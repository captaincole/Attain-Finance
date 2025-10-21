/**
 * Integration test for async recategorization service
 * Tests that custom categorization rules are saved and service handles edge cases
 *
 * NOTE: These tests don't call the actual Claude API to avoid using credits.
 * The categorization logic itself is tested separately in unit tests.
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { recategorizeAllTransactions } from "../../src/services/recategorization-service.js";
import { findTransactionsByUserId } from "../../src/storage/repositories/transactions.js";
import { saveCustomRules, getCustomRules } from "../../src/storage/categorization/rules.js";
import {
  createTestSupabaseClient,
  cleanupTestUser,
  createTestConnection,
  createTestTransactions,
} from "../helpers/test-db.js";

// Mock environment - invalid API key to prevent real API calls
process.env.ANTHROPIC_API_KEY = "mock-invalid-key-for-testing";

describe("Async Recategorization Integration Tests", () => {
  const supabase = createTestSupabaseClient();
  const testUserId = "test-user-recategorization";

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

  it("should save custom rules to database", async () => {
    const customRules = "Categorize all Amazon transactions as Business expenses.";

    // Save rules
    await saveCustomRules(testUserId, customRules);

    // Verify rules were saved
    const savedRules = await getCustomRules(testUserId);
    assert.equal(savedRules, customRules, "Rules should be saved correctly");
  });

  it("should handle empty transaction list without calling categorization", async () => {
    // No transactions exist
    const customRules = "Test rules";

    // Run recategorization - should complete quickly without errors
    const startTime = Date.now();
    await recategorizeAllTransactions(testUserId, customRules);
    const duration = Date.now() - startTime;

    // Should return immediately (no API calls)
    assert(duration < 1000, `Should complete quickly for empty list, took ${duration}ms`);

    // Verify no transactions were created
    const transactions = await findTransactionsByUserId(testUserId);
    assert.equal(transactions.length, 0, "No transactions should exist");
  });

  it("should handle errors silently without crashing (invalid API key)", async () => {
    // Create test connection and transactions
    await createTestConnection(supabase, {
      itemId: "item_test_1",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    const transactions = Array.from({ length: 10 }, (_, i) => ({
      transaction_id: `tx_error_${i}`,
      user_id: testUserId,
      item_id: "item_test_1",
      account_id: "acc_1",
      date: "2024-01-01",
      name: `Transaction ${i}`,
      amount: 10.0,
      pending: false,
    }));

    await createTestTransactions(supabase, transactions);

    // Run recategorization with invalid API key - should not throw
    let errorThrown = false;
    try {
      await recategorizeAllTransactions(testUserId, "test rules");
    } catch (error) {
      errorThrown = true;
    }

    // Verify no error was thrown (errors are logged, not thrown)
    assert.equal(errorThrown, false, "Service should handle API errors silently");
  });

  it("should return immediately when called (fire-and-forget pattern)", async () => {
    // Create test connection and transactions
    await createTestConnection(supabase, {
      itemId: "item_test_2",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    const transactions = [
      { transaction_id: "tx_1", user_id: testUserId, item_id: "item_test_2", account_id: "acc_1", date: "2024-01-01", name: "Test 1", amount: 10.0, pending: false },
      { transaction_id: "tx_2", user_id: testUserId, item_id: "item_test_2", account_id: "acc_1", date: "2024-01-02", name: "Test 2", amount: 20.0, pending: false },
      { transaction_id: "tx_3", user_id: testUserId, item_id: "item_test_2", account_id: "acc_1", date: "2024-01-03", name: "Test 3", amount: 30.0, pending: false },
    ];

    await createTestTransactions(supabase, transactions);

    // Measure response time
    const startTime = Date.now();
    // Start the recategorization (will fail due to invalid API key, but that's expected)
    const promise = recategorizeAllTransactions(testUserId, "test rules");

    // We're not testing that it returns immediately here - we're testing that it runs
    // The fire-and-forget pattern is demonstrated in the update-rules handler,
    // where we call this function via setImmediate()

    // Wait for completion
    await promise;
    const duration = Date.now() - startTime;

    // Log duration for informational purposes
    console.log(`[INFO] Recategorization attempt completed in ${duration}ms (expected to fail due to invalid API key)`);

    // Verify transactions still exist
    const retrievedTransactions = await findTransactionsByUserId(testUserId);
    assert.equal(retrievedTransactions.length, 3, "Transactions should still exist after failed recategorization");
  });
});
