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
  createTestSupabaseAdminClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";

describe("Transaction Filters Integration Tests", () => {
  const testUserId = "test-user-tx-filters";
  const supabase = createTestSupabaseClient(testUserId);
  const adminSupabase = createTestSupabaseAdminClient();
  const baseUrl = "http://localhost:3000";

  /**
   * Shared test data setup - creates 7 transactions with varied attributes
   * - 2 checking account, 5 savings account
   * - 3 Food, 2 Transport, 2 Shopping
   * - 2 tagged to budget_food, 3 tagged to budget_transport
   * - 3 pending, 4 confirmed
   */
  async function setupTestData() {
    // Create connection (uses admin client internally)
    await createTestConnection(supabase, {
      itemId: "item_test",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create 7 transactions with varied attributes
    const { error } = await adminSupabase.from("transactions").insert([
      // Checking account (2 transactions)
      {
        transaction_id: "tx_1",
        user_id: testUserId,
        item_id: "item_test",
        account_id: "acc_checking",
        account_name: "Checking",
        date: "2025-01-15",
        name: "Starbucks",
        amount: 5.50,
        pending: true,
        custom_category: "Food & Dining",
        budget_ids: ["budget_food"],
      },
      {
        transaction_id: "tx_2",
        user_id: testUserId,
        item_id: "item_test",
        account_id: "acc_checking",
        account_name: "Checking",
        date: "2025-01-16",
        name: "Uber",
        amount: 15.00,
        pending: false,
        custom_category: "Transportation",
        budget_ids: ["budget_transport"],
      },
      // Savings account (5 transactions)
      {
        transaction_id: "tx_3",
        user_id: testUserId,
        item_id: "item_test",
        account_id: "acc_savings",
        account_name: "Savings",
        date: "2025-01-17",
        name: "McDonald's",
        amount: 8.99,
        pending: false,
        custom_category: "Food & Dining",
        budget_ids: ["budget_food"],
      },
      {
        transaction_id: "tx_4",
        user_id: testUserId,
        item_id: "item_test",
        account_id: "acc_savings",
        account_name: "Savings",
        date: "2025-01-18",
        name: "Whole Foods",
        amount: 50.00,
        pending: true,
        custom_category: "Food & Dining",
        budget_ids: null,
      },
      {
        transaction_id: "tx_5",
        user_id: testUserId,
        item_id: "item_test",
        account_id: "acc_savings",
        account_name: "Savings",
        date: "2025-01-19",
        name: "Lyft",
        amount: 12.50,
        pending: false,
        custom_category: "Transportation",
        budget_ids: ["budget_transport"],
      },
      {
        transaction_id: "tx_6",
        user_id: testUserId,
        item_id: "item_test",
        account_id: "acc_savings",
        account_name: "Savings",
        date: "2025-01-20",
        name: "Amazon",
        amount: 75.00,
        pending: true,
        custom_category: "Shopping",
        budget_ids: null,
      },
      {
        transaction_id: "tx_7",
        user_id: testUserId,
        item_id: "item_test",
        account_id: "acc_savings",
        account_name: "Savings",
        date: "2025-01-21",
        name: "Target",
        amount: 45.00,
        pending: false,
        custom_category: "Shopping",
        budget_ids: null,
      },
    ]);

    if (error) {
      throw new Error(`Failed to insert test transactions: ${error.message}`);
    }
  }

  before(() => {
    setSupabaseMock(supabase);
  });

  beforeEach(async () => {
    await cleanupTestUser(supabase, testUserId);
    await setupTestData();
    const { data, error } = await supabase
      .from("transactions")
      .select("transaction_id")
      .eq("user_id", testUserId);
    if (error) {
      throw new Error(`Failed to verify test transactions: ${error.message}`);
    }
    const { data: adminData, error: adminError } = await adminSupabase
      .from("transactions")
      .select("transaction_id")
      .eq("user_id", testUserId);
    if (adminError) {
      throw new Error(`Admin verification failed: ${adminError.message}`);
    }
    console.log("[TEST] transactions inserted", data?.length || 0, "admin", adminData?.length || 0);
  });

  after(async () => {
    await cleanupTestUser(supabase, testUserId);
    resetSupabase();
  });

  it("should filter transactions by account_ids", async () => {
    // Filter by checking account only (should return 2 of 7 transactions)
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      account_ids: ["acc_checking"],
    }, supabase);

    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 2, "Should return 2 checking transactions");
    assert(transactions.every((tx: any) => tx.account_name === "Checking"));
    assert(transactions.some((tx: any) => tx.description === "Starbucks"));
    assert(transactions.some((tx: any) => tx.description === "Uber"));
  });

  it("should filter transactions by categories", async () => {
    // Filter by Food & Transport categories (should return 5 of 7 transactions)
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      categories: ["Food", "Transport"],
    }, supabase);

    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 5, "Should return 5 transactions (3 Food + 2 Transport)");

    // Verify included transactions
    assert(transactions.some((tx: any) => tx.description === "Starbucks"));
    assert(transactions.some((tx: any) => tx.description === "McDonald's"));
    assert(transactions.some((tx: any) => tx.description === "Whole Foods"));
    assert(transactions.some((tx: any) => tx.description === "Uber"));
    assert(transactions.some((tx: any) => tx.description === "Lyft"));

    // Verify excluded transactions
    assert(!transactions.some((tx: any) => tx.description === "Amazon"));
    assert(!transactions.some((tx: any) => tx.description === "Target"));
  });

  it("should filter transactions by budget_id", async () => {
    // Filter by budget_food (should return 2 of 7 transactions)
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      budget_id: "budget_food",
    }, supabase);

    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 2, "Should return 2 transactions tagged to food budget");
    assert(transactions.some((tx: any) => tx.description === "Starbucks"));
    assert(transactions.some((tx: any) => tx.description === "McDonald's"));
  });

  it("should filter transactions by pending status (pending_only)", async () => {
    // Filter for pending only (should return 3 of 7 transactions)
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      pending_only: true,
    }, supabase);

    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 3, "Should return 3 pending transactions");
    assert(transactions.every((tx: any) => tx.pending === true));
    assert(transactions.some((tx: any) => tx.description === "Starbucks"));
    assert(transactions.some((tx: any) => tx.description === "Whole Foods"));
    assert(transactions.some((tx: any) => tx.description === "Amazon"));
  });

  it("should filter transactions by pending status (exclude_pending)", async () => {
    // Filter to exclude pending (should return 4 of 7 transactions)
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      exclude_pending: true,
    }, supabase);

    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 4, "Should return 4 confirmed transactions");
    assert(transactions.every((tx: any) => tx.pending === false));
    assert(transactions.some((tx: any) => tx.description === "Uber"));
    assert(transactions.some((tx: any) => tx.description === "McDonald's"));
    assert(transactions.some((tx: any) => tx.description === "Lyft"));
    assert(transactions.some((tx: any) => tx.description === "Target"));
  });

  it("should combine multiple filters (account + category)", async () => {
    // Filter by checking account AND food category (should return 1 of 7 transactions)
    const result = await getPlaidTransactionsHandler(testUserId, baseUrl, {
      account_ids: ["acc_checking"],
      categories: ["Food"],
    }, supabase);

    assert(result.structuredContent, "Should have structured content");
    const transactions = result.structuredContent.transactions;
    assert.equal(transactions.length, 1, "Should return 1 transaction (checking + food)");
    assert.equal(transactions[0].description, "Starbucks");
    assert.equal(transactions[0].account_name, "Checking");
    assert(transactions[0].category.includes("Food"));
  });
});
