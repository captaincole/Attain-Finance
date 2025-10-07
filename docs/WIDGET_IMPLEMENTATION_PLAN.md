# Widget Implementation Plan: Spending Categories

## Overview

This document outlines the plan for building custom UI widgets that work across both ChatGPT (web/mobile) and Claude Desktop (desktop app). We'll use a **spending categories list widget** as our reference implementation.

## Key Requirements Analysis

### ChatGPT Widget Requirements (from Apps SDK docs)

1. **Component Architecture**:
   - React components bundled with esbuild
   - Runs in iframe with `window.openai` API bridge
   - Registers as MCP resource with `mimeType: "text/html+skybridge"`
   - Component URI: `ui://widget/spending-categories.html`

2. **Data Flow**:
   - Tool returns `structuredContent` → injected as `window.openai.toolOutput`
   - Component can persist state via `window.openai.setWidgetState`
   - Component can trigger server actions via `window.openai.callTool`

3. **Advanced Features**:
   - Layout modes: inline, picture-in-picture, fullscreen
   - Theme/locale support via `window.openai.theme` and `window.openai.locale`
   - Host-backed navigation with React Router
   - CSP requirements for production

### Claude Desktop Widget Requirements (inferred from MCP spec)

1. **Component Architecture**:
   - Standard MCP resources (no iframe sandbox)
   - Likely rendered as native UI elements or webview
   - May use different MIME type or rendering hints

2. **Data Flow**:
   - Tool returns `structuredContent` in standard MCP format
   - No `window.openai` API available
   - May need alternative state persistence strategy

3. **Constraints**:
   - CLI/desktop environment (no full browser APIs)
   - Potentially limited interactivity
   - Focus on data visualization over complex interactions

## Architecture Decision: Dual-Target Strategy

We'll build **two separate widget implementations** that share the same MCP tool backend:

```
personal-finance-mcp/
├── src/
│   ├── create-server.ts          # MCP server with tools
│   ├── tools/
│   │   └── spending-categories.ts  # Shared tool logic
│   └── widgets/
│       ├── chatgpt/               # ChatGPT-specific widgets
│       │   ├── package.json
│       │   ├── tsconfig.json
│       │   ├── src/
│       │   │   └── spending-categories.tsx
│       │   └── dist/
│       │       ├── spending-categories.js
│       │       └── spending-categories.css
│       └── claude/                # Claude Desktop widgets
│           └── spending-categories-template.html
└── docs/
    └── WIDGET_IMPLEMENTATION_PLAN.md
```

## Example Widget: Spending Categories List

### Widget Functionality

**Purpose**: Display user's spending broken down by category over a selected time period.

**Features**:
- List of spending categories with amounts and percentages
- Visual progress bars showing relative spending
- Time period selector (last 30/60/90 days)
- Sort by amount or category name
- Drill down into transactions for each category

**Data Structure**:

```typescript
interface SpendingCategory {
  category: string;           // "Food and Drink", "Transportation", etc.
  amount: number;            // 1234.56
  transactionCount: number;  // 42
  percentOfTotal: number;    // 23.5
  subcategories?: string[];  // ["Restaurants", "Groceries"]
}

interface SpendingCategoriesOutput {
  categories: SpendingCategory[];
  totalSpending: number;
  startDate: string;  // ISO date
  endDate: string;    // ISO date
  currency: string;   // "USD"
}
```

## Implementation Plan

### Phase 1: MCP Tool Implementation (Backend)

**File**: `src/tools/spending-categories.ts`

**Tasks**:
1. Create tool definition with Zod schema
2. Fetch Plaid transactions for date range
3. Group transactions by category
4. Calculate totals, percentages, counts
5. Return structured data in standard format

**Tool Schema**:

```typescript
{
  name: "get-spending-categories",
  title: "View Spending by Category",
  description: "Analyze your spending broken down by category",
  inputSchema: {
    days: z.number().int().min(1).max(365).default(30),
    sort: z.enum(["amount", "category"]).default("amount")
  }
}
```

**Response Format**:

```typescript
{
  content: [
    {
      type: "text",
      text: "Here's your spending breakdown for the last 30 days..."
    }
  ],
  structuredContent: {
    categories: [...],
    totalSpending: 5432.10,
    startDate: "2024-12-07",
    endDate: "2025-01-06",
    currency: "USD"
  },
  _meta: {
    // ChatGPT-only: full transaction IDs for drill-down
    categoryTransactions: {
      "Food and Drink": ["txn-1", "txn-2", ...],
      ...
    }
  }
}
```

### Phase 2: ChatGPT Widget Implementation

**Directory**: `src/widgets/chatgpt/`

#### Step 2.1: Setup Build Environment

```bash
cd src/widgets/chatgpt
npm init -y
npm install react@^18 react-dom@^18
npm install -D typescript esbuild @types/react @types/react-dom
```

**package.json scripts**:

