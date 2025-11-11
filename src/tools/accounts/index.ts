/**
 * Account Tools Registry
 * All account connection management MCP tools
 */

import { z } from "zod";
import {
  connectAccountHandler,
  disconnectAccountHandler,
  getAccountStatusHandler,
  getFinancialSummaryHandler,
} from "./handlers.js";
import { updateAccountLinkHandler } from "./update-account-link.js";
import { getBaseUrl } from "../../utils/config.js";
import { WIDGET_META } from "../../utils/widget-metadata.js";
import type { ToolDefinition } from "../types.js";

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
      handler: async (_args, { authInfo }, { plaidClient }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const baseUrl = getBaseUrl();
        return connectAccountHandler(userId, baseUrl, plaidClient!);
      },
    },
    {
      name: "financial-summary",
      description:
        "Net worth and asset overview. Shows total assets, liabilities, trend (week over week), and suggested next actions. Use this to recap overall health before diving into specific accounts.",
      inputSchema: {},
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
        _meta: WIDGET_META.financialSummary,
      },
      handler: async (_args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return getFinancialSummaryHandler(userId);
      },
    },
    {
      name: "get-account-status",
      description:
        "View connected institutions with balance details, connection health, and last sync timestamps. Use this before updating or disconnecting an institution.",
      inputSchema: {},
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
        _meta: WIDGET_META.accountStatus,
      },
      handler: async (_args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return getAccountStatusHandler(userId);
      },
    },
    {
      name: "update-account-link",
      description:
        "IMPORTANT: Only use this tool when an account connection is broken. ALWAYS call get-account-status FIRST to verify the connection shows an error status (⚠️) before calling this tool. This tool updates a broken or expired account connection by re-authenticating with the financial institution. Returns a secure link for the user to complete re-authentication. After the user completes the update, they should say 'I've updated it, please refresh my transactions' to sync their data.",
      inputSchema: {
        item_id: z
          .string()
          .describe(
            "The account's item_id to update (get this from get-account-status)"
          ),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, { plaidClient }) => {
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
            "The account's item_id to disconnect (get this from get-account-status)"
          ),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, { plaidClient }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return disconnectAccountHandler(userId, args.item_id, plaidClient!);
      },
    },
  ];
}
