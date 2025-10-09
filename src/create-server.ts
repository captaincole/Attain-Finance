import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type ListResourcesRequest,
  type ReadResourceRequest
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PlaidApi } from "plaid";
import { readFileSync } from "node:fs";

// Import tool handlers
import { trackSubscriptionsHandler } from "./tools/track-subscriptions.js";
import {
  connectFinancialInstitutionHandler,
  checkConnectionStatusHandler,
  disconnectFinancialInstitutionHandler,
} from "./tools/plaid-connection.js";
import { getPlaidTransactionsHandler } from "./tools/plaid-transactions.js";
import { updateCategorizationRulesHandler } from "./tools/update-categorization.js";
import { updateVisualizationHandler, resetVisualizationHandler } from "./tools/visualization-tools.js";
import { getVisualization } from "./db/visualization-storage.js";
import { getOpinionById, getOpinionsByTool, formatOpinionList } from "./db/opinion-storage.js";

/**
 * Helper to get the base URL for generating download links
 * Uses BASE_URL environment variable or defaults to localhost
 */
function getBaseUrl(): string {
  return process.env.BASE_URL || "http://localhost:3000";
}

export const createServer = (plaidClient: PlaidApi) => {
  // Create server instance with explicit capabilities
  const server = new McpServer(
    {
      name: "personal-finance",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  console.log("=== MCP SERVER CREATED ===");
  console.log("Server name:", "personal-finance");
  console.log("Server version:", "1.0.0");

  // Load built widget assets from public directory
  const CONNECTED_INSTITUTIONS_JS = readFileSync(
    "public/widgets/connected-institutions.js",
    "utf8"
  );
  const CONNECTED_INSTITUTIONS_CSS = (() => {
    try {
      return readFileSync(
        "public/widgets/connected-institutions.css",
        "utf8"
      );
    } catch {
      return "";
    }
  })();

  // Widget resource definition
  const widgetUri = "ui://widget/connected-institutions.html";
  const widgetMeta = {
    "openai/widgetDescription": "Interactive cards showing connected financial institutions with account balances",
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: []
    }
  };

  const widgetHTML = `
<div id="connected-institutions-root"></div>
${CONNECTED_INSTITUTIONS_CSS ? `<style>${CONNECTED_INSTITUTIONS_CSS}</style>` : ""}
<script type="module">${CONNECTED_INSTITUTIONS_JS}</script>
  `.trim();

  // Register widget resource handlers (matching OpenAI Pizzaz pattern)
  server.server.setRequestHandler(ListResourcesRequestSchema, async (_request: ListResourcesRequest) => ({
    resources: [
      {
        uri: widgetUri,
        name: "Connected Institutions Widget",
        description: "Interactive widget showing connected financial institutions with account balances",
        mimeType: "text/html+skybridge",
        _meta: widgetMeta
      }
    ]
  }));

  server.server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    if (request.params.uri !== widgetUri) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }

    return {
      contents: [
        {
          uri: widgetUri,
          mimeType: "text/html+skybridge",
          text: widgetHTML,
          _meta: widgetMeta
        }
      ]
    };
  });

  // Note: MCP resources removed in favor of signed download URLs and tools
  // Users can customize visualizations via update-visualization tool
  // Download customized scripts via /api/visualization/:userId endpoint

  // Register tools
  // Plaid Connection Tools
  server.tool(
    "connect-financial-institution",
    "Initiate connection to a financial institution via Plaid. This opens a secure browser flow where the user can authenticate with their bank. Supports sandbox testing with fake bank data.",
    {},
    {
      securitySchemes: [
        { type: "oauth2" },
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
      securitySchemes: [
        { type: "oauth2" },
      ],
      _meta: {
        "openai/outputTemplate": "ui://widget/connected-institutions.html",
        "openai/toolInvocation/invoking": "Loading your connected institutions...",
        "openai/toolInvocation/invoked": "Connected institutions loaded",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true
      }
    },
    async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("check-connection-status called by user:", userId);

      return checkConnectionStatusHandler(userId, plaidClient, widgetHTML, widgetUri);
    }
  );

  server.tool(
    "get-transactions",
    "Retrieve real transaction data from the user's connected financial institution. Returns a downloadable CSV file of transactions for the specified date range.",
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
      securitySchemes: [
        { type: "oauth2" },
      ],
    },
    async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("get-transactions called by user:", userId);

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
        { type: "oauth2" },
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
    "update-categorization-rules",
    "Update your custom transaction categorization rules. After updating, your transaction data will be automatically re-categorized with the new rules. Use this to customize how transactions are grouped (e.g., 'Put Amazon Prime in Business category').",
    {
      rules: z
        .string()
        .describe("Custom categorization instructions (e.g., 'Categorize all Amazon Prime as Business expenses')"),
    },
    {
      securitySchemes: [
        { type: "oauth2" },
      ],
    },
    async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("update-categorization-rules called by user:", userId);

      const baseUrl = getBaseUrl();

      return updateCategorizationRulesHandler(userId, baseUrl, args, plaidClient);
    }
  );

  server.tool(
    "track-subscriptions",
    "Initiate subscription tracking analysis on credit card transactions for the authenticated user. Downloads transaction data and analysis script for local processing.",
    {},
    {
      readOnlyHint: true,
      securitySchemes: [
        { type: "oauth2" },
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

  // Visualization customization tools
  server.tool(
    "update-visualization",
    "Customize your spending visualization with natural language. Examples: 'Make all the bars green', 'Show top 15 categories', 'Change bar character to circles'. Uses AI to modify the bash script and saves your custom version.",
    {
      request: z
        .string()
        .describe("Natural language customization request (e.g., 'make bars green')"),
    },
    {
      securitySchemes: [
        { type: "oauth2" },
      ],
    },
    async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("update-visualization called by user:", userId);

      const baseUrl = getBaseUrl();

      return updateVisualizationHandler(userId, baseUrl, args);
    }
  );

  server.tool(
    "reset-visualization",
    "Reset your visualization script to the default version. Use this if you want to start over with customizations.",
    {},
    {
      securitySchemes: [
        { type: "oauth2" },
      ],
    },
    async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("reset-visualization called by user:", userId);

      const baseUrl = getBaseUrl();

      return resetVisualizationHandler(userId, baseUrl);
    }
  );

  // Opinion tools
  server.tool(
    "get-opinion",
    "Get an expert opinion prompt to apply to your financial analysis. Returns the full analysis instructions for a specific methodology (e.g., Graham Stephan's 20% Rule, Minimalist budgeting).",
    {
      opinion_id: z
        .string()
        .describe("The ID of the opinion to retrieve (e.g., 'graham-20-percent-rule')"),
    },
    {
      readOnlyHint: true,
      securitySchemes: [
        { type: "oauth2" },
      ],
    },
    async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      console.log("get-opinion called by user:", userId, "opinion:", args.opinion_id);

      const opinion = await getOpinionById(args.opinion_id);

      if (!opinion) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Opinion '${args.opinion_id}' not found.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `## ${opinion.name}
By ${opinion.author}${opinion.author_url ? ` (${opinion.author_url})` : ""}

${opinion.description ? `${opinion.description}\n\n` : ""}---

${opinion.prompt}`,
          },
        ],
      };
    }
  );

  // Legacy tool for downloading default visualization (kept for backward compatibility)
  server.tool(
    "visualize-spending",
    "Download the default spending visualization script. For customized versions, use 'update-visualization' instead.",
    {},
    {
      readOnlyHint: true,
      securitySchemes: [
        { type: "oauth2" },
      ],
    },
    async (_args, _extra) => {
      const baseUrl = getBaseUrl();
      const scriptUrl = `${baseUrl}/visualize-spending.sh`;

      // Fetch available opinions for this tool
      const opinions = await getOpinionsByTool("visualize-spending");
      const opinionsSection = opinions.length > 0
        ? `\n\n---\n\n## Expert Opinions Available\n\n${formatOpinionList(opinions)}\n\nAfter visualizing your spending, you can apply an expert opinion for deeper budget analysis.`
        : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `
## Terminal Spending Visualizer

Download and run this script to see a bar chart of your spending by category:

\`\`\`bash
# Download the visualization script
curl "${scriptUrl}" -o visualize-spending.sh

# Make it executable
chmod +x visualize-spending.sh

# Run it with your transactions CSV
./visualize-spending.sh transactions.csv
\`\`\`

**What it shows:**
- Top 10 spending categories (AI categorized)
- Dollar amounts and percentages
- Visual bar charts
- Transaction counts per category

**Customize it:**
Instead of editing manually, say:
- "Make all the bars green"
- "Show top 15 categories instead of 10"
- "Change the bar character to circles"

This will call the \`update-visualization\` tool to save your custom version.

**Get your transactions first:**
Run \`get-plaid-transactions\` to download your categorized transaction data.${opinionsSection}
            `.trim(),
          },
        ],
      };
    }
  );

  console.log("=== TOOLS REGISTERED ===");
  console.log("Total tools registered: 10");
  console.log("Tools: connect-financial-institution, check-connection-status, get-transactions, disconnect-financial-institution, update-categorization-rules, track-subscriptions, update-visualization, reset-visualization, get-opinion, visualize-spending");

  return { server };
};
