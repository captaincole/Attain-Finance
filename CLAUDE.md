# CLAUDE.md

This file provides guidance to Claude Code when working with the Personal Finance MCP Server.

**IMPORTANT:** The README.md file should only be edited by a human. You can suggest edits but never edit it directly.

## Quick Start

### Common Commands
```bash
npm run dev              # Start development server (http://localhost:3000)
npm run build            # Build TypeScript to build/
npm test                 # Run tests
npm run test:integration # Run integration tests (requires Docker + local Supabase)
npm run sandbox:create   # Generate Plaid sandbox config
npm run reset-user -- --userId=user_xxx  # Reset user data (testing only)

# Cron Jobs
npm run cron:list                   # List all cron jobs
npm run cron:plaid-sync             # Sync all Plaid data (production)
npm run cron:plaid-sync-sandbox     # Sync sandbox users only (testing)

# Git
gh pr create             # Create pull request
```

**YOU MUST** run `npx tsc --noEmit` after making code changes.

### Testing Requirements

**Integration tests require Docker and local Supabase:**

1. **Install Docker Desktop** - Required to run local Supabase
   ```bash
   # macOS: Download from https://www.docker.com/products/docker-desktop
   # Or use homebrew:
   brew install --cask docker
   ```

2. **Start Docker Desktop** - Ensure Docker is running before starting Supabase

3. **Start local Supabase** (first time setup):
   ```bash
   # Initialize Supabase (already done, skip if supabase/ folder exists)
   supabase init

   # Start all Supabase services (Postgres, Auth, Storage, etc.)
   supabase start
   ```

   This will:
   - Start 10 Docker containers (Postgres, PostgREST, Auth, Storage, etc.)
   - Apply all migrations from `supabase/migrations/`
   - Create a local database at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - Provide credentials in `.env.test`

4. **Run integration tests**:
   ```bash
   npm run test:integration
   ```

**Important Notes:**
- Integration tests use **real local Supabase database**, not mocks
- Tests create/cleanup data in local database automatically
- **Claude API calls are mocked via dependency injection** (no credits used)
- **Plaid API calls are mocked via dependency injection** (no real connections)
- All tests should pass with 0 API calls to external services

**Test Organization:**
```
test/
├── helpers/              # Test utilities and setup
│   └── test-db.ts        # Supabase client, cleanup, test data creation
├── mocks/                # Mock implementations
│   ├── plaid-mock.ts     # MockPlaidClient (implements PlaidApi)
│   └── claude-mock.ts    # MockClaudeClient (implements ClaudeClient)
└── integration/          # Integration test suites
    ├── plaid-tools.test.ts           # Plaid connection flow
    ├── oauth-transaction-sync.test.ts # OAuth → background sync
    ├── budget-tools.test.ts           # Budget CRUD operations
    ├── budget-labeling.test.ts        # Transaction labeling
    ├── account-balances.test.ts       # Account balance tool
    ├── async-recategorization.test.ts # Background recategorization
    ├── cron-jobs.test.ts              # Cron infrastructure
    └── mcp-*.test.ts                  # MCP protocol tests
```

**Mock Client Pattern (Dependency Injection):**

All external API clients (Plaid, Claude) use **dependency injection** for testing:

```typescript
// Production code accepts optional client parameter
export async function categorizeTransactions(
  transactions: TransactionForCategorization[],
  customRules?: string,
  claudeClient?: ClaudeClient  // ← Optional mock injection
): Promise<CategorizedTransaction[]> {
  if (claudeClient) {
    return await claudeClient.categorizeTransactions(transactions, customRules);
  }
  // Real API call...
}

// Tests pass MockClaudeClient
import { MockClaudeClient } from "../mocks/claude-mock.js";
const mockClaudeClient = new MockClaudeClient();
await categorizeTransactions(transactions, rules, mockClaudeClient);
```

**Why This Pattern:**
- ✅ Consistent with Plaid mocking approach
- ✅ No environment variable checks in production code
- ✅ Explicit and testable
- ✅ Zero API calls in tests (fast and free)

**Mock Implementations:**
- `MockPlaidClient` - Returns deterministic sandbox data (checking/savings accounts, sample transactions)
- `MockClaudeClient` - Uses keyword matching for categorization ("coffee" → "Food & Dining")

