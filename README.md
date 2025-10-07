# Personal Finance MCP Server

Model Context Protocol (MCP) server built with Express.js that provides personal finance tools and data.

## ⚠️ Important Notes

### ChatGPT Integration (Blocked - Known Bug)

**Status:** ChatGPT has a known bug preventing custom MCP tools from appearing in chat.

- **Issue:** Tools are registered and returned correctly by the server, but ChatGPT doesn't display them
- **Cause:** Known ChatGPT MCP implementation bug (not our server)
- **Tracking:** https://community.openai.com/t/custom-mcp-connector-no-longer-showing-all-tools-as-enabled/1361121
- **Workaround:** Server works perfectly with Claude Desktop and MCP Inspector
- **Status:** Waiting for OpenAI fix (no timeline provided)

See [CLAUDE.md](CLAUDE.md) for detailed technical information and verification logs.

### Chase Bank Production Access
If using Plaid production environment to access Chase bank accounts, note that **OAuth institution access can take up to 8 weeks** for approval. Check your application status at: http://dashboard.plaid.com/activity/status/oauth-institutions

## Getting Started

### Clone and run locally

```bash
git clone https://github.com/yourusername/personal-finance-mcp
npm install
npm run dev
```

## Features

This MCP server provides personal finance tools (currently based on weather template - to be customized):

- **get-alerts**: Get weather alerts for a US state (requires 2-letter state code)
- **get-forecast**: Get weather forecast for a location (requires latitude/longitude)

_Note: These are template tools and will be replaced with personal finance functionality._

## Testing

You can connect to the server using [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) or any other MCP client.
Be sure to include the `/mcp` path in the connection URL (e.g., `http://localhost:3000/mcp`).

## API Endpoints

- `POST /mcp`: Handles incoming messages for the MCP protocol

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run test suite for analysis tools
