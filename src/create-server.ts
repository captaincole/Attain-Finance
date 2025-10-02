import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import tool handlers
import { trackSubscriptionsHandler } from "./tools/track-subscriptions.js";
import { getAlertsHandler, getForecastHandler } from "./tools/weather.js";

// Import resource handlers
import { transactionsCsvHandler, analysisScriptHandler } from "./resources/finance-data.js";

export const createServer = () => {
  // Create server instance
  const server = new McpServer({
    name: "personal-finance",
    version: "1.0.0",
  });

  // Register resources
  server.resource(
    "transactions-csv",
    "pfinance://data/transactions.csv",
    {
      name: "Transactions CSV",
      description: "Sample credit card transactions CSV with 3 months of data. Save this file locally before processing.",
      mimeType: "text/csv",
    },
    transactionsCsvHandler
  );

  server.resource(
    "analysis-script",
    "pfinance://scripts/analyze-subscriptions.js",
    {
      name: "Analysis Script",
      description: "Node.js script to analyze transactions and detect recurring subscriptions. Save this file locally before running.",
      mimeType: "application/javascript",
    },
    analysisScriptHandler
  );

  // Register tools
  server.tool(
    "track-subscriptions",
    "Initiate subscription tracking analysis on credit card transactions. Returns resources and instructions for identifying recurring subscriptions.",
    {},
    trackSubscriptionsHandler
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
    getAlertsHandler
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
    getForecastHandler
  );

  return { server };
};
