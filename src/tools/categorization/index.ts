/**
 * Categorization Tools Registry
 * AI-powered transaction categorization tools
 */

import { z } from "zod";
import { PlaidApi } from "plaid";
import { getPlaidTransactionsHandler } from "./get-transactions.js";
import { updateCategorizationRulesHandler } from "./update-rules.js";
import { getBaseUrl } from "../../utils/config.js";
import type { ToolDefinition } from "../plaid/index.js";

export function getCategorizationTools(): ToolDefinition[] {
  return [
    {
      name: "get-transactions",
      description: "Retrieve real transaction data from the user's connected financial institution. Returns a downloadable CSV file of transactions for the specified date range.",
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
        return getPlaidTransactionsHandler(userId, baseUrl, args, plaidClient!);
      },
    },
    {
      name: "update-categorization-rules",
      description: "Update your custom transaction categorization rules. After updating, your transaction data will be automatically re-categorized with the new rules. Use this to customize how transactions are grouped (e.g., 'Put Amazon Prime in Business category').",
      inputSchema: {
        rules: z
          .string()
          .describe("Custom categorization instructions (e.g., 'Categorize all Amazon Prime as Business expenses')"),
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
