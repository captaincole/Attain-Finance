/**
 * Recategorization Service
 * Handles async recategorization of all user transactions when rules are updated
 * Uses fire-and-forget pattern similar to transaction sync
 */

import { findTransactionsByUserId, updateTransactionCategories } from "../storage/repositories/transactions.js";
import { categorizeTransactions, TransactionForCategorization } from "../utils/clients/claude.js";

/**
 * Recategorize all transactions for a user with new rules
 * Runs asynchronously in background - does not throw errors
 */
export async function recategorizeAllTransactions(
  userId: string,
  rules: string
): Promise<void> {
  console.log(`[RECATEGORIZATION-SERVICE] Starting recategorization for user ${userId}`);

  try {
    // Fetch all transactions for user
    const allTransactions = await findTransactionsByUserId(userId);

    if (allTransactions.length === 0) {
      console.log(`[RECATEGORIZATION-SERVICE] No transactions to recategorize for user ${userId}`);
      return;
    }

    console.log(`[RECATEGORIZATION-SERVICE] Found ${allTransactions.length} transactions to recategorize`);

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
    console.log(`[RECATEGORIZATION-SERVICE] Calling categorization API for ${txsForCategorization.length} transactions`);
    const categorized = await categorizeTransactions(txsForCategorization, rules);

    // Prepare updates
    const updates = categorized.map((tx, index) => ({
      transactionId: allTransactions[index].transactionId,
      customCategory: tx.custom_category,
    }));

    console.log(`[RECATEGORIZATION-SERVICE] Updating ${updates.length} transactions in database`);

    // Update all transactions in database
    await updateTransactionCategories(updates);

    console.log(
      `[RECATEGORIZATION-SERVICE] ✓ Recategorization complete for user ${userId}: ${updates.length} transactions updated`
    );
  } catch (error: any) {
    // Fail silently - just log the error
    console.error(
      `[RECATEGORIZATION-SERVICE] ✗ Recategorization failed for user ${userId}:`,
      error.message
    );
    console.error(`[RECATEGORIZATION-SERVICE] Error details:`, error);
  }
}
