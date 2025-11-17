/**
 * Admin/operational MCP tools
 * - Currently exposes minting of MCP bearer JWTs for allowlisted users.
 */

import type { ToolDefinition } from "../types.js";
import { CONFIG } from "../../utils/config.js";
import { logEvent } from "../../utils/logger.js";

export const MINT_MCP_BEARER_TOOL_NAME = "mint-mcp-bearer-token";

interface AuthContext {
  userId?: string;
  sessionId?: string;
  getToken?: (options?: { template?: string }) => Promise<string | null>;
  extra?: {
    userId?: string;
  };
}

export function isMintAllowedForUser(userId?: string | null): boolean {
  if (!userId) {
    return false;
  }
  return CONFIG.mcpAuth.tokenMintAllowList.includes(userId);
}

export function getAdminTools(): ToolDefinition[] {
  const templateName = CONFIG.mcpAuth.templateName;
  const allowList = CONFIG.mcpAuth.tokenMintAllowList;

  if (!templateName || allowList.length === 0) {
    return [];
  }

  return [
    {
      name: MINT_MCP_BEARER_TOOL_NAME,
      description:
        "Mint a short-lived MCP bearer JWT for the current Clerk user. Only available to allowlisted production accounts and requires an authenticated OAuth session.",
      inputSchema: {},
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (_args, { authInfo }) => {
        const context = authInfo as AuthContext | undefined;
        const userId = context?.extra?.userId ?? context?.userId;

        if (!userId) {
          throw new Error("User authentication required.");
        }

        if (!isMintAllowedForUser(userId)) {
          throw new Error("You are not authorized to mint MCP bearer tokens.");
        }

        if (typeof context?.getToken !== "function") {
          throw new Error("Minting is only available from a Clerk OAuth session.");
        }

        const token = await context.getToken({ template: templateName });
        if (!token) {
          throw new Error("Clerk did not return a token for the requested template.");
        }

        logEvent("TOOLS:MINT_MCP_BEARER_TOKEN", "token-minted", {
          userId,
          templateName,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: [
                "✅ **Bearer token minted**",
                "",
                `User: \`${userId}\``,
                "",
                "```",
                token,
                "```",
              ].join("\n"),
            },
          ],
          structuredContent: {
            token,
            template: templateName,
            userId,
          },
        };
      },
    },
  ];
}
