# MCP Server Setup for Custom Widgets

## Overview

Your MCP server is the foundation of every Apps SDK integration. It exposes tools that the model can call, enforces authentication, and packages the structured data plus component HTML that the ChatGPT client renders inline.

## Choose an SDK

Apps SDK supports any server that implements the MCP specification, but the official SDKs are the fastest way to get started:

- **Python SDK (official)** – great for rapid prototyping, including the official FastMCP module. See the repo at modelcontextprotocol/python-sdk.
- **TypeScript SDK (official)** – ideal if your stack is already Node/React. Use `@modelcontextprotocol/sdk`. Docs: modelcontextprotocol.io.

Install the SDK and any web framework you prefer (FastAPI or Express are common choices).

## Describe Your Tools

Tools are the contract between ChatGPT and your backend. Define a clear machine name, human-friendly title, and JSON schema so the model knows when—and how—to call each tool.

### Point to a Component Template

In addition to returning structured data, each tool on your MCP server should also reference an HTML UI template in its descriptor. This HTML template will be rendered in an iframe by ChatGPT.

1. **Register the template** – expose a resource whose `mimeType` is `text/html+skybridge` and whose body loads your compiled JS/CSS bundle. The resource URI (e.g., `ui://widget/kanban-board.html`) becomes the canonical ID for your component.

2. **Link the tool to the template** – inside the tool descriptor, set `_meta["openai/outputTemplate"]` to the same URI. Optional `_meta` fields let you declare whether the component can initiate tool calls or display custom status copy.

3. **Version carefully** – when you ship breaking component changes, register a new resource URI and update the tool metadata in lockstep. ChatGPT caches templates aggressively, so unique URIs (or cache-busted filenames) prevent stale assets from loading.

### Example

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "node:fs";

// Create an MCP server
const server = new McpServer({
  name: "kanban-server",
  version: "1.0.0"
});

// Load locally built assets (produced by your component build)
const KANBAN_JS = readFileSync("web/dist/kanban.js", "utf8");
const KANBAN_CSS = (() => {
  try {
    return readFileSync("web/dist/kanban.css", "utf8");
  } catch {
    return ""; // CSS optional
  }
})();

// UI resource (no inline data assignment; host will inject data)
server.registerResource(
  "kanban-widget",
  "ui://widget/kanban-board.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/kanban-board.html",
        mimeType: "text/html+skybridge",
        text: `
<div id="kanban-root"></div>
${KANBAN_CSS ? `<style>${KANBAN_CSS}</style>` : ""}
<script type="module">${KANBAN_JS}</script>
        `.trim(),
      },
    ],
  })
);

server.registerTool(
  "kanban-board",
  {
    title: "Show Kanban Board",
    _meta: {
      "openai/outputTemplate": "ui://widget/kanban-board.html",
      "openai/toolInvocation/invoking": "Displaying the board",
      "openai/toolInvocation/invoked": "Displayed the board"
    },
    inputSchema: { tasks: z.string() }
  },
  async () => {
    return {
      content: [{ type: "text", text: "Displayed the kanban board!" }],
      structuredContent: {}
    };
  }
);
```

## Structure the Data Your Tool Returns

Each tool result can include three sibling fields:

- **structuredContent** – structured data used to hydrate your component. ChatGPT injects this object into your iframe as `window.openai.toolOutput`. The model reads these values and may narrate or summarize them.

- **content** – Optional free-form text (Markdown or plain strings) that the model receives verbatim.

- **_meta** – Arbitrary JSON passed only to the component. Use it for data that should not influence the model's reasoning. `_meta` is never shown to the model.

Your component receives all three fields, but only `structuredContent` and `content` are visible to the model.

### Example: Kanban Board Data

```typescript
async function loadKanbanBoard() {
  const tasks = [
    { id: "task-1", title: "Design empty states", assignee: "Ada", status: "todo" },
    { id: "task-2", title: "Wireframe admin panel", assignee: "Grace", status: "in-progress" },
    { id: "task-3", title: "QA onboarding flow", assignee: "Lin", status: "done" }
  ];

  return {
    columns: [
      { id: "todo", title: "To do", tasks: tasks.filter((task) => task.status === "todo") },
      { id: "in-progress", title: "In progress", tasks: tasks.filter((task) => task.status === "in-progress") },
      { id: "done", title: "Done", tasks: tasks.filter((task) => task.status === "done") }
    ],
    tasksById: Object.fromEntries(tasks.map((task) => [task.id, task])),
    lastSyncedAt: new Date().toISOString()
  };
}

