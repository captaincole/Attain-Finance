# CLAUDE.md

This file provides guidance to Claude Code when working with the Personal Finance MCP Server.

## Project Overview

This is a Model Context Protocol (MCP) server built with Express.js and TypeScript that provides personal finance tools and data through the MCP protocol. The server uses Streamable HTTP Transport to communicate with MCP clients.

## Architecture

### Core Components

1. **[src/index.ts](src/index.ts)** - Express server entry point
   - Sets up Express middleware (CORS, JSON parsing, static files)
   - Configures StreamableHTTPServerTransport for MCP protocol
   - Handles `/mcp` POST endpoint for MCP requests
   - Manages server lifecycle and graceful shutdown

2. **[src/create-server.ts](src/create-server.ts)** - MCP server and tool definitions
   - Creates McpServer instance with name and version
   - Registers MCP tools using `server.tool()` method
   - Contains tool implementations and business logic
   - Currently has weather template tools (to be replaced with finance tools)

3. **[public/](public/)** - Static assets served by Express

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
│   ├── index.ts           # Express server setup
│   └── create-server.ts   # MCP tools and logic
├── build/                 # Compiled JavaScript (gitignored)
├── public/                # Static assets
├── package.json
├── tsconfig.json
└── CLAUDE.md             # This file
```

## Testing

### Manual Testing with cURL

Test the MCP endpoint directly:

```bash
# List available tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Call a specific tool (example with get-alerts)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get-alerts","arguments":{"state":"CA"}}}'
```

### Testing with MCP Inspector

Use the official [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):
- Connect to `http://localhost:3000/mcp`
- Ensure the `/mcp` path is included in the URL
- The inspector provides a GUI for testing tools

### Common Issues

1. **Port 3000 in use**: Kill the process or change PORT in .env
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **"Not Acceptable" error**: Missing Accept header
   - Client must accept both `application/json` and `text/event-stream`

3. **Build errors**: Run `npm run build` manually to see TypeScript errors

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

## Environment Variables

- `PORT` - Server port (default: 3000)
- Add additional variables in `.env` file (create if needed)
- Variables are loaded via `dotenv` in [src/index.ts](src/index.ts:9)

## Deployment Notes

- The project was originally designed for Vercel deployment
- Stateless transport (no session management) for serverless compatibility
- Build artifacts in `build/` directory are gitignored
- Package manager: npm (not pnpm)
