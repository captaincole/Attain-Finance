/**
 * Budget Tools Registry
 * All budget-related MCP tools
 */

import { PlaidApi } from "plaid";
import {
  UpsertBudgetArgsSchema,
  upsertBudgetHandler,
} from "./upsert-budget.js";
import { GetBudgetsArgsSchema, getBudgetsHandler } from "./get-budgets.js";

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
      inputSchema: GetBudgetsArgsSchema,
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
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return getBudgetsHandler(userId, args, plaidClient!);
      },
    },
    {
      name: "upsert-budget",
      description:
        "Create a new budget or update an existing one after calling get-budgets first. Requires ALL fields: title (display name), filter_prompt (natural language describing which transactions to include, e.g., 'Include coffee shops like Starbucks, Dunkin, and any merchant with coffee in the name'), budget_amount (dollar limit), and time_period (daily/weekly/monthly/custom). If 'id' is provided, updates existing budget; otherwise creates new one.",
      inputSchema: UpsertBudgetArgsSchema,
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
