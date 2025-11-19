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

    // Use registerTool when outputSchema is present (for proper Zod schema handling)
    // Otherwise use server.tool() for backward compatibility
    if (outputSchema) {
      server.registerTool(name, {
        description,
        inputSchema,
        outputSchema,
        annotations: options,
        _meta: options._meta,
      }, wrappedHandler);
    } else {
      server.tool(
        name,
        description,
        inputSchema,
        options,
        wrappedHandler
      );
    }
  });

  // Special handling for widget metadata and outputSchema injection
  // McpServer.tool() doesn't include _meta or outputSchema in tools/list by default
  // We need to manually inject them
  injectToolMetadata(server, allTools);
}

/**
 * Inject widget metadata and outputSchema into tools/list response
 *
 * IMPORTANT: This is a non-standard MCP pattern required for ChatGPT widget support and outputSchema.
 *
 * Background:
 * - ChatGPT's widget system requires _meta fields in the tools/list response
 * - MCP outputSchema requires JSON Schema format in tools/list response
 * - The MCP SDK server.tool() method does not include _meta or outputSchema in tools/list by default
 *
 * How it works:
 * 1. Tool definitions include _meta (widget metadata) and outputSchema (JSON Schema)
 * 2. This function wraps the tools/list handler to inject both fields into the response
 * 3. For widgets: ChatGPT receives _meta and pre-fetches widget HTML via resources/read
 * 4. For outputSchema: LLMs/clients receive JSON Schema documentation for response structure
 *
 * Alternative approaches considered:
 * - Using registerTool() for outputSchema: converts JSON Schema to Zod, loses descriptions
 * - Manually registering tools with raw MCP protocol: too verbose, loses SDK benefits
 * - Patching MCP SDK: not maintainable, breaks on SDK updates
 * - Current approach: minimal wrapper that injects metadata from tool definitions
 *
 * See docs/CHATGPT_WIDGET_DEBUG.md and CLAUDE.md for more context.
 */
function injectToolMetadata(server: McpServer, allTools: ToolDefinition[]) {
  const serverInternal = server.server as any;

  if (serverInternal._requestHandlers) {
    const originalToolsHandler = serverInternal._requestHandlers.get("tools/list");

    serverInternal._requestHandlers.set("tools/list", async (request: any, extra: any) => {
      const userId = extra?.authInfo?.extra?.userId ?? extra?.authInfo?.userId;
      logEvent("TOOLS", "list-request", { params: request.params, userId });

      // Call original handler
      const result = await originalToolsHandler(request, extra);

      if (!isMintAllowedForUser(userId)) {
        result.tools = result.tools.filter(
          (tool: any) => tool.name !== MINT_MCP_BEARER_TOOL_NAME
        );
      }

      // Create a lookup map for tool metadata (_meta for widgets)
      // Note: outputSchema is handled by registerTool(), no injection needed
      const toolMetadataMap = new Map(
        allTools.map(t => [t.name, { _meta: t.options?._meta }])
      );

      // Inject _meta (widget metadata) into tools
      // The MCP SDK doesn't include _meta from options/annotations by default
      result.tools = result.tools.map((tool: any) => {
        const metadata = toolMetadataMap.get(tool.name);
        if (!metadata?._meta) return tool;

        return { ...tool, _meta: metadata._meta };
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
