/**
 * Budget Calculation Unit Tests
 *
 * Tests the core budget calculation logic:
 * 1. Sum transaction amounts
 * 2. Calculate remaining budget
 * 3. Calculate percentage spent
 * 4. Determine budget status (under/near/over)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

interface Transaction {
  id: string;
  amount: number;
  date: string;
}

/**
 * Calculate budget statistics from transactions
 * This mirrors the logic in src/tools/budgets/get-budgets.ts:202-211
 */
function calculateBudgetStats(
  transactions: Transaction[],
  budgetAmount: number
) {
  // Calculate total spent (sum of amounts)
  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  // Calculate remaining
  const remaining = budgetAmount - totalSpent;

  // Calculate percentage
  const percentage = (totalSpent / budgetAmount) * 100;

  // Determine status
  const status = percentage >= 100 ? "over" : percentage >= 70 ? "near" : "under";

  return {
    totalSpent,
    remaining,
    percentage: Math.round(percentage),
    status,
  };
}

describe("Budget Calculation Logic", () => {
  it("should correctly sum transaction amounts", () => {
    const transactions: Transaction[] = [
      { id: "tx-1", amount: 25.50, date: "2025-10-10" },
      { id: "tx-2", amount: 8.00, date: "2025-10-08" },
      { id: "tx-3", amount: 42.75, date: "2025-10-05" },
    ];

    const budgetAmount = 200.00;
    const stats = calculateBudgetStats(transactions, budgetAmount);

    // 25.50 + 8.00 + 42.75 = 76.25
    assert.strictEqual(stats.totalSpent, 76.25, "Total spent should be $76.25");
  });

  it("should correctly calculate remaining budget", () => {
    const transactions: Transaction[] = [
      { id: "tx-1", amount: 50.00, date: "2025-10-10" },
      { id: "tx-2", amount: 30.00, date: "2025-10-08" },
    ];

    const budgetAmount = 200.00;
    const stats = calculateBudgetStats(transactions, budgetAmount);

    // 200 - 80 = 120
    assert.strictEqual(stats.remaining, 120.00, "Remaining should be $120.00");
  });

  it("should correctly calculate percentage spent", () => {
    const transactions: Transaction[] = [
      { id: "tx-1", amount: 50.00, date: "2025-10-10" },
    ];

    const budgetAmount = 200.00;
    const stats = calculateBudgetStats(transactions, budgetAmount);

    // (50 / 200) * 100 = 25%
    assert.strictEqual(stats.percentage, 25, "Percentage should be 25%");
  });

  it("should return 'under' status when < 70%", () => {
    const transactions: Transaction[] = [
      { id: "tx-1", amount: 100.00, date: "2025-10-10" },
    ];

    const budgetAmount = 200.00; // 50% spent
    const stats = calculateBudgetStats(transactions, budgetAmount);

    assert.strictEqual(stats.status, "under", "Status should be 'under' at 50%");
  });

  it("should return 'near' status when >= 70% and < 100%", () => {
    const transactions: Transaction[] = [
      { id: "tx-1", amount: 150.00, date: "2025-10-10" },
    ];

    const budgetAmount = 200.00; // 75% spent
    const stats = calculateBudgetStats(transactions, budgetAmount);

    assert.strictEqual(stats.status, "near", "Status should be 'near' at 75%");
  });

  it("should return 'over' status when >= 100%", () => {
    const transactions: Transaction[] = [
      { id: "tx-1", amount: 150.00, date: "2025-10-10" },
      { id: "tx-2", amount: 75.00, date: "2025-10-08" },
    ];

    const budgetAmount = 200.00; // 112.5% spent
    const stats = calculateBudgetStats(transactions, budgetAmount);

    assert.strictEqual(stats.status, "over", "Status should be 'over' at 112%");
    assert.strictEqual(stats.percentage, 113, "Percentage should be 113% (rounded)");
    assert.strictEqual(stats.remaining, -25.00, "Remaining should be -$25.00");
  });

  it("should handle empty transaction list", () => {
    const transactions: Transaction[] = [];
    const budgetAmount = 200.00;
    const stats = calculateBudgetStats(transactions, budgetAmount);

    assert.strictEqual(stats.totalSpent, 0, "Total spent should be $0");
    assert.strictEqual(stats.remaining, 200.00, "Remaining should be $200.00");
    assert.strictEqual(stats.percentage, 0, "Percentage should be 0%");
    assert.strictEqual(stats.status, "under", "Status should be 'under'");
  });

  it("should handle decimal amounts correctly (DoorDash example)", () => {
    // Real-world example: DoorDash transactions with various decimal amounts
    const transactions: Transaction[] = [
      { id: "tx-1", amount: 25.50, date: "2025-09-18" },
      { id: "tx-2", amount: 8.00, date: "2025-09-20" },
      { id: "tx-3", amount: 42.75, date: "2025-09-22" },
      { id: "tx-4", amount: 18.99, date: "2025-09-25" },
      { id: "tx-5", amount: 31.20, date: "2025-09-28" },
    ];

    const budgetAmount = 200.00;
    const stats = calculateBudgetStats(transactions, budgetAmount);

    // 25.50 + 8.00 + 42.75 + 18.99 + 31.20 = 126.44
    assert.strictEqual(stats.totalSpent, 126.44, "Total spent should be $126.44");
    assert.strictEqual(stats.remaining, 73.56, "Remaining should be $73.56");
    assert.strictEqual(stats.percentage, 63, "Percentage should be 63% (rounded)");
    assert.strictEqual(stats.status, "under", "Status should be 'under' at 63%");
  });

  it("should handle floating point precision correctly", () => {
    // Test edge case: amounts that could cause floating point issues
    const transactions: Transaction[] = [
      { id: "tx-1", amount: 0.1, date: "2025-10-01" },
      { id: "tx-2", amount: 0.2, date: "2025-10-02" },
    ];

    const budgetAmount = 1.00;
    const stats = calculateBudgetStats(transactions, budgetAmount);

    // 0.1 + 0.2 should equal 0.3 (JavaScript floating point quirk)
    assert.ok(
      Math.abs(stats.totalSpent - 0.3) < 0.0001,
      "Total spent should be approximately $0.30"
    );
  });
});
