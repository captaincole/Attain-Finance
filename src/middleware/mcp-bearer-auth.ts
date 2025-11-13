import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "@clerk/backend";
import type { JwtPayload } from "@clerk/types";
import { logEvent, serializeError } from "../utils/logger.js";

type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    sessionId?: string;
    token: string;
    claims: McpJwtPayload;
    actor?: McpJwtPayload["act"];
  };
};

type McpJwtPayload = JwtPayload & {
  template?: string;
  sid?: string;
  email?: string;
  mcp?: Record<string, unknown>;
};

interface McpBearerOptions {
  secretKey: string;
  audience: string;
  resourceUrl: string;
  realm?: string;
  templateName?: string;
  cacheTtlMs?: number;
  verifyTokenFn?: typeof verifyToken;
}

interface CacheEntry {
  claims: McpJwtPayload;
  expiresAt: number;
}

interface UnauthorizedOptions {
  res: Response;
  realm: string;
  resourceUrl: string;
  error: "invalid_request" | "invalid_token" | "insufficient_scope";
  description: string;
  logData?: Record<string, unknown>;
}

export interface McpBearerAuth {
  middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  clearCache: () => void;
}

const BEARER_PREFIX = "bearer ";

export function createMcpBearerAuthMiddleware(options: McpBearerOptions): McpBearerAuth {
  const {
    secretKey,
    audience,
    resourceUrl,
    realm = "mcp",
    templateName,
    cacheTtlMs = 0,
    verifyTokenFn,
  } = options;

  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required to verify MCP bearer tokens.");
  }

  if (!audience) {
    throw new Error("MCP bearer audience is required for token verification.");
  }

  const normalizedRealm = realm.trim() || "mcp";
  const normalizedResourceUrl = resourceUrl.trim() || audience;
  const normalizedTemplate = templateName?.trim();
  const ttl = Math.max(0, cacheTtlMs ?? 0);
  const verifier = verifyTokenFn ?? verifyToken;
  const tokenCache = new Map<string, CacheEntry>();

  function clearCache() {
    tokenCache.clear();
  }

  function buildWwwAuthenticateHeader(params: {
    realm: string;
    resourceUrl: string;
    error: string;
    description: string;
  }): string {
    const escapedDescription = params.description.replace(/"/g, "'");
    return `Bearer realm="${params.realm}", resource="${params.resourceUrl}", error="${params.error}", error_description="${escapedDescription}"`;
  }

  function respondUnauthorized(options: UnauthorizedOptions) {
    const header = buildWwwAuthenticateHeader({
      realm: options.realm,
      resourceUrl: options.resourceUrl,
      error: options.error,
      description: options.description,
    });

    options.res.setHeader("WWW-Authenticate", header);
    options.res.status(401).json({
      error: options.error,
      error_description: options.description,
    });

    logEvent("AUTH:MCP", "unauthorized", options.logData, "warn");
  }

  function extractBearerToken(authHeader?: string | string[]): string | null {
    if (!authHeader) {
      return null;
    }

    const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed.toLowerCase().startsWith(BEARER_PREFIX)) {
      return null;
    }

    const token = trimmed.slice(BEARER_PREFIX.length).trim();
    return token.length > 0 ? token : null;
  }

  function attachAuthContext(req: Request, claims: McpJwtPayload, token: string) {
    (req as AuthenticatedRequest).auth = {
      userId: claims.sub,
      sessionId: claims.sid,
      claims,
      token,
      actor: claims.act,
    };
  }

  function getCachedClaims(token: string): McpJwtPayload | null {
    if (!ttl) {
      return null;
    }

    const cached = tokenCache.get(token);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt > Date.now()) {
      return cached.claims;
    }

    tokenCache.delete(token);
    return null;
  }

  function cacheClaims(token: string, claims: McpJwtPayload) {
    if (!ttl) {
      return;
    }

    const now = Date.now();
    const expMs = typeof claims.exp === "number" ? claims.exp * 1000 : null;
    const ttlMs = expMs ? Math.max(0, Math.min(ttl, expMs - now)) : ttl;

    if (ttlMs <= 0) {
      return;
    }

    tokenCache.set(token, {
      claims,
      expiresAt: now + ttlMs,
    });
  }

  const middleware: McpBearerAuth["middleware"] = async (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      respondUnauthorized({
        res,
        realm: normalizedRealm,
        resourceUrl: normalizedResourceUrl,
        error: "invalid_request",
        description: "Missing Bearer token",
        logData: { reason: "missing_token" },
      });
      return;
    }

    const cachedClaims = getCachedClaims(token);
    if (cachedClaims) {
      attachAuthContext(req, cachedClaims, token);
      logEvent("AUTH:MCP", "token-cache-hit", {
        userId: cachedClaims.sub,
        template: cachedClaims.template,
      });
      next();
      return;
    }

    try {
      const claims = (await verifier(token, {
        secretKey,
        audience,
      })) as McpJwtPayload;

      if (!claims || typeof claims.sub !== "string") {
        respondUnauthorized({
          res,
          realm: normalizedRealm,
          resourceUrl: normalizedResourceUrl,
          error: "invalid_token",
          description: "Token is missing subject claim",
          logData: { reason: "missing_sub" },
        });
        return;
      }

      if (normalizedTemplate) {
        const claimTemplate =
          claims.template ??
          (claims.mcp && typeof claims.mcp === "object"
            ? (claims.mcp as { template?: string }).template
            : undefined);
        if (claimTemplate !== normalizedTemplate) {
          respondUnauthorized({
            res,
            realm: normalizedRealm,
            resourceUrl: normalizedResourceUrl,
            error: "invalid_token",
            description: "Token template mismatch",
            logData: { reason: "template_mismatch", tokenTemplate: claimTemplate },
          });
          return;
        }
      }

      attachAuthContext(req, claims, token);
      cacheClaims(token, claims);

      logEvent("AUTH:MCP", "token-verified", {
        userId: claims.sub,
        template: claims.template,
        aud: claims.aud,
      });

      next();
    } catch (error) {
      respondUnauthorized({
        res,
        realm: normalizedRealm,
        resourceUrl: normalizedResourceUrl,
        error: "invalid_token",
        description: "Unable to verify token",
        logData: {
          reason: "verification_failed",
          error: serializeError(error),
        },
      });
    }
  };

  return { middleware, clearCache };
}
