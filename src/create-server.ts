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

  console.log("=== MCP SERVER CREATED ===");
  console.log("Server name:", "personal-finance");
  console.log("Server version:", "1.0.0");

  // Note: MCP resources removed in favor of signed download URLs
  // See /api/data/transactions endpoint for user-specific data downloads

  // Register tools
  // Plaid Connection Tools
  server.tool(
    "connect-financial-institution",
    "Initiate connection to a financial institution via Plaid. This opens a secure browser flow where the user can authenticate with their bank. Supports sandbox testing with fake bank data.",
    {},
    {
      readOnlyHint: true,
      openWorldHint: true,
      securitySchemes: [
        { type: "oauth2", scopes: ["email", "profile"] },
      ],
    },
    async (_args, { authInfo }) => {
      console.log("=== TOOL CALLED: connect-financial-institution ===");
      const userId = authInfo?.extra?.userId as string | undefined;
      console.log("User ID:", userId);
      console.log("Auth info:", JSON.stringify(authInfo, null, 2));

      if (!userId) {
        console.log("ERROR: User authentication required");
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
      securitySchemes: [
        { type: "oauth2", scopes: ["email", "profile"] },
      ],
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
      securitySchemes: [
        { type: "oauth2", scopes: ["email", "profile"] },
      ],
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
    {
      securitySchemes: [
        { type: "oauth2", scopes: ["email", "profile"] },
      ],
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
      securitySchemes: [
        { type: "oauth2", scopes: ["email", "profile"] },
      ],
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

  console.log("=== TOOLS REGISTERED ===");
  console.log("Total tools registered: 5");
  console.log("Tools: connect-financial-institution, check-connection-status, get-plaid-transactions, disconnect-financial-institution, track-subscriptions");

  return { server };
};
