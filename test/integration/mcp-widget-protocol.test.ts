/**
 * Integration tests for MCP widget protocol (OpenAI extensions)
 * Tests that tools/list returns correct _meta fields for widget-enabled tools
 * Tests that resources/read returns widget HTML correctly
 * Tests that tools/call returns structuredContent for widgets
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";

// Set test environment BEFORE importing anything
process.env.NODE_ENV = "test";
process.env.ENCRYPTION_KEY = "a".repeat(64);
process.env.JWT_SECRET = "b".repeat(64);
process.env.BASE_URL = "http://localhost:3000";

// Load real Clerk test keys from .env file
import dotenv from "dotenv";
dotenv.config();

// Mock external dependencies
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { createTestSupabaseClient, cleanupTestUser } from "../helpers/test-db.js";

// Import app after environment is set up
import { app } from "../../src/index.js";

describe("MCP Widget Protocol (OpenAI Extensions)", () => {
  const supabase = createTestSupabaseClient();
  const testUserId = "test-user-widget-protocol";

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

  describe("POST /mcp - tools/list", () => {
    it.skip("should return tools list with widget metadata for check-connection-status (requires auth)", async () => {
      // TODO: This test requires a valid Clerk Bearer token
      // For now, we test the tool metadata directly in the server creation
      // See test/integration/plaid-tools.test.ts for direct tool handler testing

      const response = await request(app)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        // .set("Authorization", "Bearer <valid-clerk-token>") // Need real auth
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {}
        })
        .expect(200)
        .expect("Content-Type", /json/);

      // Parse JSON-RPC response
      const result = response.body;

      // 1. Verify JSON-RPC structure
      assert.equal(result.jsonrpc, "2.0", "Should be JSON-RPC 2.0");
      assert.equal(result.id, 1, "Should match request id");
      assert(result.result, "Should have result field");
      assert(result.result.tools, "Should have tools array");
      assert(Array.isArray(result.result.tools), "Tools should be an array");

      // 2. Find check-connection-status tool
      const checkConnectionTool = result.result.tools.find(
        (t: any) => t.name === "check-connection-status"
      );
      assert(checkConnectionTool, "Should include check-connection-status tool");

      // 3. Verify tool has basic fields
      assert.equal(checkConnectionTool.name, "check-connection-status");
      assert(
        checkConnectionTool.description,
        "Tool should have description"
      );
      assert(
        checkConnectionTool.inputSchema,
        "Tool should have inputSchema"
      );

      // 4. Verify tool has _meta field (CRITICAL for widget support)
      assert(checkConnectionTool._meta, "Tool should have _meta field for OpenAI widget support");

      // 5. Verify OpenAI widget metadata fields
      assert.equal(
        checkConnectionTool._meta["openai/outputTemplate"],
        "ui://widget/connected-institutions.html",
        "Should have outputTemplate pointing to widget URI"
      );

      assert.equal(
        checkConnectionTool._meta["openai/widgetAccessible"],
        true,
        "Should mark widget as accessible"
      );

      assert.equal(
        checkConnectionTool._meta["openai/resultCanProduceWidget"],
        true,
        "Should indicate tool can produce widgets"
      );

      // 6. Verify loading state messages
      assert(
        checkConnectionTool._meta["openai/toolInvocation/invoking"],
        "Should have invoking message"
      );
      assert.equal(
        checkConnectionTool._meta["openai/toolInvocation/invoking"],
        "Loading your connected institutions..."
      );

      assert(
        checkConnectionTool._meta["openai/toolInvocation/invoked"],
        "Should have invoked message"
      );
      assert.equal(
        checkConnectionTool._meta["openai/toolInvocation/invoked"],
        "Connected institutions loaded"
      );

      // 7. Verify other tools don't have widget metadata
      const otherTools = result.result.tools.filter(
        (t: any) => t.name !== "check-connection-status"
      );

      for (const tool of otherTools) {
        if (tool._meta) {
          // If _meta exists, it should not have OpenAI widget fields
          assert(
            !tool._meta["openai/outputTemplate"],
            `Tool ${tool.name} should not have widget outputTemplate`
          );
          assert(
            !tool._meta["openai/widgetAccessible"],
            `Tool ${tool.name} should not have widgetAccessible flag`
          );
          assert(
            !tool._meta["openai/resultCanProduceWidget"],
            `Tool ${tool.name} should not have resultCanProduceWidget flag`
          );
        }
      }
    });
  });

  describe("POST /mcp - resources/list", () => {
    it.skip("should return widget resource in resources list (requires auth)", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send({
          jsonrpc: "2.0",
          id: 2,
          method: "resources/list",
          params: {}
        })
        .expect(200)
        .expect("Content-Type", /json/);

      const result = response.body;

      // Verify response structure
      assert.equal(result.jsonrpc, "2.0");
      assert.equal(result.id, 2);
      assert(result.result.resources, "Should have resources array");

      // Find widget resource
      const widgetResource = result.result.resources.find(
        (r: any) => r.uri === "ui://widget/connected-institutions.html"
      );

      assert(widgetResource, "Should include widget resource");
      assert.equal(widgetResource.mimeType, "text/html+skybridge");
      assert(widgetResource._meta, "Widget resource should have _meta");
      assert(
        widgetResource._meta["openai/widgetDescription"],
        "Widget should have description"
      );
    });
  });

  describe("POST /mcp - resources/read", () => {
    it.skip("should return widget HTML with external script references (requires auth)", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send({
          jsonrpc: "2.0",
          id: 3,
          method: "resources/read",
          params: {
            uri: "ui://widget/connected-institutions.html"
          }
        })
        .expect(200)
        .expect("Content-Type", /json/);

      const result = response.body;

      // Verify response structure
      assert.equal(result.jsonrpc, "2.0");
      assert.equal(result.id, 3);
      assert(result.result.contents, "Should have contents array");
      assert.equal(result.result.contents.length, 1, "Should have one content item");

      const content = result.result.contents[0];

      // Verify widget HTML content
      assert.equal(content.uri, "ui://widget/connected-institutions.html");
      assert.equal(content.mimeType, "text/html+skybridge");
      assert(content.text, "Should have HTML text");

      // Verify HTML includes script and link tags
      assert(
        content.text.includes('<div id="connected-institutions-root"></div>'),
        "HTML should have root element"
      );
      assert(
        content.text.includes('<script type="module" src="'),
        "HTML should have module script tag"
      );
      assert(
        content.text.includes('<link rel="stylesheet" href="'),
        "HTML should have stylesheet link"
      );
      assert(
        content.text.includes("/widgets/connected-institutions.js"),
        "HTML should reference widget JS file"
      );

      // Verify _meta includes widget metadata
      assert(content._meta, "Content should have _meta");
      assert(
        content._meta["openai/widgetDescription"],
        "Should have widget description"
      );
      assert(
        content._meta["openai/widgetPrefersBorder"],
        "Should have border preference"
      );
      assert(
        content._meta["openai/widgetCSP"],
        "Should have CSP settings"
      );
    });
  });
});
