/**
 * Transactions Repository
 * Pure database operations for transactions table
 */

import { getSupabase } from "../supabase.js";
import { Tables } from "../database.types.js";

export type TransactionRow = Tables<"transactions">;

export interface Transaction {
  transactionId: string;
  accountId: string;
  itemId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  name: string;
  amount: number;
  plaidCategory: string[] | null;
  pending: boolean;
  customCategory: string | null;
  categorizedAt: Date | null;
  budgetIds: string[] | null;
  budgetsUpdatedAt: Date | null;
  accountName: string | null;
  institutionName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Upsert transactions (insert new or update existing)
 */
export async function upsertTransactions(
  transactions: Omit<Transaction, "createdAt" | "updatedAt">[]
): Promise<void> {
  console.log(`[REPO/TRANSACTIONS] Upserting ${transactions.length} transactions`);

  const rows = transactions.map((tx) => ({
    transaction_id: tx.transactionId,
    account_id: tx.accountId,
    item_id: tx.itemId,
    user_id: tx.userId,
    date: tx.date,
    name: tx.name,
    amount: tx.amount,
    plaid_category: tx.plaidCategory,
    pending: tx.pending,
    custom_category: tx.customCategory,
    categorized_at: tx.categorizedAt?.toISOString(),
    budget_ids: tx.budgetIds,
    budgets_updated_at: tx.budgetsUpdatedAt?.toISOString(),
    account_name: tx.accountName,
    institution_name: tx.institutionName,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await getSupabase()
    .from("transactions")
    .upsert(rows, {
      onConflict: "transaction_id",
    });

  if (error) {
    console.error("[REPO/TRANSACTIONS] Upsert error:", error);
    throw new Error(`Failed to upsert transactions: ${error.message}`);
  }

  console.log(`[REPO/TRANSACTIONS] Successfully upserted ${transactions.length} transactions`);
}

/**
 * Get all transactions for a user within date range
 */
export async function findTransactionsByUserId(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  console.log(`[REPO/TRANSACTIONS] Fetching transactions for user ${userId}`);

  let query = getSupabase()
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (startDate) {
    query = query.gte("date", startDate);
  }

  if (endDate) {
    query = query.lte("date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[REPO/TRANSACTIONS] Query error:", error);
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  console.log(`[REPO/TRANSACTIONS] Found ${data?.length || 0} transactions`);

  return (data || []).map(rowToTransaction);
}

/**
 * Get transactions matching a specific budget
 */
export async function findTransactionsByBudgetId(
  userId: string,
  budgetId: string,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  console.log(`[REPO/TRANSACTIONS] Fetching transactions for budget ${budgetId}`);

  let query = getSupabase()
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .contains("budget_ids", [budgetId])
    .order("date", { ascending: false });

  if (startDate) {
    query = query.gte("date", startDate);
  }

  if (endDate) {
    query = query.lte("date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[REPO/TRANSACTIONS] Query error:", error);
    throw new Error(`Failed to fetch budget transactions: ${error.message}`);
  }

  console.log(`[REPO/TRANSACTIONS] Found ${data?.length || 0} transactions for budget`);

  return (data || []).map(rowToTransaction);
}

/**
 * Get transactions that need categorization (custom_category is null)
 */
export async function findUncategorizedTransactions(
  userId: string
): Promise<Transaction[]> {
  console.log(`[REPO/TRANSACTIONS] Fetching uncategorized transactions for user ${userId}`);

  const { data, error } = await getSupabase()
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .is("custom_category", null)
    .order("date", { ascending: false });

  if (error) {
    console.error("[REPO/TRANSACTIONS] Query error:", error);
    throw new Error(`Failed to fetch uncategorized transactions: ${error.message}`);
  }

  console.log(`[REPO/TRANSACTIONS] Found ${data?.length || 0} uncategorized transactions`);

  return (data || []).map(rowToTransaction);
}

/**
 * Update categorization for specific transactions
 */
export async function updateTransactionCategories(
  updates: { transactionId: string; customCategory: string }[]
): Promise<void> {
  console.log(`[REPO/TRANSACTIONS] Updating categories for ${updates.length} transactions`);

  const promises = updates.map((update) =>
    getSupabase()
      .from("transactions")
      .update({
        custom_category: update.customCategory,
        categorized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", update.transactionId)
  );

  const results = await Promise.all(promises);

  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    console.error("[REPO/TRANSACTIONS] Update errors:", errors);
    throw new Error(
      `Failed to update categories: ${errors.map((e) => e.error?.message).join(", ")}`
    );
  }

  console.log(`[REPO/TRANSACTIONS] Successfully updated ${updates.length} categories`);
}

/**
 * Update budget associations for a transaction
 */
export async function updateTransactionBudgets(
  transactionId: string,
  budgetIds: string[]
): Promise<void> {
  const { error } = await getSupabase()
    .from("transactions")
    .update({
      budget_ids: budgetIds,
      budgets_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("transaction_id", transactionId);

  if (error) {
    console.error("[REPO/TRANSACTIONS] Update budget error:", error);
    throw new Error(`Failed to update budget associations: ${error.message}`);
  }
}

/**
 * Update budget associations for multiple transactions (batch operation)
 */
export async function batchUpdateTransactionBudgets(
  updates: { transactionId: string; budgetIds: string[] }[]
): Promise<void> {
  console.log(`[REPO/TRANSACTIONS] Batch updating budgets for ${updates.length} transactions`);

  const promises = updates.map((update) =>
    updateTransactionBudgets(update.transactionId, update.budgetIds)
  );

  await Promise.all(promises);

  console.log(`[REPO/TRANSACTIONS] Successfully updated budgets for ${updates.length} transactions`);
}

/**
 * Delete all transactions for a user (when disconnecting accounts)
 */
export async function deleteTransactionsByUserId(userId: string): Promise<void> {
  console.log(`[REPO/TRANSACTIONS] Deleting all transactions for user ${userId}`);

  const { error } = await getSupabase()
    .from("transactions")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[REPO/TRANSACTIONS] Delete error:", error);
    throw new Error(`Failed to delete transactions: ${error.message}`);
  }

  console.log(`[REPO/TRANSACTIONS] Successfully deleted transactions`);
}

/**
 * Delete transactions for a specific item (when disconnecting an institution)
 */
export async function deleteTransactionsByItemId(itemId: string): Promise<void> {
  console.log(`[REPO/TRANSACTIONS] Deleting transactions for item ${itemId}`);

  const { error } = await getSupabase()
    .from("transactions")
    .delete()
    .eq("item_id", itemId);

  if (error) {
    console.error("[REPO/TRANSACTIONS] Delete error:", error);
    throw new Error(`Failed to delete transactions: ${error.message}`);
  }

  console.log(`[REPO/TRANSACTIONS] Successfully deleted transactions for item`);
}

/**
 * Convert database row to Transaction object
 */
function rowToTransaction(row: TransactionRow): Transaction {
  return {
    transactionId: row.transaction_id,
    accountId: row.account_id,
    itemId: row.item_id,
    userId: row.user_id,
    date: row.date,
    name: row.name,
    amount: parseFloat(row.amount.toString()),
    plaidCategory: row.plaid_category as string[] | null,
    pending: row.pending,
    customCategory: row.custom_category,
    categorizedAt: row.categorized_at ? new Date(row.categorized_at) : null,
    budgetIds: row.budget_ids,
    budgetsUpdatedAt: row.budgets_updated_at
      ? new Date(row.budgets_updated_at)
      : null,
    accountName: row.account_name,
    institutionName: row.institution_name,
    createdAt: new Date(row.created_at || new Date()),
    updatedAt: new Date(row.updated_at || new Date()),
  };
}
