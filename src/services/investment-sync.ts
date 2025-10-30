/**
 * Investment Sync Service
 * Handles syncing investment holdings from Plaid using /investments/holdings/get endpoint
 * Unlike transactions, holdings use a full snapshot approach (no cursor-based incremental sync)
 */

import { PlaidApi } from "plaid";
import { SupabaseClient } from "@supabase/supabase-js";
import { upsertHoldingsForAccount } from "../storage/repositories/investment-holdings.js";
import { getAccountsByItemId } from "../storage/repositories/accounts.js";
import { AccountInvestmentSyncStateRepository } from "../storage/repositories/account-investment-sync-state.js";
import { logServiceEvent, serializeError } from "../utils/logger.js";

interface InvestmentSyncOptions {
  itemId: string;
  userId: string;
  accessToken: string;
}

export class InvestmentSyncService {
  private syncStateRepo: AccountInvestmentSyncStateRepository;

  constructor(
    private plaidClient: PlaidApi,
    supabase: SupabaseClient
  ) {
    this.syncStateRepo = new AccountInvestmentSyncStateRepository(supabase);
  }

  /**
   * Sync investment holdings for all investment accounts in a connection
   * Uses full snapshot approach - fetches all holdings and upserts to database
   */
  async syncConnectionInvestments(
    options: InvestmentSyncOptions
  ): Promise<void> {
    const { itemId, userId, accessToken } = options;

    logServiceEvent("investment-sync", "connection-sync-start", {
      itemId,
      userId,
    });

    try {
      // Get all accounts for this connection
      const accounts = await getAccountsByItemId(userId, itemId);

      // Filter to only investment accounts
      const investmentAccounts = accounts.filter(
        (account) => account.type === "investment"
      );

      if (investmentAccounts.length === 0) {
        logServiceEvent("investment-sync", "no-investment-accounts", {
          itemId,
          userId,
        });
        return;
      }

      logServiceEvent("investment-sync", "investment-accounts-found", {
        itemId,
        userId,
        accountCount: investmentAccounts.length,
      });

      // Fetch holdings from Plaid (all accounts at once)
      const holdingsResponse = await this.plaidClient.investmentsHoldingsGet({
        access_token: accessToken,
      });

      logServiceEvent("investment-sync", "holdings-fetched", {
        itemId,
        userId,
        totalHoldings: holdingsResponse.data.holdings.length,
        totalSecurities: holdingsResponse.data.securities.length,
      });

      // Create sync state records for each investment account
      for (const account of investmentAccounts) {
        try {
          await this.syncStateRepo.createSyncState(account.account_id);
        } catch (error: any) {
          // Ignore errors - sync state already exists
        }
      }

      // Upsert holdings for each investment account
      for (const account of investmentAccounts) {
        try {
          // Mark sync as in progress
          await this.syncStateRepo.markSyncInProgress(account.account_id);

          // Filter holdings for this specific account
          const accountHoldings = holdingsResponse.data.holdings.filter(
            (h) => h.account_id === account.account_id
          );

          logServiceEvent("investment-sync", "account-sync-start", {
            itemId,
            userId,
            accountId: account.account_id,
            holdingsCount: accountHoldings.length,
          });

          // Upsert holdings to database
          await upsertHoldingsForAccount(
            userId,
            account.account_id,
            accountHoldings,
            holdingsResponse.data.securities
          );

          // Mark sync as complete
          await this.syncStateRepo.markSyncComplete(
            account.account_id,
            accountHoldings.length
          );

          logServiceEvent("investment-sync", "account-sync-complete", {
            itemId,
            userId,
            accountId: account.account_id,
            holdingsCount: accountHoldings.length,
          });
        } catch (error: any) {
          // Mark sync as error
          await this.syncStateRepo.markSyncError(
            account.account_id,
            error.message
          );

          // Log error but continue syncing other accounts
          logServiceEvent(
            "investment-sync",
            "account-sync-error",
            {
              itemId,
              userId,
              accountId: account.account_id,
              error: serializeError(error),
            },
            "error"
          );
          // Don't throw - continue to next account
        }
      }

      logServiceEvent("investment-sync", "connection-sync-complete", {
        itemId,
        userId,
        investmentAccountCount: investmentAccounts.length,
      });
    } catch (error: any) {
      logServiceEvent(
        "investment-sync",
        "connection-sync-error",
        { itemId, userId, error: serializeError(error) },
        "error"
      );
      throw error;
    }
  }
}
