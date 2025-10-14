# Transaction Storage Pipeline - Implementation Plan

## Overview

Transform the system from real-time Plaid API calls to a database-backed transaction cache with asynchronous categorization and budget labeling.

**Goal:** Store transactions in Supabase to enable:
- Fast budget calculations (database queries instead of AI calls)
- Persistent categorization (runs once per transaction)
- Efficient budget labeling (pre-computed associations)
- User-controlled data refresh (via `refresh-transactions` tool)

---

## Architecture Decision: Single Transactions Table

**Plaid API Structure:**
- `transactionsGet()` returns ALL transactions across ALL accounts for a given `access_token`
- Each transaction has unique `transaction_id` (Plaid-generated)
- Transactions linked to `account_id` and `item_id` (institution)

**Why Single Table:**
✅ Plaid returns unified data across accounts
✅ Easier to query across all user transactions
✅ Simpler budget filtering (no joins needed)
✅ Can still filter by `item_id` or `account_id` when needed
✅ Follows Plaid's data model design

---

## Phase 1: Database Foundation

**Goal:** Create transaction storage layer and repository

### 1.1 Database Migration

**File:** `migrations/010_create_transactions.sql`

```sql
-- Migration 010: Create transactions table
-- Stores cached transaction data from Plaid with AI categorization and budget labels

CREATE TABLE transactions (
  -- Plaid identifiers
  transaction_id TEXT PRIMARY KEY,           -- Plaid's unique transaction ID
  account_id TEXT NOT NULL,                  -- Plaid account ID
  item_id TEXT NOT NULL,                     -- Plaid item ID (institution connection)
  user_id TEXT NOT NULL,                     -- User who owns this transaction

  -- Transaction details
  date DATE NOT NULL,                        -- Transaction date
  name TEXT NOT NULL,                        -- Merchant/description
  amount DECIMAL(10, 2) NOT NULL,            -- Amount (positive = debit, negative = credit)
  plaid_category JSONB,                      -- Plaid's category array (e.g., ["Food", "Groceries"])
  pending BOOLEAN NOT NULL DEFAULT false,    -- Is transaction pending?

  -- Our enrichment data
  custom_category TEXT,                      -- AI-assigned category from categorization rules
  categorized_at TIMESTAMP WITH TIME ZONE,   -- When was this categorized?

  -- Budget associations (array of budget IDs)
  budget_ids TEXT[],                         -- Array of budget IDs this transaction matches
  budgets_updated_at TIMESTAMP WITH TIME ZONE, -- When were budgets last updated?

  -- Account metadata (cached from Plaid for faster queries)
  account_name TEXT,                         -- Human-readable account name
  institution_name TEXT,                     -- Bank/institution name

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Foreign key to ensure account connection exists
  FOREIGN KEY (item_id) REFERENCES plaid_connections(item_id) ON DELETE CASCADE
);

-- Indexes for fast queries
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_item_id ON transactions(item_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_pending ON transactions(pending) WHERE pending = true;

-- GIN index for budget_ids array queries
CREATE INDEX idx_transactions_budget_ids ON transactions USING GIN(budget_ids);

-- Composite index for budget queries (user + specific budget + date range)
CREATE INDEX idx_transactions_budget_filter
  ON transactions(user_id, date DESC)
  WHERE budget_ids IS NOT NULL AND array_length(budget_ids, 1) > 0;
```

**Run migration:**
1. Copy SQL to Supabase SQL Editor
2. Execute migration
3. Verify table created with `\dt transactions`

### 1.2 Repository Layer

**File:** `src/storage/repositories/transactions.ts`

Create pure database operations:
- `upsertTransactions()` - Insert/update transactions from Plaid
- `findTransactionsByUserId()` - Query by user and date range
- `findTransactionsByBudgetId()` - Get transactions for specific budget
- `findUncategorizedTransactions()` - Get transactions needing categorization
- `updateTransactionCategories()` - Batch update categories
- `updateTransactionBudgets()` - Update budget associations
- `deleteTransactionsByUserId()` - Cleanup when disconnecting

**Key Design:**
- TypeScript interfaces for type safety
- Conversion helpers (`rowToTransaction()`)
- Batch operations for performance
- Error handling with descriptive messages

### 1.3 Testing

**Manual Test:**
1. Run migration in Supabase
2. Create repository file
3. Write simple test script:
```typescript
// test-transactions-repo.ts
import { upsertTransactions } from "./storage/repositories/transactions.js";

const testTx = {
  transactionId: "test-tx-123",
  accountId: "acc-123",
  itemId: "item-sandbox-test",
  userId: "user-test",
  date: "2025-01-15",
  name: "Test Coffee Shop",
  amount: 5.50,
  plaidCategory: ["Food", "Coffee"],
  pending: false,
  customCategory: null,
  categorizedAt: null,
  budgetIds: null,
  budgetsUpdatedAt: null,
  accountName: "Test Checking",
  institutionName: "Test Bank",
};

await upsertTransactions([testTx]);
console.log("✓ Transaction inserted");
```

