/**
 * Budget Labeling Utility
 * Uses Claude API to determine which budgets each transaction matches
 */

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
  claudeClient?: ClaudeClient
): Promise<void> {
  console.log(
    `[BUDGET-LABELING] Labeling ${transactions.length} transactions for ${budgets.length} budgets`
  );

  if (transactions.length === 0) {
    console.log("[BUDGET-LABELING] No transactions to label");
    return;
  }

  if (budgets.length === 0) {
    console.log("[BUDGET-LABELING] No budgets defined, skipping");
    return;
  }

  // Map: transaction_id -> Set<budget_id>
  const transactionBudgetMap = new Map<string, Set<string>>();

  // For each budget, filter transactions using Claude
  for (const budget of budgets) {
    console.log(
      `[BUDGET-LABELING] Processing budget: ${budget.title} (${budget.id})`
    );

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

      console.log(
        `[BUDGET-LABELING] Budget "${budget.title}": ${matchCount} matching transactions`
      );
    } catch (error: any) {
      console.error(
        `[BUDGET-LABELING] Error filtering for budget ${budget.id}:`,
        error.message
      );
      // Continue with other budgets
    }
  }

  // Update database with budget associations
  const updates = transactions.map((tx) => ({
    transactionId: tx.transactionId,
    budgetIds: Array.from(transactionBudgetMap.get(tx.transactionId) || []),
  }));

  await batchUpdateTransactionBudgets(updates);

  const txsWithBudgets = updates.filter((u) => u.budgetIds.length > 0).length;
  console.log(
    `[BUDGET-LABELING] Complete: ${txsWithBudgets}/${transactions.length} transactions labeled`
  );
}

/**
 * Label all transactions for all budgets
 * Returns count of transactions updated
 */
export async function labelTransactionsForBudgets(
  userId: string,
  budgets: Budget[],
  claudeClient?: ClaudeClient
): Promise<number> {
  console.log(`[BUDGET-LABELING] Starting for user ${userId} with ${budgets.length} budgets`);

  // Fetch all user transactions from database
  const allTransactions = await findTransactionsByUserId(userId);

  console.log(`[BUDGET-LABELING] Processing ${allTransactions.length} transactions for ${budgets.length} budgets`);

  if (allTransactions.length === 0) {
    console.log("[BUDGET-LABELING] No transactions to label");
    return 0;
  }

  if (budgets.length === 0) {
    console.log("[BUDGET-LABELING] No budgets defined, clearing all budget labels");

    // Clear budget_ids for all transactions
    const updates = allTransactions.map((tx) => ({
      transactionId: tx.transactionId,
      budgetIds: [],
    }));

    await batchUpdateTransactionBudgets(updates);
    return allTransactions.length;
  }

  // Map: transaction_id -> Set<budget_id>
  const transactionBudgetMap = new Map<string, Set<string>>();

  // For each budget, filter transactions using Claude
  for (const budget of budgets) {
    console.log(`[BUDGET-LABELING] Processing budget: ${budget.title} (${budget.id})`);

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

      console.log(`[BUDGET-LABELING] Budget "${budget.title}": ${matchCount} matching transactions`);
    } catch (error: any) {
      console.error(`[BUDGET-LABELING] Error filtering for budget ${budget.id}:`, error.message);
      // Continue with other budgets
    }
  }

  // Update database with budget associations
  const updates = allTransactions.map((tx) => ({
    transactionId: tx.transactionId,
    budgetIds: Array.from(transactionBudgetMap.get(tx.transactionId) || []),
  }));

  await batchUpdateTransactionBudgets(updates);

  const txsWithBudgets = updates.filter((u) => u.budgetIds.length > 0).length;
  console.log(`[BUDGET-LABELING] Complete: ${txsWithBudgets}/${allTransactions.length} transactions labeled`);

  return txsWithBudgets;
}

/**
 * Label transactions for a single budget (used when creating/updating a budget)
 * Returns count of transactions that match this budget
 */
export async function labelTransactionsForSingleBudget(
  userId: string,
  budget: Budget,
  claudeClient?: ClaudeClient
): Promise<number> {
  console.log(`[BUDGET-LABELING] Labeling transactions for single budget: ${budget.title}`);

  // Fetch all user transactions from database
  const allTransactions = await findTransactionsByUserId(userId);

  if (allTransactions.length === 0) {
    console.log("[BUDGET-LABELING] No transactions to label");
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
    await batchUpdateTransactionBudgets(changedUpdates);
    console.log(`[BUDGET-LABELING] Updated ${changedUpdates.length} transactions`);
  }

  console.log(`[BUDGET-LABELING] Budget "${budget.title}": ${matchingTxIds.size} matching transactions`);

  return matchingTxIds.size;
}
