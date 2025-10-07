# Revised Widget Strategy: ChatGPT vs Claude Desktop

## Key Insight

The two clients have fundamentally different UX paradigms:

- **ChatGPT**: Web/mobile browser → Interactive React widgets in iframes
- **Claude Desktop**: Terminal/CLI → Shell scripts that generate terminal-based visualizations

## Resource Types by Client

### ChatGPT Resources
- **Type**: `text/html+skybridge` (React components)
- **Delivery**: Inline iframes with `window.openai` API
- **Interactivity**: Full JavaScript, state persistence, tool calls
- **Example**: Interactive spending categories list with drill-down

### Claude Desktop Resources
- **Type**: Executable shell scripts (`.sh` files)
- **Delivery**: Signed download URLs (same pattern as transaction CSV)
- **Interactivity**: Terminal-based charts using tools like:
  - `gnuplot` - Chart generation
  - ASCII art libraries
  - `termgraph` - Terminal bar charts
  - `plotille` - Terminal plotting (Python)
- **Example**: Shell script that generates ASCII bar chart of spending categories

## Example: Spending Categories Widget

### ChatGPT Version
```typescript
// Returns interactive React widget
{
  content: [{ type: "text", text: "Spending breakdown ready" }],
  structuredContent: { categories: [...] },
  _meta: {
    "openai/outputTemplate": "ui://widget/spending-categories.html"
  }
}
```

User sees:
```
┌─ Spending by Category ─────────────────┐
│ Food & Drink        $1,234.56  ████████│
│ Transportation      $456.78    ███     │
│ Shopping            $789.01    █████   │
└────────────────────────────────────────┘
[Interactive: Click to drill down]
```

### Claude Desktop Version
```typescript
// Returns downloadable shell script + data
{
  content: [{
    type: "text",
    text: `
Download and run this script to visualize your spending:

curl "${signedScriptUrl}" -o visualize-spending.sh
curl "${signedDataUrl}" -o spending-data.csv
chmod +x visualize-spending.sh
./visualize-spending.sh spending-data.csv
    `
  }],
  structuredContent: { categories: [...] }
}
```

User runs in terminal:
```bash
$ ./visualize-spending.sh spending-data.csv

Spending by Category (Last 30 Days)
Total: $2,480.35

Food & Drink         $1,234.56 ████████████████████████ 49.8%
Transportation       $456.78   █████████ 18.4%
Shopping             $789.01   ███████████████ 31.8%

Top Categories:
1. Food & Drink: 42 transactions
2. Shopping: 18 transactions
3. Transportation: 15 transactions
```

## Implementation Architecture

```
src/
├── utils/
│   └── client-detection.ts         # isChatGPT(extra) utility
├── widgets/
│   ├── chatgpt/                    # React widgets
│   │   ├── src/spending-categories.tsx
│   │   └── dist/spending-categories.js
│   └── claude/                     # Shell script templates
│       ├── visualize-spending.sh   # Terminal visualization script
│       └── spending-categories.sh  # Simple text-based display
└── tools/
    └── spending-categories.ts      # Tool handler with client detection
```

## Shell Script Example (Claude Desktop)

**File**: `src/widgets/claude/visualize-spending.sh`

```bash
#!/bin/bash
# Spending Categories Visualizer
# Usage: ./visualize-spending.sh spending-data.csv

CSV_FILE="$1"

if [ ! -f "$CSV_FILE" ]; then
  echo "Error: CSV file not found: $CSV_FILE"
  exit 1
fi

# Read CSV and generate ASCII bar chart
echo "Spending by Category (Last 30 Days)"
echo "=================================="
echo ""

# Skip header, group by category, sum amounts
awk -F',' 'NR>1 {
  gsub(/"/, "", $4)  # Remove quotes from category
  categories[$4] += $3
  total += $3
}
END {
  # Print sorted by amount
  n = asorti(categories, sorted, "@val_num_desc")
  for (i = 1; i <= n; i++) {
    cat = sorted[i]
    amount = categories[cat]
    percent = (amount / total) * 100

    # Generate bar (1 block per 2%)
    bars = int(percent / 2)
    bar = ""
    for (j = 0; j < bars; j++) bar = bar "█"

    printf "%-20s $%8.2f %s %.1f%%\n", cat, amount, bar, percent
  }
  printf "\nTotal: $%.2f\n", total
}' "$CSV_FILE"
```

