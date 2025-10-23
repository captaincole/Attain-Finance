/**
 * Integration tests for demo investment tooling.
 */

import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert";

import {
  cleanupTestUser,
  createTestConnection,
  createTestSupabaseClient,
} from "../helpers/test-db.js";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { upsertAccounts } from "../../src/storage/repositories/accounts.js";
import { runDemoInvestmentSeed } from "../../scripts/demo-investments-runner.js";
import { getInvestmentsTool } from "../../src/tools/demo/investments.js";
import { DEMO_SECURITY_IDS } from "../../src/demo-data/investments.js";

describe("Demo Investments Tool", () => {
  const supabase = createTestSupabaseClient();
  const testUserId = "test-demo-investments";
  const testItemId = `item_${testUserId}`;

  before(() => {
    setSupabaseMock(supabase);
  });

  beforeEach(async () => {
    await cleanupTestUser(supabase, testUserId);

    await createTestConnection(supabase, {
      itemId: testItemId,
      userId: testUserId,
      institutionName: "Chase",
    });

    await upsertAccounts(testUserId, testItemId, [
      {
        account_id: `${testUserId}_cc_1`,
        name: "Chase Sapphire Preferred",
        official_name: "Chase Sapphire Preferred",
        type: "credit",
        subtype: "credit card",
        balances: {
          current: -1523.45,
          available: null,
          limit: 10000,
          iso_currency_code: "USD",
        },
      },
    ]);
  });

  after(async () => {
    await cleanupTestUser(supabase, testUserId);
    resetSupabase();
  });

  it("returns demo investments with Plaid-shaped payload", async () => {
    await runDemoInvestmentSeed(testUserId, { reset: true });

    const tool = getInvestmentsTool();
    const result = await tool.handler(
      {},
      { authInfo: { extra: { userId: testUserId } } },
      {}
    );

    assert.ok(result.content?.length, "should include text content");
    const text = result.content![0].text;
    assert.match(
      text,
      /Demo Brokerage Portfolio/,
      "should mention demo brokerage"
    );
    assert.match(
      text,
      /Chase Sapphire Preferred/,
      "should include connected credit account summary"
    );

    const structured = result.structuredContent;
    assert.ok(structured, "should include structured content payload");
    assert.equal(structured.accounts.length, 1, "one demo account expected");
    assert.ok(
      structured.holdings.some(
        (holding: any) => holding.security_id === DEMO_SECURITY_IDS.goog
      ),
      "should include GOOG holding"
    );
    assert.ok(
      structured.linkedCreditAccounts.length >= 1,
      "should include linked credit account snapshot"
    );
    assert.ok(structured.totals.totalValue > 0, "total value should be positive");
  });
});
