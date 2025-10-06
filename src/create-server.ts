import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlaidApi } from "plaid";

// Import tool handlers
import { trackSubscriptionsHandler } from "./tools/track-subscriptions.js";
import { getAlertsHandler, getForecastHandler } from "./tools/weather.js";
import {
  connectFinancialInstitutionHandler,
  checkConnectionStatusHandler,
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
          text: "Checks if user has connected a financial institution and displays account details including balances. Use the 'check-connection-status' MCP tool to check status.",
          url: `${getBaseUrl()}/docs/check-status`,
          metadata: { tool_name: "check-connection-status" },
        },
        "tool-get-transactions": {
          id: "tool-get-transactions",
          title: "Get Plaid Transactions",
          text: "Retrieves real transaction data from connected financial institution via Plaid. Returns downloadable CSV file for specified date range. Use the 'get-plaid-transactions' MCP tool with optional start_date and end_date parameters.",
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
        text: "Tool not found. Available tools: connect-financial-institution, check-connection-status, get-plaid-transactions, track-subscriptions.",
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
    "track-subscriptions",
    "Initiate subscription tracking analysis on credit card transactions for the authenticated user. Downloads transaction data and analysis script for local processing.",
    {},
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

  server.tool(
    "get-alerts",
    "Get weather alerts for a state",
    {
      state: z
        .string()
        .length(2)
        .describe("Two-letter state code (e.g. CA, NY)"),
    },
    async (args, { authInfo }) => {
      // Extract user ID from Clerk OAuth token (available for future use)
      const userId = authInfo?.extra?.userId as string | undefined;
      console.log("get-alerts called by user:", userId);

      return getAlertsHandler(args);
    }
  );

  server.tool(
    "get-forecast",
    "Get weather forecast for a location",
    {
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .describe("Latitude of the location"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .describe("Longitude of the location"),
    },
    async (args, { authInfo }) => {
      // Extract user ID from Clerk OAuth token (available for future use)
      const userId = authInfo?.extra?.userId as string | undefined;
      console.log("get-forecast called by user:", userId);

      return getForecastHandler(args);
    }
  );

  return { server };
};
