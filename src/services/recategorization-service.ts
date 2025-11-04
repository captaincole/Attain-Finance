/**
 * Recategorization Service
 * Handles async recategorization of all user transactions when rules are updated
 * Uses fire-and-forget pattern similar to transaction sync
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../storage/database.types.js";
import { findTransactionsByUserId, updateTransactionCategories } from "../storage/repositories/transactions.js";
import {
  categorizeTransactions,
  TransactionForCategorization,
  ClaudeClient,
} from "../utils/clients/claude.js";
import { logServiceEvent, serializeError } from "../utils/logger.js";

/**
 * Recategorize all transactions for a user with new rules
 * Runs asynchronously in background - does not throw errors
 */
export async function recategorizeAllTransactions(
  userId: string,
  rules: string,
  supabaseClient: SupabaseClient<Database>,
  claudeClient?: ClaudeClient
): Promise<void> {
  logServiceEvent("recategorization", "start", { userId });

  try {
    // Fetch all transactions for user
    const allTransactions = await findTransactionsByUserId(userId, supabaseClient);

    if (allTransactions.length === 0) {
      logServiceEvent("recategorization", "no-transactions", { userId });
      return;
    }

    logServiceEvent("recategorization", "transactions-found", {
      userId,
      count: allTransactions.length,
    });

    // Prepare transactions for categorization
    const txsForCategorization: TransactionForCategorization[] =
      allTransactions.map((tx) => ({
        date: tx.date,
        description: tx.name,
        amount: tx.amount.toString(),
        category: tx.plaidCategory?.join(", "),
        account_name: tx.accountName || undefined,
        pending: tx.pending ? "true" : "false",
      }));

    // Call Claude API with new rules
    logServiceEvent("recategorization", "categorization-request", {
      userId,
      count: txsForCategorization.length,
    });
    const categorized = await categorizeTransactions(txsForCategorization, rules, claudeClient);

    // Prepare updates
    const updates = categorized.map((tx, index) => ({
      transactionId: allTransactions[index].transactionId,
      customCategory: tx.custom_category,
    }));

    logServiceEvent("recategorization", "database-update", {
      userId,
      count: updates.length,
    });

    // Update all transactions in database
    await updateTransactionCategories(updates, supabaseClient);

    logServiceEvent("recategorization", "complete", {
      userId,
      count: updates.length,
    });
  } catch (error: any) {
    // Fail silently - just log the error
    logServiceEvent(
      "recategorization",
      "error",
      { userId, error: serializeError(error) },
      "error"
    );
  }
}
