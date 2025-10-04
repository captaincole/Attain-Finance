# CLAUDE.md

This file provides guidance to Claude Code when working with the Personal Finance MCP Server.

## Project Overview

This is a Model Context Protocol (MCP) server built with Express.js and TypeScript that provides personal finance tools and data through the MCP protocol. The server uses Streamable HTTP Transport with **Clerk OAuth authentication** to secure user data.

**Production URL**: https://personal-finance-mcp.vercel.app/mcp

**Authentication**: All MCP endpoints require OAuth authentication via Clerk. Unauthenticated requests return `401 Unauthorized`.

## MVP: Subscription Tracking Test

The current implementation demonstrates the **Tool → Signed Download URL → AI Analysis** pattern for detecting recurring subscriptions in credit card transactions.

### How It Works

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

### Optional

- `PORT` - Server port (default: 3000)
- `BASE_URL` - Base URL for generating download links
  - Local: `http://localhost:3000`
  - Production: `https://personal-finance-mcp.vercel.app`

All variables are loaded via `dotenv` in [src/index.ts](src/index.ts)

**Security Note**: Never commit `.env` file. Use `.env.example` as template.

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