**Test Helper Functions (`test/helpers/test-db.ts`):**
```typescript
// Create real Supabase client for testing
const supabase = createTestSupabaseClient();

// Clean up all test data for a user (respects foreign keys)
await cleanupTestUser(supabase, testUserId);

// Create test Plaid connection (uses upsert to avoid duplicate key errors)
await createTestConnection(supabase, {
  itemId: "test-item-123",
  userId: testUserId,
  institutionName: "Test Bank",
});

// Create test transactions
await createTestTransactions(supabase, [
  { transaction_id: "tx_1", user_id: testUserId, ... },
]);

// Setup common test data (connection + 3 sample transactions)
const { connection, transactions } = await setupCommonTestData(supabase, testUserId);
```

**Stopping Supabase:**
```bash
supabase stop    # Stop all containers
supabase stop --no-backup  # Stop and remove all data (full reset)
```

### Project Structure
```
src/
├── index.ts              # Express server entry point
├── create-server.ts      # MCP server factory
├── tools/                # MCP tool definitions (by feature)
├── routes/               # Express routes (Plaid, OAuth)
├── storage/              # Database access layer
│   └── repositories/     # Transaction, budget, connection repos
├── cron/                 # Cron job infrastructure
│   ├── jobs/             # Individual job definitions
│   ├── services/         # Reusable sync services
│   ├── utils/            # Cron-specific utilities
│   └── runner.ts         # CLI entry point
├── utils/                # Shared utilities
└── prompts/              # AI prompt templates

migrations/               # Database migrations (append-only!)
widgets/                  # ChatGPT widget workspace
public/                   # Static files (served by Express)
docs/                     # Detailed documentation
```

## Critical Rules

### Database Migrations
**CRITICAL:** All migrations must be in `migrations/` folder with sequential numbering (`###_name.sql`).

**NEVER edit existing migration files.** Always create a NEW migration file for schema changes.

**Migration Workflow:**
1. Create new migration file (e.g., `migrations/015_description.sql`)
2. Run migration manually on database
3. Regenerate TypeScript types via Supabase CLI: `npx supabase gen types typescript --local > src/storage/database.types.ts`
4. **DO NOT EDIT `src/storage/database.types.ts` manually** - it is auto-generated
5. Wait for types to regenerate before continuing with code that uses the new schema
6. **If adding a new user-data table**: Update `src/storage/repositories/user-data-cleanup.ts` to include deletion logic for the new table

### Git Commits
**Maximum 7 lines total:**
- Line 1: Short summary (50-72 chars)
- Line 2: Blank
- Lines 3-5: Body explaining what/why
- Lines 6-7: Attribution footer - Do not mention claude

```
Fix Plaid callback error in serverless environment

Migrate session storage from in-memory Map to Supabase.
Fixes 400 errors caused by stateless instances.
```

### Code Style
- **Language:** TypeScript with ES modules (`import`/`export`, not `require`)
- **Style:** Functional style preferred (but OOP when appropriate)
- **Destructuring:** Use when possible: `import { foo } from 'bar'`
- **Database:** All queries go through repository layer in `src/storage/repositories/`
- **No emojis** unless explicitly requested
- **Supabase:** Does NOT support `.raw()` for SQL expressions. To increment counters, fetch current value first, then update with new value.

## Key Architectural Patterns

### Transaction Flow (Database-Backed)
1. **refresh-transactions** - Fetch from Plaid → Upsert to database → Categorize → Label for budgets
2. **get-transactions** - Read from database (instant, no API calls)
3. **upsert-budget** - Save budget → Label matching transactions
4. **get-budgets** - Query pre-labeled transactions (instant)

**Performance:** Database-backed approach is 99% faster than real-time API calls.

### Investment Holdings Flow (Database-Backed)
1. **OAuth Callback** - Initial holdings sync after connecting investment account
2. **Daily Cron Sync** - Full snapshot refresh via `/investments/holdings/get`
3. **get-investment-holdings** - Read from database (instant, no API calls)

**Key Differences from Transactions:**
- **Full Snapshot** - No cursor-based incremental sync (Plaid limitation)
- **No Categorization** - Holdings don't need AI categorization
- **Sync State Tracking** - Tracks `last_synced_at`, `holdings_count`, and errors per account

### Liabilities Flow (Database-Backed, On-Demand)
1. **get-liabilities** - Fetches from Plaid on first call, then reads from database
2. **Optional Type Filter** - Can filter by credit, mortgage, or student loans
3. **Integrated with Account Balances** - Summary shown in `get-account-balances` widget

