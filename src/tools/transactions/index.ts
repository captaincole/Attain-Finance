/**
 * Transaction Tools Registry
 * All transaction-related MCP tools
 */

import { z } from "zod";
import { PlaidApi } from "plaid";
import { refreshTransactionsHandler } from "./refresh-transactions.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  options: any;
  handler: (args: any, context: any, plaidClient?: PlaidApi) => Promise<any>;
}

export function getTransactionTools(): ToolDefinition[] {
  return [
    {
      name: "refresh-transactions",
      description:
        "Fetch latest transactions from connected bank accounts, categorize new transactions using AI, and update budget labels. Call this tool after connecting accounts or when you want to sync the latest data from your bank. This is a one-time sync operation - transaction data is stored in the database for fast access.",
      inputSchema: {
        // No arguments needed
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
        _meta: {
          "openai/toolInvocation/invoking": "Syncing transactions from your bank...",
          "openai/toolInvocation/invoked": "Transactions synced successfully",
        },
      },
      handler: async (_args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        if (!plaidClient) {
          throw new Error("Plaid client not available");
        }

        return refreshTransactionsHandler(userId, plaidClient);
      },
    },
  ];
}
