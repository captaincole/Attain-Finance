# Personal Finance MCP Server

Model Context Protocol (MCP) server built with Express.js that provides personal finance tools and data.

## ⚠️ Important Notes

### ChatGPT Integration

**Status:** ✅ Working with interactive widgets!

This server now fully supports ChatGPT with:
- All MCP tools accessible in chat
- Interactive widget UI for visualizing data
- OAuth authentication via Clerk
- Live updates when tool data changes

See **ChatGPT Widgets** section below for details on the interactive UI components.

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

This MCP server provides AI-powered personal finance tools with OAuth authentication:

### 1. Plaid Bank Connection
- **connect-financial-institution**: Initiate secure bank connection via Plaid Link
- **check-connection-status**: View connected accounts and balances
- **get-plaid-transactions**: Fetch real transaction data with AI categorization
- **disconnect-financial-institution**: Remove bank connection

### 2. AI-Powered Transaction Categorization

**User Experience:**
1. User requests spending data → System fetches from Plaid and categorizes via Claude API
2. User receives CSV with custom categories
3. User customizes: "Put Amazon Prime in Business category"
4. System updates categorization rules and auto-recategorizes
5. User gets updated data instantly

**Tools:**
- **update-categorization-rules**: Customize category assignments with natural language

**Features:**
- Parallel batch processing for speed (50 transactions/batch)
- User-specific rules stored in database
- 12 default categories: Housing, Transportation, Food & Dining, Shopping, Entertainment, Healthcare, Personal Care, Travel, Business, Income, Transfer, Other
- No transaction data caching (privacy-first)

### 3. Customizable Data Visualizations

**User Experience:**
1. User downloads default visualization script
2. User requests customization: "Show top 15 categories" or "Change bar color to blue"
3. System uses Claude API to modify bash script
4. User gets personalized visualization
5. User can reset to default anytime

**Tools:**
- **visualize-spending**: Download visualization script (default or custom)
- **update-visualization**: Customize script with natural language
- **reset-visualization**: Return to default

**Features:**
- Per-user script storage
- Natural language customization
- Terminal bar charts with configurable colors, TOP_N, filtering
- Excludes Income/Transfer/Payment by default

### 4. Subscription Tracking
- **track-subscriptions**: Analyze recurring charges and subscriptions

**Pattern:** Tool → Signed Download URL → AI Analysis with executable scripts users can customize

### 5. ChatGPT Widgets

Interactive UI components that render inside ChatGPT when tools are called.

**Current Widgets:**
- **Connected Institutions Widget**: Shows connected bank accounts with balances in a compact table format

**How it works:**
1. User calls `check-connection-status` tool
2. Server returns data via `structuredContent` field
3. ChatGPT fetches widget HTML template from server
4. ChatGPT renders interactive UI with live data
5. Widget updates reactively when data changes

**See [CLAUDE.md](CLAUDE.md#chatgpt-widget-development)** for complete widget development guide including:
- Project structure and build process
- Creating new widgets with React and TypeScript
- Handling tool data with `window.openai.toolOutput`
- CSP configuration and deployment
- Complete working examples

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
