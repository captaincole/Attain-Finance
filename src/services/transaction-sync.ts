/**
 * Transaction Sync Service
 * Handles syncing transactions from Plaid using /transactions/sync endpoint
 * Supports pagination, cursor management, and categorization
 */

import { PlaidApi } from "plaid";
import { SupabaseClient } from "@supabase/supabase-js";
import { AccountSyncStateRepository } from "../storage/repositories/account-sync-state.js";
import { upsertTransactions } from "../storage/repositories/transactions.js";
import { getAccountsByItemId } from "../storage/repositories/accounts.js";
import {
  categorizeTransactions,
  TransactionForCategorization,
  ClaudeClient,
} from "../utils/clients/claude.js";
import {
  labelTransactionArrayForBudgets,
  TransactionForBudgetLabeling,
} from "../utils/budget-labeling.js";
import { getBudgets } from "../storage/budgets/budgets.js";
import { logServiceEvent, serializeError } from "../utils/logger.js";

interface TransactionSyncOptions {
  accountId: string;
  accessToken: string;
  userId: string;
  itemId: string;
}

export class TransactionSyncService {
  private syncStateRepo: AccountSyncStateRepository;
  private claudeClient?: ClaudeClient;

  constructor(
    private plaidClient: PlaidApi,
    supabase: SupabaseClient,
    claudeClient?: ClaudeClient
  ) {
    this.syncStateRepo = new AccountSyncStateRepository(supabase);
    this.claudeClient = claudeClient;
  }

  /**
   * Sync transactions for a single account
   * Handles pagination, cursor management, and categorization
   */
  async syncAccountTransactions(
    options: TransactionSyncOptions
  ): Promise<void> {
    const { accountId, accessToken, userId, itemId } = options;

    logServiceEvent("transaction-sync", "account-sync-start", {
      accountId,
      userId,
      itemId,
    });

    try {
      // Get current cursor from database FIRST (before updating status)
      const syncState = await this.syncStateRepo.getSyncState(accountId);
      let cursor = syncState?.transaction_cursor || undefined;

      logServiceEvent("transaction-sync", "cursor-start", {
        accountId,
        cursorPreview: cursor ? `${cursor.substring(0, 30)}...` : null,
      });

      // Mark sync as in progress (preserve existing cursor)
      await this.syncStateRepo.updateSyncProgress(
        accountId,
        cursor || "", // Keep existing cursor
        "syncing",
        0
      );

      let hasMore = true;
      let pageCount = 0;
      let totalAdded = 0;
      let totalModified = 0;
      let totalRemoved = 0;

      // Track all synced transactions for budget labeling
      const allSyncedTransactions: TransactionForBudgetLabeling[] = [];

      // Paginate through all transactions
      while (hasMore) {
        pageCount++;
        logServiceEvent("transaction-sync", "page-fetch", {
          accountId,
          page: pageCount,
          cursorPreview: cursor ? `${cursor.substring(0, 20)}...` : null,
        });

        // Call Plaid /transactions/sync
        const response = await this.plaidClient.transactionsSync({
          access_token: accessToken,
          cursor: cursor,
          count: 500, // Max per page
          options: {
            include_original_description: false,
            account_id: accountId, // Filter to specific account
          },
        });

        const { added, modified, removed, next_cursor, has_more } =
          response.data;

        logServiceEvent("transaction-sync", "page-summary", {
          accountId,
          page: pageCount,
          added: added.length,
          modified: modified.length,
          removed: removed.length,
        });

        // Get account info for enrichment (if we have any transactions)
        let account: any = null;
        if (added.length > 0 || modified.length > 0) {
          const accounts = await getAccountsByItemId(userId, itemId);
          account = accounts.find((a) => a.account_id === accountId);
        }

        // Only categorize NEWLY ADDED transactions (not modified ones)
        // Modified transactions already have categories from when they were first added
        const categorizedAdded: any[] = [];
        if (added.length > 0) {
          const forCategorization: TransactionForCategorization[] =
            added.map((tx) => ({
              date: tx.date,
              description: tx.name,
              amount: Math.abs(tx.amount).toFixed(2),
              category: tx.personal_finance_category?.primary || undefined,
              account_name: account?.name,
              pending: tx.pending ? "true" : "false",
            }));

          logServiceEvent("transaction-sync", "categorize-added", {
            accountId,
            page: pageCount,
            addedCount: added.length,
          });

          const result = await categorizeTransactions(forCategorization, undefined, this.claudeClient);
          categorizedAdded.push(...result);
        }

        // Build database objects for added transactions (with AI categorization)
        const addedForDb = added.map((tx, idx) => ({
          transactionId: tx.transaction_id,
          accountId: tx.account_id,
          itemId: itemId,
          userId: userId,
          date: tx.date,
          name: tx.name,
          amount: tx.amount,
          plaidCategory: tx.personal_finance_category
            ? [
                tx.personal_finance_category.primary,
                tx.personal_finance_category.detailed,
              ]
            : null,
          pending: tx.pending,
          customCategory: categorizedAdded[idx]?.custom_category || null,
          categorizedAt: categorizedAdded[idx]?.custom_category
            ? new Date()
            : null,
          budgetIds: null, // Budget labeling happens separately
          budgetsUpdatedAt: null,
          accountName: account?.name || null,
          institutionName: null, // Could be enriched later
        }));

        // Build database objects for modified transactions (NO re-categorization)
        const modifiedForDb = modified.map((tx) => ({
          transactionId: tx.transaction_id,
          accountId: tx.account_id,
          itemId: itemId,
          userId: userId,
          date: tx.date,
          name: tx.name,
          amount: tx.amount,
          plaidCategory: tx.personal_finance_category
            ? [
                tx.personal_finance_category.primary,
                tx.personal_finance_category.detailed,
              ]
            : null,
          pending: tx.pending,
          // Keep existing categorization - upsert will preserve these fields
          customCategory: null, // Will be ignored by upsert if already exists
          categorizedAt: null, // Will be ignored by upsert if already exists
          budgetIds: null,
          budgetsUpdatedAt: null,
          accountName: account?.name || null,
          institutionName: null,
        }));

        // Upsert both added and modified transactions to database
        const allTransactions = [...addedForDb, ...modifiedForDb];
        if (allTransactions.length > 0) {
          await upsertTransactions(allTransactions);

          // Track these transactions for budget labeling later
          allSyncedTransactions.push(
            ...allTransactions.map((tx) => ({
              transactionId: tx.transactionId,
              date: tx.date,
              name: tx.name,
              amount: tx.amount,
              customCategory: tx.customCategory,
              accountName: tx.accountName,
              pending: tx.pending,
            }))
          );
        }

        // Handle removed transactions (delete from database)
        if (removed.length > 0) {
          logServiceEvent("transaction-sync", "remove-transactions", {
            accountId,
            page: pageCount,
            removedCount: removed.length,
          });
          // TODO: Implement transaction deletion
          // For now, we'll skip this as it's rare and can be handled later
        }

        // Update cursor and counters
        cursor = next_cursor;
        hasMore = has_more;
        totalAdded += added.length;
        totalModified += modified.length;
        totalRemoved += removed.length;

        // Update sync state after each page
        await this.syncStateRepo.updateSyncProgress(
          accountId,
          next_cursor,
          "syncing",
          added.length + modified.length
        );
      }

      // Mark sync as complete
      await this.syncStateRepo.markSyncComplete(accountId, cursor || "");

      logServiceEvent("transaction-sync", "account-sync-complete", {
        accountId,
        userId,
        itemId,
        added: totalAdded,
        modified: totalModified,
        removed: totalRemoved,
        pages: pageCount,
      });

      // Label synced transactions for budgets
      if (allSyncedTransactions.length > 0) {
        logServiceEvent("transaction-sync", "budget-labeling-start", {
          userId,
          transactionCount: allSyncedTransactions.length,
        });

        try {
          const budgets = await getBudgets(userId);
          if (budgets.length > 0) {
            await labelTransactionArrayForBudgets(
              allSyncedTransactions,
              budgets,
              this.claudeClient
            );
          } else {
            logServiceEvent("transaction-sync", "budget-labeling-skip", {
              userId,
              reason: "no-budgets",
            });
          }
        } catch (error: any) {
          logServiceEvent(
            "transaction-sync",
            "budget-labeling-error",
            { userId, error: serializeError(error) },
            "warn"
          );
          // Don't throw - budget labeling failure shouldn't fail the entire sync
        }
      }
    } catch (error: any) {
      logServiceEvent(
        "transaction-sync",
        "account-sync-error",
        { accountId, userId, itemId, error: serializeError(error) },
        "error"
      );

      // Mark sync as failed
      await this.syncStateRepo.markSyncError(accountId, error.message);

      throw error;
    }
  }

