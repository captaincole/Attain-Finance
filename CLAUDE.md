# CLAUDE.md

This file provides guidance to Claude Code when working with the Personal Finance MCP Server.

## Git Commit Guidelines

**Commit Message Format:**
- Maximum 7 lines total
- First line: short summary (50-72 characters)
- Blank line
- Body: 3-5 lines maximum explaining what/why
- Always include Claude Code attribution footer

**Example:**
```
Fix Plaid callback error in serverless environment

Migrate session storage from in-memory Map to Supabase database.
Fixes 400 errors caused by stateless Vercel instances.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Project Overview

This is a Model Context Protocol (MCP) server built with Express.js and TypeScript that provides personal finance tools and data through the MCP protocol. The server uses Streamable HTTP Transport with **Clerk OAuth authentication** to secure user data.

**Production URL**: https://personal-finance-mcp.vercel.app/mcp

**Authentication**: All MCP endpoints require OAuth authentication via Clerk. Unauthenticated requests return `401 Unauthorized`.

## Monitoring Vercel Deployments

Use the Vercel MCP server to check deployment status without leaving Claude Code:

```typescript
// Get your team ID
mcp__vercel__list_teams()

// Get project details and latest deployment
mcp__vercel__get_project({
  projectId: "prj_n09eCw9WwelhsBJCik2TNHB3XteP",
  teamId: "team_TCcYEvV7cx7Xit3TzghhciW7"
})
```

The `latestDeployment.readyState` field shows deployment status:
- `BUILDING` - Deployment in progress
- `READY` - Deployment complete and live
- `ERROR` - Deployment failed

**Project IDs:**
- **personal-finance-mcp**: `prj_n09eCw9WwelhsBJCik2TNHB3XteP`
- **Team ID**: `team_TCcYEvV7cx7Xit3TzghhciW7`

## Database Migrations

**IMPORTANT MIGRATION RULES:**

1. **All database migrations must be in the `migrations/` folder**
2. **Migration naming**: `###_descriptive_name.sql` with zero-padded integers (e.g., `001_create_plaid_connections.sql`, `002_add_user_settings.sql`)
3. **NEVER edit a migration file that has already been successfully applied**
4. **Always create a NEW migration file** for schema changes, even if fixing a previous migration
5. **Migrations are append-only** - treat them as immutable once applied to any environment

This ensures migration history is preserved and prevents issues when deploying to multiple environments.

## Custom Sandbox Test Data

You can create realistic Plaid Sandbox users with custom transaction data from real bank exports.

### Quick Start

```bash
# Generate Plaid configuration from CSV files
npm run sandbox:create

# Validate the configuration
npm run sandbox:validate
```

### Workflow

1. **CSV Files are provided** in `sandbox/data/`:
   - `bankofamerica.csv` - Bank of America checking account
   - `chasedata.CSV` - Chase credit card
   - `VenmoStatement_*.csv` - Venmo transactions (3 monthly files)

2. **Run generator** to create Plaid configuration:
   ```bash
   npm run sandbox:create
   ```
   - Parses all CSV files
   - Converts to Plaid custom user schema v2
   - Limits Chase transactions to 150 (to stay under 250 total limit)
   - Outputs `sandbox/custom-user-config.json`

3. **Validate** the configuration:
   ```bash
   npm run sandbox:validate
   ```
   - Checks total transaction count ≤250
   - Verifies schema matches Plaid requirements
   - Shows account summary

4. **Upload to Plaid Dashboard**:
   - Go to https://dashboard.plaid.com/developers/sandbox
   - Click "Create new custom user"
   - Set username: `user_custom_bofa_chase_venmo`
   - Copy/paste JSON from `sandbox/custom-user-config.json`
   - Save

5. **Use in Plaid Link**:
   - When testing in sandbox, use username: `user_custom_bofa_chase_venmo`
   - Any password works (e.g., `pass`)
   - Your real transaction data will appear in the connected accounts

### Transaction Counts

Current CSV data (as of implementation):
- Bank of America: ~28 transactions
- Chase Credit Card: ~150 transactions (filtered from 321)
- Venmo: ~25 transactions
- **Total: ~203 transactions** (under 250 limit ✓)

### Updating Test Data

To modify sandbox data:

1. Edit CSV files in `sandbox/data/`
2. Run `npm run sandbox:create` to regenerate config
3. Run `npm run sandbox:validate` to verify
4. Re-upload to Plaid Dashboard

**Note:** The generator will warn if total transactions exceed 250.

## ChatGPT Widget Development

### Project Structure

Widgets are built separately and served as static HTTP resources:

```
personal-finance-mcp/
├── widgets/                      # Widget workspace
│   ├── package.json             # Widget dependencies and build scripts
│   ├── tsconfig.json            # TypeScript config for widgets
│   └── src/                     # Widget source code (React + TypeScript)
│       ├── connected-institutions.tsx
│       └── connected-institutions.css
├── public/                      # Static files served via Express
│   └── widgets/                 # Widget build output (committed to git)
│       ├── connected-institutions.js
│       └── connected-institutions.css
├── src/                         # Server source code
│   ├── create-server.ts         # Widget metadata and resource handlers
│   └── tools/
│       └── plaid-connection.ts  # Tool that returns widget data
└── build/                       # Server build output (gitignored)
```

**Key Concepts:**
- Widgets build to `public/widgets/` and are served as static HTTP files
- ChatGPT's iframe fetches widget JS/CSS via `<script src="https://...">` tags
- Server provides widget HTML template via MCP `resources/read` handler
- Tool responses include `structuredContent` which becomes `window.openai.toolOutput`

### Step-by-Step: Adding a New Widget

#### 1. Create Widget Component

Create `widgets/src/your-widget.tsx`:

```typescript
import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

// Define your data types
interface YourWidgetOutput {
  data: string[];
  count: number;
}

// Hook to subscribe to window.openai.toolOutput changes
function useToolOutput(): YourWidgetOutput | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      // ChatGPT fires "openai:set_globals" when toolOutput changes
      const handleSetGlobals = (event: CustomEvent) => {
        if (event.detail?.globals?.toolOutput !== undefined) {
          onChange();
        }
      };

      window.addEventListener("openai:set_globals", handleSetGlobals as EventListener);
      return () => {
        window.removeEventListener("openai:set_globals", handleSetGlobals as EventListener);
      };
    },
    () => (window as any).openai?.toolOutput ?? null,
    () => null // Server-side rendering fallback
  );
}

function YourWidget() {
  const toolOutput = useToolOutput();

  // Show loading state while waiting for data
  if (toolOutput === null) {
    return <div>Loading...</div>;
  }

  // Render your widget with the data
  return (
    <div>
      <h3>Your Widget</h3>
      <p>Count: {toolOutput.count}</p>
      <ul>
        {toolOutput.data.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// Mount component
const root = document.getElementById("your-widget-root");
if (root) {
  createRoot(root).render(<YourWidget />);
}
```