server.registerTool(
  "kanban-board",
  {
    title: "Show Kanban Board",
    _meta: {
      "openai/outputTemplate": "ui://widget/kanban-board.html",
      "openai/toolInvocation/invoking": "Displaying the board",
      "openai/toolInvocation/invoked": "Displayed the board"
    },
    inputSchema: { tasks: z.string() }
  },
  async () => {
    const board = await loadKanbanBoard();

    return {
      structuredContent: {
        columns: board.columns.map((column) => ({
          id: column.id,
          title: column.title,
          tasks: column.tasks.slice(0, 5) // keep payload concise for the model
        }))
      },
      content: [{ type: "text", text: "Here's your latest board. Drag cards in the component to update status." }],
      _meta: {
        tasksById: board.tasksById, // full task map for the component only
        lastSyncedAt: board.lastSyncedAt
      }
    };
  }
);
```

## Run Locally

1. Build your component bundle
2. Start the MCP server
3. Point MCP Inspector to `http://localhost:<port>/mcp`, list tools, and call them
4. Inspector validates that your response includes both structured content and component metadata and renders the component inline

## Expose a Public Endpoint

ChatGPT requires HTTPS. During development, you can use a tunnelling service such as ngrok:

```bash
ngrok http <port>
# Forwarding: https://<subdomain>.ngrok.app -> http://127.0.0.1:<port>
```

Use the resulting URL when creating a connector in developer mode.

## Advanced Features

### Allow Component-Initiated Tool Access

To allow component‑initiated tool access, mark tools with `_meta.openai/widgetAccessible: true`:

```json
"_meta": {
  "openai/outputTemplate": "ui://widget/kanban-board.html",
  "openai/widgetAccessible": true
}
```

### Define Component Content Security Policies

Widgets require a strict content security policy (CSP) prior to broad distribution. Declare a CSP in your component resource with the `openai/widget` meta property:

```typescript
server.registerResource(
  "html",
  "ui://widget/widget.html",
  {},
  async (req) => ({
    contents: [
      {
        uri: "ui://widget/widget.html",
        mimeType: "text/html",
        text: `
<div id="kitchen-sink-root"></div>
<link rel="stylesheet" href="https://persistent.oaistatic.com/ecosystem-built-assets/kitchen-sink-2d2b.css">
<script type="module" src="https://persistent.oaistatic.com/ecosystem-built-assets/kitchen-sink-2d2b.js"></script>
        `.trim(),
        _meta: {
          "openai/widgetCSP": {
            connect_domains: [],
            resource_domains: ["https://persistent.oaistatic.com"],
          }
        },
      },
    ],
  })
);
```

The CSP defines two arrays of URLs: `connect_domains` and `resource_domains`. These URLs map to:

```
`script-src 'self' ${resources}`,
`img-src 'self' data: ${resources}`,
`font-src 'self' ${resources}`,
`connect-src 'self' ${connects}`,
```

### Configure Component Subdomains

Components support configurable subdomains for restricting public API keys to specific origins:

```json
"openai/widgetDomain": "https://chatgpt.com"
```

By default, all components are rendered on `https://web-sandbox.oaistatic.com`. With a custom domain, the origin is converted (e.g., `chatgpt.com` becomes `chatgpt-com`) so the final domain is `https://chatgpt-com.web-sandbox.oaiusercontent.com`.

### Configure Status Strings on Tool Calls

Provide short, localized status strings during and after invocation:

```json
"_meta": {
  "openai/outputTemplate": "ui://widget/kanban-board.html",
  "openai/toolInvocation/invoking": "Organizing tasks…",
  "openai/toolInvocation/invoked": "Board refreshed."
}
```

### Serve Localized Content

ChatGPT advertises the user's preferred locale during the MCP initialize handshake. Locale tags follow IETF BCP 47 (e.g., `en-US`, `fr-FR`, `es-419`).

**Initialize request example:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "_meta": {
      "openai/locale": "en-GB"
    }
  }
}
```

**Response with resolved locale:**

```json
"_meta": {
  "openai/outputTemplate": "ui://widget/kanban-board.html",
  "openai/locale": "en"
}
```

Every subsequent MCP request repeats the requested locale in `_meta["openai/locale"]`.

### Inspect Client Context Hints

Operation-phase requests can include extra hints under `_meta.openai/*`:

- `_meta["openai/userAgent"]` – string identifying the client (e.g., `ChatGPT/1.2025.012`)
- `_meta["openai/userLocation"]` – coarse location object (country, region, city, timezone, coordinates)

Treat these values as advisory only; never rely on them for authorization.

### Add Component Descriptions

Component descriptions help the model understand what is being displayed. Set `openai/widgetDescription` on the resource template:

```typescript
server.registerResource("html", "ui://widget/widget.html", {}, async () => ({
  contents: [
    {
      uri: "ui://widget/widget.html",
      mimeType: "text/html",
      text: componentHtml,
      _meta: {
        "openai/widgetDescription": "Renders an interactive UI showcasing the zoo animals returned by get_zoo_animals.",
      },
    },
  ],
}));
```

**Note:** You must refresh actions on your MCP in dev mode for your description to take effect.

### Opt Into Component Borders

Widgets better suited for a "Card" layout can opt into having a border rendered by ChatGPT:

```json
"openai/widgetPrefersBorder": true
```
