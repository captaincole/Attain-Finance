import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// Format alert data
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

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
    async () => {
      // Read and return the actual CSV file contents
      const csvPath = path.join(__dirname, "..", "public", "transactions.csv");
      const csvContent = fs.readFileSync(csvPath, "utf-8");

      return {
        contents: [
          {
            uri: "pfinance://data/transactions.csv",
            mimeType: "text/csv",
            text: csvContent,
          },
        ],
      };
    }
  );

  server.resource(
    "analysis-script",
    "pfinance://scripts/analyze-subscriptions.js",
    {
      name: "Analysis Script",
      description: "Node.js script to analyze transactions and detect recurring subscriptions. Save this file locally before running.",
      mimeType: "application/javascript",
    },
    async () => {
      // Read and return the actual script file contents
      const scriptPath = path.join(__dirname, "..", "public", "analyze-subscriptions.js");
      const scriptContent = fs.readFileSync(scriptPath, "utf-8");

      return {
        contents: [
          {
            uri: "pfinance://scripts/analyze-subscriptions.js",
            mimeType: "application/javascript",
            text: scriptContent,
          },
        ],
      };
    }
  );

  // Register subscription tracking tool
  server.tool(
    "track-subscriptions",
    "Initiate subscription tracking analysis on credit card transactions. Returns resources and instructions for identifying recurring subscriptions.",
    {},
    async () => {
      // Read the analysis prompt (from src directory since it's not in build)
      const promptPath = path.join(__dirname, "..", "src", "prompts", "analyze-subscriptions.txt");
      const analysisPrompt = fs.readFileSync(promptPath, "utf-8");

      const responseText = `✓ Subscription Tracking Initiated

AVAILABLE MCP RESOURCES:

1. Transaction Data (CSV)
   MCP Resource URI: pfinance://data/transactions.csv
   Resource Name: transactions-csv
   Description: 3 months of credit card transactions (100 rows)

2. Analysis Script (JavaScript)
   MCP Resource URI: pfinance://scripts/analyze-subscriptions.js
   Resource Name: analysis-script
   Description: Automated subscription detection script
   Usage: node analyze-subscriptions.js [path-to-csv]

---

${analysisPrompt}`;

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    }
  );

  // Register weather tools
  server.tool(
    "get-alerts",
    "Get weather alerts for a state",
    {
      state: z
        .string()
        .length(2)
        .describe("Two-letter state code (e.g. CA, NY)"),
    },
    async ({ state }) => {
      const stateCode = state.toUpperCase();
      const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
      const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

      if (!alertsData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve alerts data",
            },
          ],
        };
      }

      const features = alertsData.features || [];
      if (features.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No active alerts for ${stateCode}`,
            },
          ],
        };
      }

      const formattedAlerts = features.map(formatAlert);
      const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join(
        "\n"
      )}`;

      return {
        content: [
          {
            type: "text",
            text: alertsText,
          },
        ],
      };
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
    async ({ latitude, longitude }) => {
      // Get grid point data
      const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(
        4
      )},${longitude.toFixed(4)}`;
      const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

      if (!pointsData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
            },
          ],
        };
      }

      const forecastUrl = pointsData.properties?.forecast;
      if (!forecastUrl) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to get forecast URL from grid point data",
            },
          ],
        };
      }

      // Get forecast data
      const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
      if (!forecastData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve forecast data",
            },
          ],
        };
      }

      const periods = forecastData.properties?.periods || [];
      if (periods.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No forecast periods available",
            },
          ],
        };
      }

      // Format forecast periods
      const formattedForecast = periods.map((period: ForecastPeriod) =>
        [
          `${period.name || "Unknown"}:`,
          `Temperature: ${period.temperature || "Unknown"}°${
            period.temperatureUnit || "F"
          }`,
          `Wind: ${period.windSpeed || "Unknown"} ${
            period.windDirection || ""
          }`,
          `${period.shortForecast || "No forecast available"}`,
          "---",
        ].join("\n")
      );

      const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join(
        "\n"
      )}`;

      return {
        content: [
          {
            type: "text",
            text: forecastText,
          },
        ],
      };
    }
  );

  return { server };
};