#### 2. Update Widget Build Scripts

Edit `widgets/package.json`:

```json
{
  "scripts": {
    "build": "esbuild src/connected-institutions.tsx --bundle --format=esm --outfile=../public/widgets/connected-institutions.js",
    "build:your-widget": "esbuild src/your-widget.tsx --bundle --format=esm --outfile=../public/widgets/your-widget.js",
    "build:all": "npm run build && npm run build:your-widget"
  }
}
```

#### 3. Register Widget Resource Handler

In `src/create-server.ts`, add widget metadata and resource handler:

```typescript
// Widget resource definition
const yourWidgetUri = "ui://widget/your-widget.html";
const yourWidgetMeta = {
  "openai/widgetDescription": "Description of what your widget does",
  "openai/widgetPrefersBorder": true,
  "openai/widgetCSP": {
    connect_domains: [],
    resource_domains: ["https://personal-finance-mcp.vercel.app"]
  }
};

// Function to generate widget HTML with external script references
function getYourWidgetHTML(): string {
  const baseUrl = getBaseUrl();
  return `
<div id="your-widget-root"></div>
<link rel="stylesheet" href="${baseUrl}/widgets/your-widget.css">
<script type="module" src="${baseUrl}/widgets/your-widget.js"></script>
  `.trim();
}

// Register resource handler (add to existing setRequestHandler)
server.server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  if (request.params.uri === yourWidgetUri) {
    return {
      contents: [{
        uri: yourWidgetUri,
        mimeType: "text/html+skybridge",
        text: getYourWidgetHTML(),
        _meta: yourWidgetMeta
      }]
    };
  }

  // ... other widget handlers
});
```

#### 4. Create Tool That Returns Widget Data

In `src/tools/your-tool.ts`:

```typescript
export async function yourToolHandler(userId: string) {
  // Fetch your data
  const data = ["item1", "item2", "item3"];

  // Return tool response matching OpenAI pattern
  return {
    content: [
      {
        type: "text" as const,
        text: "Here is your data visualization",
      },
    ],
    structuredContent: {
      data: data,
      count: data.length,
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/your-widget.html",
      "openai/widgetAccessible": true,
      "openai/resultCanProduceWidget": true
    }
  };
}
```

**Important:** The `structuredContent` object becomes `window.openai.toolOutput` in your widget.

#### 5. Register the Tool

In `src/create-server.ts`:

```typescript
server.tool(
  "your-tool-name",
  "Description of what the tool does",
  {
    // Zod schema for arguments (can be empty {})
  },
  async (_args, { authInfo }) => {
    const userId = authInfo?.extra?.userId as string;
    return yourToolHandler(userId);
  }
);
```

#### 6. Build and Deploy

```bash
npm run build          # Builds widgets to public/widgets/ and server
git add .
git commit -m "Add your widget"
git push               # Vercel auto-deploys
```

### Widget Data Flow

1. **User calls tool** in ChatGPT: `"Show my data"`
2. **Tool handler executes**, returns:
   - `content`: Text response
   - `structuredContent`: Data object
   - `_meta`: Widget URI reference
3. **ChatGPT fetches widget HTML** via `resources/read` request to `ui://widget/your-widget.html`
4. **Server returns HTML** with `<script src="https://your-server.com/widgets/your-widget.js">`
5. **ChatGPT renders iframe**, browser fetches JS/CSS via HTTP
6. **ChatGPT injects data**: Sets `window.openai.toolOutput = structuredContent`
7. **ChatGPT fires event**: Dispatches `openai:set_globals` event
8. **Widget re-renders**: `useToolOutput()` hook detects change and updates UI

### Important Settings

**Content Security Policy (CSP):**
- Must whitelist your domain in `resource_domains` array
- Use full HTTPS URL: `["https://personal-finance-mcp.vercel.app"]`
- This allows ChatGPT's iframe to fetch your JS/CSS files

**Tool Invocation Messages:**
```typescript
_meta: {
  "openai/toolInvocation/invoking": "Loading your data...",  // Shown while tool runs
  "openai/toolInvocation/invoked": "Data loaded",            // Shown when complete
}
```

**Widget Loading States:**
```typescript
if (toolOutput === null) {
  return <div>Loading...</div>;  // While waiting for tool response
}

if (toolOutput.data.length === 0) {
  return <div>No data available</div>;  // When data is empty
}

// Render normal UI
```

### Common Patterns

**Reading tool output:**
```typescript
const toolOutput = useToolOutput();  // Reactive hook
const data = toolOutput?.yourField || defaultValue;
```

**Handling loading:**
```typescript
if (toolOutput === null) return <Loading />;  // ChatGPT shows loading message
```

**Styling:**
- Use inline styles or CSS files
- Keep it simple - ChatGPT provides the container
- Support light/dark themes if needed (via `window.openai.theme`)

### Troubleshooting

**Widget shows "No data":**
- Check browser console for `window.openai.toolOutput`
- Verify `structuredContent` matches your TypeScript interface
- Ensure event listener is using `openai:set_globals` (not `openai:tool_response`)

**CSS/JS fails to load:**
- Check CSP `resource_domains` includes your full HTTPS URL
- Verify files exist at `public/widgets/your-widget.js`
- Check Express is serving `public/` as static files

**Widget doesn't update:**
- Ensure using `useSyncExternalStore` hook
- Check event listener is attached correctly
- Verify `onChange()` is called when event fires

## TODO

### ChatGPT Widget Integration - Understanding the Pattern and Refactoring

**Status:** ✅ Widget rendering works with current workaround. Refactor recommended for cleaner code.

## How ChatGPT Widget Initialization Works

When ChatGPT connects to an MCP server with widgets, it follows this exact initialization sequence:

### 1. Initialize Connection
```
Client → Server: POST /mcp { "method": "initialize", "params": { "protocolVersion": "2025-06-18", "capabilities": {} } }
Server → Client: { "capabilities": { "resources": {}, "tools": {} }, "serverInfo": { ... } }
Client → Server: POST /mcp { "method": "notifications/initialized" }
```

### 2. Discover Tools (CRITICAL STEP FOR WIDGETS)
```
Client → Server: POST /mcp { "method": "tools/list" }
Server → Client: {
  "tools": [
    {
      "name": "check-connection-status",
      "description": "Check if user has connected financial institutions...",
      "inputSchema": { ... },
      "_meta": {                                      ← REQUIRED FOR WIDGETS!
        "openai/outputTemplate": "ui://widget/...",   ← Widget URI - triggers pre-fetch
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true
      }
    },
    // ... other tools without _meta
  ]
}
```

**KEY REQUIREMENT:** ChatGPT scans the `tools/list` response for any tool with `_meta["openai/outputTemplate"]`. If found, it immediately triggers Step 3.

### 3. Pre-fetch Widget HTML (Automatic if `outputTemplate` found)
```
Client → Server: POST /mcp { "method": "resources/read", "params": { "uri": "ui://widget/connected-institutions.html" } }
Server → Client: {
  "contents": [{
    "uri": "ui://widget/connected-institutions.html",
    "mimeType": "text/html+skybridge",
    "text": "<div id='root'></div><script type='module'>...</script>",
    "_meta": {
      "openai/widgetDescription": "Interactive cards showing...",
      "openai/widgetPrefersBorder": true
    }
  }]
}
```

ChatGPT caches the widget HTML and is now ready to render it when the tool is called.

### 4. User Calls Tool (Later in conversation)
```
User: "Check my connection status"
Client → Server: POST /mcp { "method": "tools/call", "params": { "name": "check-connection-status" } }
Server → Client: {
  "content": [{ "type": "text", "text": "✓ Connected to 2 institutions..." }],
  "structuredContent": {
    "institutions": [
      { "itemId": "...", "institutionName": "Chase", "accounts": [...] },
      { "itemId": "...", "institutionName": "Bank of America", "accounts": [...] }
    ],
    "totalAccounts": 5
  },
  "_meta": {
    "openai/outputTemplate": "ui://widget/connected-institutions.html",
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true
  }
}
```

ChatGPT:
1. Sees `outputTemplate` URI in tool response
2. Looks up cached widget HTML
3. Injects `structuredContent` as `window.openai.toolOutput` in the widget's iframe
4. Renders the widget in the chat

## Why Our Current Implementation Works (But Needs Refactoring)

**Current Implementation:**
We wrap the `tools/list` handler to inject `_meta` after tool registration (see [src/create-server.ts:509-532](src/create-server.ts)):

```typescript
// Workaround: Inject _meta into tools/list response
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
- ChatGPT needs `openai/outputTemplate` in `tools/list` to pre-fetch widget HTML via `resources/read`
- Our workaround manually injects `_meta` into the response

**Recommended Refactor:**
Switch to the pattern used by OpenAI's Pizzaz example (see `openai-apps-sdk-examples/pizzaz_server_node/src/server.ts`):

1. **Manually build tools array** with `_meta`:
   ```typescript
   const tools: Tool[] = [
     {
       name: "check-connection-status",
       description: "...",
       inputSchema: { ... },
       _meta: {
         "openai/outputTemplate": "ui://widget/connected-institutions.html",
         "openai/widgetAccessible": true,
         "openai/resultCanProduceWidget": true
       }
     },
     // ... other tools
   ];
   ```

2. **Register custom handler** instead of using `server.tool()`:
   ```typescript
   server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
     tools
   }));

   server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
     // Manual routing to tool handlers
     switch (request.params.name) {
       case "check-connection-status":
         return checkConnectionStatusHandler(...);
       // ... other tools
     }
   });
   ```

**Benefits of Refactoring:**
- Cleaner, more explicit code
- No internal API access (`serverInternal._requestHandlers`)
- Matches official OpenAI example pattern
- Easier to add multiple widget-enabled tools in the future

**Trade-offs:**
- More boilerplate code (manual tool routing)
- Loses some of the convenience of `server.tool()` abstraction
- Need to maintain tools list separately from handlers

### Database Migration (Priority)

**Current State:** All Plaid data stored in-memory Maps (lost on server restart)
- `pendingConnections: Map<sessionId, PendingConnection>` - OAuth session tracking
- `userPlaidTokens: Map<userId, PlaidConnection>` - Access tokens & account details
- `userTransactionData: Map<userId, csvContent>` - Temporary transaction downloads

**Required:**
1. Replace in-memory storage with PostgreSQL/Supabase
2. Encrypt `access_token` at rest (never store plaintext tokens)
3. Add Row Level Security (RLS) filtering by `userId` from Clerk
4. Implement token refresh logic for expired Plaid connections
5. Add webhook endpoint for Plaid item updates (deactivation, errors)

**Schema Outline:**
```sql
CREATE TABLE plaid_items (
  user_id TEXT PRIMARY KEY,
  access_token_encrypted TEXT NOT NULL,
  item_id TEXT NOT NULL,
  connected_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active'
);

CREATE TABLE plaid_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES plaid_items(user_id),
  account_id TEXT NOT NULL,
  name TEXT,
  type TEXT,
  subtype TEXT,
  mask TEXT
);

CREATE TABLE plaid_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

## MVP Features

### 1. Plaid Bank Connection (NEW)

Connect real bank accounts via Plaid API to retrieve live transaction data. Supports sandbox testing with fake bank accounts.

**User Flow:**
1. User calls `connect-financial-institution` tool
2. Server generates Plaid Link token and returns clickable URL
3. User clicks URL → Browser opens Plaid Link UI
4. User authenticates with bank (Sandbox: `user_good` / `pass_good`)
5. Plaid automatically redirects to server with public token
6. Server exchanges token for permanent access token and stores it
7. User returns to Claude and calls `check-connection-status` to confirm

**Available Tools:**
- `connect-financial-institution` - Initiate bank connection flow
- `check-connection-status` - View connected accounts and balances
- `get-plaid-transactions` - Fetch real transaction data (CSV download)

### 2. AI-Powered Transaction Categorization

Automatically categorizes transactions using Claude 3.5 Sonnet with user-customizable categorization rules.

**User Experience Flow:**