**Key Features:**
- **On-Demand Sync** - No automatic syncing (yet), fetches from Plaid when tool is called
- **Three Liability Types** - Credit cards, mortgages, and student loans stored in separate tables
- **Normalized Schema** - Shared account data in `accounts` table, liability-specific data in companion tables
- **JSON Fields** - Complex nested structures (APRs, addresses, repayment plans) stored as JSONB

**Database Tables:**
- `liabilities_credit` - Credit card APRs, payment dates, minimum payments
- `liabilities_mortgage` - Property address, interest rate, escrow, PMI
- `liabilities_student` - Servicer info, repayment plans, disbursement dates

### Repository Pattern
All database operations go through `src/storage/repositories/`:
- `transactions.ts` - Transaction CRUD and queries
- `account-connections.ts` - Plaid connection management
- `budgets.ts` - Budget definitions
- `investment-holdings.ts` - Investment holdings CRUD
- `account-investment-sync-state.ts` - Investment sync state tracking
- `liabilities.ts` - Liabilities CRUD across three tables (credit, mortgage, student)

### Tool Design Pattern: Structured Data + AI Instructions

**Core Philosophy:** Data Retrieval ≠ Data Analysis

We separate data fetching from visualization/analysis. Tools return raw structured data along with instructions for how to work with it, rather than pre-computed insights.

**Example: get-transactions**
```typescript
{
  content: [{ type: "text", text: "Found X transactions..." }],
  structuredContent: {
    transactions: [...],  // Full transaction array
    summary: { transactionCount, dateRange },
    dataInstructions: "TRANSACTION DATA ANALYSIS GUIDELINES: ...",
    visualizationInstructions: "VISUALIZATION RECOMMENDATIONS: ..."
  }
}
```

**Key Design Decisions:**
- **Database-Backed** - Reads from `transactions` table (instant, no API calls)
- **Structured Data** - Returns full transaction array in `structuredContent` (supports ~3,000-4,000 transactions)
- **Text Instructions** - Guides ChatGPT on how to analyze and visualize data
- **AI-Powered** - Categorization on our backend, analysis on ChatGPT's side

### ChatGPT Widget Integration

**How ChatGPT Widget Initialization Works:**

1. **Initialize Connection** - Standard MCP handshake
2. **Discover Tools (CRITICAL)** - ChatGPT scans `tools/list` for `_meta["openai/outputTemplate"]`
3. **Pre-fetch Widget HTML** - If found, ChatGPT calls `resources/read` to cache widget HTML
4. **User Calls Tool** - ChatGPT injects `structuredContent` as `window.openai.toolOutput` and renders widget

**Our Custom Implementation (IMPORTANT):**

We wrap the `tools/list` handler to inject `_meta` after tool registration:

```typescript
// Inject _meta into tools/list response for widget support
const serverInternal = server.server as any;
const originalToolsHandler = serverInternal._requestHandlers.get("tools/list");
serverInternal._requestHandlers.set("tools/list", async (request) => {
  const result = await originalToolsHandler(request);
  result.tools = result.tools.map((tool) => {
    if (tool.name === "check-connection-status") {
      return { ...tool, _meta: checkConnectionStatusToolMeta };
    }
    return tool;
  });
  return result;
});
```

**Why This Works:**
- `McpServer.tool()` doesn't include `_meta` in `tools/list` responses by default
- ChatGPT needs `openai/outputTemplate` in `tools/list` to pre-fetch widget HTML
- Our approach manually injects `_meta` while keeping the convenience of `server.tool()`

**Widget Build Process:**
1. Build: `cd widgets && npm run build:all`
2. Output: `public/widgets/*.js` (committed to git)
3. Server provides HTML template via MCP `resources/read`
4. ChatGPT renders iframe with widget

## Environment Variables

**Required:**
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` - OAuth authentication
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - Database
- `ENCRYPTION_KEY` - AES-256 key for Plaid tokens (64-char hex)
- `JWT_SECRET` - Signed download URLs (64-char hex)
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` - Plaid API