```json
{
  "scripts": {
    "build": "esbuild src/spending-categories.tsx --bundle --format=esm --outfile=dist/spending-categories.js",
    "build:css": "esbuild src/spending-categories.css --bundle --outfile=dist/spending-categories.css",
    "build:all": "npm run build && npm run build:css",
    "watch": "npm run build -- --watch"
  }
}
```

#### Step 2.2: Create React Component

**File**: `src/widgets/chatgpt/src/spending-categories.tsx`

**Key Features**:
- Read data from `window.openai.toolOutput`
- Persist sort/filter preferences via `window.openai.setWidgetState`
- Support inline/fullscreen display modes
- Respond to theme changes (dark/light mode)
- Call `window.openai.callTool` to refresh data
- Use `window.openai.sendFollowupTurn` for drill-down

**Component Structure**:

```typescript
interface SpendingCategoriesProps {}

function SpendingCategoriesWidget() {
  const toolOutput = window.openai?.toolOutput as SpendingCategoriesOutput;
  const [widgetState, setWidgetState] = useWidgetState({ sortBy: "amount" });
  const displayMode = useOpenAiGlobal("displayMode");
  const theme = useOpenAiGlobal("theme");

  const sortedCategories = useMemo(() => {
    return [...toolOutput.categories].sort((a, b) => {
      if (widgetState.sortBy === "amount") {
        return b.amount - a.amount;
      }
      return a.category.localeCompare(b.category);
    });
  }, [toolOutput.categories, widgetState.sortBy]);

  const handleDrillDown = (category: SpendingCategory) => {
    window.openai.sendFollowupTurn({
      prompt: `Show me all transactions in the ${category.category} category`
    });
  };

  const handleRefresh = () => {
    window.openai.callTool("get-spending-categories", { days: 30 });
  };

  return (
    <div className={`spending-categories ${theme}`}>
      <header>
        <h2>Spending by Category</h2>
        <button onClick={handleRefresh}>Refresh</button>
      </header>

      <div className="total">
        Total: ${toolOutput.totalSpending.toFixed(2)}
      </div>

      <ul className="category-list">
        {sortedCategories.map(cat => (
          <li key={cat.category} onClick={() => handleDrillDown(cat)}>
            <div className="category-info">
              <span className="name">{cat.category}</span>
              <span className="amount">${cat.amount.toFixed(2)}</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${cat.percentOfTotal}%` }}
              />
            </div>
            <div className="meta">
              {cat.transactionCount} transactions • {cat.percentOfTotal}%
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Mount component
const root = document.getElementById("spending-categories-root");
if (root) {
  createRoot(root).render(<SpendingCategoriesWidget />);
}
```

#### Step 2.3: Register Component Resource in MCP Server

**File**: `src/create-server.ts`

```typescript
import { readFileSync } from "node:fs";

// Load built widget assets
const SPENDING_CATEGORIES_JS = readFileSync(
  "src/widgets/chatgpt/dist/spending-categories.js",
  "utf8"
);
const SPENDING_CATEGORIES_CSS = (() => {
  try {
    return readFileSync(
      "src/widgets/chatgpt/dist/spending-categories.css",
      "utf8"
    );
  } catch {
    return "";
  }
})();

// Register widget resource
server.registerResource(
  "spending-categories-widget",
  "ui://widget/spending-categories.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/spending-categories.html",
        mimeType: "text/html+skybridge",
        text: `
<div id="spending-categories-root"></div>
${SPENDING_CATEGORIES_CSS ? `<style>${SPENDING_CATEGORIES_CSS}</style>` : ""}
<script type="module">${SPENDING_CATEGORIES_JS}</script>
        `.trim(),
        _meta: {
          "openai/widgetDescription": "Interactive breakdown of spending by category with drill-down capabilities",
          "openai/widgetPrefersBorder": true,
          "openai/widgetCSP": {
            connect_domains: [],
            resource_domains: []
          }
        }
      }
    ]
  })
);

// Update tool to reference widget
server.tool(
  "get-spending-categories",
  {
    title: "View Spending by Category",
    description: "Analyze your spending broken down by category",
    inputSchema: {
      days: z.number().int().min(1).max(365).default(30),
      sort: z.enum(["amount", "category"]).default("amount")
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/spending-categories.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Analyzing spending patterns...",
      "openai/toolInvocation/invoked": "Spending breakdown ready"
    }
  },
  async (args, { authInfo }) => {
    const userId = authInfo?.extra?.userId as string;
    const categories = await getSpendingCategories(userId, args.days);

    return {
      content: [
        {
          type: "text",
          text: `Your spending over the last ${args.days} days totals $${categories.totalSpending.toFixed(2)}`
        }
      ],
      structuredContent: {
        categories: categories.categories,
        totalSpending: categories.totalSpending,
        startDate: categories.startDate,
        endDate: categories.endDate,
        currency: "USD"
      }
    };
  }
);
```

### Phase 3: Claude Desktop Widget Implementation

**Note**: Claude Desktop's widget support is less documented. We'll use a fallback strategy.

#### Strategy Options:

**Option A: HTML Template (if Claude supports rendering)**

**File**: `src/widgets/claude/spending-categories-template.html`

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 1rem; }
    .category { margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #ddd; }
    .progress { height: 8px; background: #eee; border-radius: 4px; }
    .progress-fill { height: 100%; background: #4CAF50; border-radius: 4px; }
  </style>
</head>
<body>
  <h2>Spending by Category</h2>
  <div id="total"></div>
  <div id="categories"></div>

  <script>
    // Simple vanilla JS (no React, no window.openai)
    const data = {{SPENDING_DATA}}; // Server-side templating

    document.getElementById('total').textContent =
      `Total: $${data.totalSpending.toFixed(2)}`;

    const categoriesEl = document.getElementById('categories');
    data.categories.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'category';
      div.innerHTML = `
        <div><strong>${cat.category}</strong> - $${cat.amount.toFixed(2)}</div>
        <div class="progress">
          <div class="progress-fill" style="width: ${cat.percentOfTotal}%"></div>
        </div>
        <div>${cat.transactionCount} transactions • ${cat.percentOfTotal}%</div>
      `;
      categoriesEl.appendChild(div);
    });
  </script>
</body>
</html>
```

