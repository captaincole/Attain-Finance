/**
 * Integration test for get-account-balances tool
 * Tests account balance retrieval, net worth calculation, and widget metadata
 *
 * NOTE: Uses real local Supabase database, no mocks
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { getAccountBalancesHandler } from "../../src/tools/accounts/handlers.js";
import {
  createTestSupabaseClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";

describe("Account Balances Integration Tests", () => {
  const supabase = createTestSupabaseClient();
  const testUserId = "test-user-accounts";

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

  it("should return error when no accounts connected", async () => {
    const result = await getAccountBalancesHandler(testUserId);

    // Verify error message
    assert(result.content[0].text.includes("No Accounts Found"));
    assert(result.content[0].text.includes("Connect my account"));
  });

  it("should fetch and return account balances with proper formatting", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_1",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create 2 accounts in database
    await supabase.from("accounts").insert([
      {
        account_id: "acc_checking",
        user_id: testUserId,
        item_id: "item_test_1",
        name: "Checking Account",
        type: "depository",
        subtype: "checking",
        current_balance: 1234.50,
        available_balance: 1200.00,
        last_synced_at: new Date().toISOString(),
      },
      {
        account_id: "acc_savings",
        user_id: testUserId,
        item_id: "item_test_1",
        name: "Savings Account",
        type: "depository",
        subtype: "savings",
        current_balance: 5000.00,
        available_balance: 5000.00,
        last_synced_at: new Date().toISOString(),
      },
    ]);

    const result = await getAccountBalancesHandler(testUserId);

    // Verify formatting with 2 decimal places
    assert(result.content[0].text.includes("$1234.50"));
    assert(result.content[0].text.includes("$5000.00"));

    // Verify last synced info present
    assert(result.content[0].text.includes("Last synced"));

    // Verify institution name shown
    assert(result.content[0].text.includes("Test Bank"));
  });

  it("should calculate net worth correctly (assets - liabilities)", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_2",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create mixed accounts:
    // - Checking: $1,000 (asset)
    // - Savings: $5,000 (asset)
    // - Credit Card: -$500 (liability - negative balance)
    // Expected net worth: $6,000 - $500 = $5,500
    await supabase.from("accounts").insert([
      {
        account_id: "acc_checking",
        user_id: testUserId,
        item_id: "item_test_2",
        name: "Checking",
        type: "depository",
        subtype: "checking",
        current_balance: 1000,
        last_synced_at: new Date().toISOString(),
      },
      {
        account_id: "acc_savings",
        user_id: testUserId,
        item_id: "item_test_2",
        name: "Savings",
        type: "depository",
        subtype: "savings",
        current_balance: 5000,
        last_synced_at: new Date().toISOString(),
      },
      {
        account_id: "acc_credit",
        user_id: testUserId,
        item_id: "item_test_2",
        name: "Credit Card",
        type: "credit",
        subtype: "credit card",
        current_balance: -500,
        last_synced_at: new Date().toISOString(),
      },
    ]);

    const result = await getAccountBalancesHandler(testUserId);

    // Verify net worth calculation (with markdown formatting)
    assert(result.content[0].text.includes("**Net Worth:** $5500.00"));

    // Verify accounts grouped by type
    assert(result.content[0].text.includes("Summary by Account Type"));
    assert(result.content[0].text.includes("Depository:"));
    assert(result.content[0].text.includes("Credit:"));
  });

  it("should include widget metadata and structured content in response", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_3",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create at least 1 account
    await supabase.from("accounts").insert({
      account_id: "acc_1",
      user_id: testUserId,
      item_id: "item_test_3",
      name: "Checking Account",
      type: "depository",
      subtype: "checking",
      current_balance: 1000,
      last_synced_at: new Date().toISOString(),
    });

    const result = await getAccountBalancesHandler(testUserId);

    // Verify structured content exists
    assert(result.structuredContent, "Should have structured content");
    assert(result.structuredContent.institutions, "Should have institutions array");
    assert.equal(result.structuredContent.institutions.length, 1, "Should have 1 institution");

    // Verify institution structure
    const institution = result.structuredContent.institutions[0];
    assert.equal(institution.itemId, "item_test_3");
    assert.equal(institution.institutionName, "Test Bank");
    assert.equal(institution.status, "active");
    assert(institution.accounts, "Institution should have accounts");
    assert.equal(institution.accounts.length, 1, "Institution should have 1 account");

    // Verify account structure
    const account = institution.accounts[0];
    assert.equal(account.name, "Checking Account");
    assert.equal(account.type, "depository");
    assert.equal(account.subtype, "checking");
    assert.equal(account.balances.current, 1000);

    // Verify summary data
    assert(result.structuredContent.summary, "Should have summary");
    assert.equal(result.structuredContent.summary.totalAccounts, 1);
    assert(result.structuredContent.summary.accountsByType, "Should have accountsByType");
    assert(result.structuredContent.summary.netWorth !== undefined, "Should have netWorth");
  });
});