**Optional:**
- `PORT` - Server port (default: 3000)
- `BASE_URL` - For download links (local: http://localhost:3000, prod: https://personal-finance-mcp-d0eg.onrender.com)

## Common Gotchas

1. **Transaction storage** - Always read from database, not Plaid API (except during refresh)
2. **Widget metadata** - Uses handler wrapper pattern, not manual tool registration
3. **Plaid sandbox** - Use `user_good` / `pass_good` for testing
4. **Signed URLs** - Expire in 10 minutes, include userId in JWT
5. **Budget labeling** - Pre-computed and stored in `budget_ids` array column
6. **Categorization** - Runs once during refresh, cached in `custom_category` column

## MCP Integration

### Servers Available
- **Render** - Deploy and monitor (requires `RENDER_API_KEY` env var)
- **Context7** - Code context and search

Configured in `.mcp.json` (not checked into git).

### Production URL
https://personal-finance-mcp-d0eg.onrender.com/mcp

**Auth:** All endpoints require Clerk OAuth. Unauthenticated requests return 401.

## Monitoring Deployments

### Service Information
- **Service ID:** `srv-d3o0f8ur433s73e5bl90`
- **Dashboard:** https://dashboard.render.com/web/srv-d3o0f8ur433s73e5bl90
- **Region:** Oregon
- **Plan:** Starter

### Get Service Status
```typescript
// Get service details
mcp__render__get_service({
  serviceId: "srv-d3o0f8ur433s73e5bl90"
})
```

### View Logs
```typescript
// List recent logs (last 50 entries, most recent first)
mcp__render__list_logs({
  resource: ["srv-d3o0f8ur433s73e5bl90"],
  limit: 50,
  direction: "backward"
})

// Filter logs by type (app, build, request)
mcp__render__list_logs({
  resource: ["srv-d3o0f8ur433s73e5bl90"],
  type: ["app"],
  limit: 50
})

// Filter logs by severity level
mcp__render__list_logs({
  resource: ["srv-d3o0f8ur433s73e5bl90"],
  level: ["error"],
  limit: 50
})

// Search logs for specific text
mcp__render__list_logs({
  resource: ["srv-d3o0f8ur433s73e5bl90"],
  text: ["TOOL/GET-BUDGETS"],
  limit: 50
})

// Get logs from specific time range (RFC3339 format)
mcp__render__list_logs({
  resource: ["srv-d3o0f8ur433s73e5bl90"],
  startTime: "2025-10-15T20:00:00Z",
  endTime: "2025-10-15T21:00:00Z",
  limit: 100
})
```

**CI/CD:** Every push to `main` automatically deploys to Render.

## Cron Jobs

### Architecture

Cron jobs use a structured pattern for reusability and maintainability:

```
src/cron/
├── jobs/                 # Individual job definitions
│   ├── plaid-sync.ts
│   └── plaid-sync-sandbox.ts
├── services/            # Reusable sync services
│   ├── user-batch-sync.service.ts
│   ├── transaction-sync.service.ts
│   └── investment-sync.service.ts
├── utils/              # Shared utilities
│   └── cron-logger.ts
└── runner.ts           # CLI entry point
```

### Available Jobs

**plaid-sync** - Sync all Plaid data (transactions, investments, balances) for all users
- **Production Render Schedule**: `0 8 * * *` (midnight PST / 8am UTC)
- **Manual Trigger**: `npm run cron:plaid-sync`
- **Syncs**:
  - Transactions for all accounts (using `/transactions/sync` with cursor-based pagination)
  - Investment holdings for investment accounts (using `/investments/holdings/get` full snapshot)
  - Account balances refreshed automatically during sync
- **Why Daily**: Transactions update frequently, and investment holdings need daily price updates

**plaid-sync-sandbox** - Sandbox-only Plaid data sync (for testing)
- **Production Render Schedule**: N/A (manual only)
- **Manual Trigger**: `npm run cron:plaid-sync-sandbox`
- **Syncs**: Only connections created with sandbox Plaid credentials
- **Purpose**: Test sync infrastructure without affecting production data

### Creating New Cron Jobs

1. **Create job file**: `src/cron/jobs/my-job.ts`
   ```typescript
   export const myJob: CronJob = {
     name: "my-job",
     description: "Description of what this job does",
     async run(): Promise<void> {
       const logger = new CronLogger("my-job");
       // Job implementation
     }
   };
   ```

2. **Register in runner**: Add to `src/cron/runner.ts`:
   ```typescript
   import { myJob } from "./jobs/my-job.js";
   const jobs = {
     "my-job": myJob,
     // ... other jobs
   };
   ```

3. **Add npm script**: Update `package.json`:
   ```json
   "cron:my-job": "npm run cron -- my-job"
   ```

4. **Create Render cron job**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Cron Job"
   - **Name**: `my-job`
   - **Schedule**: Cron expression (e.g., `0 8 * * *`)
   - **Command**: `npm run cron:my-job`
   - **Environment**: Use same env vars as web service
   - **Region**: Oregon (same as web service)

### Monitoring Cron Jobs

Use Render MCP tools to monitor cron job execution:

```typescript
// List all cron jobs
mcp__render__list_services({ includePreviews: false })

// Get cron job details
mcp__render__get_service({ serviceId: "crn-xxx" })

// View cron job logs
mcp__render__list_logs({
  resource: ["crn-xxx"],
  limit: 50,
  direction: "backward"
})
```

### Testing Cron Jobs Locally

```bash
# Test with actual database (requires .env configured)
npm run cron:plaid-sync-sandbox

# List all jobs
npm run cron:list
```

**Important**: Cron jobs run with production environment variables. Test with sandbox-only jobs when possible.

## Detailed Documentation

### Claude Code & Codebase
- **[docs/CLAUDE_PROMPT_ENGINEERING_GUIDE.md](docs/CLAUDE_PROMPT_ENGINEERING_GUIDE.md)** - Claude 4 best practices
- **[docs/CLAUDE_CODE_IMPROVEMENTS.md](docs/CLAUDE_CODE_IMPROVEMENTS.md)** - Codebase improvement plan
- **[docs/TRANSACTION_STORAGE_PLAN.md](docs/TRANSACTION_STORAGE_PLAN.md)** - Database architecture details
- **[test/README.md](test/README.md)** - Testing guide
- **[README.md](README.md)** - User-facing documentation (human-maintained)

### MCP Protocol & Widgets
- **[docs/MCP_PROTOCOL_TRANSPORTS.md](docs/MCP_PROTOCOL_TRANSPORTS.md)** - Streamable HTTP transport
- **[docs/MCP_PROTOCOL_LIFECYCLE.md](docs/MCP_PROTOCOL_LIFECYCLE.md)** - Connection lifecycle
- **[docs/MCP_PROTOCOL_AUTH.md](docs/MCP_PROTOCOL_AUTH.md)** - OAuth 2.0 authentication
- **[docs/MCP_PROTOCOL_TOOLS.md](docs/MCP_PROTOCOL_TOOLS.md)** - Tools protocol
- **[docs/MCP_PROTOCL_RESOURCES.md](docs/MCP_PROTOCL_RESOURCES.md)** - Resources protocol
- **[docs/MCP_WIDGETS_SETUP.md](docs/MCP_WIDGETS_SETUP.md)** - Widget setup guide (OpenAI docs)
- **[docs/MCP_WIDGETS_BUILD_UX.md](docs/MCP_WIDGETS_BUILD_UX.md)** - Widget UX patterns (OpenAI docs)
- **[docs/CHATGPT_WIDGET_DEBUG.md](docs/CHATGPT_WIDGET_DEBUG.md)** - Widget debugging guide

### Plaid API
- **[docs/PLAID_API.md](docs/PLAID_API.md)** - Plaid API reference and patterns
- **Official Plaid Docs**: https://plaid.com/docs/
- **Plaid Sandbox Guide**: https://plaid.com/docs/sandbox/

## Custom Slash Commands

Available via `.claude/commands/`:
- `/project:new-feature-engineer` - Product discovery and technical planning
- `/project:morning-coding-routine` - Daily startup routine with 5S refactor suggestions

## Testing Workflow

### Integration Test Architecture

**Local Supabase Setup:**
- Tests run against **real local Supabase database** (not mocks)
- All migrations applied automatically via `supabase start`
- Database at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Credentials in `.env.test`

**Test Helpers** (`test/helpers/test-db.ts`):
```typescript
// Create real Supabase client for testing
const supabase = createTestSupabaseClient();

// Clean up all test data for a user (respects foreign keys)
await cleanupTestUser(supabase, testUserId);

// Create test Plaid connection with properly encrypted access token
await createTestConnection(supabase, {
  itemId: "test-item-123",
  userId: testUserId,
  institutionName: "Test Bank",
});

// Create test transactions
await createTestTransactions(supabase, [
  { transaction_id: "tx_1", user_id: testUserId, ... },
]);

// Setup common test data (connection + 3 sample transactions)
const { connection, transactions } = await setupCommonTestData(supabase, testUserId);
```

**Mocking Strategy:**
- **Supabase**: Real local database (no mocking)
- **Plaid API**: Mocked via `MockPlaidClient` (passed as parameter to handlers)
- **Claude API**: Auto-mocked in test mode (detects `ANTHROPIC_API_KEY=mock-api-key-for-testing`)
  - See `src/utils/clients/claude.ts` → `isTestMode()` and `mockCategorizationForTests()`
  - Uses simple keyword-based categorization for zero API calls

**Why Plaid Mock Works but Claude Mock Required Different Approach:**
- **Plaid**: Uses dependency injection pattern (plaidClient passed as parameter)
  ```typescript
  await connectAccountHandler(userId, baseUrl, mockPlaidClient);
  ```
- **Claude**: Static import pattern (no parameter to override)
  ```typescript
  import { categorizeTransactions } from "../utils/clients/claude.js";
  await categorizeTransactions(transactions); // No way to inject mock
  ```
- **Solution**: Environment-based mocking inside `categorizeTransactions()` function

**Test Database Cleanup:**
The `cleanupTestUser()` helper deletes data in correct order to respect foreign keys:
1. `transactions` (depends on plaid_connections)
2. `account_sync_state` (depends on plaid_connections)
3. `accounts` (depends on plaid_connections)
4. `budgets`
5. `categorization_prompts`
6. `plaid_connections`
7. `plaid_sessions`

**Recommended TDD approach:**
1. Write tests first (tell Claude: "Write tests, do NOT implement yet")
2. Confirm tests fail: `npm test`
3. Commit tests: `git add . && git commit -m "Add tests for X"`
4. Implement code to pass tests
5. Iterate until all tests pass
6. Run full suite: `npm run test:integration`
7. Commit implementation

## Adding New Tools

1. Create handler in `src/tools/<feature>/`
2. Register in `src/tools/index.ts` via `registerAllTools()`
3. Use `authInfo?.extra?.userId` for user-specific operations
4. Follow existing patterns (see `src/tools/transactions/` for examples)

## Adding New Migrations

1. Create `migrations/###_descriptive_name.sql` with next sequential number
2. Include comments explaining what and why
3. Test locally before deploying
4. Commit and push (auto-deploys to Render, migrations run automatically)

## Development Todos

### Completed
- ✅ **Account Balance Tracking** (2025-10-16) - Implemented end-to-end account balance feature. Created `accounts` table (migration 013), account repository layer, and `get-account-balances` MCP tool. Account balances are automatically fetched and stored during Plaid OAuth callback and refreshed during transaction syncs. Includes automatic session cleanup to prevent "session already completed" errors when users retry connections. Tool displays balances grouped by account type with net worth calculation.

- ✅ **Background Transaction Sync** (2025-10-16) - Implemented automatic transaction sync triggered by OAuth callback. Created migrations 014-015 for `account_sync_state` table tracking. Built `TransactionSyncService` using Plaid's `/transactions/sync` endpoint with cursor-based pagination. Each account syncs independently with its own cursor for error isolation. Transactions are automatically categorized during sync. Fire-and-forget pattern via `setImmediate()` ensures OAuth callback returns 200 immediately. Includes comprehensive logging, integration tests, and observability via `account_sync_state` table. Admin endpoint (`/admin/user/:userId/data`) and interactive CLI script (`npm run reset-user`) added for testing workflow.

### Key Patterns Established

**Background Processing Pattern:**
- Use `setImmediate()` for fire-and-forget async operations after HTTP response
- Log extensively with prefixes like `[SERVICE-NAME]` for debugging
- Store operation state in database for observability
- Handle errors gracefully without affecting primary operation

**Testing Utilities Pattern:**
- Admin endpoints at `/admin/*` (HTTP only, not MCP tools)
- Environment guards: reject in production via `PLAID_ENV` check
- Explicit confirmation required: query parameter `?confirm=DELETE_ALL_DATA`
- Interactive CLI scripts with pretty-printed JSON and y/n prompts
- Update `user-data-cleanup.ts` when adding new user-data tables

### Pending
- ⏳ **Async Recategorization** - Refactor `update-categorization-rules` tool to use background processing pattern (like transaction sync). Currently blocks MCP call while re-categorizing all transactions synchronously, which can take 30+ seconds for users with 1,000+ transactions. Should use `setImmediate()`, store progress in database, and return immediately.
