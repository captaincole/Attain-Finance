/**
 * Budget Tools Registry
 * All budget-related MCP tools
 */

import { z } from "zod";
import { PlaidApi } from "plaid";
import { createBudgetHandler } from "./create-budget.js";
import { updateBudgetRulesHandler } from "./update-budget-rules.js";
import { getBudgetsHandler } from "./get-budgets.js";
import { deleteBudgetHandler } from "./delete-budget.js";
import { logToolEvent } from "../../utils/logger.js";

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
        logToolEvent("get-budgets", "called", {
          hasAuthInfo: !!authInfo,
          args,
          hasPlaidClient: !!plaidClient,
        });
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          logToolEvent("get-budgets", "missing-user-id", undefined, "error");
          throw new Error("User authentication required");
        }

        logToolEvent("get-budgets", "handler-invoke", { userId });
        return getBudgetsHandler(userId, args);
      },
    },
    {
      name: "create-budget",
      description:
        "Create a new budget after calling get-budgets first. Two budget types: ROLLING (last N days, continuously rolling) or FIXED (calendar-based with custom start date). For rolling budgets: provide time_period='rolling' and custom_period_days. For fixed budgets: provide time_period (weekly/biweekly/monthly/quarterly/yearly) and fixed_period_start_date in YYYY-MM-DD format.",
      inputSchema: {
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
          .enum(["rolling", "weekly", "biweekly", "monthly", "quarterly", "yearly"])
          .describe("Budget type: 'rolling' for last N days, or fixed periods (weekly/biweekly/monthly/quarterly/yearly)"),
        custom_period_days: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Required for 'rolling' budgets: number of days to track (e.g., 7, 30, 90)"),
        fixed_period_start_date: z
          .string()
          .optional()
          .describe("Required for fixed budgets: anchor date in YYYY-MM-DD format (e.g., '2025-01-15' for monthly budget starting on 15th)"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
        _meta: {
          "openai/outputTemplate": "ui://widget/budget-list.html",
          "openai/toolInvocation/invoking": "Creating budget...",
          "openai/toolInvocation/invoked": "Budget created",
          "openai/widgetAccessible": true,
          "openai/resultCanProduceWidget": true,
        },
      },
      handler: async (args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return createBudgetHandler(userId, args);
      },
    },
    {
      name: "update-budget-rules",
      description:
        "Update an existing budget's configuration (title, filter rules, amount, or time period). Call get-budgets first to get the budget ID. All parameters except 'id' are optional - only provide the fields you want to change. After updating, transactions will be re-matched against the new rules.",
      inputSchema: {
        id: z
          .string()
          .describe("Budget ID to update (required - get from get-budgets tool)"),
        title: z
          .string()
          .optional()
          .describe("Optional: Update display name for the budget"),
        filter_prompt: z
          .string()
          .optional()
          .describe("Optional: Update natural language filter criteria"),
        budget_amount: z
          .number()
          .positive()
          .optional()
          .describe("Optional: Update dollar amount limit"),
        time_period: z
          .enum(["rolling", "weekly", "biweekly", "monthly", "quarterly", "yearly"])
          .optional()
          .describe("Optional: Update budget type"),
        custom_period_days: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Optional: Update number of days for rolling budgets"),
        fixed_period_start_date: z
          .string()
          .optional()
          .describe("Optional: Update anchor date for fixed budgets (YYYY-MM-DD)"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
        _meta: {
          "openai/outputTemplate": "ui://widget/budget-list.html",
          "openai/toolInvocation/invoking": "Updating budget...",
          "openai/toolInvocation/invoked": "Budget updated",
          "openai/widgetAccessible": true,
          "openai/resultCanProduceWidget": true,
        },
      },
      handler: async (args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return updateBudgetRulesHandler(userId, args);
      },
    },
    {
      name: "delete-budget",
      description:
        "Delete a budget by ID. Use get-budgets to find the budget ID.",
      inputSchema: {
        id: z.string().describe("Budget ID to delete"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return deleteBudgetHandler(userId, args);
      },
    },
  ];
}
