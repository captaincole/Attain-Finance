/**
 * Categorization Tools Registry
 * AI-powered transaction categorization tools
 */

import { z } from "zod";
import { PlaidApi } from "plaid";
import { getPlaidTransactionsHandler } from "./get-transactions.js";
import { getRawTransactionsHandler } from "./get-raw-transactions.js";
import { updateCategorizationRulesHandler } from "./update-rules.js";
import { getBaseUrl } from "../../utils/config.js";
import type { ToolDefinition } from "../accounts/index.js";

export function getCategorizationTools(): ToolDefinition[] {
  return [
    {
      name: "get-raw-transactions",
      description: "Download raw transaction data as CSV without AI categorization. Use this when you need the pure data export for external analysis or spreadsheet tools. For analyzed data with categories, use 'get-transactions' instead.",
      inputSchema: {
        start_date: z
          .string()
          .optional()
          .describe("Start date in YYYY-MM-DD format (default: 90 days ago)"),
        end_date: z
          .string()
          .optional()
          .describe("End date in YYYY-MM-DD format (default: today)"),
      },
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const baseUrl = getBaseUrl();
        return getRawTransactionsHandler(userId, baseUrl, args, plaidClient!);
      },
    },
    {
      name: "get-transactions",
      description: "Retrieve categorized transaction data from the user's connected financial institution. Returns structured transaction data with AI-powered categorization, along with analysis and visualization guidance.",
      inputSchema: {
        start_date: z
          .string()
          .optional()
          .describe("Start date in YYYY-MM-DD format (default: all available data)"),
        end_date: z
          .string()
          .optional()
          .describe("End date in YYYY-MM-DD format (default: today)"),
        account_filter: z
          .string()
          .optional()
          .describe("Filter transactions by account name (placeholder - not yet implemented)"),
        category_filter: z
          .string()
          .optional()
          .describe("Filter transactions by category (placeholder - not yet implemented)"),
      },
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const baseUrl = getBaseUrl();
        return getPlaidTransactionsHandler(userId, baseUrl, args, plaidClient!);
      },
    },
    {
      name: "update-categorization-rules",
      description: "Update global transaction categorization rules that apply to ALL transactions (e.g., 'Categorize all Amazon Prime as Business expenses'). This updates the general category field for transactions but does NOT affect budget matching. To update which transactions match a specific budget, use 'update-budget-rules' instead. After updating, all transactions will be automatically re-categorized with the new rules in the background.",
      inputSchema: {
        rules: z
          .string()
          .describe("Custom categorization instructions (e.g., 'Categorize all Amazon Prime as Business expenses', 'Put Starbucks in Personal Care instead of Food & Dining')"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const baseUrl = getBaseUrl();
        return updateCategorizationRulesHandler(userId, baseUrl, args, plaidClient!);
      },
    },
  ];
}
