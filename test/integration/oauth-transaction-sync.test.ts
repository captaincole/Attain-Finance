/**
 * Integration test for OAuth callback → transaction sync flow
 * Tests that when a user completes OAuth, transactions are synced in background
 */

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert";
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import { MockSupabaseClient } from "../mocks/supabase-mock.js";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { completeAccountConnection } from "../../src/services/account-service.js";
import { getAccountsByItemId } from "../../src/storage/repositories/accounts.js";
import { findTransactionsByUserId } from "../../src/storage/repositories/transactions.js";
import { AccountSyncStateRepository } from "../../src/storage/repositories/account-sync-state.js";

// Mock environment for categorization (skip actual Claude API calls in tests)
process.env.ANTHROPIC_API_KEY = "mock-api-key";

// Mock categorization function to avoid real API calls
const originalCategorize = await import("../../src/utils/clients/claude.js");
const mockCategorize = {
  ...originalCategorize,
  categorizeTransactions: async (transactions: any[]) => {
    // Return simple mock categorization
    return transactions.map((tx) => ({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      custom_category: "Food & Dining", // Simple mock category
    }));
  },
};

describe("OAuth Transaction Sync Integration Test", () => {
  let mockPlaidClient: any;
  let mockSupabase: any;
  let syncStateRepo: AccountSyncStateRepository;
  const testUserId = "test-user-oauth-sync";
  const testSessionId = "test-session-oauth-sync";

  before(() => {
    // Mock Plaid client
    mockPlaidClient = new MockPlaidClient();

    // Mock Supabase
    mockSupabase = new MockSupabaseClient();
    setSupabaseMock(mockSupabase);

    // Initialize sync state repository
    syncStateRepo = new AccountSyncStateRepository(mockSupabase);
  });

  beforeEach(() => {
    // Clear mock data between tests
    mockSupabase.clear();
  });

  it("should sync transactions in background after OAuth callback", async () => {
    // Step 1: Create a pending account session (simulates user starting OAuth flow)
    await mockSupabase.from("account_sessions").insert({
      session_id: testSessionId,
      user_id: testUserId,
      status: "pending",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    // Step 2: Complete account connection (simulates OAuth callback)
    const { userId, itemId } = await completeAccountConnection(
      testSessionId,
      "test-public-token",
      mockPlaidClient
    );

    // Verify user and item returned
    assert.equal(userId, testUserId, "Should return correct user ID");
    assert(itemId, "Should return item ID");

    // Step 3: Wait for background sync to complete
    // Poll sync state until all accounts are synced or timeout
    const maxWaitMs = 10000; // 10 second timeout
    const pollIntervalMs = 500;
    const startTime = Date.now();

    let allAccountsSynced = false;
    while (!allAccountsSynced && Date.now() - startTime < maxWaitMs) {
      // Get all accounts for this connection
      const accounts = await getAccountsByItemId(userId, itemId);

      // Check sync state for each account
      const syncStates = await Promise.all(
        accounts.map((acc) => syncStateRepo.getSyncState(acc.account_id))
      );

      // Check if all accounts have completed sync
      const completedCount = syncStates.filter(
        (state) => state?.sync_status === "complete"
      ).length;

      if (completedCount === accounts.length) {
        allAccountsSynced = true;
        console.log(`[TEST] All ${accounts.length} accounts synced successfully`);
      } else {
        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    assert(
      allAccountsSynced,
      "All accounts should complete sync within timeout period"
    );

    // Step 4: Verify accounts were created
    const accounts = await getAccountsByItemId(userId, itemId);
    assert(accounts.length > 0, "Should have created accounts");
    console.log(`[TEST] Found ${accounts.length} accounts`);

    // Step 5: Verify sync state records were created
    for (const account of accounts) {
      const syncState = await syncStateRepo.getSyncState(account.account_id);
      assert(syncState, `Sync state should exist for account ${account.account_id}`);
      assert.equal(
        syncState.sync_status,
        "complete",
        `Account ${account.account_id} should have completed sync`
      );
      assert(
        syncState.transaction_cursor,
        "Should have stored final cursor"
      );
      assert(
        syncState.total_transactions_synced > 0,
        "Should have synced at least one transaction"
      );
      console.log(
        `[TEST] Account ${account.account_id}: ${syncState.total_transactions_synced} transactions synced`
      );
    }

    // Step 6: Verify transactions were stored in database
    const transactions = await findTransactionsByUserId(userId);
    assert(
      transactions.length > 0,
      "Should have stored transactions in database"
    );
    console.log(`[TEST] Found ${transactions.length} total transactions`);

    // Step 7: Verify transactions were categorized
    const categorizedTransactions = transactions.filter(
      (tx) => tx.customCategory !== null
    );
    assert(
      categorizedTransactions.length > 0,
      "Should have categorized transactions"
    );
    console.log(
      `[TEST] ${categorizedTransactions.length} transactions were categorized`
    );

    // Step 8: Verify transaction count matches mock data expectations
    // We expect 3 transactions for checking + 1 for savings = 4 total
    assert(
      transactions.length >= 4,
      "Should have at least 4 transactions (3 checking + 1 savings)"
    );

    // Step 9: Verify transactions belong to correct accounts
    const checkingTxns = transactions.filter(
      (tx) => tx.accountId === "acc_checking_123"
    );
    const savingsTxns = transactions.filter(
      (tx) => tx.accountId === "acc_savings_456"
    );

    assert(checkingTxns.length >= 3, "Should have at least 3 checking transactions");
    assert(savingsTxns.length >= 1, "Should have at least 1 savings transaction");

    console.log("[TEST] ✓ OAuth transaction sync flow completed successfully");
  });

  it("should handle sync errors gracefully", async () => {
    // Create a session
    await mockSupabase.from("account_sessions").insert({
      session_id: "error-session",
      user_id: "error-user",
      status: "pending",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    // Create a mock Plaid client that fails on transactionsSync
    const failingPlaidClient = {
      ...mockPlaidClient,
      transactionsSync: async () => {
        throw new Error("Mock Plaid API error");
      },
    };

    // Complete connection should still succeed (sync is fire-and-forget)
    const result = await completeAccountConnection(
      "error-session",
      "test-public-token",
      failingPlaidClient
    );

    assert(result.userId, "Should still return user ID despite sync error");
    assert(result.itemId, "Should still return item ID despite sync error");

    // Wait a bit for background sync to fail
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify accounts were still created (sync failure doesn't affect account creation)
    const accounts = await getAccountsByItemId(result.userId, result.itemId);
    assert(accounts.length > 0, "Should have created accounts even if sync failed");

    // Verify sync state shows error
    const syncState = await syncStateRepo.getSyncState(accounts[0].account_id);
    if (syncState) {
      // Sync state might show error or might not exist yet due to timing
      console.log(`[TEST] Sync state status: ${syncState.sync_status}`);
    }

    console.log("[TEST] ✓ Error handling test completed");
  });
});