**Success Criteria:**
✅ Migration runs without errors
✅ Repository compiles (no TypeScript errors)
✅ Test transaction can be inserted and retrieved
✅ Indexes visible in Supabase

---

## Phase 2: Refresh Transactions Tool

**Goal:** Create orchestration tool to sync Plaid data to database

### 2.1 Budget Labeling Utility

**File:** `src/utils/budget-labeling.ts`

**Purpose:** Use Claude API to determine which budgets each transaction matches

**How It Works:**
1. Fetch all user transactions from database
2. For EACH budget, call `filterTransactionsForBudget()` (existing function)
3. Build map: `transaction_id -> Set<budget_id>`
4. Update database with `budget_ids` arrays

**Example:**
```typescript
// Transaction matches multiple budgets
{
  transaction_id: "txn_coffee_123",
  name: "Starbucks",
  budget_ids: ["budget-coffee-abc", "budget-food-def"]  // Matches 2 budgets
}

// Transaction matches no budgets
{
  transaction_id: "txn_rent_456",
  name: "Rent Payment",
  budget_ids: []  // No matching budgets
}
```

**Function:**
```typescript
export async function labelTransactionsForBudgets(
  userId: string,
  budgets: Budget[]
): Promise<number> {
  // Get all transactions
  const allTransactions = await findTransactionsByUserId(userId);

  // Map: transaction_id -> Set<budget_id>
  const transactionBudgetMap = new Map<string, Set<string>>();

  // For each budget, filter transactions using Claude
  for (const budget of budgets) {
    const txsForFilter = allTransactions.map(tx => ({
      id: tx.transactionId,
      date: tx.date,
      description: tx.name,
      amount: tx.amount,
      category: tx.customCategory || "Uncategorized",
      account_name: tx.accountName || "",
      pending: tx.pending,
    }));

    // Call existing Claude API filter function
    const filterResults = await filterTransactionsForBudget(
      txsForFilter,
      budget.filter_prompt
    );

    // Add budget ID to matching transactions
    for (const result of filterResults) {
      if (result.matches) {
        if (!transactionBudgetMap.has(result.transaction_id)) {
          transactionBudgetMap.set(result.transaction_id, new Set());
        }
        transactionBudgetMap.get(result.transaction_id)!.add(budget.id);
      }
    }
  }

  // Update database with budget associations
  for (const [transactionId, budgetIdSet] of transactionBudgetMap.entries()) {
    await updateTransactionBudgets(transactionId, Array.from(budgetIdSet));
  }

  // Clear budget_ids for transactions with no matches
  const txsWithoutBudgets = allTransactions.filter(
    tx => !transactionBudgetMap.has(tx.transactionId)
  );
  for (const tx of txsWithoutBudgets) {
    await updateTransactionBudgets(tx.transactionId, []);
  }

  return transactionBudgetMap.size;
}
```

### 2.2 Refresh Transactions Handler

**File:** `src/tools/transactions/refresh-transactions.ts`

**Purpose:** Main orchestration tool that syncs everything

**Steps:**
1. Get user's Plaid connections
2. Fetch all transactions from Plaid (last 2 years)
3. Upsert transactions to database (updates existing, inserts new)
4. Categorize uncategorized transactions using Claude
5. Label transactions for all user budgets
6. Return summary report

**Response Example:**
```
✅ **Transactions Refreshed**

Summary:
- Fetched: 1,234 transactions from Plaid
- Categorized: 45 new transactions
- Budget Labels: 892 transactions updated
- Connections: 2 accounts

Next Steps:
- "Get my transactions" - View categorized data
- "Check my budgets" - See budget status
- "Update my categorization rules" - Customize categories
```

### 2.3 Tool Registration

**File:** `src/tools/index.ts`

Add to tool registry:
```typescript
server.tool(
  "refresh-transactions",
  "Fetch latest transactions from connected banks, categorize new transactions, and update budget labels. Call this after connecting accounts or when you want fresh data.",
  {}, // No arguments
  async (_args, { authInfo }) => {
    const userId = authInfo?.extra?.userId as string;
    return refreshTransactionsHandler(userId, plaidClient);
  }
);
```

### 2.4 Testing

**Test Flow:**
1. Connect Plaid sandbox account
2. Call `refresh-transactions`
3. Verify database has transactions
4. Check `custom_category` populated
5. Check `budget_ids` populated (if budgets exist)

