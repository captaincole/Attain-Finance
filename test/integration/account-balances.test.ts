/**
 * Integration tests for financial-summary + get-account-status tools
 * Validates net worth calculations, account list rendering, and widget structured content
 *
 * NOTE: Uses real local Supabase database, no mocks
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { getAccountStatusHandler } from "../../src/tools/accounts/handlers.js";
import {
  getFinancialSummaryHandler,
  GetFinancialSummaryOutputSchema,
} from "../../src/tools/financial-summary/get-financial-summary.js";
import {
  createTestSupabaseClient,
  createTestSupabaseAdminClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";
import type { Database } from "../../src/storage/database.types.js";

describe("Account Dashboard Tool Integration Tests", () => {
  const testUserId = "test-user-accounts";
  const supabase = createTestSupabaseClient(testUserId);
  const adminClient = createTestSupabaseAdminClient();

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

  it("financial summary should prompt to connect when no accounts exist", async () => {
    const result = await getFinancialSummaryHandler(testUserId);

    assert(result.content[0].text.includes("Financial Summary"));
    assert(result.content[0].text.includes("No connected accounts yet."));
    assert(result.content[0].text.includes("Connect my account"));
    assert.equal(result.structuredContent.view, "financial-summary");
    assert(result.structuredContent.dashboard.hero, "Hero data should exist even for empty state");
  });

  it("financial summary should calculate net worth and trend data", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_1",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create 2 accounts in database
    const accountsToInsert: Database["public"]["Tables"]["accounts"]["Insert"][] = [
      {
        account_id: "acc_checking",
        user_id: testUserId,
        item_id: "item_test_1",
        name: "Checking Account",
        type: "depository",
        subtype: "checking",
        current_balance: 1234.5,
        available_balance: 1234.5,
        last_synced_at: new Date().toISOString(),
        currency_code: "USD",
      },
      {
        account_id: "acc_savings",
        user_id: testUserId,
        item_id: "item_test_1",
        name: "Savings Account",
        type: "depository",
        subtype: "savings",
        current_balance: 5000.0,
        available_balance: 5000.0,
        last_synced_at: new Date().toISOString(),
        currency_code: "USD",
      },
    ];

    const { error: insertError1 } = await adminClient.from("accounts").insert(accountsToInsert);
    if (insertError1) {
      console.error("[TEST] failed inserting accounts for financial summary", JSON.stringify(insertError1, null, 2));
      throw insertError1;
    }

    const result = await getFinancialSummaryHandler(testUserId);

    const summary = result.structuredContent.summary;
    const hero = result.structuredContent.dashboard.hero;
    assert.equal(result.structuredContent.view, "financial-summary");
    assert(summary, "Structured summary should be present");
    assert(hero, "Hero dashboard data should exist");

    const expectedAssets = 1234.5 + 5000;
    assert(
      Math.abs((summary.assetsTotal ?? 0) - expectedAssets) < 0.01,
      "Assets total should equal sum of seeded accounts"
    );
    assert(
      (summary.netWorth ?? 0) > 0 && Math.abs((summary.netWorth ?? 0) - expectedAssets) < 0.01,
      "Net worth should match seeded balances"
    );
  });

  it("account status should list institutions with balances", async () => {
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
    const accountStatusSeed: Database["public"]["Tables"]["accounts"]["Insert"][] = [
      {
        account_id: "acc_checking",
        user_id: testUserId,
        item_id: "item_test_2",
        name: "Checking",
        type: "depository",
        subtype: "checking",
        current_balance: 1000,
        last_synced_at: new Date().toISOString(),
        currency_code: "USD",
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
        currency_code: "USD",
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
        currency_code: "USD",
      },
    ];
    const { error: insertError2 } = await adminClient.from("accounts").insert(accountStatusSeed);
    if (insertError2) {
      console.error("[TEST] failed inserting accounts for account status", insertError2);
      throw insertError2;
    }

    const result = await getAccountStatusHandler(testUserId);

    assert(result.content[0].text.includes("Account Status"));
    assert(result.content[0].text.includes("Test Bank"));
    assert(result.content[0].text.includes("Totals → Assets"));
    assert(result.content[0].text.includes("Next Steps"));
    assert.equal(result.structuredContent.view, "account-status");
    assert(Array.isArray(result.structuredContent.institutions), "Should return institutions array");
  });

  it("account status structured content should include institutions and next steps", async () => {
    // Create test connection
    await createTestConnection(supabase, {
      itemId: "item_test_3",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create at least 1 account
    const singleAccount: Database["public"]["Tables"]["accounts"]["Insert"] = {
      account_id: "acc_1",
      user_id: testUserId,
      item_id: "item_test_3",
      name: "Checking Account",
      type: "depository",
      subtype: "checking",
      current_balance: 1000,
      last_synced_at: new Date().toISOString(),
      currency_code: "USD",
    };
    const { error: insertError3 } = await adminClient.from("accounts").insert(singleAccount);
    if (insertError3) {
      console.error("[TEST] failed inserting single account", insertError3);
      throw insertError3;
    }

    const result = await getAccountStatusHandler(testUserId);

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
    assert(result.structuredContent.dashboard.accounts, "Should include accounts dashboard data");
    assert(Array.isArray(result.structuredContent.dashboard.accounts.nextSteps), "Should include account next steps");
    const connectAction = result.structuredContent.dashboard.accounts.nextSteps.find(
      (step: any) => step.id === "connect-account"
    );
    assert(connectAction, "Should include connect-account action");
    assert.equal(connectAction.kind, "tool");
  });

  it("financial summary output should match Zod schema definition", async () => {
    // Setup test data: connection + accounts + net worth snapshots
    await createTestConnection(supabase, {
      itemId: "item_schema_test",
      userId: testUserId,
      institutionName: "Schema Test Bank",
    });

    // Create diverse account types to test full schema
    const accountsForSchemaTest: Database["public"]["Tables"]["accounts"]["Insert"][] = [
      {
        account_id: "acc_schema_checking",
        user_id: testUserId,
        item_id: "item_schema_test",
        name: "Checking Account",
        type: "depository",
        subtype: "checking",
        current_balance: 2500.75,
        available_balance: 2500.75,
        last_synced_at: new Date().toISOString(),
        currency_code: "USD",
      },
      {
        account_id: "acc_schema_investment",
        user_id: testUserId,
        item_id: "item_schema_test",
        name: "Investment Account",
        type: "investment",
        subtype: "401k",
        current_balance: 50000.0,
        last_synced_at: new Date().toISOString(),
        currency_code: "USD",
      },
      {
        account_id: "acc_schema_credit",
        user_id: testUserId,
        item_id: "item_schema_test",
        name: "Credit Card",
        type: "credit",
        subtype: "credit card",
        current_balance: -1200.5,
        limit_amount: 5000,
        last_synced_at: new Date().toISOString(),
        currency_code: "USD",
      },
    ];

    const { error: accountInsertError } = await adminClient
      .from("accounts")
      .insert(accountsForSchemaTest);

    if (accountInsertError) {
      console.error("[TEST] Failed to insert accounts for schema test", accountInsertError);
      throw accountInsertError;
    }

    // Create net worth snapshot for trend data (1 week ago)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { error: snapshotError } = await adminClient.from("net_worth_snapshots").insert({
      user_id: testUserId,
      snapshot_date: oneWeekAgo.toISOString().split("T")[0],
      net_worth_amount: 50000.0, // Baseline for trend calculation
      assets_total: 51000.0,
      liabilities_total: 1000.0,
    });

    if (snapshotError) {
      console.error("[TEST] Failed to insert net worth snapshot", snapshotError);
      throw snapshotError;
    }

    // Call the handler with real data
    const result = await getFinancialSummaryHandler(testUserId);

    // Validate against Zod schema - check key fields match outputSchema
    const dashboardValidation = GetFinancialSummaryOutputSchema.dashboard.safeParse(
      result.structuredContent.dashboard
    );

    if (!dashboardValidation.success) {
      console.error("[TEST] Dashboard schema validation failed:");
      console.error(JSON.stringify(dashboardValidation.error.issues, null, 2));
      console.error("\nActual dashboard output:");
      console.error(JSON.stringify(result.structuredContent.dashboard, null, 2));
    }

    assert(
      dashboardValidation.success,
      `Financial summary dashboard output must match Zod schema. Errors: ${JSON.stringify(dashboardValidation.error?.issues || [])}`
    );

    // Additional assertions to verify the data integrity
    const structuredContent = result.structuredContent;
    assert.equal(structuredContent.view, "financial-summary");
    assert(structuredContent.summary, "Should have summary object");
    assert(structuredContent.dashboard, "Should have dashboard object");
    assert(structuredContent.dashboard.hero, "Should have hero section");

    // Verify calculated values make sense
    const expectedNetWorth = 2500.75 + 50000.0 - 1200.5; // checking + investment - credit
    assert(
      Math.abs(structuredContent.summary.netWorth - expectedNetWorth) < 0.01,
      "Net worth should match seeded account balances"
    );
    assert.equal(structuredContent.summary.totalAccounts, 3, "Should have 3 accounts");

    // Verify trend data exists (we added a snapshot)
    assert(structuredContent.summary.netWorthTrend, "Should have net worth trend");
    assert.equal(structuredContent.summary.netWorthTrend.direction, "up", "Net worth should be trending up");
    assert(
      structuredContent.summary.netWorthTrend.amountChange > 0,
      "Should show positive change from baseline"
    );

    // Verify dashboard hero section
    assert.equal(structuredContent.dashboard.hero.hasData, true, "Hero should indicate data exists");
    assert(Array.isArray(structuredContent.dashboard.hero.nextSteps), "Hero should have next steps");
    assert(structuredContent.dashboard.hero.nextSteps.length > 0, "Should have at least one next step");

    console.log("✓ Financial summary output successfully validated against Zod schema");
  });
});
