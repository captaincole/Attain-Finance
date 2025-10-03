import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import tool handlers
import { trackSubscriptionsHandler } from "./tools/track-subscriptions.js";
import { getAlertsHandler, getForecastHandler } from "./tools/weather.js";

/**
 * Helper to get the base URL for generating download links
 * Uses BASE_URL environment variable or defaults to localhost
 */
function getBaseUrl(): string {
  return process.env.BASE_URL || "http://localhost:3000";
}

export const createServer = () => {
  // Create server instance
  const server = new McpServer({
    name: "personal-finance",
    version: "1.0.0",
  });

  // Note: MCP resources removed in favor of signed download URLs
  // See /api/data/transactions endpoint for user-specific data downloads

  // Register tools
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