**Validation Queries:**
```sql
-- Count transactions
SELECT COUNT(*) FROM transactions WHERE user_id = 'your-user-id';

-- Check categorization
SELECT name, custom_category, categorized_at
FROM transactions
WHERE user_id = 'your-user-id'
LIMIT 10;

-- Check budget labels
SELECT name, budget_ids
FROM transactions
WHERE user_id = 'your-user-id'
  AND budget_ids IS NOT NULL
LIMIT 10;
```

**Success Criteria:**
✅ Transactions fetched from Plaid and stored
✅ All transactions have `custom_category`
✅ Budget labels populated correctly
✅ Tool returns clear summary
✅ Subsequent refreshes update existing transactions

---

## Phase 3: Update Existing Tools

**Goal:** Migrate tools to read from database instead of calling Plaid/Claude

### 3.1 Update `get-transactions` Tool

**File:** `src/tools/categorization/get-transactions.ts`

**Changes:**
- ❌ Remove: Plaid API calls
- ❌ Remove: Claude categorization calls
- ✅ Add: Database query via `findTransactionsByUserId()`

**Before:**
```typescript
// Fetch from Plaid
const response = await plaidClient.transactionsGet({ ... });

// Categorize with Claude
const categorized = await categorizeTransactions(transactions, customRules);
```

**After:**
```typescript
// Fetch from database (already categorized)
const transactions = await findTransactionsByUserId(userId, startDate, endDate);
```

**Benefits:**
- ⚡ **10x faster** (no API calls)
- 💰 **No cost** per request
- 📊 Consistent data (same view everywhere)

### 3.2 Update `get-budgets` Tool

**File:** `src/tools/budgets/get-budgets.ts`

**Changes:**
- ❌ Remove: Plaid API calls
- ❌ Remove: Claude `filterTransactionsForBudget()` calls
- ✅ Add: Database query via `findTransactionsByBudgetId()`

**Before:**
```typescript
// Fetch transactions from Plaid
const response = await plaidClient.transactionsGet({ ... });

// Filter with Claude API
const filterResults = await filterTransactionsForBudget(transactions, budget.filter_prompt);

// Extract matching transactions
const matchingTransactions = transactions.filter(tx =>
  filterResults.find(r => r.transaction_id === tx.id && r.matches)
);
```

**After:**
```typescript
// Fetch pre-labeled transactions from database
const matchingTransactions = await findTransactionsByBudgetId(
  userId,
  budget.id,
  startDate,
  endDate
);

// Calculate total (no AI needed)
const totalSpent = matchingTransactions.reduce((sum, tx) => sum + tx.amount, 0);
```

**Benefits:**
- ⚡ **100x faster** (simple database query)
- 💰 **Zero AI costs** for budget checks
- 🔄 Can check budgets unlimited times

### 3.3 Update `update-categorization-rules` Tool

**File:** `src/tools/categorization/update-rules.ts`

**Changes:**
- ✅ Add: Re-categorize ALL stored transactions when rules change

**New Behavior:**
1. User updates categorization rules
2. Save new rules to database
3. Fetch ALL user transactions from database
4. Re-categorize with Claude using new rules
5. Update `custom_category` for all transactions
6. Return summary

**Why This Matters:**
- Users can experiment with categorization rules
- Changes apply retroactively to all historical data
- Budget labels remain unchanged (budgets use `filter_prompt`, not categories)

**Example:**
```
User: "Put all Amazon purchases in Business category instead of Shopping"

System:
1. Updates categorization rules
2. Re-categorizes 1,234 transactions
3. "Amazon.com" now shows "Business" instead of "Shopping"
4. Returns: "✅ Re-categorized 1,234 transactions with new rules"
```

### 3.4 Update `upsert-budget` Tool

**File:** `src/tools/budgets/upsert-budget.ts`

**Changes:**
- ✅ Add: Trigger budget labeling after creating/updating budget

**New Behavior:**
1. User creates/updates budget
2. Save budget to database
3. Call `labelTransactionsForBudgets()` for this budget only
4. Update affected transactions with new budget ID
5. Return budget summary

**Optimization:**
- Only re-label for the new/updated budget (not all budgets)
- Other budget labels remain unchanged

### 3.5 Testing

**Test Scenarios:**

**Scenario 1: Fresh user flow**
1. Connect Plaid account
2. Call `refresh-transactions`
3. Call `get-transactions` → Returns categorized data from DB
4. Call `get-budgets` → Shows budget status
✅ All data comes from database

**Scenario 2: Update categorization**
1. Call `update-categorization-rules`
2. Call `get-transactions` → Categories updated
3. Call `get-budgets` → Budget totals unchanged
✅ Categories updated, budgets intact

**Scenario 3: Create new budget**
1. Call `upsert-budget` with new budget
2. Call `get-budgets` → Shows new budget with spending
3. Check database → `budget_ids` updated
✅ New budget labels applied