1. **User requests spending data**: "Get my recent transactions"
2. **System fetches and categorizes**:
   - Retrieves transactions from Plaid
   - Loads user's custom categorization rules (if any)
   - Calls Claude API to categorize all transactions
   - Returns CSV with `custom_category` column
3. **User visualizes data**: Downloads and runs visualization script
4. **User customizes categories**: "Put Amazon Prime in Business category"
5. **System updates rules**:
   - Saves updated categorization prompt to user profile
   - Automatically re-fetches and re-categorizes transactions
   - Returns new CSV with updated categories
6. **User sees updated visualization**: Re-runs script with new categories

**Key Features:**
- Parallel batch processing (50 transactions per batch) for speed
- User-specific categorization rules stored in database
- Default categories: Housing, Transportation, Food & Dining, Shopping, Entertainment, Healthcare, Personal Care, Travel, Business, Income, Transfer, Other
- No transaction data caching (privacy-first design)

**Available Tools:**
- `get-transactions` - Fetch and categorize transactions (CSV download)
- `update-categorization-rules` - Customize category assignments with natural language

### 3. Expert Opinions System

Layer expert analysis methodologies on top of financial tools. Opinions are shareable prompts that guide AI analysis using specific frameworks (e.g., "Exclude large expenses from budget").

**Architecture:**
- **Opinions** = Text prompts stored in database
- Applied to existing tool outputs (visualizations, budgets, etc.)
- Manually curated (no self-service yet)
- Generic system works with any tool

**User Experience Flow:**

1. **User calls a tool**: "Visualize my spending"
2. **Tool suggests opinions**: Shows available expert methodologies
3. **User applies opinion**: "Use the exclude large expenses method"
4. **System returns prompt**: Full analysis instructions
5. **AI applies methodology**: Analyzes data using expert framework
6. **User sees results**: Deeper insights beyond raw data

**Example Opinion:**
```
Name: Exclude Large Expenses from Budget
Tool: visualize-spending
Purpose: Separate recurring monthly spending from one-time large purchases

The opinion teaches AI to:
- Identify expenses over $500
- Categorize as one-time, irregular, or emergency
- Create two budget views (full vs. recurring)
- Calculate monthly savings for irregular expenses
```

**Database Schema:**
```sql
CREATE TABLE opinions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  author TEXT NOT NULL,
  tool_name TEXT NOT NULL,  -- Which tool this applies to
  description TEXT,
  prompt TEXT NOT NULL,      -- The actual analysis instructions
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Available Tools:**
- `get-opinion` - Retrieve an expert opinion prompt by ID
- All tools suggest relevant opinions in their responses

**Adding New Opinions:**
```sql
INSERT INTO opinions (id, name, author, tool_name, description, prompt)
VALUES ('opinion-id', 'Name', 'Author', 'tool-name', 'Description', 'Full prompt text');
```

### 4. Customizable Data Visualizations

Users can customize spending visualizations using natural language or direct script editing.

**User Experience Flow:**

1. **User visualizes data**: Downloads default visualization script and runs it
2. **User requests customization**: "Show top 15 categories instead of 10" or "Change bar color to blue"
3. **System updates script**:
   - Loads user's current custom script (or default)
   - Calls Claude API to apply requested changes
   - Validates output is valid bash script
   - Saves customized script to user profile
4. **User downloads updated script**: Gets personalized visualization
5. **User runs updated visualization**: Sees customized output
6. **User can reset anytime**: Returns to default visualization

**Key Features:**
- Per-user script storage in database
- Natural language customization ("exclude Income category")
- Direct code editing support (AI modifies bash script)
- Common customizations: colors, bar style, TOP_N count, category filtering
- Default excludes: Income, Transfer, Payment categories

**Available Tools:**
- `visualize-spending` - Download visualization script (default or custom)
- `update-visualization` - Customize script with natural language
- `reset-visualization` - Return to default script

### 5. Subscription Tracking

The original demo demonstrates the **Tool → Signed Download URL → AI Analysis** pattern for detecting recurring subscriptions in credit card transactions.

**How It Works:**

1. **User calls tool**: `track-subscriptions` (no arguments required)
2. **Tool generates signed URLs**:
   - Creates JWT-signed download URL for user's transaction data (expires in 10 minutes)
   - Includes userId in JWT payload for user-specific data
   - Returns curl download commands and analysis instructions
3. **AI downloads files**:
   - Downloads `transactions.csv` using signed URL (user-specific, expiring)
   - Downloads `analyze-subscriptions.js` analysis script (static, public)
4. **AI analyzes data**:
   - Runs the JavaScript analysis script locally
   - Script performs accurate mathematical analysis (no AI calculation errors)
5. **AI presents results**: Human-readable subscription summary with costs and patterns

### Key Pattern: Tool + Signed URL Workflow

**Core Differentiation:** We provide executable analysis code that users can customize, not just AI-generated analysis. This enables users to start with a working system and modify it for their specific needs.

**Why Signed URLs Instead of MCP Resources:**
- **Efficient**: Large files downloaded directly to disk (no token waste on file content)
- **Secure**: Time-limited URLs (10-minute expiry) with JWT signatures
- **User-Specific**: userId embedded in JWT enables per-user data isolation
- **Scalable**: Works with any file size without MCP protocol limitations

**Pattern Components:**
- **Tools** generate signed download URLs and provide analysis instructions
- **Signed URLs** deliver user-specific data securely with time limits
- **Static Files** serve analysis scripts (public, no expiry needed)
- **AI** downloads files via curl and executes analysis scripts
- **Scripts** ensure mathematical accuracy (AI runs them instead of doing manual calculations)

## Architecture

### Core Components

1. **[src/index.ts](src/index.ts)** - Express server entry point
   - Sets up Express middleware (CORS, JSON parsing, static files)
   - Configures StreamableHTTPServerTransport for MCP protocol
   - Handles `/mcp` POST endpoint for MCP requests
   - Manages server lifecycle and graceful shutdown

2. **[src/create-server.ts](src/create-server.ts)** - MCP server and tool definitions
   - Creates McpServer instance with name and version
   - Registers MCP resources using `server.resource()` method
   - Registers MCP tools using `server.tool()` method
   - Contains tool implementations and business logic

3. **[public/](public/)** - Static assets served by Express
   - [transactions.csv](public/transactions.csv) - Fake credit card transaction dataset (100 rows, 3 months)
   - [analyze-subscriptions.js](public/analyze-subscriptions.js) - ES module script for subscription detection

4. **[src/prompts/](src/prompts/)** - Prompt templates for AI instructions
   - [analyze-subscriptions.txt](src/prompts/analyze-subscriptions.txt) - Detailed analysis instructions for subscription tracking

### Technology Stack

- **Runtime**: Node.js with ES modules
- **Language**: TypeScript 5.7.3
- **Framework**: Express 4.21.2
- **MCP SDK**: @modelcontextprotocol/sdk ^1.10.0
- **Authentication**: Clerk (@clerk/express, @clerk/mcp-tools)
- **Bank Data**: Plaid API (plaid ^29.0.0)
- **Validation**: Zod 3.24.2
- **Dev Tools**: Nodemon, Concurrently, TSC watch mode

### MCP Protocol

The server implements the Model Context Protocol over HTTP:
- **Endpoint**: `POST /mcp` (requires OAuth authentication)
- **Transport**: Streamable HTTP via Clerk's `streamableHttpHandler`
- **Authentication**: Bearer token in `Authorization` header
- **Content Types**: Requires `Accept: application/json, text/event-stream`
- **Response Format**: Server-Sent Events (SSE) with JSON-RPC 2.0

### OAuth Endpoints

The server exposes OAuth metadata for MCP client discovery:

1. **OAuth Protected Resource Metadata**: `GET /.well-known/oauth-protected-resource/mcp`
   - Returns metadata about the protected `/mcp` endpoint
   - Includes Clerk authorization server URL
   - Specifies supported scopes: `email`, `profile`
   - Required for MCP clients to discover authentication requirements

2. **OAuth Authorization Server Metadata**: `GET /.well-known/oauth-authorization-server`
   - Returns Clerk's OAuth server metadata
   - Includes authorization and token endpoints
   - Required for older MCP clients that implement earlier spec versions

## Development Workflow

### Setup

```bash
npm install              # Install dependencies

