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
      name: "upsert-budget",
      description:
        "Create a new budget or update an existing one. If 'id' is provided and exists, the budget will be updated. If 'id' is omitted or doesn't exist, a new budget is created. Use natural language for filter_prompt to describe which transactions to include (e.g., 'Include coffee shops like Starbucks, Dunkin, and any merchant with coffee in the name').",
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
    {
      name: "get-budgets",
      description:
        "Get user's budgets with current spending status. Use showTransactions=true to include matching transactions, or false (default) to get just spending totals. Optionally filter by budget_id to get a specific budget. Returns widget visualization showing budget progress bars.",
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
  ];
}