## Tool Handler with Client Detection

**File**: `src/tools/spending-categories.ts`

```typescript
import { isChatGPT } from '../utils/client-detection.js';
import { generateSignedUrl } from '../utils/signed-urls.js';

export async function spendingCategoriesHandler(
  userId: string,
  baseUrl: string,
  args: { days: number },
  extra: any,
  plaidClient: PlaidApi
) {
  // Fetch spending data (same for both clients)
  const categories = await fetchSpendingCategories(userId, args.days, plaidClient);

  // Generate CSV file for download
  const csvContent = generateCategoriesCSV(categories);

  // Store temporarily for download
  userSpendingData.set(userId, csvContent);

  if (isChatGPT(extra)) {
    // ===== ChatGPT: Return widget =====
    return {
      content: [{
        type: "text",
        text: `Your spending over the last ${args.days} days totals $${categories.total.toFixed(2)}`
      }],
      structuredContent: {
        categories: categories.items,
        total: categories.total,
        startDate: categories.startDate,
        endDate: categories.endDate
      },
      _meta: {
        "openai/outputTemplate": "ui://widget/spending-categories.html"
      }
    };
  }

  // ===== Claude Desktop: Return shell script download =====
  const scriptUrl = `${baseUrl}/widgets/claude/visualize-spending.sh`;
  const dataUrl = generateSignedUrl(baseUrl, userId, "spending-categories", 600);

  return {
    content: [{
      type: "text",
      text: `
## Spending Breakdown (${categories.startDate} to ${categories.endDate})

**Total**: $${categories.total.toFixed(2)}

**Visualize in terminal:**

\`\`\`bash
# Download visualization script
curl "${scriptUrl}" -o visualize-spending.sh

# Download your data (expires in 10 minutes)
curl "${dataUrl}" -o spending-data.csv

# Run visualization
chmod +x visualize-spending.sh
./visualize-spending.sh spending-data.csv
\`\`\`

**Quick Summary:**
${categories.items.slice(0, 5).map((cat, i) =>
  `${i + 1}. ${cat.category}: $${cat.amount.toFixed(2)} (${cat.percent.toFixed(1)}%)`
).join('\n')}
      `.trim()
    }],
    structuredContent: {
      categories: categories.items,
      total: categories.total,
      startDate: categories.startDate,
      endDate: categories.endDate
    }
  };
}
```

## Alternative: Pure ASCII Output (No Downloads)

For even simpler Claude Desktop support, skip the script download and just return formatted ASCII:

```typescript
if (!isChatGPT(extra)) {
  // Generate ASCII chart inline
  const asciiChart = categories.items.map(cat => {
    const barLength = Math.round(cat.percent / 2);
    const bar = '█'.repeat(barLength);
    return `${cat.category.padEnd(20)} $${cat.amount.toFixed(2).padStart(10)} ${bar} ${cat.percent.toFixed(1)}%`;
  }).join('\n');

  return {
    content: [{
      type: "text",
      text: `
Spending by Category (${categories.startDate} to ${categories.endDate})
Total: $${categories.total.toFixed(2)}

${asciiChart}
      `.trim()
    }],
    structuredContent: categories
  };
}
```

## Benefits of This Approach

### For ChatGPT Users
✅ Full interactive widgets with state persistence
✅ Drill-down capabilities via `window.openai.callTool`
✅ Responsive layouts (inline/fullscreen)
✅ Rich visualizations (charts, graphs, maps)

### For Claude Desktop Users
✅ Terminal-native visualizations
✅ Shell scripts they can inspect/modify
✅ Works offline after initial download
✅ Composable with other CLI tools (grep, awk, etc.)
✅ No browser required

## Implementation Priority

1. **Phase 1**: Client detection utility + test tool
2. **Phase 2**: Simple ASCII output for Claude (no downloads)
3. **Phase 3**: ChatGPT React widget
4. **Phase 4**: Shell script templates for Claude (advanced)

Start simple with ASCII output, then add complexity as needed.
