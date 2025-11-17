import type { NextFunction, Request, RequestHandler, Response } from "express";
import { mcpAuthClerk } from "@clerk/mcp-tools/express";
import { createBearerAuthMiddleware, type BearerAuthOptions } from "./bearer.js";
import { logEvent } from "../utils/logger.js";

export interface HybridAuthOptions {
  bearer?: BearerAuthOptions;
}

/**
 * Compose all MCP authentication strategies.
 * Today this simply wraps the existing DCR middleware, but the structure
 * makes it easy to layer JWT bearer support without touching the route.
 */
export function createMcpAuthMiddleware(options?: HybridAuthOptions): RequestHandler {
  const bearerHandler = createBearerAuthMiddleware(options?.bearer);
  const dcrMiddleware = mcpAuthClerk;

  if (!bearerHandler) {
    if (options?.bearer?.enabled) {
      logEvent("AUTH:BEARER", "disabled", {
        reason: "missing secret or template",
      });
    }
    return dcrMiddleware;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const result = await bearerHandler(req, res);
      if (result === "authenticated") {
        next();
        return;
      }

      if (result === "skip") {
        const originalAuth = (req as any).auth;
        dcrMiddleware(req, res, (...args: any[]) => {
          if (args.length > 0) {
            const [err] = args;
            next(err);
            return;
          }
          const currentAuth = (req as any).auth;
          if (currentAuth && originalAuth) {
            if (typeof originalAuth.getToken === "function" && typeof currentAuth.getToken !== "function") {
              currentAuth.getToken = originalAuth.getToken.bind(originalAuth);
            }
          }
          next();
        });
        return;
      }
      // responded -> do nothing
    })().catch(next);
  };
}
