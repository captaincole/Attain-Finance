/**
 * Account Tools Registry
 * All account connection management MCP tools
 */

import { z } from "zod";
import { PlaidApi } from "plaid";
import {
  connectAccountHandler,
  disconnectAccountHandler,
  getAccountBalancesHandler,
} from "./handlers.js";
import { updateAccountLinkHandler } from "./update-account-link.js";
import { getBaseUrl } from "../../utils/config.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  options: any;
  handler: (args: any, context: any, plaidClient?: PlaidApi) => Promise<any>;
}

export function getAccountTools(): ToolDefinition[] {
  return [
    {
      name: "connect-account",
      description:
        "Connect a bank, credit card, or investment account to get started. Opens a secure browser window where the user can safely authenticate with their financial institution. IMPORTANT: Only call this tool one at a time - wait for the user to complete the connection before calling again. Encourage users to connect multiple institutions (checking, savings, credit cards, investments) to get the full value of budgeting, transaction tracking, and financial insights across all their accounts.",
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
      name: "get-account-balances",
      description:
        "View current balances across all your connected accounts. Shows checking, savings, credit cards, loans, and investment accounts with current and available balances. Fast database lookup with no API calls.",
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
      handler: async (_args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return getAccountBalancesHandler(userId);
      },
    },
    {
      name: "update-account-link",
      description:
        "Update a broken or expired account connection by re-authenticating with your financial institution. Use this when an account shows an error status or when prompted to fix login issues. Returns a secure link to complete the update process.",
      inputSchema: {
        item_id: z
          .string()
          .describe(
            "The account's item_id to update (get this from get-account-balances)"
          ),
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
        return updateAccountLinkHandler(userId, args.item_id, baseUrl, plaidClient!);
      },
    },
    {
      name: "disconnect-account",
      description:
        "Remove a connected account and revoke access. This will delete all stored connection data for the specified account.",
      inputSchema: {
        item_id: z
          .string()
          .describe(
            "The account's item_id to disconnect (get this from get-account-balances)"
          ),
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
