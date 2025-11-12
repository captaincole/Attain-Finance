# Test Suite Orientation (agent.md)

## Overview
Our integration tests simulate real production flows: the MCP server talks to a **local Supabase stack** (Postgres + Auth) and only Plaid/Claude HTTP calls are mocked. Because of this, every engineer must bring up Supabase locally before running tests.

## Prerequisites
1. **Docker Desktop running** – Supabase CLI spins up multiple containers.
2. **Supabase CLI installed** – `brew install supabase/tap/supabase` (or see supabase docs).
3. **Start the stack** – From repo root:
   ```bash
   supabase start
   ```
   This applies migrations in `supabase/migrations/` and exposes Postgres at `127.0.0.1:54322`.
4. **Environment** – `.env.test` is committed; verify `ENCRYPTION_KEY` and `SUPABASE_JWT_SECRET` match the Supabase project output. Tests read this file automatically via `dotenv`.

## Running Tests
```bash
# All integration suites (serialized)
npm run test:integration

# Individual file (preferred while iterating)
npx tsx --test test/integration/cron-jobs.test.ts
```

### Quick Tips
- Most suites create/destroy data through helper functions in `test/helpers/test-db.ts`. Use them instead of writing raw SQL inserts.
- If you see `permission denied for table ...`, you probably used the admin client for assertions. Use the user-scoped client (`createTestSupabaseClient(userId)`) for reads.
- After heavy testing you can wipe everything with `supabase stop --no-backup` and rerun `supabase start`.

## Directory Map
- `test/integration/` – node:test suites (accounts, budgets, cron, OAuth, widgets).
- `test/helpers/` – Supabase client factory, seed helpers, transaction builders.
- `test/mocks/` – Plaid/Claude/Clerk mocks used by selected suites.
- `test/sample_data/` – CSV fixtures (`sample_transactions_*.csv`). Keep ad-hoc CSVs here instead of the root.
- `test/sample_chase.csv` – legacy sample file slated for relocation/deletion; don’t depend on it.

## Workflow Expectations
1. Pull latest migrations; run `supabase start` to ensure your local DB matches.
2. Implement or update tests using the shared helper APIs.
3. Run `npx tsc --noEmit` (root + `cd widgets`) so widget/TS changes don’t break the build.
4. Run the relevant `npx tsx --test ...` command before opening a PR.

## Troubleshooting
- **Docker container won’t start** – Run `supabase stop`, prune Docker resources, retry `supabase start`.
- **Tests hang on DB calls** – Confirm `.env.test` credentials and that the Supabase ports aren’t blocked (VPNs can interfere).
- **Widget metadata tests failing** – Rebuild assets: `npm run build:widgets`.

Questions about the Supabase harness or new suite structure should be captured in `test/README.md` and mirrored here once finalized.***
