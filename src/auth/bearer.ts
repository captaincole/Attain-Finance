import type { RequestHandler } from "express";
import { logEvent } from "../utils/logger.js";

/**
 * Options for future bearer-token support.
 * These values will eventually be populated from CONFIG.mcpAuth.
 */
export interface BearerAuthOptions {
  enabled?: boolean;
}

/**
 * Placeholder bearer auth middleware.
 * Currently returns null (disabled) unless explicitly enabled.
 * When we build full JWT support, this will validate Authorization headers
 * and short-circuit the MCP route when a valid token is presented.
 */
export function createBearerAuthMiddleware(options?: BearerAuthOptions): RequestHandler | null {
  if (!options?.enabled) {
    return null;
  }

  logEvent(
    "AUTH:BEARER",
    "not-implemented",
    { note: "Bearer token path stubbed, falling back to DCR" },
    "warn"
  );

  return (_req, _res, next) => {
    // TODO: implement JWT verification and request short-circuiting.
    next();
  };
}