**Option B: Rich Text Formatting (fallback)**

If Claude doesn't support HTML rendering, use rich markdown/text formatting:

```typescript
function formatSpendingCategoriesForClaude(data: SpendingCategoriesOutput): string {
  let output = `## Spending Breakdown (${data.startDate} to ${data.endDate})\n\n`;
  output += `**Total Spending**: $${data.totalSpending.toFixed(2)}\n\n`;

  data.categories.forEach(cat => {
    const bar = '█'.repeat(Math.round(cat.percentOfTotal / 2));
    output += `### ${cat.category}\n`;
    output += `- Amount: $${cat.amount.toFixed(2)} (${cat.percentOfTotal.toFixed(1)}%)\n`;
    output += `- Transactions: ${cat.transactionCount}\n`;
    output += `- ${bar}\n\n`;
  });

  return output;
}
```

**Option C: Detect Client and Return Appropriate Format**

```typescript
server.tool(
  "get-spending-categories",
  { /* ... */ },
  async (args, { authInfo, _meta }) => {
    const userId = authInfo?.extra?.userId as string;
    const categories = await getSpendingCategories(userId, args.days);

    // Detect client from initialize handshake
    const clientName = _meta?.clientInfo?.name || "unknown";
    const isChatGPT = clientName.toLowerCase().includes("chatgpt");

    if (isChatGPT) {
      // Return widget for ChatGPT
      return {
        content: [{ type: "text", text: "Spending breakdown ready" }],
        structuredContent: categories,
        _meta: {
          "openai/outputTemplate": "ui://widget/spending-categories.html"
        }
      };
    } else {
      // Return formatted text for Claude Desktop
      return {
        content: [
          {
            type: "text",
            text: formatSpendingCategoriesForClaude(categories)
          }
        ],
        structuredContent: categories
      };
    }
  }
);
```

## Development Workflow

### Step-by-Step Implementation

1. **Backend First**:
   ```bash
   # Implement tool logic
   # Test with MCP Inspector
   npm run dev
   # In separate terminal:
   curl http://localhost:3000/mcp -X POST ...
   ```

2. **ChatGPT Widget**:
   ```bash
   cd src/widgets/chatgpt
   npm run build:all
   # Update server to load built assets
   # Test with ChatGPT dev mode
   ```

3. **Claude Widget**:
   ```bash
   # Test with Claude Desktop
   # Add to claude_desktop_config.json
   # Verify rendering
   ```

### Testing Strategy

1. **MCP Inspector**: Validate tool contract and structured data
2. **ChatGPT Dev Mode**: Test widget interactivity and layout modes
3. **Claude Desktop**: Verify fallback rendering works
4. **Multiple Clients**: Ensure client detection works correctly

## Future Enhancements

### Advanced Features to Add Later

1. **Interactive Filtering**:
   - Date range picker in widget
   - Category search/filter
   - Toggle between chart/list view

2. **Data Visualization**:
   - Pie chart using Chart.js or D3
   - Trend lines showing spending over time
   - Comparison to previous periods

3. **Multi-Tool Integration**:
   - Link to transaction details widget
   - Budget comparison widget
   - Spending alerts/notifications

4. **Performance Optimization**:
   - Lazy loading for large category lists
   - Virtual scrolling for hundreds of categories
   - Caching and incremental updates

## Success Criteria

- [ ] Tool returns correct spending data from Plaid API
- [ ] ChatGPT widget renders inline and in fullscreen
- [ ] Widget responds to theme changes (dark/light)
- [ ] Widget persists user preferences (sort order)
- [ ] Widget can trigger tool refresh
- [ ] Widget can send follow-up prompts
- [ ] Claude Desktop shows readable output
- [ ] Server detects client and returns appropriate format
- [ ] CSP configuration passes review
- [ ] Widget works on mobile ChatGPT

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 (MCP tool backend)
3. Implement Phase 2 (ChatGPT widget)
4. Test with both clients
5. Document findings and refine approach
6. Build additional widgets using this pattern
