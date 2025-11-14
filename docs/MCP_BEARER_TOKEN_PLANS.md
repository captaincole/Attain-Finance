# MCP Bearer Token + DCR Authentication Plans

We need a hybrid model that allows JWT-based bearer tokens for curated demos while keeping the default Dynamic Client Registration (DCR) handshake in production. The server must transparently support both paths without weakening the existing OAuth flow.

## Goals

- Continue to accept DCR-issued Clerk session tokens for all existing clients (Claude, ChatGPT, Cursor, etc.).
- Allow trusted demo users to present a pre-issued Bearer token (JWT template) in the `Authorization` header and skip DCR.
- Modularize authentication so each path is easy to reason about, observable, and testable.
- Keep production deployments secure: bearer tokens are an additive capability, not a replacement.

## Architecture Plan

1. **Auth router abstraction**
   - Introduce `src/auth/index.ts` (or similar) that exports a single Express middleware. Internally it:
     1. Checks for `Authorization: Bearer` and attempts JWT verification.
     2. If the header is missing entirely, falls back to the existing `mcpAuthClerk` DCR middleware.
     3. If a bearer token is present but invalid, the request is rejected immediately (no DCR fallback) to prevent privilege escalation attempts.
   - The module also houses logging helpers and shared request context typing so tooling can read `req.auth`.

2. **JWT verification module**
   - Keep the current `createMcpBearerAuthMiddleware` (possibly renamed to `verifyMcpBearer`) but ensure it only throws when configuration is invalid. For runtime auth failures it should call `next("route")` so the DCR middleware can try next.
   - Move configuration (template, audience, realm, cache TTL) into `CONFIG.mcpAuth`.
   - Require `CLERK_SECRET_KEY` or `CLERK_JWT_KEY` in production; allow test overrides.

3. **DCR fallback path**
   - Keep `mcpAuthClerk` wired exactly as today.
   - After JWT middleware finishes (either by authenticating or delegating via `next("route")`), the DCR middleware runs. This keeps all legacy behavior intact.

4. **Discovery metadata**
   - `/.well-known/oauth-protected-resource` continues to describe the DCR flow.
   - Document the bearer-token option separately (README, docs). Clients using DCR see no change.

5. **Configuration & env**
   - Environment variables remain the same (see table below). Production deployments set both the Clerk keys and optional bearer template values. Demo branches can leave DCR disabled by skipping the fallback (feature flag).

6. **Testing**
   - Unit tests for the bearer middleware (already drafted) plus new integration tests ensuring:
     - Requests with valid bearer tokens skip DCR entirely.
     - Requests without tokens still require DCR (401 if unauthenticated).
     - Mixed-mode: invalid bearer token falls back to DCR (should still be valid if the client has a session).
   - Regression tests for OAuth discovery remain unchanged.

7. **Rollout**
   - Ship the hybrid middleware behind an env flag (e.g., `MCP_ALLOW_BEARER=true`) to stage the change.
   - Enable in staging, distribute demo tokens, then roll into production once verified.

## Implementation Steps

1. **Refactor auth entry point**
   - Create `src/auth/middleware.ts` that composes `verifyMcpBearer` and `mcpAuthClerk`.
   - Update `src/index.ts` to import this single middleware.

2. **Bearer middleware adjustments**
   - Update return semantics so an absent header calls `next()` (allowing DCR), but invalid/expired tokens respond with 401 and do **not** fall back to DCR.
   - Keep cache + logging logic as-is for observability.

3. **Config + env validation**
   - Ensure `CONFIG` loads via `dotenv` before reading env variables (already addressed).
   - Add runtime checks/log warnings when bearer auth is enabled but required env vars are missing.

4. **Docs**
   - README: add “Hybrid Auth” subsection describing precedence (Bearer > DCR).
   - `docs/MCP_PROTOCOL_AUTH.md`: mention optional bearer tokens for internal demos.
   - This plan doc stays the canonical rollout reference.

5. **Testing & monitoring**
   - Add metrics counters (`AUTH:MCP` scope) for:
     - `auth-method=bearer` successes/failures.
     - `auth-method=dcr` successes/failures.
   - Ship integration tests as described above.

## Environment variables

| Variable | Description |
| --- | --- |
| `MCP_BEARER_TEMPLATE_NAME` | Clerk JWT template that issues MCP tokens (e.g. `mcp-access`) |
| `MCP_BEARER_AUDIENCE` | Expected `aud` claim, default `${BASE_URL}/mcp` |
| `MCP_BEARER_RESOURCE_URL` | Resource URL advertised in OAuth discovery + `WWW-Authenticate` |
| `MCP_BEARER_REALM` | Realm string appended to auth challenges |
| `MCP_BEARER_CACHE_TTL_MS` | Optional TTL for the in-memory verification cache (<= 60s) |
| `MCP_ALLOW_BEARER` | (Optional) Feature flag to enable hybrid mode in a deployment |

All values live in `.env.*` files so demo/staging/prod can choose the right Clerk template and resource URL.
