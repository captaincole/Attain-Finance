# Widget Development & Testing

This directory contains the React widgets for ChatGPT's Apps SDK integration.

## Quick Start

### Build All Widgets
```bash
npm run build:all
```

### Local Preview & Testing
```bash
npm run dev
```

This will:
1. Build all widgets
2. Start a Node.js Express server at http://localhost:8080
3. Open http://localhost:8080/widgets/preview.html in your browser to see widgets with mock data

## Development Workflow

### 1. Edit Widget Source
Edit files in `src/`:
- `connected-institutions.tsx` - Account balances widget
- `budget-list.tsx` - Budget overview widget

### 2. Test Locally
```bash
# Build and preview
npm run dev

# Or build manually and keep server running
npm run build:all
npm run preview

# Or use watch mode for auto-rebuild
npm run watch
```

### 3. Preview in Browser
Navigate to: http://localhost:8080/widgets/preview.html

Note: Server runs from project root, so preview.html is at `/widgets/preview.html`

**Features:**
- ✅ Live widget rendering with mock data
- ✅ Editable JSON mock data (edit and click "Update Widget")
- ✅ Switch between different widgets
- ✅ Mocks `window.openai` API (toolOutput, setWidgetState, etc.)
- ✅ See console logs for widget interactions

### 4. Customize Mock Data
In the preview page:
1. Edit the JSON in the textarea
2. Click "Update Widget" to see changes
3. Widget will re-render with your custom data

## Mock Data Templates

### Connected Institutions Widget
```json
{
  "institutions": [
    {
      "itemId": "item_123",
      "institutionName": "Chase Bank",
      "env": "✅ Production",
      "connectedAt": "2024-01-15T00:00:00.000Z",
      "lastSyncedAt": "2024-10-30T12:00:00.000Z",
      "accounts": [
        {
          "name": "Checking Account",
          "type": "depository",
          "subtype": "checking",
          "balances": { "current": 5432.10 }
        },
        {
          "name": "Credit Card",
          "type": "credit",
          "subtype": "credit card",
          "balances": { "current": -1200.75 }
        },
        {
          "name": "Investment Account",
          "type": "investment",
          "subtype": "brokerage",
          "balances": { "current": 125000.00 }
        }
      ]
    }
  ],
  "totalAccounts": 3
}
```

### Budget List Widget
```json
{
  "budgets": [
    {
      "id": "budget_1",
      "title": "Groceries",
      "amount": 500,
      "period": "monthly",
      "spent": 342.50,
      "remaining": 157.50,
      "percentage": 69,
      "status": "under",
      "dateRange": { "start": "2024-10-01", "end": "2024-10-31" },
      "transactionCount": 15
    }
  ]
}
```

## Testing Different Scenarios

### Test Empty States
```json
{
  "institutions": [],
  "totalAccounts": 0
}
```

### Test Error States
```json
{
  "institutions": [
    {
      "itemId": "item_error",
      "institutionName": "Broken Bank",
      "env": "⚠️ Error",
      "connectedAt": "2024-01-15T00:00:00.000Z",
      "accounts": [],
      "error": "Connection expired. Please re-authenticate."
    }
  ],
  "totalAccounts": 0
}
```

### Test Large Data Sets
Add multiple institutions with many accounts to test scrolling and layout.

### Test Edge Cases
- Negative balances
- Very large numbers (millions)
- Missing optional fields
- Different account types (loan, other)

## Widget Architecture

### window.openai Mock API
The preview page mocks the ChatGPT widget API:

```typescript
window.openai = {
  toolOutput: {...},        // Tool result data
  toolInput: {...},         // Tool input parameters
  widgetState: null,        // Persisted widget state
  displayMode: 'inline',    // Layout mode
  maxHeight: 600,           // Max height in pixels
  theme: 'light',           // UI theme
  locale: 'en-US',          // User locale

  setWidgetState: async (state) => {...},
  callTool: async (name, args) => {...},
  sendFollowupTurn: async (params) => {...},
  requestDisplayMode: async (params) => {...}
}
```

### Event System
Widgets listen for `openai:set_globals` events using `useSyncExternalStore`:

```typescript
window.addEventListener('openai:set_globals', (event) => {
  // event.detail.globals contains updated values
});
```

## Screenshot Testing (Future Enhancement)

For automated visual regression testing, consider adding:

```bash
npm install --save-dev playwright @playwright/test
```

Create `tests/visual.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('connected institutions widget renders correctly', async ({ page }) => {
  await page.goto('http://localhost:8080/preview.html');
  await page.selectOption('#widget-select', 'connected-institutions');
  await page.waitForSelector('#connected-institutions-root');

  await expect(page).toHaveScreenshot('connected-institutions.png');
});
```

This would enable automated screenshot comparison on every widget change.

## Build Output

Built widgets are output to `../public/widgets/`:
- `connected-institutions.js` - ~991KB (includes React)
- `connected-institutions.css` - Styles
- `budget-list.js` - Budget widget

These files are served by the MCP server via the resources API.

## Deployment

Widgets are automatically deployed when you push to main:
1. GitHub Actions runs `npm run build:all` in widgets/
2. Built files in `public/widgets/` are committed
3. Render deploys the updated server
4. ChatGPT fetches widgets via MCP resources API

## Troubleshooting

### Widget not loading in preview
- Check browser console for errors
- Verify widget was built: `ls -l ../public/widgets/`
- Try rebuilding: `npm run build:all`
- Clear browser cache and reload

### Changes not reflecting
- Build the widget: `npm run build:all`
- Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
- Check file timestamp: `ls -l ../public/widgets/connected-institutions.js`

### Mock data not updating
- Check JSON syntax (must be valid JSON)
- Click "Update Widget" button after editing
- Check browser console for parsing errors

## Resources

- [MCP Widgets Setup Guide](../docs/MCP_WIDGETS_SETUP.md)
- [Widget UX Patterns](../docs/MCP_WIDGETS_BUILD_UX.md)
- [Widget Debug Notes](../docs/CHATGPT_WIDGET_DEBUG.md)
- [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples)
