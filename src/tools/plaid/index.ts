/**
 * Plaid Tools Registry
 * All Plaid-related MCP tools
 */

import { z } from "zod";
import { PlaidApi } from "plaid";
import {
  connectFinancialInstitutionHandler,
  checkConnectionStatusHandler,
  disconnectFinancialInstitutionHandler,
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
      name: "connect-financial-institution",
      description: "Initiate connection to a financial institution via Plaid. This opens a secure browser flow where the user can authenticate with their bank. Supports sandbox testing with fake bank data.",
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
        return connectFinancialInstitutionHandler(userId, baseUrl, plaidClient!);
      },
    },
    {
      name: "check-connection-status",
      description: "Check if the user has connected a financial institution and view connected account details. Shows account balances and connection status.",
      inputSchema: {},
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
        _meta: {
          "openai/outputTemplate": "ui://widget/connected-institutions.html",
          "openai/toolInvocation/invoking": "Loading your connected institutions...",
          "openai/toolInvocation/invoked": "Connected institutions loaded",
          "openai/widgetAccessible": true,
          "openai/resultCanProduceWidget": true,
        },
      },
      handler: async (_args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return checkConnectionStatusHandler(userId, plaidClient!);
      },
    },
    {
      name: "disconnect-financial-institution",
      description: "Disconnect a financial institution and invalidate its access token. Requires the Plaid item_id which can be obtained from check-connection-status.",
      inputSchema: {
        item_id: z
          .string()
          .describe("The Plaid item_id to disconnect (get from check-connection-status)"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, plaidClient) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return disconnectFinancialInstitutionHandler(userId, args.item_id, plaidClient!);
      },
    },
  ];
}
