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

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(server: McpServer, plaidClient: PlaidApi) {
  const allTools = [
    ...getPlaidTools(),
    ...getCategorizationTools(),
    ...getVisualizationTools(),
    ...getOpinionTools(),
  ];

  // Register each tool
  allTools.forEach(({ name, description, inputSchema, options, handler }) => {
    server.tool(
      name,
      description,
      inputSchema,
      options,
      async (args: any, context: any) => {
        // Pass plaidClient only to tools that need it
        return handler(args, context, plaidClient);
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
      const result = await originalToolsHandler(request);

      // Add _meta to check-connection-status tool
      result.tools = result.tools.map((tool: any) => {
        if (tool.name === "check-connection-status") {
          return {
            ...tool,
            _meta: {
              "openai/outputTemplate": "ui://widget/connected-institutions.html",
              "openai/toolInvocation/invoking": "Loading your connected institutions...",
              "openai/toolInvocation/invoked": "Connected institutions loaded",
              "openai/widgetAccessible": true,
              "openai/resultCanProduceWidget": true
            }
          };
        }
        return tool;
      });

      return result;
    });
  }
}
