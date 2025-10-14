/**
 * Tool Registry
 * Central registration point for all MCP tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlaidApi } from "plaid";
import { getPlaidTools } from "./plaid/index.js";
import { getCategorizationTools } from "./categorization/index.js";
import { getVisualizationTools } from "./visualization/index.js";
import { getOpinionTools } from "./opinions/index.js";
import { getBudgetTools } from "./budgets/index.js";

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(server: McpServer, plaidClient: PlaidApi) {
  const allTools = [
    ...getPlaidTools(),
    ...getCategorizationTools(),
    ...getVisualizationTools(),
    ...getOpinionTools(),
    ...getBudgetTools(),
  ];

  // Register each tool with logging
  allTools.forEach(({ name, description, inputSchema, options, handler }) => {
    server.tool(
      name,
      description,
      inputSchema,
      options,
      async (args: any, context: any) => {
        console.log(`[TOOL/${name.toUpperCase()}] Called with args:`, JSON.stringify(args, null, 2));
        console.log(`[TOOL/${name.toUpperCase()}] Context authInfo:`, context.authInfo ? "Present" : "Missing");

        // Pass plaidClient only to tools that need it
        const result = await handler(args, context, plaidClient);

        // Log response metadata (but not full content to avoid spam)
        if (result._meta) {
          console.log(`[TOOL/${name.toUpperCase()}] Response _meta:`, JSON.stringify(result._meta, null, 2));
        }
        if (result.structuredContent) {
          console.log(`[TOOL/${name.toUpperCase()}] Has structuredContent:`, Object.keys(result.structuredContent));
        }

        return result;
      }
    );
  });

  // Special handling for widget metadata injection
  // McpServer.tool() doesn't include _meta in tools/list by default
  // We need to manually inject it for check-connection-status
  injectWidgetMetadata(server);
}

/**
 * Inject widget metadata into tools/list response
 * This is a workaround until MCP SDK supports _meta in tool registration
 */
function injectWidgetMetadata(server: McpServer) {
  const serverInternal = server.server as any;

  if (serverInternal._requestHandlers) {
    const originalToolsHandler = serverInternal._requestHandlers.get("tools/list");

    serverInternal._requestHandlers.set("tools/list", async (request: any) => {
      console.log("[TOOLS/LIST] Request:", JSON.stringify(request.params, null, 2));

      const result = await originalToolsHandler(request);

      // Add _meta to widget-enabled tools
      result.tools = result.tools.map((tool: any) => {
        if (tool.name === "get-account-status") {
          return {
            ...tool,
            _meta: {
              "openai/outputTemplate": "ui://widget/connected-institutions.html",
              "openai/toolInvocation/invoking": "Loading your account balances...",
              "openai/toolInvocation/invoked": "Account balances loaded",
              "openai/widgetAccessible": true,
              "openai/resultCanProduceWidget": true
            }
          };
        }
        if (tool.name === "get-budgets") {
          return {
            ...tool,
            _meta: {
              "openai/outputTemplate": "ui://widget/budget-list.html",
              "openai/toolInvocation/invoking": "Calculating budget status...",
              "openai/toolInvocation/invoked": "Budget status loaded",
              "openai/widgetAccessible": true,
              "openai/resultCanProduceWidget": true
            }
          };
        }
        return tool;
      });

      // Log response with _meta details
      const toolsWithMeta = result.tools.filter((t: any) => t._meta).map((t: any) => ({
        name: t.name,
        _meta: t._meta
      }));

      console.log("[TOOLS/LIST] Response:", JSON.stringify({
        toolCount: result.tools.length,
        toolNames: result.tools.map((t: any) => t.name),
        toolsWithMeta: toolsWithMeta
      }, null, 2));

      return result;
    });
  }
}
