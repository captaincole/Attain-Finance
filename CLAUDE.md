# CLAUDE.md

This file provides guidance to Claude Code when working with the Personal Finance MCP Server.

**IMPORTANT:** The README.md file should only be edited by a human. You can suggest edits but never edit it directly.

## Quick Start

### Common Commands
```bash
npm run dev              # Start development server (http://localhost:3000)
npm run build            # Build TypeScript to build/
npm run typecheck        # Run TypeScript type checking
npm test                 # Run tests
npm run test:integration # Run integration tests
npm run sandbox:create   # Generate Plaid sandbox config
npm run reset-user -- --userId=user_xxx  # Reset user data (testing only)
gh pr create             # Create pull request
```

**YOU MUST** run `npm run typecheck` after making code changes.

### Project Structure
```
src/
├── index.ts              # Express server entry point
├── create-server.ts      # MCP server factory
├── tools/                # MCP tool definitions (by feature)
├── routes/               # Express routes (Plaid, OAuth)
├── storage/              # Database access layer
│   └── repositories/     # Transaction, budget, connection repos
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
- Lines 6-7: Attribution footer

```
Fix Plaid callback error in serverless environment

Migrate session storage from in-memory Map to Supabase.
Fixes 400 errors caused by stateless instances.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
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

### Repository Pattern
All database operations go through `src/storage/repositories/`:
- `transactions.ts` - Transaction CRUD and queries
- `account-connections.ts` - Plaid connection management
- `budgets.ts` - Budget definitions

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
