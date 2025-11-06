/**
 * Tool Registry
 * Central registration point for all MCP tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlaidApi } from "plaid";
import { getAccountTools } from "./accounts/index.js";
import { getCategorizationTools } from "./categorization/index.js";
import { getOpinionTools } from "./opinions/index.js";
import { getBudgetTools } from "./budgets/index.js";
import { getTransactionTools } from "./transactions/index.js";
import { getInvestmentTools } from "./investments/index.js";
import { getLiabilityTools } from "./liabilities/index.js";
import type { ToolDefinition } from "./types.js";
import { logEvent, serializeError } from "../utils/logger.js";

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(server: McpServer, plaidClient: PlaidApi) {
  const allTools: ToolDefinition[] = [
    ...getAccountTools(),
    ...getCategorizationTools(),
    ...getOpinionTools(),
    ...getBudgetTools(),
    ...getTransactionTools(),
    ...getInvestmentTools(),
    ...getLiabilityTools(),
  ];

  // Register each tool with logging and error handling
  allTools.forEach(({ name, description, inputSchema, options, handler }) => {
    server.tool(
      name,
      description,
      inputSchema,
      options,
      async (args: any, context: any) => {
        const userId = context?.authInfo?.extra?.userId as string | undefined;
        logEvent(`TOOL:${name}`, "invoked", {
          args,
          userId,
          hasAuthInfo: Boolean(context?.authInfo),
        });

        try {
          // Pass plaidClient only to tools that need it
          const result = await handler(args, context, { plaidClient });

          // Log response metadata (but not full content to avoid spam)
          if (result._meta) {
            logEvent(`TOOL:${name}`, "response-meta", { _meta: result._meta, userId });
          }
          if (result.structuredContent) {
            logEvent(`TOOL:${name}`, "response-structured-content", {
              keys: Object.keys(result.structuredContent),
              userId,
            });
          }

          return result;
        } catch (error: any) {
          // Handle validation errors gracefully
          logEvent(
            `TOOL:${name}`,
            "error",
            { error: serializeError(error), userId },
            "error"
          );

          // Return user-friendly error message
          return {
            content: [{
              type: "text" as const,
              text: `❌ **Error calling ${name}**\n\n${error.message}\n\nPlease check the required parameters and try again.`
            }],
            isError: true
          };
        }
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
      logEvent("TOOLS", "list-request", { params: request.params });

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
        if (tool.name === "get-account-balances") {
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
        if (tool.name === "create-budget") {
          return {
            ...tool,
            _meta: {
              "openai/outputTemplate": "ui://widget/budget-list.html",
              "openai/toolInvocation/invoking": "Creating budget...",
              "openai/toolInvocation/invoked": "Budget created",
              "openai/widgetAccessible": true,
              "openai/resultCanProduceWidget": true
            }
          };
        }
        if (tool.name === "update-budget-rules") {
          return {
            ...tool,
            _meta: {
              "openai/outputTemplate": "ui://widget/budget-list.html",
              "openai/toolInvocation/invoking": "Updating budget...",
              "openai/toolInvocation/invoked": "Budget updated",
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

      logEvent("TOOLS", "list-response", {
        toolCount: result.tools.length,
        toolNames: result.tools.map((t: any) => t.name),
        toolsWithMeta
      });

      return result;
    });
  }
}
