/**
 * Mock Clerk authentication middleware for testing
 * Bypasses real OAuth and injects fake user authentication
 */

import { Request, Response, NextFunction } from "express";

/**
 * Mock user for testing
 */
export const MOCK_USER_ID = "test-user-12345";

/**
 * Mock clerkMiddleware - Injects fake auth context
 * This replaces @clerk/express's clerkMiddleware
 */
export function mockClerkMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Attach fake auth object to request
    (req as any).auth = {
      userId: MOCK_USER_ID,
      sessionId: "test-session-12345",
    };
    next();
  };
}

/**
 * Mock mcpAuthClerk - MCP-specific auth middleware
 * This replaces @clerk/mcp-tools/express's mcpAuthClerk
 *
 * In real implementation:
 * - Validates Bearer token from Authorization header
 * - Extracts userId from JWT and attaches to request context
 * - Returns 401 if token is invalid/missing
 *
 * In mock:
 * - Always allows requests through
 * - Injects fake userId into MCP request context
 */
export function mockMcpAuthClerk(req: Request, res: Response, next: NextFunction) {
  // For MCP requests, auth info is passed through the handler context
  // The streamableHttpHandler will extract userId from req.auth
  // So we just need to ensure req.auth is set (done by mockClerkMiddleware)
  next();
}

/**
 * Mock protected resource handler
 * Returns OAuth metadata for MCP client discovery
 */
export function mockProtectedResourceHandlerClerk(options: any) {
  return (req: Request, res: Response) => {
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    res.json({
      resource: options.resource_url || `${baseUrl}/mcp`,
      resource_url: options.resource_url || `${baseUrl}/mcp`,
      authorization_servers: [
        "https://clerk-mock-auth-server.example.com"
      ],
      scopes_supported: options.scopes_supported || ["email", "profile"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://example.com/docs"
    });
  };
}

/**
 * Mock auth server metadata handler
 * Returns OpenID Connect / OAuth 2.0 server metadata
 */
export function mockAuthServerMetadataHandlerClerk(req: Request, res: Response) {
  res.json({
    issuer: "https://clerk-mock-auth-server.example.com",
    authorization_endpoint: "https://clerk-mock-auth-server.example.com/oauth/authorize",
    token_endpoint: "https://clerk-mock-auth-server.example.com/oauth/token",
    jwks_uri: "https://clerk-mock-auth-server.example.com/.well-known/jwks",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: ["openid", "email", "profile"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"]
  });
}
