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
import { WIDGET_META } from "../utils/widget-metadata.js";
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
 *
 * IMPORTANT: This is a non-standard MCP pattern required for ChatGPT widget support.
 *
 * Background:
 * ChatGPT's widget system requires _meta fields in the tools/list response.
 * The MCP SDK server.tool() method does not include _meta from options in tools/list by default.
 * We define _meta in tool definitions (see src/tools directory) but need to manually inject it
 * when ChatGPT calls the tools/list endpoint.
 *
 * How it works:
 * 1. Tool definitions include _meta in their options (using WIDGET_META constants)
 * 2. This function wraps the tools/list handler to inject _meta into the response
 * 3. ChatGPT receives _meta and pre-fetches widget HTML via resources/read
 * 4. When tool is called, ChatGPT renders widget with structuredContent data
 *
 * Alternative approaches considered:
 * - Manually registering tools with raw MCP protocol would be too verbose and lose SDK benefits
 * - Patching MCP SDK would not be maintainable and break on SDK updates
 * - Current approach is a minimal wrapper that injects _meta from our centralized constants
 *
 * See docs/CHATGPT_WIDGET_DEBUG.md and CLAUDE.md for more context.
 */
function injectWidgetMetadata(server: McpServer) {
  const serverInternal = server.server as any;

  if (serverInternal._requestHandlers) {
    const originalToolsHandler = serverInternal._requestHandlers.get("tools/list");

    serverInternal._requestHandlers.set("tools/list", async (request: any) => {
      logEvent("TOOLS", "list-request", { params: request.params });

      // Call original handler
      const result = await originalToolsHandler(request);

      // Inject _meta for widget-enabled tools
      // The MCP SDK doesn't include _meta from options by default, so we must inject it manually
      // Note: We reference WIDGET_META constants to stay DRY with tool definitions
      result.tools = result.tools.map((tool: any) => {
        if (tool.name === "get-account-balances") {
          return { ...tool, _meta: WIDGET_META.accountBalances };
        }
        if (tool.name === "get-budgets") {
          return { ...tool, _meta: WIDGET_META.budgetList };
        }
        if (tool.name === "create-budget") {
          return { ...tool, _meta: WIDGET_META.budgetList };
        }
        if (tool.name === "update-budget-rules") {
          return { ...tool, _meta: WIDGET_META.budgetList };
        }
        return tool;
      });

      // Log response with _meta details for observability
      const toolsWithMeta = result.tools.filter((t: any) => t._meta).map((t: any) => ({
        name: t.name,
        hasWidget: true,
        widgetUri: t._meta?.["openai/outputTemplate"]
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
