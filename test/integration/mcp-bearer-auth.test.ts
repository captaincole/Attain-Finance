/**
 * Tests for the MCP bearer authentication middleware
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { createMcpBearerAuthMiddleware } from "../../src/middleware/mcp-bearer-auth.js";

const BASE_OPTIONS = {
  secretKey: "test_secret_key",
  audience: "http://localhost:3000/mcp",
  resourceUrl: "http://localhost:3000/mcp",
  templateName: "mcp-access",
  cacheTtlMs: 1000,
};

type TestResponse = Response & {
  statusCode: number;
  body?: unknown;
  headers: Record<string, string>;
};

function createRequest(authHeader?: string): Request & { auth?: unknown } {
  const headers: Request["headers"] = {};
  if (authHeader) {
    headers.authorization = authHeader;
  }

  return {
    headers,
  } as Request & { auth?: unknown };
}

function createResponse(): TestResponse {
  const headers: Record<string, string> = {};

  return {
    headers,
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as unknown as TestResponse;
}

function createNext() {
  let called = false;
  const fn: NextFunction = () => {
    called = true;
  };

  return {
    fn,
    wasCalled: () => called,
  };
}

function futureExp(seconds = 60): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

describe("MCP bearer authentication middleware", () => {
  it("rejects requests without an Authorization header", async () => {
    const { middleware } = createMcpBearerAuthMiddleware({
      ...BASE_OPTIONS,
      verifyTokenFn: async () => {
        throw new Error("should not be called");
      },
    });

    const req = createRequest();
    const res = createResponse();
    const next = createNext();

    await middleware(req, res, next.fn);

    assert.equal(res.statusCode, 401);
    assert.equal(next.wasCalled(), false);
    assert.equal((res.body as any).error, "invalid_request");
    assert.match(res.headers["www-authenticate"], /error="invalid_request"/);
  });

  it("rejects non-bearer Authorization headers", async () => {
    const { middleware } = createMcpBearerAuthMiddleware({
      ...BASE_OPTIONS,
      verifyTokenFn: async () => {
        throw new Error("should not be called");
      },
    });
    const req = createRequest("Basic abc123");
    const res = createResponse();
    const next = createNext();

    await middleware(req, res, next.fn);

    assert.equal(res.statusCode, 401);
    assert.equal((res.body as any).error, "invalid_request");
    assert.equal(next.wasCalled(), false);
  });

  it("verifies tokens and attaches auth context", async () => {
    const verifyCalls: string[] = [];
    const { middleware, clearCache } = createMcpBearerAuthMiddleware({
      ...BASE_OPTIONS,
      verifyTokenFn: async (token) => {
        verifyCalls.push(token);
        return {
          sub: "user_123",
          template: "mcp-access",
          aud: BASE_OPTIONS.audience,
          sid: "sess_456",
          exp: futureExp(),
        };
      },
    });

    const req = createRequest("Bearer valid-token");
    const res = createResponse();
    const next = createNext();

    await middleware(req, res, next.fn);

    assert.equal(res.statusCode, 200);
    assert.equal(next.wasCalled(), true);
    assert.deepEqual(verifyCalls, ["valid-token"]);
    assert.ok((req as any).auth, "auth context should be attached");
    assert.equal((req as any).auth.userId, "user_123");
    assert.equal((req as any).auth.sessionId, "sess_456");

    clearCache();
  });

  it("rejects tokens from unexpected templates", async () => {
    const { middleware } = createMcpBearerAuthMiddleware({
      ...BASE_OPTIONS,
      verifyTokenFn: async () => ({
        sub: "user_456",
        template: "other-template",
        aud: BASE_OPTIONS.audience,
        exp: futureExp(),
      }),
    });

    const req = createRequest("Bearer mismatched");
    const res = createResponse();
    const next = createNext();

    await middleware(req, res, next.fn);

    assert.equal(res.statusCode, 401);
    assert.equal((res.body as any).error, "invalid_token");
    assert.match((res.body as any).error_description, /template mismatch/i);
    assert.equal(next.wasCalled(), false);
  });

  it("caches verified tokens within the TTL window", async () => {
    let verificationCount = 0;
    const { middleware } = createMcpBearerAuthMiddleware({
      ...BASE_OPTIONS,
      cacheTtlMs: 5_000,
      verifyTokenFn: async () => {
        verificationCount += 1;
        return {
          sub: "user_cached",
          template: "mcp-access",
          aud: BASE_OPTIONS.audience,
          exp: futureExp(120),
        };
      },
    });

    const firstReq = createRequest("Bearer cached-token");
    const firstRes = createResponse();
    const firstNext = createNext();

    await middleware(firstReq, firstRes, firstNext.fn);
    assert.equal(verificationCount, 1, "should verify first request");
    assert.equal(firstRes.statusCode, 200);
    assert.equal(firstNext.wasCalled(), true);

    const secondReq = createRequest("Bearer cached-token");
    const secondRes = createResponse();
    const secondNext = createNext();

    await middleware(secondReq, secondRes, secondNext.fn);
    assert.equal(verificationCount, 1, "should use cache for subsequent request");
    assert.equal(secondRes.statusCode, 200);
    assert.equal(secondNext.wasCalled(), true);
  });

  it("propagates verification failures as invalid_token responses", async () => {
    const { middleware } = createMcpBearerAuthMiddleware({
      ...BASE_OPTIONS,
      verifyTokenFn: async () => {
        throw new Error("boom");
      },
    });

    const req = createRequest("Bearer exploding");
    const res = createResponse();
    const next = createNext();

    await middleware(req, res, next.fn);

    assert.equal(res.statusCode, 401);
    assert.equal((res.body as any).error, "invalid_token");
    assert.equal(next.wasCalled(), false);
    assert.match((res.body as any).error_description, /Unable to verify token/);
  });
});
