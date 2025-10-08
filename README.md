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
