# Row Level Security Guide

This guide outlines the Row Level Security (RLS) setup for the Personal Finance MCP server. The focus is currently on the `transactions` table, which acts as the proving ground for our production rollout.

## Overview

- **Migration 022** enables RLS on `public.transactions`, forces it for all roles, and defines per-user policies.
- The application now passes a Supabase-scoped JWT with every request. The server always generates a short-lived JWT (signed with `SUPABASE_JWT_SECRET`, `sub = userId`) before calling Supabase, even if Clerk provided an opaque access token.
- Service-role workloads, cron jobs, and tests that use the Supabase secret key continue to bypass RLS (policy + inherent bypass privileges).
- RLS logging is turned on for missing headers or malformed payloads so that we can debug header propagation issues quickly.

## Helper Function

The helper function runs as a security definer, calls `auth.jwt()->>'sub'` to extract the Clerk user ID, and logs when the claim is missing.

Check the Supabase Postgres logs when debugging access issues.

## Policies

Policies are defined for both `authenticated` and `anon` roles because our browser-facing supabase-js client uses the anon key with a Clerk session token:

- **Single user policy (`FOR ALL`)** enforces `transactions.user_id = private.get_clerk_user_id()` via both `USING` and `WITH CHECK`.
- **Service role:** granted unrestricted access via `FOR ALL` policy

Because RLS is forced, the helper must return a value for user-scoped requests or the policy will deny the operation.

## Client Usage Requirements

Always obtain Supabase clients for user-scoped operations through `getSupabaseForUser(userId)`.  
This helper signs a Supabase-valid JWT with `SUPABASE_JWT_SECRET`, injects the `Authorization` header, and caches the client until the token is near expiration. Legacy `x-user-id` headers remain for observability only.

```ts
const supabase = getSupabaseForUser(userId);
const { data, error } = await supabase
  .from("transactions")
  .select("*")
  .order("date", { ascending: false });
```

Service workflows should continue to use `getSupabaseServiceRole()` to retain unrestricted access (cron jobs, sync services, test fixtures, etc.).

## Testing

Run integration tests locally (requires Docker + `supabase start`):

```bash
npm run test:integration
```

`test/integration/transactions-rls.test.ts` covers:

- Users only seeing their own transactions
- Attempts to update/delete another user's transaction failing with an RLS error

## Operational Notes

- Keep an eye on the logs for repeated `missing Clerk sub claim` messages—this indicates the incoming request didn't include a valid Clerk session token.
- When debugging locally, you can set `SUPABASE_LOG_LEVEL=debug` in `docker-compose/dev` to capture the raised messages.
- Future tables that adopt RLS should share the helper function. Consider moving common logic to a shared schema as rollout expands.
- Legacy environments (older PostgREST) may expose headers via `request.header.<name>` GUCs; the helper checks both that format and the newer `request.headers` payload (object, array, or key/value pairs) to stay compatible.
- The server requires `SUPABASE_JWT_SECRET` (matching the Supabase project's JWT secret) so it can mint resource-server tokens when Clerk only supplies opaque access tokens.