# Create .env file with Clerk credentials
cp .env.example .env
# Edit .env and add your Clerk keys:
# CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
# CLERK_SECRET_KEY=sk_test_xxxxx

npm run build            # Build TypeScript to build/
```

### Development

```bash
npm run dev              # Start dev server with hot reload on port 3000
```

This runs two concurrent processes:
- `tsc --watch` - Compiles TypeScript on file changes
- `nodemon` - Restarts server when build files change

### Building

```bash
npm run build            # Compile TS and make build/*.js executable
npm start                # Run production server
```

### Project Structure

```
personal-finance-mcp/
├── src/
│   ├── index.ts              # Express server + download endpoints
│   ├── create-server.ts      # MCP tools and business logic
│   ├── utils/
│   │   └── signed-urls.ts    # JWT signing/verification
│   ├── tools/
│   │   ├── track-subscriptions.ts  # Subscription tracking tool
│   │   └── weather.ts        # Weather tools (demo)
│   ├── resources/
│   │   └── finance-data.ts   # (Archived - MCP resources removed)
│   └── prompts/
│       └── analyze-subscriptions.txt  # AI analysis instructions
├── public/
│   ├── transactions.csv      # Sample transaction data
│   └── analyze-subscriptions.js       # Analysis script (static)
├── build/                    # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
├── vercel.json              # Vercel deployment config
└── CLAUDE.md               # This file
```

## Signed URL Pattern (Recommended)

This server uses **JWT-signed, time-limited download URLs** instead of MCP resources for efficient large file handling.

### Why This Pattern?

**Problems with MCP Resources:**
- Entire file content loaded into MCP protocol messages
- Wastes tokens for large datasets
- AI must manually copy content to files (error-prone)
- Doesn't scale beyond small files

**Benefits of Signed URLs:**
- AI downloads files directly to disk using `curl`
- No token waste on file content
- Works with any file size
- Secure with time-limited JWT tokens
- Ready for user-specific data (userId in JWT)

### Implementation Components

**1. Signed URL Utility** ([src/utils/signed-urls.ts](src/utils/signed-urls.ts))

```typescript
import { generateSignedUrl } from "./utils/signed-urls.js";

// Generate download URL (expires in 10 minutes)
const downloadUrl = generateSignedUrl(
  baseUrl,      // https://your-server.com
  userId,       // User's ID from OAuth
  "transactions", // Resource type
  600           // Expiry in seconds (default: 600 = 10 min)
);
```

**2. Download API Endpoint** ([src/index.ts](src/index.ts))

```typescript
// GET /api/data/transactions?token=<jwt>
app.get("/api/data/transactions", (req, res) => {
  const payload = verifySignedToken(req.query.token);

  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Currently: serve static CSV
  // Future: query database WHERE user_id = payload.userId

  res.setHeader("Content-Type", "text/csv");
  const fileStream = fs.createReadStream(csvPath);
  fileStream.pipe(res);
});
```

**3. Tool Response Format** ([src/tools/track-subscriptions.ts](src/tools/track-subscriptions.ts))

```typescript
export async function trackSubscriptionsHandler(userId: string, baseUrl: string) {
  const transactionsUrl = generateSignedUrl(baseUrl, userId, "transactions", 600);
  const scriptUrl = `${baseUrl}/analyze-subscriptions.js`; // Static file

  return {
    content: [{
      type: "text",
      text: `
STEP 1: Download your transaction data (expires in 10 minutes)
curl "${transactionsUrl}" -o transactions.csv

STEP 2: Download analysis script
curl "${scriptUrl}" -o analyze-subscriptions.js

STEP 3: Run analysis
node analyze-subscriptions.js transactions.csv
`
    }]
  };
}
```

### Security Model

- **JWT Signature**: Prevents URL tampering
- **Expiration**: 10-minute default (configurable)
- **User Isolation**: userId embedded in JWT payload
- **Stateless**: No server-side session storage needed
- **Secret**: `JWT_SECRET` environment variable

### Reusing This Pattern

To add a new data download endpoint:

1. **Create API endpoint** in [src/index.ts](src/index.ts):
   ```typescript
   app.get("/api/data/your-resource", (req, res) => {
     const payload = verifySignedToken(req.query.token);
     if (!payload || payload.resource !== "your-resource") {
       return res.status(401).json({ error: "Invalid token" });
     }
     // Return user-specific data using payload.userId
   });
   ```

2. **Update tool handler** to generate signed URL:
   ```typescript
   const url = generateSignedUrl(baseUrl, userId, "your-resource", 600);
   ```

3. **Return curl command** in tool response:
   ```typescript
   text: `curl "${url}" -o your-file.csv`
   ```

### Static Files (No Auth Needed)

For non-sensitive files (analysis scripts, templates), serve from `public/` directory:
- Accessible at `https://your-server.com/filename.js`
- No authentication required
- No expiration
- Use for: Analysis scripts, documentation, public templates

