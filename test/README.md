# Test Suite

Integration tests for the Personal Finance MCP Server.

## Running Tests

```bash
# Run all integration tests
npm test

# Run specific test suite
npm run test:integration

# Run specific test file
npx tsx --test test/integration/oauth-discovery.test.ts
npx tsx --test test/integration/plaid-tools.test.ts
```

## Test Files

### Integration Tests

- **[oauth-discovery.test.ts](integration/oauth-discovery.test.ts)** - OAuth discovery protocol endpoints
- **[plaid-tools.test.ts](integration/plaid-tools.test.ts)** - Plaid tool handlers with mocked dependencies
- **[mcp-widget-metadata.test.ts](integration/mcp-widget-metadata.test.ts)** - MCP widget protocol (OpenAI extensions)
- **[mcp-widget-protocol.test.ts](integration/mcp-widget-protocol.test.ts)** - HTTP-based widget tests (skipped, require auth)

### Mock Services

- **[plaid-mock.ts](mocks/plaid-mock.ts)** - Mock Plaid API client
- **[supabase-mock.ts](mocks/supabase-mock.ts)** - Mock Supabase database client
- **[clerk-mock.ts](mocks/clerk-mock.ts)** - Mock Clerk authentication (for future use)

## Test Coverage

### OAuth Discovery Protocol
- OAuth protected resource metadata endpoints
- OpenID Connect configuration
- Unauthenticated request handling (401 responses)
- CORS preflight requests

### Plaid Tools
- Financial institution connection flow
- Connection status checking
- Tool handlers work correctly with mocked dependencies

### MCP Widget Protocol (OpenAI Extensions)
- **tools/list** response includes correct `_meta` fields for widget-enabled tools
- **resources/list** includes widget resource definition
- **resources/read** returns widget HTML with external script references
- Widget metadata includes:
  - `openai/outputTemplate` - URI pointing to widget resource
  - `openai/widgetAccessible` - Widget accessibility flag
  - `openai/resultCanProduceWidget` - Tool capability flag
  - `openai/toolInvocation/invoking` and `invoked` - Loading state messages
  - `openai/widgetDescription` - Human-readable widget description
  - `openai/widgetCSP` - Content Security Policy settings

## Adding New Integration Tests

1. Create a new test file in `test/integration/`:
   ```typescript
   import { describe, it, before, after } from "node:test";
   import assert from "node:assert";

   describe("Your Test Suite", () => {
     it("should test something", async () => {
       // Your test code
       assert(true);
     });
   });
   ```

2. Run the test:
   ```bash
   npx tsx --test test/integration/your-test.test.ts
   ```

3. Add mocks as needed in `test/mocks/`
