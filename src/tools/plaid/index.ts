/**
 * Plaid Tools Registry
 * All Plaid-related MCP tools
 */

import { z } from "zod";
import { PlaidApi } from "plaid";
import {
  connectAccountHandler,
  getAccountStatusHandler,
  disconnectAccountHandler,
} from "./connection.js";
import { getBaseUrl } from "../../utils/config.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  options: any;
  handler: (args: any, context: any, plaidClient?: PlaidApi) => Promise<any>;
}

export function getPlaidTools(): ToolDefinition[] {
  return [
    {
      name: "connect-account",
      description: "Connect a bank, credit card, or investment account to get started. Opens a secure browser window where the user can safely authenticate with their financial institution.",
      inputSchema: {},
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (_args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const baseUrl = getBaseUrl();
        return connectAccountHandler(userId, baseUrl, plaidClient!);
      },
    },
    {
      name: "get-account-status",
      description: "View current account balances and see which accounts are connected. Use this to check balances across all your linked bank accounts, credit cards, and investments.",
      inputSchema: {},
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
        _meta: {
          "openai/outputTemplate": "ui://widget/connected-institutions.html",
          "openai/toolInvocation/invoking": "Loading your account balances...",
          "openai/toolInvocation/invoked": "Account balances loaded",
          "openai/widgetAccessible": true,
          "openai/resultCanProduceWidget": true,
        },
      },
      handler: async (_args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return getAccountStatusHandler(userId, plaidClient!);
      },
    },
    {
      name: "disconnect-account",
      description: "Remove a connected account and revoke access. This will delete all stored connection data for the specified account.",
      inputSchema: {
        item_id: z
          .string()
          .describe("The account's item_id to disconnect (get this from get-account-status)"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return disconnectAccountHandler(userId, args.item_id, plaidClient!);
      },
    },
  ];
}
