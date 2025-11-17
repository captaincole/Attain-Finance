import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { createBearerAuthMiddleware } from "../../src/auth/bearer.js";

type MockResponse = Response & {
  statusCode: number;
  body?: unknown;
  headers: Record<string, string>;
};

function createResponse(): MockResponse {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as MockResponse;
}

function createRequest(headers: Record<string, string> = {}): Request {
  return {
    headers,
  } as unknown as Request;
}

describe("Bearer auth middleware", () => {
  const baseOptions = {
    enabled: true,
    secretKey: "test-secret",
    templateName: "mcp-access",
    resourceUrl: "http://localhost:3000/mcp",
    realm: "mcp",
    cacheTtlMs: 1000,
  };

  let verifyCalls: string[];
  const now = () => Date.now();

  beforeEach(() => {
    verifyCalls = [];
  });

  it("skips when Authorization header is missing", async () => {
    const handler = createBearerAuthMiddleware(baseOptions, {
      verifyTokenFn: async () => {
        throw new Error("should not verify");
      },
      now,
    });
    assert(handler, "expected handler");
    const result = await handler(createRequest(), createResponse());
    assert.equal(result, "skip");
  });

  it("rejects non-bearer Authorization headers", async () => {
    const handler = createBearerAuthMiddleware(baseOptions, {
      verifyTokenFn: async () => {
        throw new Error("should not verify");
      },
      now,
    });
    const res = createResponse();
    const result = await handler(createRequest({ authorization: "Basic abc123" }), res);
    assert.equal(result, "responded");
    assert.equal(res.statusCode, 401);
    assert(res.headers["WWW-Authenticate"]);
  });

  it("verifies tokens and attaches auth context", async () => {
    const handler = createBearerAuthMiddleware(baseOptions, {
      verifyTokenFn: async (token) => {
        verifyCalls.push(token);
        return {
          sub: "user_123",
          sid: "sess_456",
          exp: Math.floor(Date.now() / 1000) + 60,
        };
      },
      now,
    });

    const req = createRequest({ authorization: "Bearer valid.token.value" }) as Request & { auth?: any };
    const res = createResponse();
    const result = await handler!(req, res);
    assert.equal(result, "authenticated");
    assert.equal(req.auth?.userId, "user_123");
    assert.equal(req.auth?.sessionId, "sess_456");
    assert.deepEqual(verifyCalls, ["valid-token"]);
  });

  it("caches verified tokens within TTL", async () => {
    const handler = createBearerAuthMiddleware(baseOptions, {
      verifyTokenFn: async () => ({
        sub: "user_cached",
        sid: "sess_cached",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
      now,
    });

    const req = createRequest({ authorization: "Bearer cached.token.value" }) as Request & { auth?: any };
    const res = createResponse();
    await handler!(req, res);
    const secondReq = createRequest({ authorization: "Bearer cached.token.value" }) as Request & { auth?: any };
    const secondRes = createResponse();

    const result = await handler!(secondReq, secondRes);
    assert.equal(result, "authenticated");
    assert.equal(secondReq.auth?.userId, "user_cached");
  });

  it("responds with 401 when verification fails", async () => {
    const handler = createBearerAuthMiddleware(baseOptions, {
      verifyTokenFn: async () => {
        throw new Error("boom");
      },
      now,
    });
    const res = createResponse();
    const result = await handler!(createRequest({ authorization: "Bearer bad.token.value" }), res);
    assert.equal(result, "responded");
    assert.equal(res.statusCode, 401);
  });

  it("skips non-JWT bearer tokens so DCR can handle them", async () => {
    const handler = createBearerAuthMiddleware(baseOptions, {
      verifyTokenFn: async () => {
        throw new Error("should not verify");
      },
      now,
    });
    const req = createRequest({ authorization: "Bearer notajwt" }) as Request & { auth?: any };
    const res = createResponse();
    const result = await handler!(req, res);
    assert.equal(result, "skip");
    assert.equal(req.auth, undefined);
  });
});
