/**
 * Budget Tools Registry
 * All budget-related MCP tools
 */

import { z } from "zod";
import { PlaidApi } from "plaid";
import { upsertBudgetHandler } from "./upsert-budget.js";
import { getBudgetsHandler } from "./get-budgets.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  options: any;
  handler: (args: any, context: any, plaidClient?: PlaidApi) => Promise<any>;
}

export function getBudgetTools(): ToolDefinition[] {
  return [
    {
      name: "get-budgets",
      description:
        "CALL THIS FIRST when user asks about budgets, wants to create a budget, or view budget status. Shows existing budgets with spending progress or provides creation guidance if no budgets exist. Use showTransactions=true to include matching transactions, or false (default) to get just spending totals. Optionally filter by budget_id to get a specific budget. Returns widget visualization showing budget progress bars.",
      inputSchema: {
        budget_id: z
          .string()
          .optional()
          .describe("Optional: Get specific budget by ID. If omitted, returns all budgets."),
        showTransactions: z
          .boolean()
          .default(false)
          .describe("Include matching transactions in the response (default: false)"),
      },
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
        _meta: {
          "openai/outputTemplate": "ui://widget/budget-list.html",
          "openai/toolInvocation/invoking": "Calculating budget status...",
          "openai/toolInvocation/invoked": "Budget status loaded",
          "openai/widgetAccessible": true,
          "openai/resultCanProduceWidget": true,
        },
      },
      handler: async (args, { authInfo }, plaidClient) => {
        console.log("[GET-BUDGETS] Handler called with args:", args);
        console.log("[GET-BUDGETS] authInfo present:", !!authInfo);
        console.log("[GET-BUDGETS] plaidClient present:", !!plaidClient);

        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          console.error("[GET-BUDGETS] No userId found in authInfo");
          throw new Error("User authentication required");
        }

        console.log("[GET-BUDGETS] Calling getBudgetsHandler for user:", userId);
        return getBudgetsHandler(userId, args, plaidClient!);
      },
    },
    {
      name: "upsert-budget",
      description:
        "Create a new budget or update an existing one after calling get-budgets first. Requires ALL fields: title (display name), filter_prompt (natural language describing which transactions to include, e.g., 'Include coffee shops like Starbucks, Dunkin, and any merchant with coffee in the name'), budget_amount (dollar limit), and time_period (daily/weekly/monthly/custom). If 'id' is provided, updates existing budget; otherwise creates new one.",
      inputSchema: {
        id: z
          .string()
          .optional()
          .describe("Optional: Budget ID to update. If omitted or doesn't exist, creates new budget."),
        title: z
          .string()
          .describe("Display name for the budget (e.g., 'Coffee Shop Budget')"),
        filter_prompt: z
          .string()
          .describe("Natural language filter criteria describing which transactions to include"),
        budget_amount: z
          .number()
          .positive()
          .describe("Dollar amount limit for the budget"),
        time_period: z
          .enum(["daily", "weekly", "monthly", "custom"])
          .describe("Time period for budget tracking"),
        custom_period_days: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Number of days for custom period (required if time_period is 'custom')"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return upsertBudgetHandler(userId, args);
      },
    },
  ];
}