## MCP Tools

### connect-financial-institution

Initiates Plaid Link flow to connect a bank account.

**Arguments**: None

**Authentication**: Required (OAuth via Clerk)

**Returns**:
- Clickable Plaid Link URL with embedded session ID
- Instructions for sandbox testing credentials
- Guidance on what happens during the flow

**Example Usage** (via Claude Desktop):
```
User: "Connect my bank account"
Claude: Calls connect-financial-institution tool
Server: Returns Plaid Link URL
User: Clicks URL, authenticates with bank, returns to Claude
```

**Implementation**: See [src/tools/plaid-connection.ts](src/tools/plaid-connection.ts)

### check-connection-status

Check if user has connected a bank account and view account details.

**Arguments**: None

**Authentication**: Required (OAuth via Clerk)

**Returns**:
- Connection status (connected or not)
- If connected: Account names, types, balances, item ID
- Available commands for next steps

**Example Response**:
```
✓ Bank Connected

Connected: 12/15/2024, 3:45:00 PM
Item ID: item-sandbox-abc123

Accounts (3):
- Plaid Checking (checking): $1,210.45
- Plaid Savings (savings): $5,320.10
- Plaid Credit Card (credit): $-450.32

Available Commands:
- "Get my recent transactions"
- "Track my subscriptions"
```

**Implementation**: See [src/tools/plaid-connection.ts](src/tools/plaid-connection.ts)

### get-transactions

Fetch real transaction data from connected financial institution with AI-powered categorization.

**Arguments**:
- `start_date` (optional): Start date in YYYY-MM-DD format (default: 90 days ago)
- `end_date` (optional): End date in YYYY-MM-DD format (default: today)

**Authentication**: Required (OAuth via Clerk)

**Returns**:
- Count of transactions found
- Date range queried
- Signed download URL for transactions CSV with custom categories (expires in 10 minutes)
- curl command to download file

**Example Call**:
```typescript
// Get last 30 days of transactions
get-transactions({ start_date: "2024-11-15", end_date: "2024-12-15" })

// Get default range (last 90 days)
get-transactions({})
```

**CSV Format**:
```
date,description,amount,category,account_name,pending,custom_category
2024-12-15,"Netflix",15.99,"Entertainment, Streaming","",false,"Entertainment"
2024-12-14,"Whole Foods",45.23,"Food and Drink, Groceries","",false,"Food & Dining"
```

**Implementation**: See [src/tools/plaid-transactions.ts](src/tools/plaid-transactions.ts)

### get-opinion

Retrieve an expert opinion prompt to apply to financial analysis. Returns full analysis instructions for a specific methodology.

**Arguments**:
- `opinion_id` (required): The ID of the opinion to retrieve (e.g., 'exclude-large-expenses-budgeting')

**Authentication**: Required (OAuth via Clerk)

**Returns**:
- Opinion name and author
- Description
- Full analysis prompt with instructions

**Example Call**:
```typescript
get-opinion({ opinion_id: "exclude-large-expenses-budgeting" })
```

**Response Format**:
```
## Exclude Large Expenses from Budget
By Personal Finance Influencer

Remove one-time large purchases to see your true recurring monthly budget

---

[Full analysis methodology and instructions]
```

**Implementation**: See [src/create-server.ts](src/create-server.ts) and [src/db/opinion-storage.ts](src/db/opinion-storage.ts)

### track-subscriptions

Initiates the subscription tracking workflow for the authenticated user.

**Arguments**: None

**Authentication**: Required (OAuth via Clerk)

**Returns**:
- Signed download URL for user's transaction data (10-minute expiry)
- Static download URL for analysis script (no expiry)
- curl commands for downloading files
- Complete analysis prompt from [src/prompts/analyze-subscriptions.txt](src/prompts/analyze-subscriptions.txt)
- Instructions for running analysis locally

**Response Format**:
```
STEP 1: Download your transaction data (expires in 10 minutes)
curl "https://personal-finance-mcp.vercel.app/api/data/transactions?token=<jwt>" -o transactions.csv

STEP 2: Download analysis script
curl "https://personal-finance-mcp.vercel.app/analyze-subscriptions.js" -o analyze-subscriptions.js

STEP 3: Run analysis
node analyze-subscriptions.js transactions.csv
```

**Implementation**: See [src/tools/track-subscriptions.ts](src/tools/track-subscriptions.ts)

## Testing

### Automated Tests

The project includes automated tests for analysis tools:

```bash
# Run all tests
npm test

# Run analysis tests specifically
npm run test:analysis
```

**Test Coverage:**
- Subscription detection algorithm
- CSV parsing and validation
- Monthly recurring pattern identification
- Cost calculations and projections

See [test/README.md](test/README.md) for details on test data and adding new test cases.

### Testing Production

**Note**: All MCP endpoints now require authentication. Use Claude Desktop or MCP Inspector to test authenticated requests.

Test OAuth metadata endpoints (public, no auth required):

```bash
# Test OAuth protected resource metadata
curl https://personal-finance-mcp.vercel.app/.well-known/oauth-protected-resource/mcp

# Test OAuth authorization server metadata
curl https://personal-finance-mcp.vercel.app/.well-known/oauth-authorization-server

# Test unauthenticated request (should return 401)
curl -v -X POST https://personal-finance-mcp.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Expected: 401 Unauthorized with WWW-Authenticate header
```

### Testing Locally

Replace production URL with `http://localhost:3000/mcp` in the above commands.

### Testing with Claude Desktop

The recommended way to test the authenticated MCP server:

1. **Open Claude Desktop** → Settings → Connectors → Add Remote Server
2. **Enter URL**: `http://localhost:3000/mcp` or `https://personal-finance-mcp.vercel.app/mcp`
3. **OAuth Flow**: Claude will automatically handle authentication:
   - Opens browser to Clerk login page
   - User authenticates
   - Claude receives and stores access token
4. **Test Tools**: Ask Claude to "track my subscriptions" or use other tools

