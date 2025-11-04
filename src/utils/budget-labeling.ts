/**
 * Budget Labeling Utility
 * Uses Claude API to determine which budgets each transaction matches
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  findTransactionsByUserId,
  batchUpdateTransactionBudgets,
} from "../storage/repositories/transactions.js";
import { Budget } from "../storage/budgets/budgets.js";
import {
  filterTransactionsForBudget,
  TransactionForBudgetFilter,
  ClaudeClient,
} from "./clients/claude.js";
import { logEvent } from "./logger.js";
import type { Database } from "../storage/database.types.js";

/**
 * Minimal transaction shape needed for budget labeling
 */
export interface TransactionForBudgetLabeling {
  transactionId: string;
  date: string;
  name: string;
  amount: number;
  customCategory: string | null;
  accountName: string | null;
  pending: boolean;
}

/**
 * Label specific transactions for budgets
 * Takes an array of transactions and labels them for all budgets
 * Used during transaction sync to label only new/modified transactions
 */
export async function labelTransactionArrayForBudgets(
  transactions: TransactionForBudgetLabeling[],
  budgets: Budget[],
  supabaseClient: SupabaseClient<Database>,
  claudeClient?: ClaudeClient
): Promise<void> {
  logEvent("BUDGET-LABELING", "start", { transactionCount: transactions.length, budgetCount: budgets.length });

  if (transactions.length === 0) {
    logEvent("BUDGET-LABELING", "no-transactions");
    return;
  }

  if (budgets.length === 0) {
    logEvent("BUDGET-LABELING", "no-budgets-skipping");
    return;
  }

  // Map: transaction_id -> Set<budget_id>
  const transactionBudgetMap = new Map<string, Set<string>>();

  // For each budget, filter transactions using Claude
  for (const budget of budgets) {
    logEvent("BUDGET-LABELING", "processing-budget", { budgetId: budget.id, budgetTitle: budget.title });

    // Prepare transactions for budget filter
    const txsForFilter: TransactionForBudgetFilter[] = transactions.map(
      (tx) => ({
        id: tx.transactionId,
        date: tx.date,
        description: tx.name,
        amount: tx.amount,
        category: tx.customCategory || "Uncategorized",
        account_name: tx.accountName || "",
        pending: tx.pending,
      })
    );

    try {
      // Call Claude API to filter
      const filterResults = await filterTransactionsForBudget(
        txsForFilter,
        budget.filter_prompt,
        claudeClient
      );

      // Add budget ID to matching transactions
      let matchCount = 0;
      for (const result of filterResults) {
        if (result.matches) {
          if (!transactionBudgetMap.has(result.transaction_id)) {
            transactionBudgetMap.set(result.transaction_id, new Set());
          }
          transactionBudgetMap.get(result.transaction_id)!.add(budget.id);
          matchCount++;
        }
      }

      logEvent("BUDGET-LABELING", "budget-matches", { budgetId: budget.id, budgetTitle: budget.title, matchCount });
    } catch (error: any) {
      logEvent("BUDGET-LABELING", "filter-error", { budgetId: budget.id, error: error.message }, "error");
      // Continue with other budgets
    }
  }

  // Update database with budget associations
  const updates = transactions.map((tx) => ({
    transactionId: tx.transactionId,
    budgetIds: Array.from(transactionBudgetMap.get(tx.transactionId) || []),
  }));

  await batchUpdateTransactionBudgets(updates, supabaseClient);

  const txsWithBudgets = updates.filter((u) => u.budgetIds.length > 0).length;
  logEvent("BUDGET-LABELING", "complete", { labeledCount: txsWithBudgets, totalCount: transactions.length });
}

/**
 * Label all transactions for all budgets
 * Returns count of transactions updated
 */
