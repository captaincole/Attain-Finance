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

// Type definitions for Plaid storage
interface PendingConnection {
  userId: string;
  createdAt: Date;
  status: "pending" | "completed" | "failed";
  completedAt?: Date;
  error?: string;
}

interface PlaidConnection {
  accessToken: string;
  itemId: string;
  connectedAt: Date;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    subtype: string | null;
    mask: string | null;
  }>;
}

/**
 * Helper to get the base URL for generating download links
 * Uses BASE_URL environment variable or defaults to localhost
 */
function getBaseUrl(): string {
  return process.env.BASE_URL || "http://localhost:3000";
}

export const createServer = (
  plaidClient: PlaidApi,
  pendingConnections: Map<string, PendingConnection>,
  userPlaidTokens: Map<string, PlaidConnection>
) => {
  // Create server instance
  const server = new McpServer({
    name: "personal-finance",
    version: "1.0.0",
  });

  // Note: MCP resources removed in favor of signed download URLs
  // See /api/data/transactions endpoint for user-specific data downloads

  // Register tools
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

      return connectFinancialInstitutionHandler(
        userId,
        baseUrl,
        plaidClient,
        pendingConnections
      );
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

      return checkConnectionStatusHandler(userId, plaidClient, userPlaidTokens);
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
        plaidClient,
        userPlaidTokens
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