### Testing with MCP Inspector

Use the official [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):
- Connect to `http://localhost:3000/mcp` (local) or `https://personal-finance-mcp.vercel.app/mcp` (production)
- Ensure the `/mcp` path is included in the URL
- MCP Inspector should handle OAuth flow automatically
- The inspector provides a GUI for testing tools and resources

### Common Issues

1. **Port 3000 in use**: Kill the process or change PORT in .env
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **401 Unauthorized**: Missing or invalid authentication
   - Ensure Clerk environment variables are set correctly
   - Test OAuth metadata endpoints to verify Clerk integration
   - Use Claude Desktop or MCP Inspector to test authenticated flows

3. **"Not Acceptable" error**: Missing Accept header
   - Client must accept both `application/json` and `text/event-stream`

4. **Build errors**: Run `npm run build` manually to see TypeScript errors

5. **"Invalid URL" when reading resources**:
   - Resources must use custom URI schemes like `pfinance://`
   - Do not use `http://` or `https://` for MCP resource URIs
   - HTTP URLs will fail with MCP clients

6. **OAuth flow not starting**: Check Dynamic Client Registration
   - In Clerk Dashboard → OAuth Applications
   - Ensure "Dynamic Client Registration" is enabled
   - This allows MCP clients to auto-register

## Adding New Tools

To add a new personal finance tool:

1. Open [src/create-server.ts](src/create-server.ts)
2. Add a new `server.tool()` call with:
   - Tool name (kebab-case)
   - Description
   - Input schema (using Zod)
   - Implementation function that accepts `authInfo`
3. Access authenticated user context:
   ```typescript
   server.tool(
     "my-tool",
     "Tool description",
     { /* Zod schema */ },
     async (args, { authInfo }) => {
       const userId = authInfo?.extra?.userId as string;

       // Use userId for user-specific operations

       return {
         content: [
           {
             type: "text",
             text: "Your response here"
           }
         ]
       };
     }
   );
   ```

## Adding New Data Downloads (Signed URL Pattern)

**Note**: MCP resources have been removed in favor of signed download URLs. See "Signed URL Pattern" section above for implementation details.

To add a new user data download endpoint:

1. **Create API endpoint** in [src/index.ts](src/index.ts):
   ```typescript
   app.get("/api/data/your-resource", (req: Request, res: Response) => {
     const payload = verifySignedToken(req.query.token as string);

     if (!payload || payload.resource !== "your-resource") {
       return res.status(401).json({ error: "Invalid or expired token" });
     }

     const userId = payload.userId; // Use for user-specific queries

     // Set appropriate headers
     res.setHeader("Content-Type", "text/csv");
     res.setHeader("Content-Disposition", "attachment; filename=your-file.csv");

     // Stream file or database query results
     const fileStream = fs.createReadStream(filePath);
     fileStream.pipe(res);
   });
   ```

2. **Update tool** to generate signed URL:
   ```typescript
   import { generateSignedUrl } from "../utils/signed-urls.js";

   const downloadUrl = generateSignedUrl(baseUrl, userId, "your-resource", 600);
   ```

3. **Return curl command** in tool response:
   ```typescript
   text: `curl "${downloadUrl}" -o your-file.csv`
   ```

## Authentication Setup

### Clerk Configuration

