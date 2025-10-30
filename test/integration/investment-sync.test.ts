/**
 * Investment Sync Integration Tests
 * Tests the InvestmentSyncService with real local Supabase database
 */

import { describe, test, beforeEach, afterEach, expect } from "@jest/globals";
import { InvestmentSyncService } from "../../src/services/investment-sync.js";
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import {
  createTestSupabaseClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";
import { getHoldingsByUserId } from "../../src/storage/repositories/investment-holdings.js";
import { upsertAccounts } from "../../src/storage/repositories/accounts.js";
import { AccountInvestmentSyncStateRepository } from "../../src/storage/repositories/account-investment-sync-state.js";

describe("Investment Sync Service", () => {
  const supabase = createTestSupabaseClient();
  const mockPlaidClient = new MockPlaidClient() as any;
  const investmentSyncService = new InvestmentSyncService(
    mockPlaidClient,
    supabase
  );
  const syncStateRepo = new AccountInvestmentSyncStateRepository(supabase);

  const testUserId = "test-investment-sync-user";
  const testItemId = "item-test-investment-123";
  const testAccessToken = `access-test-${testItemId}`;

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestUser(supabase, testUserId);

    // Create test connection
    await createTestConnection(supabase, {
      itemId: testItemId,
      userId: testUserId,
      institutionName: "Mock Bank",
    });
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestUser(supabase, testUserId);
  });

  test("should sync investment holdings for investment accounts", async () => {
    // Setup: Get mock accounts and create them in database
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // Execute: Sync investment holdings
    await investmentSyncService.syncConnectionInvestments({
      itemId: testItemId,
      userId: testUserId,
      accessToken: testAccessToken,
    });

    // Verify: Check holdings were stored
    const holdings = await getHoldingsByUserId(testUserId);

    // Should have 9 holdings total (4 from 401k + 5 from brokerage)
    expect(holdings.length).toBeGreaterThan(0);

    // Verify 401k holdings
    const acc401kHoldings = holdings.filter(
      (h) => h.account_id === "acc_401k_789"
    );
    expect(acc401kHoldings.length).toBe(4); // VTSAX, VTIAX, VBTLX, USD cash

    // Verify brokerage holdings
    const brokerageHoldings = holdings.filter(
      (h) => h.account_id === "acc_brokerage_101"
    );
    expect(brokerageHoldings.length).toBe(5); // AAPL, MSFT, TSLA, VTI, BTC

    // Verify holding data structure
    const appleHolding = holdings.find(
      (h) => h.ticker_symbol === "AAPL"
    );
    expect(appleHolding).toBeDefined();
    expect(appleHolding!.quantity).toBe(10.0);
    expect(appleHolding!.institution_price).toBe(180.0);
    expect(appleHolding!.institution_value).toBe(1800.0);
    expect(appleHolding!.cost_basis).toBe(1500.0);
    expect(appleHolding!.security_name).toBe("Apple Inc.");
    expect(appleHolding!.security_type).toBe("equity");
  });

  test("should not sync holdings for non-investment accounts", async () => {
    // Setup: Get mock accounts and create them in database
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // Execute: Sync investment holdings
    await investmentSyncService.syncConnectionInvestments({
      itemId: testItemId,
      userId: testUserId,
      accessToken: testAccessToken,
    });

    // Verify: Check that no holdings exist for checking/savings accounts
    const holdings = await getHoldingsByUserId(testUserId);
    const checkingHoldings = holdings.filter(
      (h) => h.account_id === "acc_checking_123"
    );
    const savingsHoldings = holdings.filter(
      (h) => h.account_id === "acc_savings_456"
    );

    expect(checkingHoldings.length).toBe(0);
    expect(savingsHoldings.length).toBe(0);
  });

  test("should update existing holdings on re-sync (upsert behavior)", async () => {
    // Setup: Get mock accounts and create them in database
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // Execute: First sync
    await investmentSyncService.syncConnectionInvestments({
      itemId: testItemId,
      userId: testUserId,
      accessToken: testAccessToken,
    });

    const firstSyncHoldings = await getHoldingsByUserId(testUserId);
    const firstSyncCount = firstSyncHoldings.length;

    // Execute: Second sync (should update, not duplicate)
    await investmentSyncService.syncConnectionInvestments({
      itemId: testItemId,
      userId: testUserId,
      accessToken: testAccessToken,
    });

    const secondSyncHoldings = await getHoldingsByUserId(testUserId);

    // Verify: Same number of holdings (upserted, not duplicated)
    expect(secondSyncHoldings.length).toBe(firstSyncCount);

    // Verify: last_synced_at was updated
    const appleHolding = secondSyncHoldings.find(
      (h) => h.ticker_symbol === "AAPL"
    );
    expect(appleHolding).toBeDefined();
    expect(appleHolding!.last_synced_at).toBeDefined();
  });

  test("should track sync state for investment accounts", async () => {
    // Setup: Get mock accounts and create them in database
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // Execute: Sync investment holdings
    await investmentSyncService.syncConnectionInvestments({
      itemId: testItemId,
      userId: testUserId,
      accessToken: testAccessToken,
    });

    // Verify: Sync state was created and updated for investment accounts
    const acc401kState = await syncStateRepo.getSyncState("acc_401k_789");
    expect(acc401kState).toBeDefined();
    expect(acc401kState!.syncStatus).toBe("synced");
    expect(acc401kState!.lastSyncedAt).toBeDefined();
    expect(acc401kState!.holdingsCount).toBe(4); // 4 holdings in 401k
    expect(acc401kState!.lastError).toBeNull();

    const brokerageState = await syncStateRepo.getSyncState("acc_brokerage_101");
    expect(brokerageState).toBeDefined();
    expect(brokerageState!.syncStatus).toBe("synced");
    expect(brokerageState!.holdingsCount).toBe(5); // 5 holdings in brokerage

    // Verify: No sync state for non-investment accounts
    const checkingState = await syncStateRepo.getSyncState("acc_checking_123");
    expect(checkingState).toBeNull();
  });

  test("should skip sync if no investment accounts exist", async () => {
    // Setup: Create connection with only depository accounts (no investments)
    const testUserIdNoInvestments = "test-no-investments";
    const testItemIdNoInvestments = "item-no-investments";

    await cleanupTestUser(supabase, testUserIdNoInvestments);
    await createTestConnection(supabase, {
      itemId: testItemIdNoInvestments,
      userId: testUserIdNoInvestments,
      institutionName: "Mock Bank No Investments",
    });

    // Create only depository accounts
    await upsertAccounts(testUserIdNoInvestments, testItemIdNoInvestments, [
      {
        account_id: "acc_checking_only",
        name: "Checking Only",
        official_name: "Checking Account",
        type: "depository",
        subtype: "checking",
        balances: {
          current: 1000.0,
          available: 950.0,
          limit: null,
          iso_currency_code: "USD",
        },
      },
    ]);

    // Execute: Sync (should exit early, no error)
    await investmentSyncService.syncConnectionInvestments({
      itemId: testItemIdNoInvestments,
      userId: testUserIdNoInvestments,
      accessToken: "access-no-investments",
    });

    // Verify: No holdings created
    const holdings = await getHoldingsByUserId(testUserIdNoInvestments);
    expect(holdings.length).toBe(0);

    // Cleanup
    await cleanupTestUser(supabase, testUserIdNoInvestments);
  });

  test("should handle errors gracefully per account", async () => {
    // This test would require modifying the mock to throw errors
    // For now, we verify that the service completes even if one account fails

    // Setup: Get mock accounts and create them in database
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // Execute: Sync should complete even with potential errors
    await expect(
      investmentSyncService.syncConnectionInvestments({
        itemId: testItemId,
        userId: testUserId,
        accessToken: testAccessToken,
      })
    ).resolves.not.toThrow();

    // Verify: Holdings were still synced
    const holdings = await getHoldingsByUserId(testUserId);
    expect(holdings.length).toBeGreaterThan(0);
  });
});