  /**
   * Initiate sync for all accounts in a connection
   * Called from OAuth callback after account connection
   */
  async initiateSyncForConnection(
    itemId: string,
    userId: string,
    accessToken: string
  ): Promise<void> {
    logServiceEvent("transaction-sync", "connection-sync-start", {
      itemId,
      userId,
    });

    try {
      // Get all accounts for this connection
      const accounts = await getAccountsByItemId(userId, itemId);

      logServiceEvent("transaction-sync", "connection-accounts-found", {
        itemId,
        accountCount: accounts.length,
      });

      // Create sync state records for each account
      for (const account of accounts) {
        try {
          await this.syncStateRepo.createSyncState(account.account_id);
          logServiceEvent("transaction-sync", "sync-state-created", {
            itemId,
            accountId: account.account_id,
          });
        } catch (error: any) {
          // Ignore duplicate key errors (sync state already exists)
          if (!error.message.includes("duplicate")) {
            throw error;
          }
        }
      }

      // Sync each account independently
      // We could parallelize this, but sequential is safer for MVP
      for (const account of accounts) {
        try {
          await this.syncAccountTransactions({
            accountId: account.account_id,
            accessToken,
            userId,
            itemId,
          });
        } catch (error: any) {
          // Log error but continue syncing other accounts
          logServiceEvent(
            "transaction-sync",
            "account-sync-warning",
            { accountId: account.account_id, itemId, error: serializeError(error) },
            "warn"
          );
        }
      }

      logServiceEvent("transaction-sync", "connection-sync-complete", {
        itemId,
        userId,
      });
    } catch (error: any) {
      logServiceEvent(
        "transaction-sync",
        "connection-sync-error",
        { itemId, userId, error: serializeError(error) },
        "error"
      );
      throw error;
    }
  }
}