1. **Create Clerk Account**: Sign up at [clerk.com](https://clerk.com)

2. **Create Application**: Create a new application in Clerk Dashboard

3. **Enable Dynamic Client Registration**:
   - Go to **User Authentication** → **OAuth Applications**
   - Toggle on **Dynamic Client Registration**
   - This allows MCP clients like Claude Desktop to auto-register

4. **Get API Keys**:
   - Go to **API Keys** in Clerk Dashboard
   - Copy `CLERK_PUBLISHABLE_KEY` (starts with `pk_`)
   - Copy `CLERK_SECRET_KEY` (starts with `sk_`)

5. **Add to Environment**:
   ```bash
   # .env
   CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
   CLERK_SECRET_KEY=sk_test_xxxxx
   ```

### User Authentication Flow

When a user connects to the MCP server:

1. **MCP Client (e.g., Claude Desktop)** attempts to call `/mcp` endpoint
2. **Server returns 401** with `WWW-Authenticate` header pointing to OAuth metadata
3. **Client discovers OAuth server** by fetching `/.well-known/oauth-protected-resource/mcp`
4. **Client auto-registers** with Clerk via Dynamic Client Registration
5. **Browser opens** to Clerk login page
6. **User authenticates** with email/password (or social login if enabled)
7. **Clerk redirects** back to client with authorization code
8. **Client exchanges code** for access token
9. **All future requests** include `Authorization: Bearer <token>` header
10. **Server validates token** and extracts `userId` for user-specific data

### Accessing User Context in Tools

All tool handlers receive authenticated user information:

```typescript
server.tool(
  "tool-name",
  "description",
  { /* args */ },
  async (args, { authInfo }) => {
    const userId = authInfo?.extra?.userId as string;
    console.log("Tool called by user:", userId);

    // Use userId to fetch user-specific data
    // from database in the future

    return { /* response */ };
  }
);
```

The `userId` from Clerk can be used to:
- Query user-specific financial data from database
- Associate uploaded transactions with user accounts
- Implement Row Level Security (RLS) in database queries

## Environment Variables

### Required

- `CLERK_PUBLISHABLE_KEY` - Clerk public key (from Clerk Dashboard)
- `CLERK_SECRET_KEY` - Clerk secret key (from Clerk Dashboard)
- `JWT_SECRET` - Secret for signing download URLs
  - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - Must be 64-character hex string for security
  - Used to sign time-limited download URLs
- `PLAID_CLIENT_ID` - Plaid client ID (from Plaid Dashboard)
- `PLAID_SECRET` - Plaid secret key (from Plaid Dashboard)
- `PLAID_ENV` - Plaid environment (`sandbox`, `development`, or `production`)

### Optional

- `PORT` - Server port (default: 3000)
- `BASE_URL` - Base URL for generating download links
  - Local: `http://localhost:3000`
  - Production: `https://personal-finance-mcp.vercel.app`

All variables are loaded via `dotenv` in [src/index.ts](src/index.ts)

**Security Note**: Never commit `.env` file. Use `.env.example` as template.

### Getting Plaid Credentials

1. Sign up at [Plaid Dashboard](https://dashboard.plaid.com/signup)
2. Go to **Team Settings** → **Keys**
3. Copy your **client_id**
4. Copy your **Sandbox secret** (starts with `sandbox-...`)
5. For production, request access to Development or Production environment

**Sandbox Mode:**
- No real bank connections
- Free to use
- Test credentials: `user_good` / `pass_good`
- Provides fake transaction data for testing

## Deployment to Vercel

### Setup

1. **Create GitHub repository** and push code:
   ```bash
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel auto-detects settings from `vercel.json` and `package.json`
   - **Add Environment Variables**:
     - `CLERK_PUBLISHABLE_KEY` - From Clerk Dashboard
     - `CLERK_SECRET_KEY` - From Clerk Dashboard
     - `JWT_SECRET` - Generate with crypto command
     - `BASE_URL` - Set to `https://personal-finance-mcp.vercel.app`
     - `PLAID_CLIENT_ID` - From Plaid Dashboard
     - `PLAID_SECRET` - From Plaid Dashboard (sandbox or production)
     - `PLAID_ENV` - Set to `sandbox` for testing, `production` for live
   - Click "Deploy"

3. **Auto-deployment**:
   - Every push to `main` triggers automatic deployment
   - Build command: `npm run build` (from package.json `prepare` script)
   - Vercel routes all requests to `build/index.js` via `vercel.json` rewrites

### Vercel Configuration

The `vercel.json` file uses simple rewrites to route all traffic to the Express app:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/build/index.js"
    }
  ]
}
```

This works because:
- Express handles routing internally (`/mcp`, `/transactions.csv`, etc.)
- Stateless serverless function (no sessions)
- Public files served via Express static middleware

### Production URL

- **MCP Endpoint**: https://personal-finance-mcp.vercel.app/mcp
- **Repository**: https://github.com/captaincole/Personal-Finance-MCP

### Deployment Notes

- Stateless transport (no session management) for serverless compatibility
- Build artifacts in `build/` directory are gitignored
- `public/` and `src/prompts/` included in deployment via `package.json` files array
- Package manager: npm (not pnpm)

## Plaid Integration Architecture

### Connection Flow

The Plaid integration uses an automated redirect-based flow to eliminate manual token handling:

1. **Link Token Generation** (`connect-financial-institution` tool)
   - Creates unique session ID
   - Stores pending connection in memory (expires in 30 min)
   - Calls Plaid `linkTokenCreate()` API
   - Returns branded URL: `{baseUrl}/plaid/link?token={linkToken}&session={sessionId}`

2. **Plaid Link UI** (`GET /plaid/link`)
   - Serves HTML page with Plaid JavaScript SDK
   - Automatically opens Plaid Link modal on page load
   - User selects bank and authenticates
   - On success: JavaScript sends `public_token` to callback endpoint

3. **Token Exchange** (`POST /plaid/callback`)
   - Receives `public_token` and `session` from client JavaScript
   - Verifies session is valid and pending
   - Calls Plaid `itemPublicTokenExchange()` to get permanent `access_token`
   - Fetches account details via `accountsGet()`
   - Stores connection in `userPlaidTokens` Map (keyed by `userId`)
   - Returns success with account list

4. **Transaction Retrieval** (`get-plaid-transactions` tool)
   - Looks up user's `access_token` in storage
   - Calls Plaid `transactionsGet()` with date range
   - Converts transactions to CSV format
   - Generates signed download URL
   - Returns curl command to AI

### Storage Architecture (MVP)

**In-Memory Maps** (replaced by database in production):

```typescript
// Temporary session tracking (30 min expiry)
pendingConnections: Map<sessionId, {
  userId: string,
  status: 'pending' | 'completed' | 'failed',
  createdAt: Date
}>

// Permanent Plaid connections (until server restart)
userPlaidTokens: Map<userId, {
  accessToken: string,  // Encrypted in production
  itemId: string,
  connectedAt: Date,
  accounts: Array<{...}>
}>

// Temporary transaction data (deleted after download)
userTransactionData: Map<userId, csvContent>
```

**Production Migration:**
- Move to PostgreSQL/Supabase
- Encrypt `access_token` at rest
- Add Row Level Security (RLS) by `userId`
- Implement token refresh logic
- Add webhook handling for Plaid events

### Plaid Endpoints

**New Express Routes:**

1. `GET /plaid/link` - Serves branded Plaid Link UI page
2. `POST /plaid/callback` - Handles automatic token exchange
3. `GET /api/data/transactions` - Downloads transaction CSV (updated to support Plaid data)

**New MCP Tools:**

1. `connect-financial-institution` - Initiates Plaid Link flow
2. `check-connection-status` - Verifies connection and shows accounts
3. `get-plaid-transactions` - Fetches real transaction data

### Security Considerations

**Plaid Access Tokens:**
- Stored in-memory (MVP) - **DO NOT use in production**
- Must be encrypted at rest in database
- Should implement token rotation
- Add item webhook to handle token revocation

**Session Management:**
- Session IDs are UUIDs (cryptographically random)
- Expire after 30 minutes
- Single-use (marked as completed after exchange)
- Automatically cleaned up by interval timer

**Data Privacy:**
- Transaction data temporarily stored for download
- Deleted immediately after user downloads CSV
- User isolation enforced via `userId` from Clerk OAuth

### Testing Plaid Integration

**Local Testing:**

```bash
# 1. Get Plaid sandbox credentials from dashboard.plaid.com
# 2. Add to .env file
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox

# 3. Start server
npm run dev

# 4. Use Claude Desktop to test:
# - "Connect my bank account"
# - Click the link
# - Use credentials: user_good / pass_good
# - Return to Claude: "Check my connection status"
# - "Get my recent transactions"
```

**Sandbox Credentials:**
- Username: `user_good`
- Password: `pass_good`
- 2FA Code (if prompted): `1234`
- Bank: Select "First Platypus Bank" or any test institution

**Expected Sandbox Data:**
- 3 accounts: Checking, Savings, Credit Card
- ~100 transactions spanning 90 days
- Includes recurring transactions for subscription testing

### Future Enhancements

**Planned Features:**
1. Database storage for Plaid tokens (encrypted)
2. Webhook handling for real-time updates
3. Support for multiple bank connections per user
4. Token refresh and re-authentication flow
5. Transaction categorization improvements
6. Budget tracking based on Plaid data
7. Investment account support (Plaid Investments API)
