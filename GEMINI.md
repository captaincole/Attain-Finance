# GEMINI.md

This file provides comprehensive context for Gemini when working with the Personal Finance MCP Server. It combines high-level project goals, architectural details, and specific developer guidelines.

## Project Overview

**Personal Finance MCP Server** is a Model Context Protocol (MCP) server built with Express.js. It provides personal finance tools and data to AI clients (like Claude, ChatGPT, and Gemini).

**Core Value Proposition:**
-   Connects to financial institutions via Plaid.
-   Syncs transactions, balances, and investments to a Supabase database.
-   Exposes this data to AI agents via MCP tools.
-   Supports rich UI widgets for OpenAI/ChatGPT.

## Unique Architectural Features

### 1. Hybrid Authentication System

This project implements a sophisticated **Hybrid Authentication** model to support both standard MCP clients and custom/automated workflows.

*   **Primary: Dynamic Client Registration (DCR)**
    *   Follows the [MCP Auth Scheme](https://modelcontextprotocol.io/specification/draft/basic/authorization).
    *   Uses **Clerk** as the OAuth provider.
    *   Clients (like ChatGPT) perform an OAuth handshake to establish a session.
    *   Middleware: `@clerk/mcp-tools/express` validates session tokens.

*   **Secondary: Bearer Tokens (JWT)**
    *   Allows trusted clients (e.g., local scripts, specific AI agents) to bypass DCR.
    *   **Mechanism**: Accepts `Authorization: Bearer <token>` where `<token>` is a valid Clerk JWT.
    *   **Security**:
        *   Tokens must match a specific Clerk Template (`MCP_BEARER_TEMPLATE_NAME`).
        *   Only allowlisted users (`MCP_BEARER_ALLOWED_USER_IDS`) can mint these tokens via the `mint-mcp-bearer-token` tool.
        *   Tokens are short-lived and cached in-memory for performance.

*   **Supabase RLS (Row Level Security)**
    *   **Challenge**: We use Clerk for auth, but Supabase for data.
    *   **Solution**: The server signs a *new* Supabase-compatible JWT using `SUPABASE_JWT_SECRET` that wraps the Clerk user ID. This allows Supabase RLS policies to enforce data isolation (`auth.uid() = user_id`).

### 2. Database-Backed Tool Execution

Unlike many MCP servers that fetch data live from APIs, this project is **Database-Backed**.

*   **Flow**:
    1.  **Sync**: Background cron jobs or "refresh" tools fetch data from Plaid and upsert it into Supabase.
    2.  **Read**: MCP tools (`get-transactions`, `get-balances`) read *only* from the database.
*   **Benefits**:
    *   **Speed**: Instant responses for AI agents (no 30s API waits).
    *   **Reliability**: No API rate limits or timeouts during user interaction.
    *   **Intelligence**: Allows for background categorization and labeling before the user asks a question.

### 3. Third-Party Integrations

*   **Plaid**: Source of truth for financial data.
    *   *Note*: We use a specific "Sandbox" user (`user_good` / `pass_good`) for testing.
*   **Clerk**: Identity and Access Management. Handles OAuth 2.1 DCR and JWT generation.
*   **Supabase**: PostgreSQL database with RLS. Stores transactions, accounts, budgets, and connection state.
*   **Render**: Hosting provider. Auto-deploys from `main`.
*   **OpenAI Widgets**: Custom UI components rendered in ChatGPT.
    *   *Mechanism*: We inject `_meta` tags into the `tools/list` response to tell ChatGPT which widget to render for specific tools.

## Developer Guidelines

### Database Migrations
**CRITICAL**: The database schema is managed via raw SQL migrations in `migrations/`.
1.  **Never edit existing migrations.** Create a new file (e.g., `migrations/015_feature.sql`).
2.  **Regenerate Types**: After applying a migration locally, run:
    ```bash
    npx supabase gen types typescript --local > src/storage/database.types.ts
    ```
3.  **Do not edit `database.types.ts` manually.**

### Testing
We use a rigorous integration testing strategy that requires **Docker** and **Local Supabase**.
*   **Command**: `npm run test:integration`
*   **Environment**: Uses a real local Postgres instance (spun up via `supabase start`).
*   **Mocking**: External APIs (Plaid, Claude) are mocked via dependency injection to ensure tests are deterministic and free.
    *   *Pattern*: Functions accept an optional client interface (e.g., `plaidClient?: PlaidApi`). Tests inject `MockPlaidClient`.

### Git Conventions
*   **Commit Messages**: 7 lines max. Short summary, blank line, detailed body.
*   **No Emojis**: Unless requested.

## Key Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start local dev server |
| `npm run test:integration` | Run full integration suite (requires Docker) |
| `npm run sandbox:create` | Generate Plaid sandbox config |
| `npm run cron:plaid-sync` | Manually trigger the production sync job |
| `npm run mint-token` | Mint a bearer token for local testing |

## Project Structure

```
src/
├── index.ts              # Entry point & Server setup
├── auth/                 # Hybrid Auth logic (Bearer + DCR)
├── tools/                # MCP Tool definitions
├── routes/               # Express routes (OAuth callbacks)
├── storage/
│   ├── repositories/     # Data access layer (Transactions, Accounts, etc.)
│   └── database.types.ts # Auto-generated Supabase types
├── cron/                 # Background job infrastructure
└── utils/                # Shared utilities

Other Top-Level Folders:
├── supabase/             # Supabase configuration
│   ├── migrations/       # SQL Migrations (Append-only, managed via Supabase CLI)
│   └── seed.sql          # Deterministic seed data for local dev
├── widgets/              # React source code for OpenAI widgets (builds to public/widgets)
├── public/               # Static assets served by Express (icons, built widgets)
├── sandbox/              # Plaid Sandbox configuration and custom user data
├── scripts/              # Utility scripts (token minting, user reset, config validation)
├── test/                 # Integration and unit tests (requires Docker + Local Supabase)
└── docs/                 # Detailed documentation (Architecture, API, Guides)
```
