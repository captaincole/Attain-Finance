import type { Request, Response } from "express";
import { verifyToken } from "@clerk/backend";
import type { JwtPayload } from "@clerk/types";
import { logEvent, serializeError } from "../utils/logger.js";

type BearerResult = "skip" | "authenticated" | "responded";
type BearerHandler = (req: Request, res: Response) => Promise<BearerResult>;

export interface BearerAuthOptions {
  enabled?: boolean;
  secretKey?: string;
  templateName?: string;
  resourceUrl?: string;
  realm?: string;
  cacheTtlMs?: number;
}

type VerifyTokenFn = typeof verifyToken;

interface CacheEntry {
  claims: McpJwtPayload;
  expiresAt: number;
}

type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    sessionId?: string;
    token: string;
    claims: McpJwtPayload;
    actor?: McpJwtPayload["act"];
    extra?: Record<string, unknown>;
  };
};

type McpJwtPayload = JwtPayload & {
  sid?: string;
  template?: string;
  tpl?: string;
  act?: Record<string, unknown>;
  mcp?: Record<string, unknown>;
};

export function createBearerAuthMiddleware(
  options?: BearerAuthOptions,
  deps?: { verifyTokenFn?: VerifyTokenFn; now?: () => number }
): BearerHandler | null {
  if (!options?.enabled) {
    return null;
  }

  if (!options.secretKey) {
    throw new Error("MCP bearer auth enabled but CLERK_SECRET_KEY is missing.");
  }

  const ttl = Math.max(0, options.cacheTtlMs ?? 0);
  const realm = options.realm || "mcp";
  const resourceUrl = options.resourceUrl || "/mcp";
  const verifier = deps?.verifyTokenFn ?? verifyToken;
  const now = deps?.now ?? (() => Date.now());
  const tokenCache = new Map<string, CacheEntry>();

  return async function handleBearer(req: Request, res: Response): Promise<BearerResult> {
    const extraction = extractBearerToken(req.headers.authorization);
    // NO AUTH SCENARIO: no Authorization header → let Clerk's DCR middleware handle the request
    if (extraction.type === "missing") {
      logEvent("AUTH:BEARER", "no-header", undefined, "info");
      return "skip";
    }
    // DCR SCENARIO: header exists but isn't a template JWT (Clerk session token or malformed value)
    if (extraction.type === "invalid") {
      respondUnauthorized(res, realm, resourceUrl, "invalid_request", extraction.reason);
      logEvent("AUTH:BEARER", "invalid-header", { reason: extraction.reason }, "warn");
      return "responded";
    }

    const token = extraction.token;
    logEvent("AUTH:BEARER", "token-received", {
      hasToken: true,
      tokenPreview: previewToken(token),
    });

    if (!isJwtFormat(token)) {
      // DCR SCENARIO (continued): header was Bearer but not one of our JWTs → skip so DCR keeps control
      logEvent(
        "AUTH:BEARER",
        "non-jwt-token",
        { reason: "token missing JWT sections", tokenPreview: previewToken(token) },
        "info"
      );
      return "skip";
    }

    const cached = getCachedClaims(token);
    if (cached) {
      attachAuth(req as AuthenticatedRequest, cached, token);
      logEvent("AUTH:BEARER", "cache-hit", { userId: cached.sub });
      return "authenticated";
    }

    try {
      // JWT TEMPLATE SCENARIO: token looks like a JWT, so verify it and short-circuit to bearer auth
      const claims = (await verifier(token, {
        secretKey: options.secretKey!,
      })) as McpJwtPayload;

      if (!claims || typeof claims.sub !== "string") {
        respondUnauthorized(res, realm, resourceUrl, "invalid_token", "Token missing subject");
        logEvent("AUTH:BEARER", "missing-sub", undefined, "warn");
        return "responded";
      }

      if (options.templateName) {
        const templateClaim = resolveTemplateClaim(claims);
        if (templateClaim && templateClaim !== options.templateName) {
          respondUnauthorized(res, realm, resourceUrl, "invalid_token", "Token template mismatch");
          logEvent("AUTH:BEARER", "template-mismatch", {
            tokenTemplate: templateClaim,
            expectedTemplate: options.templateName,
          }, "warn");
          return "responded";
        }
      }

      attachAuth(req as AuthenticatedRequest, claims, token);
      cacheClaims(token, claims);

      logEvent("AUTH:BEARER", "token-verified", {
        userId: claims.sub,
        sessionId: claims.sid,
      });

      return "authenticated";
    } catch (error) {
      const serialized = serializeError(error);
      respondUnauthorized(res, realm, resourceUrl, "invalid_token", "Unable to verify token");
      logEvent(
        "AUTH:BEARER",
        "verification-failed",
        { error: serialized },
        "warn"
      );
      return "responded";
    }
  };

  function getCachedClaims(token: string): McpJwtPayload | null {
    if (!ttl) {
      return null;
    }
    const entry = tokenCache.get(token);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt > now()) {
      return entry.claims;
    }
    tokenCache.delete(token);
    return null;
  }

  function cacheClaims(token: string, claims: McpJwtPayload) {
    if (!ttl) {
      return;
    }
    const issuedTtl = typeof claims.exp === "number" ? Math.max(0, claims.exp * 1000 - now()) : ttl;
    const effectiveTtl = Math.min(ttl, issuedTtl);
    if (effectiveTtl <= 0) {
      return;
    }
    tokenCache.set(token, {
      claims,
      expiresAt: now() + effectiveTtl,
    });
  }
}

type TokenExtraction =
  | { type: "missing" }
  | { type: "invalid"; reason: string }
  | { type: "token"; token: string };

function extractBearerToken(header?: string | string[]): TokenExtraction {
  if (!header) {
    return { type: "missing" };
  }
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return { type: "missing" };
  }
  const [scheme, ...rest] = value.trim().split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") {
    return { type: "invalid", reason: "Authorization header must use Bearer scheme" };
  }
  const token = rest.join(" ").trim();
  if (!token) {
    return { type: "invalid", reason: "Bearer token is missing" };
  }
  return { type: "token", token };
}

function isJwtFormat(token: string): boolean {
  const segments = token.split(".");
  return segments.length === 3 && segments.every((part) => part.length > 0);
}

function previewToken(token: string): string {
  if (!token) {
    return "(empty)";
  }
  const trimmed = token.trim();
  if (trimmed.length <= 16) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)} (${trimmed.length} chars)`;
}

function attachAuth(req: AuthenticatedRequest, claims: McpJwtPayload, token: string) {
  req.auth = {
    userId: claims.sub,
    sessionId: claims.sid,
    token,
    claims,
    actor: claims.act,
    extra: {
      userId: claims.sub,
    },
  };
}

function respondUnauthorized(
  res: Response,
  realm: string,
  resourceUrl: string,
  error: "invalid_request" | "invalid_token" | "insufficient_scope",
  description: string
) {
  const header = `Bearer realm="${realm}", resource="${resourceUrl}", error="${error}", error_description="${description.replace(/\"/g, "'")}"`;
  res.setHeader("WWW-Authenticate", header);
  res.status(401).json({ error, error_description: description });
}

function resolveTemplateClaim(claims: McpJwtPayload): string | undefined {
  if (claims.template && typeof claims.template === "string") {
    return claims.template;
  }
  if (claims.tpl && typeof claims.tpl === "string") {
    return claims.tpl;
  }
  if (claims.mcp && typeof (claims.mcp as Record<string, unknown>).template === "string") {
    return (claims.mcp as Record<string, unknown>).template as string;
  }
  return undefined;
}