export async function labelTransactionsForBudgets(
  userId: string,
  budgets: Budget[],
  supabaseClient: SupabaseClient<Database>,
  claudeClient?: ClaudeClient
): Promise<number> {
  logEvent("BUDGET-LABELING", "starting-full-relabel", { userId, budgetCount: budgets.length });

  // Fetch all user transactions from database
  const allTransactions = await findTransactionsByUserId(userId, supabaseClient);

  logEvent("BUDGET-LABELING", "processing-all-transactions", { userId, transactionCount: allTransactions.length, budgetCount: budgets.length });

  if (allTransactions.length === 0) {
    logEvent("BUDGET-LABELING", "no-transactions");
    return 0;
  }

  if (budgets.length === 0) {
    logEvent("BUDGET-LABELING", "no-budgets-clearing-labels");

    // Clear budget_ids for all transactions
    const updates = allTransactions.map((tx) => ({
      transactionId: tx.transactionId,
      budgetIds: [],
    }));

    await batchUpdateTransactionBudgets(updates, supabaseClient);
    return allTransactions.length;
  }

  // Map: transaction_id -> Set<budget_id>
  const transactionBudgetMap = new Map<string, Set<string>>();

  // For each budget, filter transactions using Claude
  for (const budget of budgets) {
    logEvent("BUDGET-LABELING", "processing-budget", { budgetId: budget.id, budgetTitle: budget.title });

    // Prepare transactions for budget filter
    const txsForFilter: TransactionForBudgetFilter[] = allTransactions.map((tx) => ({
      id: tx.transactionId,
      date: tx.date,
      description: tx.name,
      amount: tx.amount,
      category: tx.customCategory || "Uncategorized",
      account_name: tx.accountName || "",
      pending: tx.pending,
    }));

    try {
      // Call existing Claude API filter function
      const filterResults = await filterTransactionsForBudget(
        txsForFilter,
        budget.filter_prompt,
        claudeClient
      );

      // Add budget ID to matching transactions
      let matchCount = 0;
      for (const result of filterResults) {
        if (result.matches) {
          if (!transactionBudgetMap.has(result.transaction_id)) {
            transactionBudgetMap.set(result.transaction_id, new Set());
          }
          transactionBudgetMap.get(result.transaction_id)!.add(budget.id);
          matchCount++;
        }
      }

      logEvent("BUDGET-LABELING", "budget-matches", { budgetId: budget.id, budgetTitle: budget.title, matchCount });
    } catch (error: any) {
      logEvent("BUDGET-LABELING", "filter-error", { budgetId: budget.id, error: error.message }, "error");
      // Continue with other budgets
    }
  }

  // Update database with budget associations
  const updates = allTransactions.map((tx) => ({
    transactionId: tx.transactionId,
    budgetIds: Array.from(transactionBudgetMap.get(tx.transactionId) || []),
  }));

  await batchUpdateTransactionBudgets(updates, supabaseClient);

  const txsWithBudgets = updates.filter((u) => u.budgetIds.length > 0).length;
  logEvent("BUDGET-LABELING", "complete", { labeledCount: txsWithBudgets, totalCount: allTransactions.length });

  return txsWithBudgets;
}

/**
 * Label transactions for a single budget (used when creating/updating a budget)
 * Returns count of transactions that match this budget
 */
export async function labelTransactionsForSingleBudget(
  userId: string,
  budget: Budget,
  supabaseClient: SupabaseClient<Database>,
  claudeClient?: ClaudeClient
): Promise<number> {
  logEvent("BUDGET-LABELING", "labeling-single-budget", { userId, budgetId: budget.id, budgetTitle: budget.title });

  // Fetch all user transactions from database
  const allTransactions = await findTransactionsByUserId(userId, supabaseClient);

  if (allTransactions.length === 0) {
    logEvent("BUDGET-LABELING", "no-transactions");
    return 0;
  }

  // Prepare transactions for budget filter
  const txsForFilter: TransactionForBudgetFilter[] = allTransactions.map((tx) => ({
    id: tx.transactionId,
    date: tx.date,
    description: tx.name,
    amount: tx.amount,
    category: tx.customCategory || "Uncategorized",
    account_name: tx.accountName || "",
    pending: tx.pending,
  }));

  // Call Claude API to filter
  const filterResults = await filterTransactionsForBudget(
    txsForFilter,
    budget.filter_prompt,
    claudeClient
  );

  // Build set of matching transaction IDs
  const matchingTxIds = new Set(
    filterResults.filter((r) => r.matches).map((r) => r.transaction_id)
  );

  // Update database: add/remove this budget ID from budget_ids arrays
  const updates = allTransactions.map((tx) => {
    const currentBudgetIds = tx.budgetIds || [];

    // Check if transaction matches this budget
    const shouldInclude = matchingTxIds.has(tx.transactionId);
    const isIncluded = currentBudgetIds.includes(budget.id);

    // Update budget_ids array
    let newBudgetIds: string[];
    if (shouldInclude && !isIncluded) {
      // Add budget ID
      newBudgetIds = [...currentBudgetIds, budget.id];
    } else if (!shouldInclude && isIncluded) {
      // Remove budget ID
      newBudgetIds = currentBudgetIds.filter((id) => id !== budget.id);
    } else {
      // No change needed
      newBudgetIds = currentBudgetIds;
    }

    return {
      transactionId: tx.transactionId,
      budgetIds: newBudgetIds,
    };
  });

  // Only update transactions that changed
  const changedUpdates = updates.filter((update, index) => {
    const original = allTransactions[index].budgetIds || [];
    return JSON.stringify(update.budgetIds) !== JSON.stringify(original);
  });

  if (changedUpdates.length > 0) {
    await batchUpdateTransactionBudgets(changedUpdates, supabaseClient);
    logEvent("BUDGET-LABELING", "updated-transactions", { count: changedUpdates.length });
  }

  logEvent("BUDGET-LABELING", "single-budget-complete", { budgetId: budget.id, budgetTitle: budget.title, matchCount: matchingTxIds.size });

  return matchingTxIds.size;
}
