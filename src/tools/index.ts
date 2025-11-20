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
import { getFinancialSummaryTools } from "./financial-summary/index.js";
import type { ToolDefinition } from "./types.js";
import { logEvent, serializeError } from "../utils/logger.js";
import {
  getAdminTools,
  isMintAllowedForUser,
  MINT_MCP_BEARER_TOOL_NAME,
} from "./admin/index.js";

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(server: McpServer, plaidClient: PlaidApi) {
  const allTools: ToolDefinition[] = [
    ...getAccountTools(),
    ...getFinancialSummaryTools(),
    ...getCategorizationTools(),
    ...getOpinionTools(),
    ...getBudgetTools(),
    ...getTransactionTools(),
    ...getInvestmentTools(),
    ...getLiabilityTools(),
    ...getAdminTools(),
  ];

  // Register each tool with logging and error handling
  allTools.forEach(({ name, description, inputSchema, outputSchema, options, handler }) => {
    // Create the wrapped handler with logging and error handling
    const wrappedHandler = async (args: any, context: any) => {
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
    };

    // Use registerTool (the MCP SDK now supports _meta and outputSchema natively)
    const config: any = {
      description,
      annotations: options,
      _meta: options?._meta,
    };

    // Only include inputSchema if it has properties (not empty object)
    if (inputSchema && Object.keys(inputSchema).length > 0) {
      config.inputSchema = inputSchema;
    }

    // Include outputSchema if defined (must be Zod schema)
    if (outputSchema) {
      config.outputSchema = outputSchema;
    }

    server.registerTool(name, config, wrappedHandler);
  });

  // Apply user-based tool filtering
  applyToolFiltering(server);
}

/**
 * Apply user-based tool filtering to the tools/list response
 *
 * This wraps the tools/list handler to filter out admin-only tools
 * based on the authenticated user's permissions.
 *
 * Note: _meta and outputSchema are now natively supported by MCP SDK v1.22.0
 * and are automatically included in tools/list responses.
 */
function applyToolFiltering(server: McpServer) {
  const serverInternal = server.server as any;

  if (serverInternal._requestHandlers) {
    const originalToolsHandler = serverInternal._requestHandlers.get("tools/list");

    serverInternal._requestHandlers.set("tools/list", async (request: any, extra: any) => {
      const userId = extra?.authInfo?.extra?.userId ?? extra?.authInfo?.userId;
      logEvent("TOOLS", "list-request", { params: request.params, userId });

      // Call original handler (now includes _meta and outputSchema natively)
      const result = await originalToolsHandler(request, extra);

      // Filter out admin-only tools for non-admin users
      if (!isMintAllowedForUser(userId)) {
        result.tools = result.tools.filter(
          (tool: any) => tool.name !== MINT_MCP_BEARER_TOOL_NAME
        );
      }

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
