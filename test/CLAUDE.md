# CLAUDE.md (Test Suite)

Guidance for Claude Code or any coding agent working inside the `test/` workspace.

## Mission Snapshot
- Integration tests exercise the real Supabase stack (Postgres + RLS) just like production. No mocks for Supabase—only Plaid/Claude clients are swapped in certain suites.
- Tests live under `test/integration/`; helpers and fixtures are under `test/helpers/` and `test/sample_data/`.

## Environment Requirements
1. **Local Supabase** – Run `supabase start` from the repo root before any integration suite. Docker Desktop must be running.
2. **`.env.test`** – Already checked in; ensure `ENCRYPTION_KEY`, `SUPABASE_JWT_SECRET`, and Clerk/Plaid test keys match your local stack.
3. **TypeScript** – Always run `npx tsc --noEmit` (root + `cd widgets`) before/after edits to catch cross-project type issues.

## Running Tests
```bash
# Full integration pass (serialized via node:test flags)
npm run test:integration

# Single file (faster when iterating)
npx tsx --test test/integration/account-balances.test.ts

# Filter by name pattern
NODE_OPTIONS='--test-name-pattern="financial summary"' npx tsx --test test/integration/account-balances.test.ts
```

## Test Helpers & Patterns
- Use `createTestSupabaseClient(userId)` / `createTestSupabaseAdminClient()` from `test/helpers/test-db.ts` to seed data. Never instantiate Supabase clients directly.
- Clean up with `cleanupTestUser(supabase, userId)` inside `beforeEach`/`after` hooks so RLS and FK constraints stay happy.
- `createTestConnection` automatically encrypts access tokens so Plaid-dependent code paths behave like production.
- Sample CSVs belong in `test/sample_data/`. If you need new fixtures, add them there and document usage in `test/README.md`.

## Conventions
- Stick to `node:test` (`describe`, `it`, `before`, `after`). Do not mix Jest/Mocha globals.
- Keep seeding logic in helpers: prefer `seedAccounts([...])` style utilities over inline `adminClient.from("accounts").insert`.
- Assertions should verify both human-readable `content` and `structuredContent` when widgets are involved.
- For RLS suites, ensure you run queries through the user-scoped client; admin inserts are only for setup.

## Gotchas
- Forgetting to call `setSupabaseTestClient`/`resetSupabaseClients` can leak the admin client into production code paths. Follow the pattern shown in `account-balances.test.ts`.
- Running tests without Docker/Supabase results in `ECONNREFUSED` errors—check `supabase status`.
- Widget bundles live in `public/widgets`; when tests depend on their metadata, rebuild via `npm run build:widgets`.

**Reminder:** Do not edit `README.md` automatically. Update `test/README.md`, `test/agent.md`, or this file when documenting test-related behavior.***
