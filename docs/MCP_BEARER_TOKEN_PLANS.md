# MCP Bearer Token Authentication Plans

This document outlines the production-ready path for MCP/OAuth-compliant Bearer tokens backed by Clerk verification.

## Production-Ready Bearer Tokens (dashboard-managed, secure)

**Goal:** keep MCP compliant while allowing curated users to authenticate via Clerk-issued Bearer tokens (JWT templates) instead of dynamic client registration.

**Implementation Steps**

1. **JWT template + issuance:**
   - Create a Clerk JWT template dedicated to MCP access; include `sub`, `sid`, `org_id` (if needed), and a scoped `mcp` claim.
   - Decide on audience/issuer so we can validate `aud === <BASE_URL>/mcp`.
   - Issue, rotate, and revoke all tokens directly from the Clerk dashboard (no extra scripts). Record in the playbook which dashboard pages to visit and who is authorized to perform these actions.

2. **Verification middleware:**
   - Add `@clerk/backend` (or use existing Clerk server SDK) to instantiate `createClerkClient({ secretKey })`.
   - Replace `mcpAuthClerk` with `verifyMcpBearer` (see `src/middleware/mcp-bearer-auth.ts`) that:
     * extracts the Bearer token,
     * calls `verifyToken(token, { secretKey, audience })` from `@clerk/backend`,
     * checks `aud` or `resource` claims match the current server,
     * attaches the decoded claims (user id, email, etc.) to `req.auth`, and
     * emits structured logs/metrics for observability.
   - Consider a short in-memory cache (<=1 minute) to reduce repeated verification latency.

3. **Discovery docs:**
   - Keep serving `/.well-known/oauth-protected-resource` but update the metadata to reflect Bearer-token access (e.g., `token_endpoint_auth_methods_supported: ["bearer"]`, `authorization_servers: []` if we expect clients to pre-provision tokens).
   - Optionally add a short note in `docs/MCP_PROTOCOL_AUTH.md` or a new README section describing the “Bearer token w/ Clerk template” auth mode for MCP clients.

4. **Token lifecycle:**
   - Establish storage guidelines (tokens in secure vault, expiration times, rotation schedule) and note that rotation happens by reissuing from the dashboard.
   - Rely on Clerk’s dashboard revocation controls (delete a token, disable a template) instead of custom scripts; document the manual steps and expected propagation time.
   - Decide what happens when a token is revoked mid-session (e.g., rely on Clerk revocation lists or reduce `exp`).

5. **Testing + monitoring:**
   - Add integration tests hitting `/mcp` with forged, expired, and valid tokens to ensure the middleware behaves as expected.
   - Emit metrics/counters for 401s vs successful auths so we can monitor abuse.
   - Optionally introduce rate limiting per `sub` to mitigate brute force attempts.

6. **Rollout:**
   - Behind a feature flag, deploy to staging, issue tokens for internal users via the dashboard, and iterate.
   - Once validated, remove the flag and deprecate dynamic client registration/document the new onboarding steps for MCP clients (including dashboard instructions).

### Environment variables

| Variable | Description |
| --- | --- |
| `MCP_BEARER_TEMPLATE_NAME` | Clerk JWT template that issues MCP tokens (e.g. `mcp-access`) |
| `MCP_BEARER_AUDIENCE` | Expected `aud` claim, default `${BASE_URL}/mcp` |
| `MCP_BEARER_RESOURCE_URL` | Resource URL advertised in OAuth discovery + `WWW-Authenticate` |
| `MCP_BEARER_REALM` | Realm string appended to auth challenges |
| `MCP_BEARER_CACHE_TTL_MS` | Optional TTL for the in-memory verification cache (<= 60s) |

All values live in `.env.*` files so demo/staging/prod can choose the right Clerk template and resource URL.
