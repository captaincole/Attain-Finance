/**
 * Budget Processing Worker
 * Handles asynchronous transaction labeling for budgets
 */

import { Budget } from "../storage/budgets/budgets.js";
import {
  markBudgetAsProcessing,
  markBudgetAsReady,
  markBudgetAsError,
} from "../storage/budgets/budgets.js";
import { labelTransactionsForSingleBudget } from "./budget-labeling.js";

/**
 * Process a budget asynchronously (labels transactions in background)
 * This function is fire-and-forget - it updates status in database when complete
 */
export async function processBudgetAsync(
  userId: string,
  budget: Budget
): Promise<void> {
  console.log(`[BUDGET-WORKER] Starting async processing for budget ${budget.id}`);

  try {
    // Mark as processing
    await markBudgetAsProcessing(budget.id);

    // Label transactions (this is the slow part that uses Claude API)
    const matchingCount = await labelTransactionsForSingleBudget(userId, budget);

    console.log(`[BUDGET-WORKER] Labeling complete for ${budget.id}: ${matchingCount} transactions matched`);

    // Mark as ready
    await markBudgetAsReady(budget.id);

    console.log(`[BUDGET-WORKER] Budget ${budget.id} processing complete`);
  } catch (error: any) {
    console.error(`[BUDGET-WORKER] Error processing budget ${budget.id}:`, error);

    // Mark as error
    await markBudgetAsError(budget.id, error.message || "Unknown error");
  }
}

/**
 * Start processing a budget in the background
 * Returns immediately while processing continues
 */
export function startBudgetProcessing(
  userId: string,
  budget: Budget
): void {
  // Fire and forget - don't await
  processBudgetAsync(userId, budget).catch((error) => {
    console.error(`[BUDGET-WORKER] Unhandled error in async processing:`, error);
  });

  console.log(`[BUDGET-WORKER] Background processing started for budget ${budget.id}`);
}
