# ChatGPT Widget Debug Notes

## Issue Summary

ChatGPT is not calling `resources/list` during MCP initialization, preventing widgets from being discovered and rendered.

**Status:** Under investigation (as of 2025-10-09)

## Symptoms

1. ✅ Server advertises `resources` capability in `initialize` response
2. ✅ Widget resource registered: `ui://widget/connected-institutions.html`
3. ✅ Tool returns `_meta["openai/outputTemplate"]` correctly
4. ✅ Widget files built and deployed to `public/widgets/`
5. ❌ **ChatGPT never calls `resources/list`** during initialization
6. ❌ **ChatGPT never calls `resources/read`** after tool response

## MCP Resource Fetching Flows

### Flow A: Pre-fetch (Traditional MCP)
```
1. initialize
2. resources/list     → Get all available resources
3. resources/read     → Pre-fetch and cache widgets
4. tools/call         → Tool returns _meta with widget URI
5. Render cached widget
```

### Flow B: On-demand (Optimized - ChatGPT may use this)
```
1. initialize
2. tools/list         → Skip resources/list (optimization)
3. tools/call         → Tool returns _meta with widget URI
4. resources/read     → Fetch widget only when needed
5. Render widget
```

### Actual ChatGPT Behavior
```
1. initialize         → Server responds with capabilities ✅
2. notifications/initialized → Client confirms ready ✅
3. tools/list         → Get available tools ✅
4. tools/call("check-connection-status") → Returns _meta["openai/outputTemplate"] ✅
5. ❌ DOES NOT call resources/read for the widget URI
```

**Key Insight:** ChatGPT skipping `resources/list` might be expected (Flow B optimization), but it **must** call `resources/read` when it encounters an unknown widget URI in the tool response.

## Server Initialize Response

```json
{
  "protocolVersion": "2025-06-18",
  "capabilities": {
    "resources": {
      "listChanged": true
    },
    "completions": {},
    "tools": {
      "listChanged": true
    }
  },
  "serverInfo": {
    "name": "personal-finance",
    "version": "1.0.0"
  }
}
```

**Note:** Server correctly advertises `resources` capability.

## Tool Response (Working Correctly)

```json
{
  "result": {
    "content": [...],
    "structuredContent": {
      "institutions": [...],
      "totalAccounts": 3
    },
    "_meta": {
      "openai/outputTemplate": "ui://widget/connected-institutions.html"
    }
  }
}
```

**Note:** `_meta["openai/outputTemplate"]` is correctly returned.

## Possible Causes

### 1. ChatGPT MCP Implementation Bug
- **Likelihood:** HIGH
- **Evidence:**
  - Recent ChatGPT MCP issues reported in OpenAI Community
  - ChatGPT ignoring advertised capabilities
  - Same server works with other MCP clients (MCP Inspector)
- **Related:** https://community.openai.com/t/custom-mcp-connector-no-longer-showing-all-tools-as-enabled/1361121

### 2. Protocol Version Mismatch
- **Likelihood:** MEDIUM
- **Evidence:**
  - ChatGPT requests `2025-06-18`
  - Server responds with `2025-06-18`
  - Should be compatible, but worth investigating
- **Action:** Check if older protocol versions handle resources differently

### 3. Missing Capability Flag
- **Likelihood:** LOW
- **Evidence:**
  - Server advertises `resources.listChanged: true`
  - This matches MCP spec requirements
  - Other clients recognize this correctly
- **Action:** Check if ChatGPT expects additional flags

### 4. Resource Registration Timing
- **Likelihood:** LOW
- **Evidence:**
  - Resource registered before server initialization completes
  - SDK should handle this automatically
- **Action:** Verify registration happens before first client connection

### 5. OAuth/Authentication Interference
- **Likelihood:** LOW
- **Evidence:**
  - All other methods work with same auth
  - `tools/list` called successfully with same token
- **Action:** Check if `resources/list` requires different permissions

