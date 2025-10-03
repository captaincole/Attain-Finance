# CLAUDE.md

This file provides guidance to Claude Code when working with the Personal Finance MCP Server.

## Project Overview

This is a Model Context Protocol (MCP) server built with Express.js and TypeScript that provides personal finance tools and data through the MCP protocol. The server uses Streamable HTTP Transport with **Clerk OAuth authentication** to secure user data.

**Production URL**: https://personal-finance-mcp.vercel.app/mcp

**Authentication**: All MCP endpoints require OAuth authentication via Clerk. Unauthenticated requests return `401 Unauthorized`.

## MVP: Subscription Tracking Test

The current implementation demonstrates the **Tool → Resource → AI Analysis** pattern for detecting recurring subscriptions in credit card transactions.

### How It Works

1. **User calls tool**: `track-subscriptions` (no arguments required)
2. **Tool returns**:
   - Instructions for the AI on how to analyze subscriptions
   - MCP Resource URIs for data and scripts
   - Analysis criteria and expected output format
3. **AI fetches resources**:
   - Reads `pfinance://data/transactions.csv` via MCP
   - Reads `pfinance://scripts/analyze-subscriptions.js` via MCP
4. **AI analyzes data**:
   - Option A: Saves and runs the JavaScript analysis script
   - Option B: Manually analyzes the CSV data
5. **AI presents results**: Human-readable subscription summary with costs and patterns

### Key Pattern: Tool + Resource Workflow

The core differentiation between our service and others is that we provide the code for a users AI to do the analysis. THIS IS IMPORTANT because it enables the user to start from a working system and customize it however they want. 

This pattern allows tools to dynamically provide data and analysis scripts to the AI:
- **Tools** introduce resources and provide instructions
- **Resources** deliver actual file contents (CSV, scripts, etc.)
- **AI** processes the data using the provided guidance
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
│   ├── index.ts              # Express server setup
│   ├── create-server.ts      # MCP tools, resources, and logic
│   └── prompts/
│       └── analyze-subscriptions.txt  # AI analysis instructions
├── public/
│   ├── transactions.csv      # Sample transaction data
│   └── analyze-subscriptions.js       # Analysis script
├── build/                    # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
├── vercel.json              # Vercel deployment config
└── CLAUDE.md               # This file
```

## MCP Resources

### Registered Resources

Resources are registered with custom URI scheme `pfinance://`:

1. **transactions-csv** (`pfinance://data/transactions.csv`)
   - Returns complete CSV file contents
   - 100 rows of credit card transactions
   - 3 recurring subscriptions: Netflix ($15.99), Spotify ($10.99), AWS ($23.50)

2. **analysis-script** (`pfinance://scripts/analyze-subscriptions.js`)
   - Returns complete JavaScript file contents
   - ES module format (uses `import` syntax)
   - Detects subscriptions by grouping merchants, checking amounts, and validating monthly patterns

**Important**: Resources must use custom URI schemes (like `pfinance://`) not `http://` URLs. MCP clients cannot read resources with `http://` URIs.

## MCP Tools

### track-subscriptions

Initiates the subscription tracking workflow. No arguments required.

**Returns**:
- MCP resource URIs for data and analysis script
- Complete analysis prompt from [src/prompts/analyze-subscriptions.txt](src/prompts/analyze-subscriptions.txt)
- Instructions for AI to fetch resources, save files, and run analysis

**Example Call**:
```bash
curl -X POST https://personal-finance-mcp.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"track-subscriptions","arguments":{}}}'
```

## Testing

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

## Adding New Resources

To add a new MCP resource:

1. Open [src/create-server.ts](src/create-server.ts)
2. Add a new `server.resource()` call with:
   - Resource name (kebab-case)
   - URI using custom scheme (e.g., `pfinance://category/filename`)
   - Metadata (name, description, mimeType)
   - Handler function that returns file contents
3. Return MCP resource format:
   ```typescript
   return {
     contents: [
       {
         uri: "pfinance://category/filename",
         mimeType: "text/csv", // or application/javascript, etc.
         text: fileContent
       }
     ]
   };
   ```

**Important**: Never use `http://` or `https://` URLs as resource URIs - use custom schemes only.

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

### Optional

- `PORT` - Server port (default: 3000)

All variables are loaded via `dotenv` in [src/index.ts](src/index.ts)

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
     - `CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`
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
