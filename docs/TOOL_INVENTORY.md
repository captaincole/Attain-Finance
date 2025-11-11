# MCP Tool Inventory

Quick reference for all MCP tools in the Personal Finance server. Organized by feature area.

## Account Management (4 tools)

### `connect-account`
**Purpose:** Initiate Plaid OAuth flow to connect financial institution
**Returns:** OAuth URL for user to complete connection
**Widget:** None
**Notes:** Opens secure browser, call one at a time

### `financial-summary`
**Purpose:** Net worth + asset snapshot with week-over-week trend
**Returns:** Hero card with assets, liabilities, net worth trend, suggested next actions
**Widget:** ✅ Financial Summary card (shared widget with account status)
**Notes:** Database lookup (instant). Best starting point for high-level progress updates.

### `get-account-status`
**Purpose:** View all connected institutions with balance + connection health
**Returns:** Account list grouped by institution/type, connection errors, recommended next steps
**Widget:** ✅ Account Status card (shared widget with financial summary)
**Notes:** Run this before updating or disconnecting an institution; exposes item_id values for follow-up tools.

### `update-account-link`
**Purpose:** Re-authenticate broken/expired account connection
**Returns:** Update URL for user to fix connection
**Widget:** None
**Notes:** Call get-account-status first to verify error status

### `disconnect-account`
**Purpose:** Remove account connection and revoke access
**Returns:** Confirmation message
**Widget:** None
**Notes:** Deletes all stored connection data

---

## Transactions (2 tools)

### `get-transactions`
**Purpose:** Retrieve categorized transaction data with filters
**Returns:** Structured transaction array + analysis/visualization guidance
**Widget:** None
**Filters:** date range, accounts, categories, budgets, pending status
**Notes:** Database lookup (instant), AI-categorized. Use `get-account-status` to grab account IDs for filtering.

### `get-raw-transactions`
**Purpose:** Download pure transaction data as CSV
**Returns:** Signed CSV download URL (expires 10min)
**Widget:** None
**Notes:** For external analysis/spreadsheet tools, no categorization

---

## Budgets (4 tools)

### `get-budgets`
**Purpose:** View budget status with spending progress
**Returns:** Budget list with spending totals, optionally includes transactions
**Widget:** ✅ Budget cards with progress bars
**Filters:** budget_id, showTransactions
**Notes:** Call this FIRST for budget operations

### `create-budget`
**Purpose:** Create new budget (rolling or fixed period)
**Returns:** Created budget with widget visualization
**Widget:** ✅ Budget list with new budget highlighted
**Types:** Rolling (last N days) or Fixed (weekly/monthly/etc)
**Notes:** Requires natural language filter_prompt

### `update-budget-rules`
**Purpose:** Update existing budget configuration
**Returns:** Updated budget with new calculations
**Widget:** ✅ Budget list with updated budget
**Notes:** All fields optional except budget ID, re-labels transactions

### `delete-budget`
**Purpose:** Delete budget by ID
**Returns:** Confirmation message
**Widget:** None
**Notes:** Get budget ID from get-budgets first

---

## Categorization (1 tool)

### `update-categorization-rules`
**Purpose:** Update global AI categorization rules for all transactions
**Returns:** Confirmation + background job status
**Widget:** None
**Notes:** Affects custom_category field, NOT budget matching. Triggers async recategorization.

---

## Investments (1 tool)

### `get-investment-holdings`
**Purpose:** View complete investment portfolio across all accounts
**Returns:** Holdings list with prices, quantities, gain/loss
**Widget:** None
**Notes:** Database lookup (instant), synced daily via cron

---

## Liabilities (1 tool)

### `get-liabilities`
**Purpose:** View credit cards, mortgages, student loans
**Returns:** Liability details with payment schedules, interest rates
**Widget:** None
**Filters:** type (credit/mortgage/student)
**Notes:** Fetches from Plaid on first call, then cached

---

## Financial Analysis (1 tool)

### `get-opinion`
**Purpose:** Get expert financial analysis methodology prompt
**Returns:** Full analysis instructions for specific methodology
**Widget:** None
**Examples:** Graham Stephan's 20% Rule, Minimalist budgeting
**Notes:** Returns prompt text, not analysis itself

---

## Summary Statistics

- **Total Tools:** 15
- **Widget-Enabled:** 5 (financial-summary, get-account-status, get-budgets, create-budget, update-budget-rules)
- **Read-Only:** 8 (all gets + get-opinion)
- **Write Operations:** 6 (connect, update, delete, create)
- **Background Jobs:** 1 (update-categorization-rules)

## Tool Grouping Observations

### Potential Reorganization Ideas

**By Data Type:**
- Accounts (4) - Well organized
- Transactions (2) - Could add more analysis tools
- Budgets (4) - Well organized
- Investments (1) - Could expand
- Liabilities (1) - Could expand
- Categorization (1) - Standalone feature

**By Operation:**
- **Setup:** connect-account, update-account-link
- **View Data:** financial-summary, get-account-status, get-transactions, get-budgets, get-investment-holdings, get-liabilities
- **Manage Rules:** create-budget, update-budget-rules, update-categorization-rules
- **Export:** get-raw-transactions
- **Cleanup:** disconnect-account, delete-budget
- **Analysis:** get-opinion

**Naming Consistency:**
- ✅ All "get" tools are read-only
- ✅ "update" implies modification
- ✅ "create"/"delete" are explicit
- ⚠️ "connect-account" could be "create-account-connection"
- ⚠️ "update-account-link" could be "refresh-account-connection"

**Missing Tools (Potential Additions):**
- refresh-transactions (manual sync trigger)
- refresh-investments (manual sync trigger)
- export-budgets (download budget data)
- analyze-spending (AI-powered insights tool)
- get-cash-flow (income vs expenses over time)
- get-net-worth-history (balance trends)
