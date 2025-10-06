import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlaidApi } from "plaid";

// Import tool handlers
import { trackSubscriptionsHandler } from "./tools/track-subscriptions.js";
import {
  connectFinancialInstitutionHandler,
  checkConnectionStatusHandler,
  disconnectFinancialInstitutionHandler,
} from "./tools/plaid-connection.js";
import { getPlaidTransactionsHandler } from "./tools/plaid-transactions.js";

/**
 * Helper to get the base URL for generating download links
 * Uses BASE_URL environment variable or defaults to localhost
 */
function getBaseUrl(): string {
  return process.env.BASE_URL || "http://localhost:3000";
}

export const createServer = (plaidClient: PlaidApi) => {
  // Create server instance
  const server = new McpServer({
    name: "personal-finance",
    version: "1.0.0",
  });

  // Note: MCP resources removed in favor of signed download URLs
  // See /api/data/transactions endpoint for user-specific data downloads

  // Register tools
  // ChatGPT-compatible search/fetch tools (for Deep Research support)
  server.tool(
    "search",
    "Search for financial tools and capabilities available in this MCP server. Returns information about available financial management tools.",
    {
      query: z.string().describe("Search query for financial tools"),
    },
    {
      readOnlyHint: true,
      openWorldHint: true,
    },
    async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;
      console.log("search called by user:", userId, "query:", args.query);

      // Return list of available financial tools in ChatGPT's required format
      const results = [
        {
          id: "tool-connect-bank",
          title: "Connect Financial Institution",
          url: `${getBaseUrl()}/docs/connect-bank`,
        },
        {
          id: "tool-check-status",
          title: "Check Connection Status",
          url: `${getBaseUrl()}/docs/check-status`,
        },
        {
          id: "tool-disconnect-bank",
          title: "Disconnect Financial Institution",
          url: `${getBaseUrl()}/docs/disconnect-bank`,
        },
        {
          id: "tool-get-transactions",
          title: "Get Plaid Transactions",
          url: `${getBaseUrl()}/docs/transactions`,
        },
        {
          id: "tool-track-subscriptions",
          title: "Track Subscriptions",
          url: `${getBaseUrl()}/docs/subscriptions`,
        },
      ];

      // Must return exactly one text content item with JSON-encoded string
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ results }),
          },
        ],
      };
    }
  );

  server.tool(
    "fetch",
    "Fetch detailed information about a specific financial tool or capability.",
    {
      id: z.string().describe("Tool ID to fetch details for"),
    },
    {
      readOnlyHint: true,
      openWorldHint: true,
    },
    async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;
      console.log("fetch called by user:", userId, "id:", args.id);

      // Map tool IDs to detailed information
      const toolDetails: Record<string, any> = {
        "tool-connect-bank": {
          id: "tool-connect-bank",
          title: "Connect Financial Institution",
          text: "Initiates connection to a financial institution via Plaid. Opens a secure browser flow for bank authentication. Supports sandbox testing. Use the 'connect-financial-institution' MCP tool to start this flow.",
          url: `${getBaseUrl()}/docs/connect-bank`,
          metadata: { tool_name: "connect-financial-institution" },
        },
        "tool-check-status": {
          id: "tool-check-status",
          title: "Check Connection Status",
          text: "Checks if user has connected financial institutions and displays account details including balances. Shows all connected banks. Use the 'check-connection-status' MCP tool to check status.",
          url: `${getBaseUrl()}/docs/check-status`,
          metadata: { tool_name: "check-connection-status" },
        },
        "tool-disconnect-bank": {
          id: "tool-disconnect-bank",
          title: "Disconnect Financial Institution",
          text: "Disconnects a financial institution and invalidates its Plaid access token. Removes the connection from the database. Use the 'disconnect-financial-institution' MCP tool with the item_id parameter (get item_id from check-connection-status).",
          url: `${getBaseUrl()}/docs/disconnect-bank`,
          metadata: { tool_name: "disconnect-financial-institution" },
        },
        "tool-get-transactions": {
          id: "tool-get-transactions",
          title: "Get Plaid Transactions",
          text: "Retrieves real transaction data from all connected financial institutions via Plaid. Returns downloadable CSV file for specified date range. Use the 'get-plaid-transactions' MCP tool with optional start_date and end_date parameters.",
          url: `${getBaseUrl()}/docs/transactions`,
          metadata: { tool_name: "get-plaid-transactions" },
        },
        "tool-track-subscriptions": {
          id: "tool-track-subscriptions",
          title: "Track Subscriptions",
          text: "Analyzes credit card transactions to identify recurring subscriptions. Downloads transaction data and analysis script for local processing. Use the 'track-subscriptions' MCP tool to start analysis.",
          url: `${getBaseUrl()}/docs/subscriptions`,
          metadata: { tool_name: "track-subscriptions" },
        },
      };

      const result = toolDetails[args.id] || {
        id: args.id,
        title: "Unknown Tool",
        text: "Tool not found. Available tools: connect-financial-institution, check-connection-status, disconnect-financial-institution, get-plaid-transactions, track-subscriptions.",
        url: `${getBaseUrl()}/docs`,
        metadata: null,
      };

      // Must return exactly one text content item with JSON-encoded string
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );
  // Plaid Connection Tools
  server.tool(
    "connect-financial-institution",
    "Initiate connection to a financial institution via Plaid. This opens a secure browser flow where the user can authenticate with their bank. Supports sandbox testing with fake bank data.",
    {},
    {
      readOnlyHint: true,
      openWorldHint: true,
    },
    async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("connect-financial-institution called by user:", userId);

      const baseUrl = getBaseUrl();

      return connectFinancialInstitutionHandler(userId, baseUrl, plaidClient);
    }
  );

  server.tool(
    "check-connection-status",
    "Check if the user has connected a financial institution and view connected account details. Shows account balances and connection status.",
    {},
    {
      readOnlyHint: true,
      openWorldHint: true,
    },
    async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("check-connection-status called by user:", userId);

      return checkConnectionStatusHandler(userId, plaidClient);
    }
  );

  server.tool(
    "get-plaid-transactions",
    "Retrieve real transaction data from the user's connected financial institution via Plaid. Returns a downloadable CSV file of transactions for the specified date range.",
    {
      start_date: z
        .string()
        .optional()
        .describe(
          "Start date in YYYY-MM-DD format (default: 90 days ago)"
        ),
      end_date: z
        .string()
        .optional()
        .describe("End date in YYYY-MM-DD format (default: today)"),
    },
    {
      readOnlyHint: true,
      openWorldHint: true,
    },
    async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("get-plaid-transactions called by user:", userId);

      const baseUrl = getBaseUrl();

      return getPlaidTransactionsHandler(
        userId,
        baseUrl,
        args,
        plaidClient
      );
    }
  );

  server.tool(
    "disconnect-financial-institution",
    "Disconnect a financial institution and invalidate its access token. Requires the Plaid item_id which can be obtained from check-connection-status.",
    {
      item_id: z
        .string()
        .describe("The Plaid item_id to disconnect (get from check-connection-status)"),
    },
    async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("disconnect-financial-institution called by user:", userId, "item:", args.item_id);

      return disconnectFinancialInstitutionHandler(userId, args.item_id, plaidClient);
    }
  );

  server.tool(
    "track-subscriptions",
    "Initiate subscription tracking analysis on credit card transactions for the authenticated user. Downloads transaction data and analysis script for local processing.",
    {},
    {
      readOnlyHint: true,
      openWorldHint: true,
    },
    async (_args, { authInfo }) => {
      // Extract user ID from Clerk OAuth token
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("track-subscriptions called by user:", userId);

      // Get base URL from environment
      const baseUrl = getBaseUrl();

      return trackSubscriptionsHandler(userId, baseUrl);
    }
  );

  return { server };
};
