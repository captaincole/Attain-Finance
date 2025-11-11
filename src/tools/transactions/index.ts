/**
 * Transaction Tools Registry
 * All transaction-related MCP tools
 */

import { z } from "zod";
import { getPlaidTransactionsHandler } from "./get-transactions.js";
import { getRawTransactionsHandler } from "./get-raw-transactions.js";
import { getBaseUrl } from "../../utils/config.js";
import { getSupabaseForUser } from "../../storage/supabase.js";
import type { ToolDefinition } from "../types.js";

export function getTransactionTools(): ToolDefinition[] {
  return [
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
        account_ids: z
          .array(z.string())
          .optional()
          .describe("Filter transactions by account IDs (exact match). Get account IDs by calling get-account-status tool first. Example: ['account_123', 'account_456']"),
        categories: z
          .array(z.string())
          .optional()
          .describe("Filter transactions by category names (case-insensitive partial match). Searches AI-generated custom categories. Multiple categories use OR logic. Example: ['Food', 'Transport'] will match 'Food & Dining', 'Transportation', etc."),
        budget_id: z
          .string()
          .optional()
          .describe("Filter transactions tagged to a specific budget (exact match). Get budget IDs by calling get-budgets tool first. Example: 'budget_123'"),
        pending_only: z
          .boolean()
          .optional()
          .describe("Show only pending transactions (exact match). Useful for cash flow management and seeing what charges haven't cleared yet. Cannot be used with exclude_pending."),
        exclude_pending: z
          .boolean()
          .optional()
          .describe("Exclude pending transactions (exact match). Shows only confirmed/cleared transactions. Useful for accurate spending analysis. Cannot be used with pending_only."),
      },
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
