/**
 * Transactions Repository
 * Pure database operations for transactions table
 */

import { getSupabase } from "../supabase.js";
import { Tables } from "../database.types.js";
import { logEvent } from "../../utils/logger.js";

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
  logEvent("REPO/TRANSACTIONS", "upserting", { count: transactions.length });

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
    logEvent("REPO/TRANSACTIONS", "upsert-error", { error: error.message }, "error");
    throw new Error(`Failed to upsert transactions: ${error.message}`);
  }

  logEvent("REPO/TRANSACTIONS", "upserted", { count: transactions.length });
}

/**
 * Delete transactions by transaction IDs
 * Used when Plaid reports transactions as removed
 */
export async function deleteTransactions(
  transactionIds: string[]
): Promise<void> {
  if (transactionIds.length === 0) {
    return;
  }

  logEvent("REPO/TRANSACTIONS", "deleting", { count: transactionIds.length });

  const { error } = await getSupabase()
    .from("transactions")
    .delete()
    .in("transaction_id", transactionIds);

  if (error) {
    logEvent("REPO/TRANSACTIONS", "delete-error", { error: error.message }, "error");
    throw new Error(`Failed to delete transactions: ${error.message}`);
  }

  logEvent("REPO/TRANSACTIONS", "deleted", { count: transactionIds.length });
}

export interface FindTransactionsFilters {
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  categories?: string[];
  budgetId?: string;
  pendingOnly?: boolean;
  excludePending?: boolean;
}

/**
 * Get all transactions for a user within date range with optional filters
 */
export async function findTransactionsByUserId(
  userId: string,
  startDate?: string,
  endDate?: string,
  filters?: FindTransactionsFilters
): Promise<Transaction[]> {
  logEvent("REPO/TRANSACTIONS", "fetching-user-transactions", { userId, startDate, endDate, filters });

  let query = getSupabase()
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  // Apply date filters (use filters object if provided, otherwise use direct parameters)
  const effectiveStartDate = filters?.startDate || startDate;
  const effectiveEndDate = filters?.endDate || endDate;

  if (effectiveStartDate) {
    query = query.gte("date", effectiveStartDate);
  }

  if (effectiveEndDate) {
    query = query.lte("date", effectiveEndDate);
  }

  // Apply account filter
  if (filters?.accountIds && filters.accountIds.length > 0) {
    query = query.in("account_id", filters.accountIds);
  }

  // Apply category filter (case-insensitive partial match)
  // Since categories are AI-generated and user-defined, we use fuzzy matching
  if (filters?.categories && filters.categories.length > 0) {
    // Build OR condition for categories using PostgREST syntax
    // PostgREST uses * as wildcard for ilike (not %)
    const categoryConditions = filters.categories
      .map((cat) => `custom_category.ilike.*${cat}*`)
      .join(",");

    // Use .or() which creates: WHERE existing_filters AND (cat1 OR cat2 OR cat3)
    query = query.or(categoryConditions);
  }

  // Apply budget filter
  if (filters?.budgetId) {
    query = query.contains("budget_ids", [filters.budgetId]);
  }

  // Apply pending status filter
  if (filters?.pendingOnly) {
    query = query.eq("pending", true);
  } else if (filters?.excludePending) {
    query = query.eq("pending", false);
  }

  const { data, error } = await query;

  if (error) {
    logEvent("REPO/TRANSACTIONS", "query-error", { error: error.message }, "error");
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  logEvent("REPO/TRANSACTIONS", "found-transactions", { count: data?.length || 0 });

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
  logEvent("REPO/TRANSACTIONS", "fetching-budget-transactions", { userId, budgetId, startDate, endDate });

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
    logEvent("REPO/TRANSACTIONS", "query-error", { error: error.message }, "error");
    throw new Error(`Failed to fetch budget transactions: ${error.message}`);
  }

  logEvent("REPO/TRANSACTIONS", "found-budget-transactions", { count: data?.length || 0 });

  return (data || []).map(rowToTransaction);
}

/**
 * Get transactions that need categorization (custom_category is null)
 */
export async function findUncategorizedTransactions(
  userId: string
): Promise<Transaction[]> {
  logEvent("REPO/TRANSACTIONS", "fetching-uncategorized", { userId });

  const { data, error } = await getSupabase()
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .is("custom_category", null)
    .order("date", { ascending: false });

  if (error) {
    logEvent("REPO/TRANSACTIONS", "query-error", { error: error.message }, "error");
    throw new Error(`Failed to fetch uncategorized transactions: ${error.message}`);
  }

  logEvent("REPO/TRANSACTIONS", "found-uncategorized", { count: data?.length || 0 });

  return (data || []).map(rowToTransaction);
}

/**
 * Update categorization for specific transactions
 */
export async function updateTransactionCategories(
  updates: { transactionId: string; customCategory: string }[]
): Promise<void> {
  logEvent("REPO/TRANSACTIONS", "updating-categories", { count: updates.length });

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
    logEvent("REPO/TRANSACTIONS", "update-errors", { errorCount: errors.length, errors: errors.map((e) => e.error?.message) }, "error");
    throw new Error(
      `Failed to update categories: ${errors.map((e) => e.error?.message).join(", ")}`
    );
  }

  logEvent("REPO/TRANSACTIONS", "updated-categories", { count: updates.length });
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
    logEvent("REPO/TRANSACTIONS", "update-budget-error", { error: error.message }, "error");
    throw new Error(`Failed to update budget associations: ${error.message}`);
  }
}

/**
 * Update budget associations for multiple transactions (batch operation)
 */
export async function batchUpdateTransactionBudgets(
  updates: { transactionId: string; budgetIds: string[] }[]
): Promise<void> {
  logEvent("REPO/TRANSACTIONS", "batch-updating-budgets", { count: updates.length });

  const promises = updates.map((update) =>
    updateTransactionBudgets(update.transactionId, update.budgetIds)
  );

  await Promise.all(promises);

  logEvent("REPO/TRANSACTIONS", "batch-updated-budgets", { count: updates.length });
}

/**
 * Delete all transactions for a user (when disconnecting accounts)
 */
export async function deleteTransactionsByUserId(userId: string): Promise<void> {
  logEvent("REPO/TRANSACTIONS", "deleting-user-transactions", { userId });

  const { error } = await getSupabase()
    .from("transactions")
    .delete()
    .eq("user_id", userId);

  if (error) {
    logEvent("REPO/TRANSACTIONS", "delete-error", { error: error.message }, "error");
    throw new Error(`Failed to delete transactions: ${error.message}`);
  }

  logEvent("REPO/TRANSACTIONS", "deleted-transactions", { userId });
}

/**
 * Delete transactions for a specific item (when disconnecting an institution)
 */
export async function deleteTransactionsByItemId(itemId: string): Promise<void> {
  logEvent("REPO/TRANSACTIONS", "deleting-item-transactions", { itemId });

  const { error } = await getSupabase()
    .from("transactions")
    .delete()
    .eq("item_id", itemId);

  if (error) {
    logEvent("REPO/TRANSACTIONS", "delete-error", { error: error.message }, "error");
    throw new Error(`Failed to delete transactions: ${error.message}`);
  }

  logEvent("REPO/TRANSACTIONS", "deleted-item-transactions", { itemId });
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
