/**
 * Integration tests for OAuth discovery protocol
 * Tests that the server correctly implements OAuth metadata endpoints
 * for MCP client discovery (Claude Desktop, ChatGPT, etc.)
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";
import request from "supertest";

// Set test environment before importing app
process.env.NODE_ENV = "test";

// Load real Clerk test keys from .env file (these are test keys, safe for testing)
// Note: Clerk validates key format strictly, so we use real test keys
import dotenv from "dotenv";
dotenv.config();

// Set other required env vars for tests
process.env.ENCRYPTION_KEY = "a".repeat(64); // 64-char hex for AES-256
process.env.JWT_SECRET = "b".repeat(64);
process.env.BASE_URL = "http://localhost:3000";

// Import app after setting env vars
import { app } from "../../src/index.js";

describe("OAuth Discovery Protocol", () => {
  describe("GET /.well-known/oauth-protected-resource/mcp", () => {
    it("should return OAuth protected resource metadata", async () => {
      const response = await request(app)
        .get("/.well-known/oauth-protected-resource/mcp")
        .expect(200)
        .expect("Content-Type", /json/);

      // Verify required fields per OAuth 2.0 Protected Resource Metadata spec
      assert(response.body.resource, "Should include resource URL");
      assert(
        response.body.authorization_servers,
        "Should include authorization servers"
      );
      assert(Array.isArray(response.body.authorization_servers));
      assert(
        response.body.authorization_servers.length > 0,
        "Should have at least one auth server"
      );

      // Verify scopes are listed
      assert(
        response.body.scopes_supported,
        "Should include supported scopes"
      );
      assert(response.body.scopes_supported.includes("email"));
      assert(response.body.scopes_supported.includes("profile"));
    });
  });

  describe("GET /.well-known/oauth-protected-resource", () => {
    it("should return OAuth metadata without /mcp suffix (ChatGPT format)", async () => {
      const response = await request(app)
        .get("/.well-known/oauth-protected-resource")
        .expect(200)
        .expect("Content-Type", /json/);

      // ChatGPT expects this endpoint without /mcp suffix
      assert(
        response.body.resource_url,
        "Should include resource_url for ChatGPT"
      );
      assert(
        response.body.resource_url.includes("/mcp"),
        "Resource URL should point to /mcp endpoint"
      );
    });
  });

  describe("GET /.well-known/openid-configuration", () => {
    it("should return OpenID Connect configuration", async () => {
      const response = await request(app)
        .get("/.well-known/openid-configuration")
        .expect(200)
        .expect("Content-Type", /json/);

      // Verify required OpenID Connect Discovery fields
      assert(response.body.issuer, "Should include issuer");
      assert(
        response.body.authorization_endpoint,
        "Should include authorization endpoint"
      );
      assert(response.body.token_endpoint, "Should include token endpoint");
    });
  });

  describe("GET /.well-known/oauth-authorization-server", () => {
    it("should return OAuth authorization server metadata", async () => {
      const response = await request(app)
        .get("/.well-known/oauth-authorization-server")
        .expect(200)
        .expect("Content-Type", /json/);

      // Legacy endpoint for older MCP clients
      assert(response.body.issuer, "Should include issuer");
      assert(
        response.body.authorization_endpoint,
        "Should include authorization endpoint"
      );
    });
  });

  describe("POST /mcp without authentication", () => {
    it("should return 401 Unauthorized with WWW-Authenticate header", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        })
        .expect(401);

      // Verify WWW-Authenticate header is present (required by OAuth spec)
      assert(
        response.headers["www-authenticate"],
        "Should include WWW-Authenticate header"
      );

      // Verify CORS headers are exposed (required for browser clients)
      assert(
        response.headers["access-control-expose-headers"],
        "Should expose CORS headers"
      );
      assert(
        response.headers["access-control-expose-headers"].includes(
          "WWW-Authenticate"
        ),
        "Should expose WWW-Authenticate header via CORS"
      );
    });

    it("should allow OPTIONS preflight request", async () => {
      const response = await request(app)
        .options("/mcp")
        .expect(204); // No Content for OPTIONS

      // Verify CORS headers are present
      assert(
        response.headers["access-control-allow-methods"],
        "Should include allowed methods"
      );
    });
  });
});
