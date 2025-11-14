import type { NextFunction, Request, RequestHandler, Response } from "express";
import { mcpAuthClerk } from "@clerk/mcp-tools/express";
import { createBearerAuthMiddleware, type BearerAuthOptions } from "./bearer.js";

export interface HybridAuthOptions {
  bearer?: BearerAuthOptions;
}

/**
 * Compose all MCP authentication strategies.
 * Today this simply wraps the existing DCR middleware, but the structure
 * makes it easy to layer JWT bearer support without touching the route.
 */
export function createMcpAuthMiddleware(options?: HybridAuthOptions): RequestHandler {
  const bearerMiddleware = createBearerAuthMiddleware(options?.bearer);
  const dcrMiddleware = mcpAuthClerk;

  if (!bearerMiddleware) {
    return dcrMiddleware;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const continueToDcr: NextFunction = (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      if (res.headersSent) {
        return;
      }
      dcrMiddleware(req, res, next);
    };

    bearerMiddleware(req, res, continueToDcr);
  };
}
