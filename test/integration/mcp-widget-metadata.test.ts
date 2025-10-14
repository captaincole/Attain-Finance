/**
 * Integration tests for MCP widget metadata
 * Tests that the MCP server correctly registers tools with OpenAI widget extensions
 * This bypasses HTTP/auth and tests the server configuration directly
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import { createServer } from "../../src/create-server.js";

describe("MCP Widget Metadata Configuration", () => {
  it("should register get-account-status tool with OpenAI widget metadata", async () => {
    // Create server with mock Plaid client
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);

    // Access the internal tool registry
    // Note: This uses internal APIs for testing purposes
    const serverInternal = server.server as any;
    const toolsHandler = serverInternal._requestHandlers.get("tools/list");

    assert(toolsHandler, "Server should have tools/list handler");

    // Call the handler directly (bypassing HTTP/auth)
    // Must pass proper JSON-RPC request structure
    const result = await toolsHandler({
      method: "tools/list",
      params: {}
    });

    // Verify tools list structure
    assert(result.tools, "Should return tools array");
    assert(Array.isArray(result.tools), "Tools should be an array");
    assert(result.tools.length > 0, "Should have at least one tool");

    // Find get-account-status tool
    const getAccountStatusTool = result.tools.find(
      (t: any) => t.name === "get-account-status"
    );

    assert(getAccountStatusTool, "Should include get-account-status tool");

    // Verify basic tool fields
    assert.equal(getAccountStatusTool.name, "get-account-status");
    assert(
      getAccountStatusTool.description,
      "Tool should have description"
    );
    assert(
      getAccountStatusTool.inputSchema,
      "Tool should have inputSchema"
    );

    // CRITICAL: Verify _meta field exists
    assert(
      getAccountStatusTool._meta,
      "get-account-status tool MUST have _meta field for ChatGPT widget discovery"
    );

    // Verify OpenAI widget extension fields
    assert.equal(
      getAccountStatusTool._meta["openai/outputTemplate"],
      "ui://widget/connected-institutions.html",
      "Must have outputTemplate pointing to widget resource URI"
    );

    assert.equal(
      getAccountStatusTool._meta["openai/widgetAccessible"],
      true,
      "Must mark widget as accessible"
    );

    assert.equal(
      getAccountStatusTool._meta["openai/resultCanProduceWidget"],
      true,
      "Must indicate tool can produce widgets"
    );

    // Verify tool invocation messages (loading states)
    assert(
      getAccountStatusTool._meta["openai/toolInvocation/invoking"],
      "Must have invoking message for loading state"
    );
    assert.equal(
      getAccountStatusTool._meta["openai/toolInvocation/invoking"],
      "Loading your account balances...",
      "Invoking message should match expected text"
    );

    assert(
      getAccountStatusTool._meta["openai/toolInvocation/invoked"],
      "Must have invoked message for completion state"
    );
    assert.equal(
      getAccountStatusTool._meta["openai/toolInvocation/invoked"],
      "Account balances loaded",
      "Invoked message should match expected text"
    );

    console.log("✓ Widget metadata correctly configured in tools/list response");
  });

  it("should not add widget metadata to other tools", async () => {
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);

    const serverInternal = server.server as any;
    const toolsHandler = serverInternal._requestHandlers.get("tools/list");
    const result = await toolsHandler({
      method: "tools/list",
      params: {}
    });

    // Tools that SHOULD have widget metadata
    const widgetTools = ["get-account-status", "get-budgets"];

    // Find tools that are NOT widget tools
    const otherTools = result.tools.filter(
      (t: any) => !widgetTools.includes(t.name)
    );

    assert(otherTools.length > 0, "Should have other tools besides widget tools");

    // Verify none of the other tools have widget metadata
    for (const tool of otherTools) {
      if (tool._meta) {
        assert(
          !tool._meta["openai/outputTemplate"],
          `Tool ${tool.name} should not have widget outputTemplate`
        );
        assert(
          !tool._meta["openai/widgetAccessible"],
          `Tool ${tool.name} should not have widgetAccessible`
        );
        assert(
          !tool._meta["openai/resultCanProduceWidget"],
          `Tool ${tool.name} should not have resultCanProduceWidget`
        );
      }
    }

    console.log(`✓ Verified ${otherTools.length} other tools do not have widget metadata`);
  });

  it("should register widget resource for resources/list", async () => {
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);

    const serverInternal = server.server as any;
    const resourcesHandler = serverInternal._requestHandlers.get("resources/list");

    assert(resourcesHandler, "Server should have resources/list handler");

    const result = await resourcesHandler({
      method: "resources/list",
      params: {}
    });

    // Verify resources structure
    assert(result.resources, "Should return resources array");
    assert(Array.isArray(result.resources), "Resources should be an array");

    // Find widget resource
    const widgetResource = result.resources.find(
      (r: any) => r.uri === "ui://widget/connected-institutions.html"
    );

    assert(widgetResource, "Should include widget resource");
    assert.equal(
      widgetResource.uri,
      "ui://widget/connected-institutions.html",
      "Widget URI should match outputTemplate in tool"
    );
    assert.equal(
      widgetResource.mimeType,
      "text/html+skybridge",
      "Widget should use skybridge MIME type"
    );
    assert(
      widgetResource._meta,
      "Widget resource should have _meta"
    );
    assert(
      widgetResource._meta["openai/widgetDescription"],
      "Widget should have description in _meta"
    );
    assert(
      widgetResource._meta["openai/widgetCSP"],
      "Widget should have CSP policy"
    );

    console.log("✓ Widget resource correctly registered in resources/list");
  });

  it("should provide widget HTML via resources/read", async () => {
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);

    const serverInternal = server.server as any;
    const readResourceHandler = serverInternal._requestHandlers.get("resources/read");

    assert(readResourceHandler, "Server should have resources/read handler");

    const result = await readResourceHandler({
      method: "resources/read",
      params: {
        uri: "ui://widget/connected-institutions.html"
      }
    });

    // Verify response structure
    assert(result.contents, "Should return contents array");
    assert.equal(result.contents.length, 1, "Should have one content item");

    const content = result.contents[0];

    // Verify content structure
    assert.equal(
      content.uri,
      "ui://widget/connected-institutions.html"
    );
    assert.equal(
      content.mimeType,
      "text/html+skybridge"
    );
    assert(content.text, "Should have HTML text");

    // Verify HTML structure
    const html = content.text;
    assert(
      html.includes('<div id="connected-institutions-root"></div>'),
      "HTML must have root div for React mounting"
    );
    assert(
      html.includes('<script type="module"'),
      "HTML must have module script tag"
    );
    assert(
      html.includes('/widgets/connected-institutions.js'),
      "HTML must reference widget JS file"
    );
    assert(
      html.includes('<link rel="stylesheet"'),
      "HTML must have stylesheet link"
    );
    assert(
      html.includes('/widgets/connected-institutions.css'),
      "HTML must reference widget CSS file"
    );

    // Verify URLs use BASE_URL environment variable
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    assert(
      html.includes(baseUrl),
      `HTML should reference BASE_URL (${baseUrl})`
    );

    // Verify _meta
    assert(content._meta, "Content should have _meta");
    assert(
      content._meta["openai/widgetDescription"],
      "Should have widget description"
    );
    assert(
      content._meta["openai/widgetPrefersBorder"] !== undefined,
      "Should have border preference"
    );
    assert(
      content._meta["openai/widgetCSP"],
      "Should have CSP settings"
    );

    console.log("✓ Widget HTML correctly served via resources/read");
  });
});