### 6. ChatGPT Feature Flag / Rollout
- **Likelihood:** MEDIUM
- **Evidence:**
  - Widgets are new feature (Apps SDK)
  - May not be enabled for all users/accounts
  - Could be gradual rollout
- **Action:** Check ChatGPT account type, settings, feature availability

## Investigation Steps

### Step 1: Verify with MCP Inspector
Test the same server with MCP Inspector to confirm resources work correctly.

**Expected:** MCP Inspector should call `resources/list` and successfully fetch the widget.

### Step 2: Check Protocol Version Compatibility
Review MCP spec for protocol version `2025-06-18` to see if there are any changes to how resources should be advertised or requested.

### Step 3: Test with Different Capability Configurations
Try different capability response formats to see if ChatGPT responds:

```typescript
// Option 1: Current
"resources": { "listChanged": true }

// Option 2: Minimal
"resources": {}

// Option 3: Subscribe
"resources": { "subscribe": true }
```

### Step 4: Monitor OpenAI Communications
- Watch for announcements about MCP fixes
- Check if Apps SDK documentation updates
- Monitor community forums for similar issues

### Step 5: Test Account/Plan Requirements
- Verify ChatGPT account type (Free/Plus/Team/Enterprise)
- Check if widgets require specific plan level
- Test with different ChatGPT accounts if possible

## Workarounds

None currently available. Widget rendering requires ChatGPT to call `resources/read`, which requires `resources/list` to be called first.

## Related Files

- [src/create-server.ts](../src/create-server.ts) - Widget resource registration (line 55)
- [src/tools/plaid-connection.ts](../src/tools/plaid-connection.ts) - Tool response with `_meta` (line 221)
- [src/widgets/chatgpt/](../src/widgets/chatgpt/) - React widget source
- [public/widgets/](../public/widgets/) - Built widget assets

## Next Steps

1. Test with MCP Inspector
2. Research protocol version differences
3. Monitor OpenAI communications
4. Document findings here

## References

- MCP Specification: https://spec.modelcontextprotocol.io
- Apps SDK Docs: (Internal - see docs/MCP_WIDGETS_SETUP.md)
- OpenAI Community Issue: https://community.openai.com/t/custom-mcp-connector-no-longer-showing-all-tools-as-enabled/1361121

## FINDINGS: Differences from OpenAI's Working Example

Compared against: https://github.com/openai/openai-apps-sdk-examples/tree/main/pizzaz_server_node

### Critical Difference #1: Resource Registration Pattern

**OpenAI Example (Working):**
```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [...]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const widget = widgetsByUri.get(request.params.uri);
  return {
    contents: [{ uri, mimeType: "text/html+skybridge", text: widget.html, _meta }]
  };
});
```

**Our Implementation:**
```typescript
server.resource("connected-institutions-widget", "ui://widget/...", {}, async () => ({
  contents: [{ uri, mimeType: "text/html+skybridge", text: html, _meta }]
}));
```

**Impact:** Using `server.resource()` might not properly register resources for ChatGPT. Need to use `setRequestHandler` pattern instead.

### Critical Difference #2: Missing _meta Fields in Tool Response

**OpenAI Example (Working):**
```typescript
{
  "openai/outputTemplate": "ui://widget/pizza-map.html",
  "openai/toolInvocation/invoking": "Hand-tossing a map",
  "openai/toolInvocation/invoked": "Served a fresh map",
  "openai/widgetAccessible": true,        // ← WE'RE MISSING THIS
  "openai/resultCanProduceWidget": true   // ← WE'RE MISSING THIS
}
```

**Our Implementation:**
```typescript
{
  "openai/outputTemplate": "ui://widget/connected-institutions.html",
  "openai/toolInvocation/invoking": "Loading...",
  "openai/toolInvocation/invoked": "Loaded"
  // Missing: openai/widgetAccessible
  // Missing: openai/resultCanProduceWidget
}
```

**Impact:** `openai/resultCanProduceWidget` might be required for ChatGPT to know this tool result should trigger a widget render.

