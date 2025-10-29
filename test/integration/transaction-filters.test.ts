/**
 * Integration test for get-transactions tool filters
 * Tests account, category, budget, and pending status filters
 *
 * NOTE: Uses real local Supabase database, no mocks
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { getPlaidTransactionsHandler } from "../../src/tools/transactions/get-transactions.js";
import {
  createTestSupabaseClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";

describe("Transaction Filters Integration Tests", () => {
  const supabase = createTestSupabaseClient();
  const testUserId = "test-user-tx-filters";
  const baseUrl = "http://localhost:3000";

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

  it("should filter transactions by account_ids", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_1",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create 2 accounts
    await supabase.from("accounts").insert([
      {
        account_id: "acc_checking",
        user_id: testUserId,
        item_id: "item_test_1",
        name: "Checking",
        type: "depository",
        subtype: "checking",
        current_balance: 1000,
        last_synced_at: new Date().toISOString(),
      },
      {
        account_id: "acc_savings",
        user_id: testUserId,
        item_id: "item_test_1",
        name: "Savings",
        type: "depository",
        subtype: "savings",
        current_balance: 5000,
        last_synced_at: new Date().toISOString(),
      },
    ]);

    // Create transactions in both accounts
    await supabase.from("transactions").insert([
      {
        transaction_id: "tx_checking_1",
        user_id: testUserId,
        item_id: "item_test_1",
        account_id: "acc_checking",
        account_name: "Checking",
        date: "2025-01-15",
        name: "Starbucks",
        amount: 5.50,
        pending: false,
        custom_category: "Food & Dining",
      },
      {
        transaction_id: "tx_checking_2",
        user_id: testUserId,
        item_id: "item_test_1",
        account_id: "acc_checking",
        account_name: "Checking",
        date: "2025-01-16",
        name: "Uber",
        amount: 15.00,
        pending: false,
        custom_category: "Transportation",
      },
      {
        transaction_id: "tx_savings_1",
        user_id: testUserId,
        item_id: "item_test_1",
        account_id: "acc_savings",
        account_name: "Savings",
        date: "2025-01-17",
        name: "Interest Payment",
        amount: -2.50,
        pending: false,
        custom_category: "Income",
      },
    ]);

    // Filter by checking account only
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      account_ids: ["acc_checking"],
    });

    // Verify only checking account transactions returned
    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 2, "Should return 2 checking transactions");
    assert(transactions.every((tx: any) => tx.account_name === "Checking"));
    assert(transactions.some((tx: any) => tx.description === "Starbucks"));
    assert(transactions.some((tx: any) => tx.description === "Uber"));
  });

  it("should filter transactions by categories (case-insensitive partial match)", async () => {
    // Create test connection and account
    await createTestConnection(supabase, {
      itemId: "item_test_2",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    await supabase.from("accounts").insert({
      account_id: "acc_1",
      user_id: testUserId,
      item_id: "item_test_2",
      name: "Checking",
      type: "depository",
      subtype: "checking",
      current_balance: 1000,
      last_synced_at: new Date().toISOString(),
    });

    // Create transactions with different categories
    await supabase.from("transactions").insert([
      {
        transaction_id: "tx_food_1",
        user_id: testUserId,
        item_id: "item_test_2",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-15",
        name: "Starbucks",
        amount: 5.50,
        pending: false,
        custom_category: "Food & Dining",
      },
      {
        transaction_id: "tx_food_2",
        user_id: testUserId,
        item_id: "item_test_2",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-16",
        name: "McDonald's",
        amount: 8.99,
        pending: false,
        custom_category: "Food & Dining",
      },
      {
        transaction_id: "tx_transport",
        user_id: testUserId,
        item_id: "item_test_2",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-17",
        name: "Uber",
        amount: 15.00,
        pending: false,
        custom_category: "Transportation",
      },
      {
        transaction_id: "tx_shopping",
        user_id: testUserId,
        item_id: "item_test_2",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-18",
        name: "Amazon",
        amount: 50.00,
        pending: false,
        custom_category: "Shopping",
      },
    ]);

    // Filter by partial category match "Food" (should match "Food & Dining")
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      categories: ["Food"],
    });

    // Verify only food transactions returned
    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 2, "Should return 2 food transactions");
    assert(transactions.every((tx: any) => tx.category === "Food & Dining"));
    assert(transactions.some((tx: any) => tx.description === "Starbucks"));
    assert(transactions.some((tx: any) => tx.description === "McDonald's"));

    // Test multiple categories with OR logic
    const result2 = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      categories: ["Transport", "Shopping"],
    });

    const transactions2 = result2.structuredContent.transactions;
    assert.equal(transactions2.length, 2, "Should return 2 transactions (Transport + Shopping)");
    assert(transactions2.some((tx: any) => tx.description === "Uber"));
    assert(transactions2.some((tx: any) => tx.description === "Amazon"));
  });

  it("should filter transactions by budget_id", async () => {
    // Create test connection and account
    await createTestConnection(supabase, {
      itemId: "item_test_3",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    await supabase.from("accounts").insert({
      account_id: "acc_1",
      user_id: testUserId,
      item_id: "item_test_3",
      name: "Checking",
      type: "depository",
      subtype: "checking",
      current_balance: 1000,
      last_synced_at: new Date().toISOString(),
    });

    // Create budgets
    await supabase.from("budgets").insert([
      {
        id: "budget_groceries",
        user_id: testUserId,
        name: "Groceries",
        rules: "category contains Food",
        monthly_limit: 500,
      },
      {
        id: "budget_transport",
        user_id: testUserId,
        name: "Transportation",
        rules: "category contains Transport",
        monthly_limit: 200,
      },
    ]);

    // Create transactions tagged to different budgets
    await supabase.from("transactions").insert([
      {
        transaction_id: "tx_groceries_1",
        user_id: testUserId,
        item_id: "item_test_3",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-15",
        name: "Whole Foods",
        amount: 50.00,
        pending: false,
        custom_category: "Food & Dining",
        budget_ids: ["budget_groceries"],
      },
      {
        transaction_id: "tx_groceries_2",
        user_id: testUserId,
        item_id: "item_test_3",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-16",
        name: "Trader Joe's",
        amount: 35.50,
        pending: false,
        custom_category: "Food & Dining",
        budget_ids: ["budget_groceries"],
      },
      {
        transaction_id: "tx_transport_1",
        user_id: testUserId,
        item_id: "item_test_3",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-17",
        name: "Uber",
        amount: 15.00,
        pending: false,
        custom_category: "Transportation",
        budget_ids: ["budget_transport"],
      },
    ]);

    // Filter by groceries budget
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      budget_id: "budget_groceries",
    });

    // Verify only groceries budget transactions returned
    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 2, "Should return 2 groceries transactions");
    assert(transactions.some((tx: any) => tx.description === "Whole Foods"));
    assert(transactions.some((tx: any) => tx.description === "Trader Joe's"));
  });

  it("should filter transactions by pending status (pending_only)", async () => {
    // Create test connection and account
    await createTestConnection(supabase, {
      itemId: "item_test_4",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    await supabase.from("accounts").insert({
      account_id: "acc_1",
      user_id: testUserId,
      item_id: "item_test_4",
      name: "Checking",
      type: "depository",
      subtype: "checking",
      current_balance: 1000,
      last_synced_at: new Date().toISOString(),
    });

    // Create mix of pending and confirmed transactions
    await supabase.from("transactions").insert([
      {
        transaction_id: "tx_pending_1",
        user_id: testUserId,
        item_id: "item_test_4",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-20",
        name: "Starbucks (Pending)",
        amount: 5.50,
        pending: true,
        custom_category: "Food & Dining",
      },
      {
        transaction_id: "tx_pending_2",
        user_id: testUserId,
        item_id: "item_test_4",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-21",
        name: "Amazon (Pending)",
        amount: 25.00,
        pending: true,
        custom_category: "Shopping",
      },
      {
        transaction_id: "tx_confirmed_1",
        user_id: testUserId,
        item_id: "item_test_4",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-15",
        name: "McDonald's (Confirmed)",
        amount: 8.99,
        pending: false,
        custom_category: "Food & Dining",
      },
      {
        transaction_id: "tx_confirmed_2",
        user_id: testUserId,
        item_id: "item_test_4",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-16",
        name: "Uber (Confirmed)",
        amount: 15.00,
        pending: false,
        custom_category: "Transportation",
      },
    ]);

    // Filter for pending only
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      pending_only: true,
    });

    // Verify only pending transactions returned
    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 2, "Should return 2 pending transactions");
    assert(transactions.every((tx: any) => tx.pending === true));
    assert(transactions.some((tx: any) => tx.description === "Starbucks (Pending)"));
    assert(transactions.some((tx: any) => tx.description === "Amazon (Pending)"));
  });

  it("should filter transactions by pending status (exclude_pending)", async () => {
    // Create test connection and account
    await createTestConnection(supabase, {
      itemId: "item_test_5",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    await supabase.from("accounts").insert({
      account_id: "acc_1",
      user_id: testUserId,
      item_id: "item_test_5",
      name: "Checking",
      type: "depository",
      subtype: "checking",
      current_balance: 1000,
      last_synced_at: new Date().toISOString(),
    });

    // Create mix of pending and confirmed transactions
    await supabase.from("transactions").insert([
      {
        transaction_id: "tx_pending_1",
        user_id: testUserId,
        item_id: "item_test_5",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-20",
        name: "Starbucks (Pending)",
        amount: 5.50,
        pending: true,
        custom_category: "Food & Dining",
      },
      {
        transaction_id: "tx_confirmed_1",
        user_id: testUserId,
        item_id: "item_test_5",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-15",
        name: "McDonald's (Confirmed)",
        amount: 8.99,
        pending: false,
        custom_category: "Food & Dining",
      },
      {
        transaction_id: "tx_confirmed_2",
        user_id: testUserId,
        item_id: "item_test_5",
        account_id: "acc_1",
        account_name: "Checking",
        date: "2025-01-16",
        name: "Uber (Confirmed)",
        amount: 15.00,
        pending: false,
        custom_category: "Transportation",
      },
    ]);

    // Filter to exclude pending
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      exclude_pending: true,
    });

    // Verify only confirmed transactions returned
    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 2, "Should return 2 confirmed transactions");
    assert(transactions.every((tx: any) => tx.pending === false));
    assert(transactions.some((tx: any) => tx.description === "McDonald's (Confirmed)"));
    assert(transactions.some((tx: any) => tx.description === "Uber (Confirmed)"));
  });

  it("should combine multiple filters (account + category)", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_6",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create 2 accounts
    await supabase.from("accounts").insert([
      {
        account_id: "acc_checking",
        user_id: testUserId,
        item_id: "item_test_6",
        name: "Checking",
        type: "depository",
        subtype: "checking",
        current_balance: 1000,
        last_synced_at: new Date().toISOString(),
      },
      {
        account_id: "acc_savings",
        user_id: testUserId,
        item_id: "item_test_6",
        name: "Savings",
        type: "depository",
        subtype: "savings",
        current_balance: 5000,
        last_synced_at: new Date().toISOString(),
      },
    ]);

    // Create transactions in both accounts with different categories
    await supabase.from("transactions").insert([
      {
        transaction_id: "tx_checking_food",
        user_id: testUserId,
        item_id: "item_test_6",
        account_id: "acc_checking",
        account_name: "Checking",
        date: "2025-01-15",
        name: "Starbucks",
        amount: 5.50,
        pending: false,
        custom_category: "Food & Dining",
      },
      {
        transaction_id: "tx_checking_transport",
        user_id: testUserId,
        item_id: "item_test_6",
        account_id: "acc_checking",
        account_name: "Checking",
        date: "2025-01-16",
        name: "Uber",
        amount: 15.00,
        pending: false,
        custom_category: "Transportation",
      },
      {
        transaction_id: "tx_savings_food",
        user_id: testUserId,
        item_id: "item_test_6",
        account_id: "acc_savings",
        account_name: "Savings",
        date: "2025-01-17",
        name: "McDonald's",
        amount: 8.99,
        pending: false,
        custom_category: "Food & Dining",
      },
    ]);

    // Filter by checking account AND food category
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      account_ids: ["acc_checking"],
      categories: ["Food"],
    });

    // Verify only checking + food transactions returned
    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 1, "Should return 1 transaction (checking + food)");
    assert.equal(transactions[0].description, "Starbucks");
    assert.equal(transactions[0].account_name, "Checking");
    assert.equal(transactions[0].category, "Food & Dining");
  });
});
