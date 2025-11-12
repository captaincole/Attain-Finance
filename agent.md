# Agent Orientation Guide

## Mission Snapshot
- Express-based MCP server that surfaces personal finance tooling over `/mcp`
- Auth via Clerk OAuth 2.1; Plaid supplies financial data; Supabase stores user state; Render hosts production
- Widgets for ChatGPT render connected institutions and budget lists (`create-server.ts`)

## Day-One Commands
- `npm install` then `npm run dev` (defaults to http://localhost:3000)
- `npx tsc --noEmit` **must** run after code edits; expect failures if types break
- `npm test` for unit tests; `npm run test:integration` spins up local Supabase via Docker (needs `.env.test`)
- Cron helpers: `npm run cron:list`, `npm run cron:sync-transactions`, `npm run cron:sync-transactions-sandbox`

## Architecture Map
- Entry: `src/index.ts` initializes Express, Clerk middleware, Plaid router, admin routes, signed download endpoints
- MCP server factory: `src/create-server.ts` wires tools/resources and widget metadata
- Tools live in `src/tools/` grouped by domain: `accounts`, `categorization`, `budgets`, `transactions`, `visualization`, `opinions`
  - Registries expose `get*Tools()` returning metadata + handlers; all handlers expect `authInfo.extra.userId`
- Services: `src/services/account-service.ts` (Plaid Link flow + immediate sync kickoff), `transaction-sync.ts` (cursor-based sync + categorization + budget labeling), `recategorization-service.ts`
- Background jobs: `src/cron/jobs/` with runner + user batch sync service; production uses Render cron config (`docs/RENDER_CRON.md`)
- HTTP routes: `src/routes/plaid/` (Link UI/callback), `routes/admin.ts` (dev utilities)
- Shared utilities: `src/utils/clients/claude.ts` (AI categorization + budget filtering), `utils/clients/plaid.ts`, `utils/budget-labeling.ts`, `utils/signed-urls.ts`

## ChatGPT Widget Configuration
- Widget descriptors live in `CONFIG.widgets` (`src/utils/config.ts`); URIs use `ui://` scheme so ChatGPT links widget templates to tools
- `registerWidgetResources()` (`src/create-server.ts`) answers `resources/list`/`resources/read` with HTML that loads built assets from `public/widgets/…`; keep `CONFIG.baseUrl` accurate so scripts resolve
- Build widget bundles via `cd widgets && npm run build:all`; output checked into `public/widgets/*.js` and `public/widgets/*.css`
- Tool metadata injected post-registration by `injectWidgetMetadata()` (`src/tools/index.ts`), which wraps `tools/list` to add `_meta.openai/outputTemplate`, widget accessibility flags, and status copy
- Tool handlers return `_meta` plus `structuredContent` (financial summary, account status, budgets) so ChatGPT renders the appropriate widgets without additional calls

### Component-Initiated Tool Calls
- When a widget button calls `window.openai.callTool`, the host resolves `{ structuredContent }` but **does not** mutate `window.openai.toolOutput`. Components must capture the returned payload and persist it via `window.openai.setWidgetState` (see `widgets/src/shared/widget-utils.ts` helpers) so the UI updates instantly.
- Always read both `toolOutput` and `widgetState`: prefer server data when present, fall back to the persisted snapshot (e.g., `connectAccountLink`) when awaiting a model refresh.
- Example: `widgets/src/financial-summary.tsx` stores the Plaid link returned by `connect-account`, rehydrates it on mount, and clears/updates widget state along with the pending-action flag.

## Data & Storage
- Supabase client (`src/storage/supabase.ts`) lazily instantiates using `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`
- `getSupabaseForUser()` signs a short-lived Supabase JWT with `SUPABASE_JWT_SECRET`, injects the `x-user-id` headers, and caches the client until the token is about to expire.
- Repositories under `src/storage/repositories/` manage tables: `plaid_connections`, `accounts`, `account_sync_state`, `transactions`, etc.
- Budgets module (`src/storage/budgets/`) calculates period windows, aggregates spending, matches transactions
- Migrations in `supabase/migrations/`; append-only policy
- Visualization scripts stored via `src/storage/visualization/`

## External Integrations
- Plaid: `createPlaidClient()` handles environment selection; account connection flow stores encrypted access tokens then fires transaction sync (`TransactionSyncService`)
- Claude (Anthropic): `categorizeTransactions()` batches requests, supports injected mocks; environment key `ANTHROPIC_API_KEY`
- Clerk: middleware in `src/index.ts`; OAuth metadata exposed at `/.well-known/*`
- Render: deployment + cron documented in `docs/RENDER.md` / `docs/RENDER_CRON.md`

## Background Processing Patterns
- Account connection completion triggers `TransactionSyncService.initiateSyncForConnection()` via `setImmediate`
- Sync service paginates `/transactions/sync`, categorizes new transactions, upserts to Supabase, then calls `labelTransactionArrayForBudgets`
- Budget creation/update queues asynchronous relabeling via Claude; current tech debt noted in `CLAUDE.md` (async recategorization TODO)
- Download endpoints use signed tokens (`utils/signed-urls.ts`) backed by in-memory maps for latest CSV export

## Testing & QA
- Integration tests live in `test/integration/`; rely on local Supabase with dockerized stack started through `supabase start`
- Mocks: Plaid via dependency injection, Claude via optional client or environment-based mock detection
- Helpers in `test/helpers/test-db.ts` manage Supabase cleanup + seed data
- Always clean up Supabase state with `npm run reset-user -- --userId=<id>` when re-running manual flows

## Documentation Waypoints
- Human-facing overview: `README.md` (do not edit automatically)
- AI operations guide: `CLAUDE.md` (command matrix, patterns, gotchas)
- Plaid deep dives: `docs/PLAID_API.md`, `docs/PLAID_TRANSACTIONS_SYNC.md`, `docs/PLAID_UPDATE_MODE.md`
- MCP references: `docs/MCP_PROTOCOL_*.md`, widget UX specs in `docs/MCP_WIDGETS_*`
- Prompting & automation: `docs/CLAUDE_PROMPT_ENGINEERING_GUIDE.md`, `docs/CLAUDE_CODE_IMPROVEMENTS.md`
- Budget async design notes: `docs/BUDGET_ASYNC_PROCESSING.md`

## Conventions & Gotchas
- Treat README as human-maintained; suggest changes separately
- Respect sequential migration numbering; never modify historical SQL files
- Tool handlers rely on `authInfo.extra.userId`; ensure Clerk auth context present in tests by stubbing appropriately
- Widget metadata injected in `registerAllTools()` via `injectWidgetMetadata()`; keep in sync when adding new widget-enabled tools
- Spend categorization expects CSV/JSON formats defined in `claude.ts`; maintain schema when extending prompts
- Background jobs must log with `[SERVICE-NAME]` prefixes for observability

## Helpful Scripts & Resources
- `npm run sandbox:create` to generate Plaid sandbox configs
- `npm run reset-user -- --userId=<id>` wipes Supabase data for targeted user
- Public assets (sample CSV, widgets) live under `public/` and `widgets/`
- For manual OAuth tests, follow flow documented in README and `docs/MCP_PROTOCOL_AUTH.md`