**Scenario 4: Multi-account**
1. Connect 2 Plaid accounts
2. Call `refresh-transactions`
3. Verify transactions from both accounts stored
4. Check budgets aggregate across both accounts
✅ Multi-account support works

**Success Criteria:**
✅ All tools read from database (no Plaid/Claude calls)
✅ Categorization updates apply retroactively
✅ Budget creation triggers labeling
✅ Performance improvement measurable (>10x faster)
✅ No regressions in existing functionality

---

## Implementation Order

Execute phases sequentially to avoid breaking changes:

### Phase 1 (Database Foundation)
1. ✅ Create migration `010_create_transactions.sql`
2. ✅ Run migration in Supabase
3. ✅ Create `src/storage/repositories/transactions.ts`
4. ✅ Test repository with sample data
5. ✅ Verify indexes created

### Phase 2 (Refresh Tool)
6. ✅ Create `src/utils/budget-labeling.ts`
7. ✅ Create `src/tools/transactions/refresh-transactions.ts`
8. ✅ Register `refresh-transactions` tool in registry
9. ✅ Test full refresh flow (Plaid → DB → categorize → label)
10. ✅ Validate database populated correctly

### Phase 3 (Migrate Existing Tools)
11. ✅ Update `get-transactions` to read from DB
12. ✅ Update `get-budgets` to use pre-labeled transactions
13. ✅ Update `update-categorization-rules` to recategorize all
14. ✅ Update `upsert-budget` to trigger labeling
15. ✅ Test all scenarios end-to-end
16. ✅ Deploy to production

---

## Performance Comparison

### Before (Current System)

**User calls `get-budgets` with 3 budgets:**
1. Fetch transactions from Plaid: ~2-3 seconds
2. Call Claude to filter for Budget A: ~3-4 seconds
3. Call Claude to filter for Budget B: ~3-4 seconds
4. Call Claude to filter for Budget C: ~3-4 seconds
5. **Total: ~11-15 seconds**
6. **Cost: 3 Claude API calls** (~$0.15)

**User calls `get-budgets` 10 times per day:**
- Time: 110-150 seconds (2.5 minutes)
- Cost: 30 Claude API calls (~$1.50/day)

### After (New System)

**User calls `refresh-transactions` once per day:**
1. Fetch from Plaid: ~2-3 seconds
2. Categorize new transactions: ~3-4 seconds
3. Label for 3 budgets: ~9-12 seconds
4. **Total: ~14-19 seconds**
5. **Cost: 3-4 Claude API calls** (~$0.20)

**User calls `get-budgets` 10 times per day:**
1. Database query: ~100ms
2. **Total: 1 second (for 10 calls)**
3. **Cost: $0**

**Savings:**
- ⚡ **99% faster** for budget checks (100ms vs 15 seconds)
- 💰 **87% cost reduction** ($0.20/day vs $1.50/day)
- 🔄 Can check budgets unlimited times at no cost

---

## Benefits Summary

### Performance
✅ Budget queries: **100x faster** (15s → 100ms)
✅ Transaction retrieval: **10x faster** (3s → 300ms)
✅ Categorization: Runs **once per transaction** instead of every API call

### Scalability
✅ Supports **thousands of transactions** efficiently
✅ Budget queries use **indexed columns** (no table scans)
✅ Can add unlimited budgets without performance degradation

### User Experience
✅ Persistent data (doesn't disappear after session)
✅ Update categorization rules → Apply retroactively
✅ Create budgets → Instant results
✅ User controls refresh frequency

### Cost Savings
✅ Categorization: **Once per transaction** (not per API call)
✅ Budget filtering: **Once during refresh** (not per budget check)
✅ **87% reduction** in Claude API costs

### Developer Experience
✅ Clean separation: Storage vs. Enrichment
✅ Repository pattern: Easy to test and maintain
✅ Batch operations: Efficient database usage
✅ Type-safe: Full TypeScript support

---

## Future Enhancements

**After this pipeline is stable, consider:**

1. **Incremental Refresh**
   - Only fetch new transactions since last refresh
   - Use Plaid's cursor-based pagination
   - Faster refresh times for large datasets

2. **Webhook Integration**
   - Plaid webhooks trigger automatic refresh
   - Real-time transaction updates
   - No manual refresh needed

3. **Smart Batching**
   - Dynamically adjust batch sizes based on transaction count
   - Optimize Claude API usage
   - Balance speed vs. cost

4. **Category Analytics**
   - Track category changes over time
   - Show trending categories
   - Detect anomalies in spending patterns

5. **Budget Forecasting**
   - Predict end-of-period spending
   - Alert before budget exceeded
   - Suggest budget adjustments

6. **Multi-User Budgets**
   - Share budgets with family/partners
   - Track household spending
   - Split expenses automatically
