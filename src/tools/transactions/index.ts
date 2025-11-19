/**
 * Transaction Tools Registry
 * All transaction-related MCP tools
 */

import { z } from "zod";
import {
  getPlaidTransactionsHandler,
  GetTransactionsArgsSchema,
  GetTransactionsOutputSchema,
} from "./get-transactions.js";
import { getRawTransactionsHandler } from "./get-raw-transactions.js";
import { getBaseUrl } from "../../utils/config.js";
import { getSupabaseForUser } from "../../storage/supabase.js";
import type { ToolDefinition } from "../types.js";

export function getTransactionTools(): ToolDefinition[] {
  return [
    {
      name: "get-transactions",
      description: "Retrieve categorized transaction data from the user's connected financial institution. Returns structured transaction data with AI-powered categorization, along with analysis and visualization guidance.",
      inputSchema: GetTransactionsArgsSchema,
      outputSchema: GetTransactionsOutputSchema,
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const supabaseClient = getSupabaseForUser(userId);
        const baseUrl = getBaseUrl();
        return getPlaidTransactionsHandler(userId, baseUrl, args, supabaseClient);
      },
    },
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
      handler: async (args, { authInfo }, { plaidClient }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const baseUrl = getBaseUrl();
        return getRawTransactionsHandler(userId, baseUrl, args, plaidClient!);
      },
    },
  ];
}