### Difference #3: Server Class

**OpenAI:** Uses `Server` from `@modelcontextprotocol/sdk/server/index.js`  
**Ours:** Uses `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`

**Impact:** Unknown - may affect how capabilities are advertised.

## Action Items

1. **HIGH PRIORITY:** Add missing `_meta` fields to tool response:
   - `"openai/widgetAccessible": true`
   - `"openai/resultCanProduceWidget": true`

2. **MEDIUM PRIORITY:** Consider switching from `server.resource()` to `setRequestHandler(ListResourcesRequestSchema)` and `setRequestHandler(ReadResourceRequestSchema)` pattern

3. **LOW PRIORITY:** Investigate `Server` vs `McpServer` class differences

## UPDATE: Resource Templates Discovery

### Critical Finding: They Register BOTH Resources AND Resource Templates

**OpenAI Example registers THREE handlers:**

```typescript
// 1. List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: "ui://widget/pizza-map.html", name: "...", mimeType: "text/html+skybridge" }
  ]
}));

// 2. List resource TEMPLATES  ← WE DON'T HAVE THIS!
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    { uriTemplate: "ui://widget/pizza-map.html", name: "...", mimeType: "text/html+skybridge" }
  ]
}));

// 3. Read specific resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  return { contents: [{ uri, mimeType, text: html }] };
});
```

**Our Implementation:**
```typescript
// Only this:
server.resource("name", "uri", {}, async () => ({ contents: [...] }));
```

**Key Question:** What does `server.resource()` actually register? Does it register handlers for:
- ListResourcesRequestSchema? 
- ListResourceTemplatesRequestSchema?
- ReadResourceRequestSchema?

**Hypothesis:** ChatGPT might be calling `resources/listTemplates` instead of (or in addition to) `resources/list`, and we're not handling that request!

## Next Action

Check Vercel logs for ANY request with "template" in the method name during initialization.

## UPDATE 3: Still Not Working After Multiple Fixes

### Changes Made:
1. ✅ Added `openai/widgetAccessible: true` to tool response `_meta`
2. ✅ Added `openai/resultCanProduceWidget: true` to tool response `_meta`
3. ✅ Added widget metadata to resource registration (not just contents)

### Current Tool Response:
```json
{
  "_meta": {
    "openai/outputTemplate": "ui://widget/connected-institutions.html",
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true
  }
}
```

### Still Seeing:
- ❌ ChatGPT never calls `resources/list`
- ❌ ChatGPT never calls `resources/read`
- ❌ Widget not displayed

### Remaining Hypothesis: API Pattern Mismatch

**OpenAI uses low-level `setRequestHandler`:**
```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [...]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [...]
}));
```

**We use high-level `server.resource()`:**
```typescript
server.resource("name", "uri", metadata, async () => ({
  contents: [...]
}));
```

**Question:** Does `McpServer.resource()` properly register the handlers that ChatGPT expects?

### Next Test: Switch to Low-Level API

Try implementing resources using `setRequestHandler` pattern to exactly match OpenAI's working example.

## CRITICAL DISCOVERY: Embedded Resources

From MCP spec docs:
> Resources MAY be embedded to provide additional context or data using a suitable URI scheme.

**Tool responses can include embedded resources directly**, not just references to them!

Example format:
```json
{
  "content": [...],
  "structuredContent": {...},
  "_meta": {
    "openai/outputTemplate": "ui://widget/..."
  },
  // ← ADD THIS:
  "embeddedResources": [{
    "type": "resource",
    "resource": {
      "uri": "ui://widget/pizza-map.html",
      "mimeType": "text/html+skybridge",
      "text": "<div>...</div><script>...</script>"
    }
  }]
}
```

**Theory:** ChatGPT might be expecting the widget HTML to be embedded in the tool response, NOT fetched separately via resources/read!

This would explain why:
- ChatGPT never calls resources/list or resources/read
- All our _meta flags are correct but widget doesn't render
- OpenAI example might work differently than we thought
