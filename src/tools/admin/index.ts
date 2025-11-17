/**
 * Admin/operational MCP tools
 * - Currently exposes minting of MCP bearer JWTs for allowlisted users.
 */

import { Buffer } from "node:buffer";
import { createClerkClient } from "@clerk/backend";
import type { ToolDefinition } from "../types.js";
import { CONFIG } from "../../utils/config.js";
import { logEvent } from "../../utils/logger.js";

export const MINT_MCP_BEARER_TOOL_NAME = "mint-mcp-bearer-token";

interface AuthContext {
  userId?: string;
  sessionId?: string;
  authMethod?: string;
  token?: string;
  getToken?: (options?: { template?: string }) => Promise<string | null>;
  extra?: {
    userId?: string;
  };
}

type AdminToolDependencies = {
  createClerkClientFn?: typeof createClerkClient;
};

export function isMintAllowedForUser(userId?: string | null): boolean {
  if (!userId) {
    return false;
  }
  return CONFIG.mcpAuth.tokenMintAllowList.includes(userId);
}

export function getAdminTools(deps?: AdminToolDependencies): ToolDefinition[] {
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
        const authContext = authInfo as AuthContext | undefined;
        const userId = authContext?.extra?.userId ?? authContext?.userId;

        if (!userId) {
          throw new Error("User authentication required.");
        }

        if (!isMintAllowedForUser(userId)) {
          throw new Error("You are not authorized to mint MCP bearer tokens.");
        }

        if (authContext?.authMethod === "bearer") {
          throw new Error("Minting is only available via the OAuth session. Re-authenticate without a bearer token.");
        }

        const secretKey = CONFIG.clerk.secretKey;
        if (!secretKey) {
          throw new Error("Clerk secret key is not configured on the server.");
        }

        const sessionToken = authContext?.token;
        if (!sessionToken) {
          logEvent("TOOLS:MINT_MCP_BEARER_TOKEN", "missing-session-token", {
            userId,
            hasAuthContext: Boolean(authContext),
            authKeys: authContext ? Object.keys(authContext).filter((key) => key !== "claims") : [],
          });
          throw new Error("Minting requires an active Clerk session token.");
        }

        const sessionId = extractSessionId(sessionToken);
        if (!sessionId) {
          throw new Error("Unable to extract Clerk session ID from authentication token.");
        }

        const mintClient = deps?.createClerkClientFn ?? ((options: { secretKey: string }) =>
          createClerkClient(options));
        const clerkClient = mintClient({ secretKey });
        const minted = await clerkClient.sessions.getToken(sessionId, templateName);
        const token = (minted as any).jwt ?? minted;

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

function extractSessionId(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload && typeof payload.sid === "string") {
      return payload.sid;
    }
    return null;
  } catch {
    return null;
  }
}
