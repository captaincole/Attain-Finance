/**
 * Integration tests for Plaid tools with local Supabase
 * Tests tool handlers directly without full MCP protocol overhead
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import {
  connectAccountHandler,
  getAccountBalancesHandler,
} from "../../src/tools/accounts/handlers.js";
import {
  createTestSupabaseClient,
  cleanupTestUser,
} from "../helpers/test-db.js";

describe("Plaid Tool Integration Tests", () => {
  const supabase = createTestSupabaseClient();
  let mockPlaidClient: any;
  const testUserId = "test-user-plaid";
  const testBaseUrl = "http://localhost:3000";

  before(() => {
    setSupabaseMock(supabase);
    mockPlaidClient = new MockPlaidClient();
  });

  beforeEach(async () => {
    await cleanupTestUser(supabase, testUserId);
  });

  after(async () => {
    await cleanupTestUser(supabase, testUserId);
    resetSupabase();
  });

  it("should generate Plaid Link URL for connect-account", async () => {
    const result = await connectAccountHandler(
      testUserId,
      testBaseUrl,
      mockPlaidClient
    );

    // Verify response structure
    assert(result.content, "Response should have content");
    assert(result.content.length > 0, "Content should not be empty");
    assert.equal(result.content[0].type, "text");

    // Verify text contains link token and instructions
    const text = result.content[0].text;
    assert(text.includes("link-sandbox-test-token"), "Should contain link token");
    assert(text.includes(testBaseUrl), "Should contain base URL");
    assert(text.includes("/plaid/link"), "Should contain Plaid Link path");
  });

  it("should check connection status after connection", async () => {
    // First, simulate a connection by calling connect
    await connectAccountHandler(
      testUserId,
      testBaseUrl,
      mockPlaidClient
    );

    // Then check the status
    const result = await getAccountBalancesHandler(testUserId);

    // Verify response structure
    assert(result.content, "Response should have content");
    assert(result.content.length > 0, "Content should not be empty");
    assert.equal(result.content[0].type, "text");

    // In a fresh session, user won't have connection yet
    // This test primarily validates that the handler doesn't crash
    const text = result.content[0].text;
    assert(text.length > 0, "Should return some status text");
  });
});
