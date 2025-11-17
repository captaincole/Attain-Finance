/**
 * Tests for the MCP bearer token minting tool and visibility rules.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import { createServer } from "../../src/create-server.js";
import { CONFIG } from "../../src/utils/config.js";
import {
  getAdminTools,
  MINT_MCP_BEARER_TOOL_NAME,
} from "../../src/tools/admin/index.js";

const ORIGINAL_TEMPLATE = CONFIG.mcpAuth.templateName;
const ORIGINAL_ALLOW_LIST = [...CONFIG.mcpAuth.tokenMintAllowList];
const ORIGINAL_SECRET = CONFIG.clerk.secretKey;

afterEach(() => {
  CONFIG.mcpAuth.templateName = ORIGINAL_TEMPLATE;
  CONFIG.mcpAuth.tokenMintAllowList = [...ORIGINAL_ALLOW_LIST];
  CONFIG.clerk.secretKey = ORIGINAL_SECRET;
});

describe("mint-mcp-bearer-token tool registration", () => {
  it("does not register when allow list is empty", () => {
    CONFIG.mcpAuth.templateName = "test-template";
    CONFIG.mcpAuth.tokenMintAllowList = [];

    const adminTools = getAdminTools();
    const mintTool = adminTools.find((tool) => tool.name === MINT_MCP_BEARER_TOOL_NAME);
    assert.strictEqual(mintTool, undefined);
  });

  it("mints a token for allowlisted Clerk users", async () => {
    CONFIG.mcpAuth.templateName = "test-template";
    CONFIG.mcpAuth.tokenMintAllowList = ["user_admin"];
    CONFIG.clerk.secretKey = "secret";
    const adminTools = getAdminTools({
      createClerkClientFn: () =>
        ({
          sessions: {
            getSessionList: async () => [{ id: "sess_123" }],
            getToken: async (sessionId: string, templateName: string) => {
              assert.strictEqual(sessionId, "sess_123");
              assert.strictEqual(templateName, "test-template");
              return { jwt: "jwt-123" };
            },
          },
        }) as any,
    });
    const mintTool = adminTools.find((tool) => tool.name === MINT_MCP_BEARER_TOOL_NAME);
    assert(mintTool, "Mint tool should be registered when allowlist is populated");

    const result = await mintTool!.handler(
      {},
      {
        authInfo: {
          userId: "user_admin",
        },
      },
      {}
    );

    assert.strictEqual(result.structuredContent?.token, "jwt-123");
    assert.match(result.content?.[0]?.text ?? "", /jwt-123/);
  });

  it("rejects minting when authenticated via bearer token", async () => {
    CONFIG.mcpAuth.templateName = "test-template";
    CONFIG.mcpAuth.tokenMintAllowList = ["user_admin"];

    const adminTools = getAdminTools();
    const mintTool = adminTools.find((tool) => tool.name === MINT_MCP_BEARER_TOOL_NAME);
    assert(mintTool, "Mint tool should be registered when allowlist is populated");

    await assert.rejects(
      () =>
        mintTool!.handler(
          {},
          {
            authInfo: {
              userId: "user_admin",
              authMethod: "bearer",
            },
          },
          {}
        ),
      /OAuth session/
    );
  });
});

describe("tools/list filtering for mint tool", () => {
  it("only returns the tool to allowlisted users", async () => {
    CONFIG.mcpAuth.templateName = "test-template";
    CONFIG.mcpAuth.tokenMintAllowList = ["user_admin"];

    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);
    const serverInternal = server.server as any;
    const toolsHandler = serverInternal._requestHandlers.get("tools/list");

    assert(toolsHandler, "tools/list handler must exist");

    const unauthorized = await toolsHandler(
      { method: "tools/list", params: {} },
      { authInfo: { userId: "user_denied" } }
    );
    assert(
      !unauthorized.tools.some((tool: any) => tool.name === MINT_MCP_BEARER_TOOL_NAME),
      "Mint tool should be hidden from unauthorized users"
    );

    const authorized = await toolsHandler(
      { method: "tools/list", params: {} },
      { authInfo: { userId: "user_admin" } }
    );
    assert(
      authorized.tools.some((tool: any) => tool.name === MINT_MCP_BEARER_TOOL_NAME),
      "Mint tool should be visible to allowlisted users"
    );

    await server.close();
  });
});
