/**
 * Integration test for budget labeling during transaction sync
 * Tests that transactions are automatically labeled with matching budget IDs
 *
 * NOTE: Claude API is auto-mocked in test mode, no credits used
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { labelTransactionArrayForBudgets } from "../../src/utils/budget-labeling.js";
import { findTransactionsByUserId } from "../../src/storage/repositories/transactions.js";
import { createBudget, getBudgets, Budget } from "../../src/storage/budgets/budgets.js";
import crypto from "crypto";
import {
  createTestSupabaseClient,
  cleanupTestUser,
  createTestConnection,
  createTestTransactions,
} from "../helpers/test-db.js";

// Mock environment - mock API key for auto-mocking
process.env.ANTHROPIC_API_KEY = "mock-api-key-for-testing";

describe("Budget Labeling Integration Tests", () => {
  const supabase = createTestSupabaseClient();
  const testUserId = "test-user-budget-labeling";

  before(() => {
    setSupabaseMock(supabase);
  });

  beforeEach(async () => {
    await cleanupTestUser(supabase, testUserId);
  });

  after(async () => {
    await cleanupTestUser(supabase, testUserId);
    resetSupabase();
  });

  it("should label transactions with matching budget IDs during sync", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_1",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create transactions (Starbucks will match coffee budget)
    const transactions = [
      {
        transaction_id: "tx_starbucks_1",
        user_id: testUserId,
        item_id: "item_test_1",
        account_id: "acc_1",
        date: "2024-01-15",
        name: "Starbucks Coffee",
        amount: 5.75,
        pending: false,
      },
      {
        transaction_id: "tx_grocery_1",
        user_id: testUserId,
        item_id: "item_test_1",
        account_id: "acc_1",
        date: "2024-01-14",
        name: "Whole Foods Market",
        amount: 87.32,
        pending: false,
      },
    ];

    await createTestTransactions(supabase, transactions);

    // Create coffee budget (filter will match "Starbucks")
    const coffeeBudget = await createBudget({
      id: crypto.randomUUID(),
      user_id: testUserId,
      title: "Coffee Budget",
      filter_prompt: "Coffee shops like Starbucks and Dunkin",
      budget_amount: 100.0,
      time_period: "rolling",
      custom_period_days: 30,
      fixed_period_start_date: null,
    });

    // Label transactions for budgets
    const transactionsForLabeling = transactions.map((tx) => ({
      transactionId: tx.transaction_id,
      date: tx.date,
      name: tx.name,
      amount: tx.amount,
      customCategory: null,
      accountName: null,
      pending: tx.pending,
    }));

    await labelTransactionArrayForBudgets(transactionsForLabeling, [coffeeBudget]);

    // Verify Starbucks transaction has budget_ids array with coffee budget ID
    const updatedTransactions = await findTransactionsByUserId(testUserId);
    const starbucksTransaction = updatedTransactions.find(
      (tx) => tx.transactionId === "tx_starbucks_1"
    );

    assert(starbucksTransaction, "Starbucks transaction should exist");
    assert(Array.isArray(starbucksTransaction.budgetIds), "budget_ids should be an array");
    assert(
      starbucksTransaction.budgetIds.includes(coffeeBudget.id),
      "Starbucks transaction should include coffee budget ID"
    );

    // Verify Whole Foods does not have coffee budget
    const groceryTransaction = updatedTransactions.find(
      (tx) => tx.transactionId === "tx_grocery_1"
    );
    assert(groceryTransaction, "Grocery transaction should exist");
    assert(
      !groceryTransaction.budgetIds?.includes(coffeeBudget.id),
      "Grocery transaction should not include coffee budget ID"
    );
  });

  it("should match transactions across multiple budgets", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_2",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create transactions
    const transactions = [
      {
        transaction_id: "tx_starbucks_2",
        user_id: testUserId,
        item_id: "item_test_2",
        account_id: "acc_1",
        date: "2024-01-15",
        name: "Starbucks Coffee",
        amount: 5.75,
        pending: false,
      },
      {
        transaction_id: "tx_wholefood_2",
        user_id: testUserId,
        item_id: "item_test_2",
        account_id: "acc_1",
        date: "2024-01-14",
        name: "Whole Foods Market",
        amount: 87.32,
        pending: false,
      },
    ];

    await createTestTransactions(supabase, transactions);

    // Create 3 budgets with overlapping filters
    const coffeeBudget = await createBudget({
      id: crypto.randomUUID(),
      user_id: testUserId,
      title: "Coffee",
      filter_prompt: "Coffee shops like Starbucks",
      budget_amount: 100.0,
      time_period: "rolling",
      custom_period_days: 30,
      fixed_period_start_date: null,
    });

    const foodBudget = await createBudget({
      id: crypto.randomUUID(),
      user_id: testUserId,
      title: "Food & Dining",
      filter_prompt: "Restaurants and dining including Starbucks but not grocery stores",
      budget_amount: 500.0,
      time_period: "rolling",
      custom_period_days: 30,
      fixed_period_start_date: null,
    });

    const groceryBudget = await createBudget({
      id: crypto.randomUUID(),
      user_id: testUserId,
      title: "Groceries",
      filter_prompt: "Grocery stores including Whole Foods and Safeway",
      budget_amount: 400.0,
      time_period: "rolling",
      custom_period_days: 30,
      fixed_period_start_date: null,
    });

    // Label transactions for all budgets
    const transactionsForLabeling = transactions.map((tx) => ({
      transactionId: tx.transaction_id,
      date: tx.date,
      name: tx.name,
      amount: tx.amount,
      customCategory: null,
      accountName: null,
      pending: tx.pending,
    }));

    await labelTransactionArrayForBudgets(transactionsForLabeling, [
      coffeeBudget,
      foodBudget,
      groceryBudget,
    ]);

    // Verify Starbucks has 2 budget IDs (coffee + food)
    const updatedTransactions = await findTransactionsByUserId(testUserId);
    const starbucksTransaction = updatedTransactions.find(
      (tx) => tx.transactionId === "tx_starbucks_2"
    );

    assert(starbucksTransaction, "Starbucks transaction should exist");
    assert(
      starbucksTransaction.budgetIds?.includes(coffeeBudget.id),
      "Starbucks should match coffee budget"
    );
    assert(
      starbucksTransaction.budgetIds?.includes(foodBudget.id),
      "Starbucks should match food budget"
    );
    assert.equal(
      starbucksTransaction.budgetIds?.length,
      2,
      "Starbucks should match exactly 2 budgets"
    );

    // Verify Whole Foods has 1 budget ID (groceries)
    const wholeFoodsTransaction = updatedTransactions.find(
      (tx) => tx.transactionId === "tx_wholefood_2"
    );

    assert(wholeFoodsTransaction, "Whole Foods transaction should exist");
    assert(
      wholeFoodsTransaction.budgetIds?.includes(groceryBudget.id),
      "Whole Foods should match grocery budget"
    );
    assert.equal(
      wholeFoodsTransaction.budgetIds?.length,
      1,
      "Whole Foods should match exactly 1 budget"
    );
  });

  it("should handle transactions with no matching budgets", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_3",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create transaction (Shell Gas Station will NOT match grocery budget)
    const transactions = [
      {
        transaction_id: "tx_gas_1",
        user_id: testUserId,
        item_id: "item_test_3",
        account_id: "acc_1",
        date: "2024-01-15",
        name: "Shell Gas Station",
        amount: 45.0,
        pending: false,
      },
    ];

    await createTestTransactions(supabase, transactions);

    // Create grocery budget (should NOT match gas)
    const groceryBudget = await createBudget({
      id: crypto.randomUUID(),
      user_id: testUserId,
      title: "Groceries",
      filter_prompt: "Grocery stores only",
      budget_amount: 400.0,
      time_period: "rolling",
      custom_period_days: 30,
      fixed_period_start_date: null,
    });

    // Label transactions
    const transactionsForLabeling = transactions.map((tx) => ({
      transactionId: tx.transaction_id,
      date: tx.date,
      name: tx.name,
      amount: tx.amount,
      customCategory: null,
      accountName: null,
      pending: tx.pending,
    }));

    await labelTransactionArrayForBudgets(transactionsForLabeling, [groceryBudget]);

    // Verify gas transaction has empty budget_ids array
    const updatedTransactions = await findTransactionsByUserId(testUserId);
    const gasTransaction = updatedTransactions.find((tx) => tx.transactionId === "tx_gas_1");

    assert(gasTransaction, "Gas transaction should exist");
    assert(Array.isArray(gasTransaction.budgetIds), "budget_ids should be an array");
    assert.equal(gasTransaction.budgetIds.length, 0, "Gas transaction should have no budgets");
  });

  it("should use pre-labeled data in get-budgets query (performance test)", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_4",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create 10 transactions (5 coffee, 5 grocery)
    const transactions = [
      // Coffee transactions
      ...Array.from({ length: 5 }, (_, i) => ({
        transaction_id: `tx_coffee_${i}`,
        user_id: testUserId,
        item_id: "item_test_4",
        account_id: "acc_1",
        date: "2024-01-15",
        name: `Starbucks Coffee ${i}`,
        amount: 5.0 + i,
        pending: false,
      })),
      // Grocery transactions
      ...Array.from({ length: 5 }, (_, i) => ({
        transaction_id: `tx_grocery_${i}`,
        user_id: testUserId,
        item_id: "item_test_4",
        account_id: "acc_1",
        date: "2024-01-14",
        name: `Whole Foods ${i}`,
        amount: 50.0 + i * 10,
        pending: false,
      })),
    ];

    await createTestTransactions(supabase, transactions);

    // Create coffee budget
    const coffeeBudget = await createBudget({
      id: crypto.randomUUID(),
      user_id: testUserId,
      title: "Coffee",
      filter_prompt: "Coffee shops like Starbucks",
      budget_amount: 100.0,
      time_period: "rolling",
      custom_period_days: 30,
      fixed_period_start_date: null,
    });

    // Label transactions
    const transactionsForLabeling = transactions.map((tx) => ({
      transactionId: tx.transaction_id,
      date: tx.date,
      name: tx.name,
      amount: tx.amount,
      customCategory: null,
      accountName: null,
      pending: tx.pending,
    }));

    await labelTransactionArrayForBudgets(transactionsForLabeling, [coffeeBudget]);

    // Query using pre-labeled data (fast query using budget_ids column)
    const startTime = Date.now();

    const budgets = await getBudgets(testUserId);
    const budget = budgets.find((b) => b.id === coffeeBudget.id);

    // Verify we found the budget
    assert(budget, "Coffee budget should exist");

    // Query transactions using pre-labeled budget_ids column
    const labeledTransactions = await findTransactionsByUserId(testUserId);
    const matchingTransactions = labeledTransactions.filter((tx) =>
      tx.budgetIds?.includes(coffeeBudget.id)
    );

    const queryTime = Date.now() - startTime;

    // Verify correct count
    assert.equal(
      matchingTransactions.length,
      5,
      "Should find exactly 5 coffee transactions"
    );

    // Verify query was fast (< 500ms for local database)
    console.log(`[TEST] Pre-labeled query completed in ${queryTime}ms`);
    assert(
      queryTime < 500,
      `Pre-labeled query should complete in < 500ms, took ${queryTime}ms`
    );

    // Calculate total spending
    const totalSpent = matchingTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    console.log(`[TEST] Total coffee spending: $${totalSpent.toFixed(2)}`);
    assert(totalSpent > 0, "Total spending should be greater than 0");
  });
});
