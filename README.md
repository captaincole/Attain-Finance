# Personal Finance MCP Server

Model Context Protocol (MCP) server built with Express.js that provides personal finance tools and data.

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
