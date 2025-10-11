/**
 * Integration tests for Plaid tools with mocked Plaid client
 * Tests tool handlers directly without full MCP protocol overhead
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import { MockSupabaseClient } from "../mocks/supabase-mock.js";
import { setSupabaseMock, resetSupabase } from "../../src/db/supabase.js";
import {
  connectFinancialInstitutionHandler,
  checkConnectionStatusHandler,
} from "../../src/tools/plaid-connection.js";

describe("Plaid Tool Integration Tests", () => {
  let mockPlaidClient: any;
  let mockSupabase: any;
  const testUserId = "test-user-123";
  const testBaseUrl = "http://localhost:3000";

  before(() => {
    // Mock Plaid
    mockPlaidClient = new MockPlaidClient();

    // Mock Supabase
    mockSupabase = new MockSupabaseClient();
    setSupabaseMock(mockSupabase);
  });

  after(() => {
    // Cleanup: reset Supabase
    resetSupabase();
  });

  it("should generate Plaid Link URL for connect-financial-institution", async () => {
    const result = await connectFinancialInstitutionHandler(
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
    await connectFinancialInstitutionHandler(
      testUserId,
      testBaseUrl,
      mockPlaidClient
    );

    // Then check the status
    const result = await checkConnectionStatusHandler(testUserId, mockPlaidClient);

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
