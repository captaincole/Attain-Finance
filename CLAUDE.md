# CLAUDE.md

This file provides guidance to Claude Code when working with the Personal Finance MCP Server.

## Project Overview

This is a Model Context Protocol (MCP) server built with Express.js and TypeScript that provides personal finance tools and data through the MCP protocol. The server uses Streamable HTTP Transport to communicate with MCP clients.

**Production URL**: https://personal-finance-mcp.vercel.app/mcp

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
- **Validation**: Zod 3.24.2
- **Dev Tools**: Nodemon, Concurrently, TSC watch mode

### MCP Protocol

The server implements the Model Context Protocol over HTTP:
- **Endpoint**: `POST /mcp`
- **Transport**: StreamableHTTPServerTransport (stateless, no session IDs)
- **Content Types**: Requires `Accept: application/json, text/event-stream`
- **Response Format**: Server-Sent Events (SSE) with JSON-RPC 2.0

## Development Workflow

### Setup

```bash
npm install              # Install dependencies
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

Test the deployed MCP server:

```bash
# List available tools
curl -X POST https://personal-finance-mcp.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# List available resources
curl -X POST https://personal-finance-mcp.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}'

# Read a resource
curl -X POST https://personal-finance-mcp.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"pfinance://data/transactions.csv"}}'

# Call track-subscriptions tool
curl -X POST https://personal-finance-mcp.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"track-subscriptions","arguments":{}}}'
```

### Testing Locally

Replace production URL with `http://localhost:3000/mcp` in the above commands.

### Testing with MCP Inspector

Use the official [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):
- Connect to `http://localhost:3000/mcp` (local) or `https://personal-finance-mcp.vercel.app/mcp` (production)
- Ensure the `/mcp` path is included in the URL
- The inspector provides a GUI for testing tools and resources

### Common Issues

1. **Port 3000 in use**: Kill the process or change PORT in .env
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **"Not Acceptable" error**: Missing Accept header
   - Client must accept both `application/json` and `text/event-stream`

3. **Build errors**: Run `npm run build` manually to see TypeScript errors

4. **"Invalid URL" when reading resources**:
   - Resources must use custom URI schemes like `pfinance://`
   - Do not use `http://` or `https://` for MCP resource URIs
   - HTTP URLs will fail with MCP clients

## Adding New Tools

To add a new personal finance tool:

1. Open [src/create-server.ts](src/create-server.ts)
2. Add a new `server.tool()` call with:
   - Tool name (kebab-case)
   - Description
   - Input schema (using Zod)
   - Implementation function
3. Return MCP response format:
   ```typescript
   return {
     content: [
       {
         type: "text",
         text: "Your response here"
       }
     ]
   };
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

## Environment Variables

- `PORT` - Server port (default: 3000)
- Add additional variables in `.env` file (create if needed)
- Variables are loaded via `dotenv` in [src/index.ts](src/index.ts:9)

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
