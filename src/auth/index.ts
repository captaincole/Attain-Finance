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
        dcrMiddleware(req, res, next);
        return;
      }
      // responded -> do nothing
    })().catch(next);
  };
}
