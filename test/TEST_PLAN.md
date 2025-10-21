# Integration Test Plan - New Features

This document outlines the test coverage gaps for recently added features and provides a plan for comprehensive integration testing before refactoring.

## Recent Features Requiring Test Coverage

### 1. Account Balances Feature (✅ Partially Covered)
**Implemented:** 2025-10-16 (commits: 83112d5, b75a6cd, 09b6e61)

**What Changed:**
- Created `accounts` table (migration 013)
- Added `get-account-balances` tool
- Account data automatically fetched during OAuth callback
- Account balances refreshed during transaction syncs
- ChatGPT widget for displaying balances

**Current Coverage:**
- ✅ OAuth callback creates accounts ([oauth-transaction-sync.test.ts](integration/oauth-transaction-sync.test.ts))
- ❌ **MISSING:** `get-account-balances` tool handler test
- ❌ **MISSING:** Account balance widget metadata test
- ❌ **MISSING:** Net worth calculation test
- ❌ **MISSING:** Account grouping by type test

---

### 2. Background Transaction Sync (✅ Well Covered)
**Implemented:** 2025-10-16 (commit: 3fcbecc)

**What Changed:**
- Fire-and-forget transaction sync after OAuth callback
- Created `account_sync_state` table (migrations 014-015)
- Cursor-based pagination with Plaid `/transactions/sync`
- Per-account sync state tracking
- Automatic categorization during sync

**Current Coverage:**
- ✅ Background sync triggers after OAuth ([oauth-transaction-sync.test.ts](integration/oauth-transaction-sync.test.ts))
- ✅ Sync state tracking ([oauth-transaction-sync.test.ts](integration/oauth-transaction-sync.test.ts))
- ✅ Error handling for failed syncs ([oauth-transaction-sync.test.ts](integration/oauth-transaction-sync.test.ts))
- ✅ Transaction categorization during sync ([oauth-transaction-sync.test.ts](integration/oauth-transaction-sync.test.ts))

---

### 3. Async Recategorization (❌ No Coverage)
**Implemented:** 2025-10-17 (commits: 684e6b8, 6c4141e)

**What Changed:**
- Created `recategorization-service.ts`
- `update-categorization-rules` now uses fire-and-forget pattern
- Recategorizes ALL user transactions in background
- Returns immediately to user (no blocking)

**Current Coverage:**
- ❌ **MISSING:** All tests for async recategorization
- ❌ **MISSING:** Fire-and-forget behavior test
- ❌ **MISSING:** Bulk transaction update test
- ❌ **MISSING:** Error handling test (service fails silently)
- ❌ **MISSING:** Rules storage and retrieval test

---

### 4. Budget Labeling During Sync (❌ No Coverage)
**Implemented:** 2025-10-21 (commit: d8e0201)

**What Changed:**
- Created `budget-labeling.ts` utility
- Transactions automatically labeled with matching budget IDs during sync
- Budget matches stored in `budget_ids` array column on transactions
- Speeds up budget queries (pre-computed matches)

**Current Coverage:**
- ❌ **MISSING:** Budget labeling during transaction sync
- ❌ **MISSING:** Budget match algorithm test
- ❌ **MISSING:** Budget ID array storage test
- ❌ **MISSING:** Budget query performance (pre-labeled vs real-time matching)

---

### 5. Cron Jobs (❌ No Coverage)
**Implemented:** 2025-10-18 (commit: bb63318)

**What Changed:**
- Created cron infrastructure (`src/cron/`)
- `sync-transactions` job (production only)
- `sync-transactions-sandbox` job (testing only)
- `UserBatchSyncService` for multi-user syncing
- `CronLogger` utility for structured logging

**Current Coverage:**
- ❌ **MISSING:** All cron job tests
- ❌ **MISSING:** Batch sync service test
- ❌ **MISSING:** Environment validation test (production vs sandbox)
- ❌ **MISSING:** Multi-user sync test
- ❌ **MISSING:** Cron logger test

---

### 6. ChatGPT Widgets (✅ Partially Covered)
**Implemented:** 2025-10-17 - 2025-10-20 (commits: 09b6e61, 8da78e5, b75a6cd, 00e662f)

**What Changed:**
- Widget for `get-account-balances` tool
- Widget for `get-budgets` tool
- Widget for `check-connection-status` tool
- Custom `tools/list` handler wrapper to inject `_meta`
- Build process for widget TypeScript → JavaScript

**Current Coverage:**
- ✅ Widget metadata in `tools/list` response ([mcp-widget-metadata.test.ts](integration/mcp-widget-metadata.test.ts))
- ✅ Widget resource definitions ([mcp-widget-metadata.test.ts](integration/mcp-widget-metadata.test.ts))
- ✅ Widget HTML templates ([mcp-widget-metadata.test.ts](integration/mcp-widget-metadata.test.ts))
- ❌ **MISSING:** Widget data format validation (structured content)
- ❌ **MISSING:** Multiple widgets per tool test

---

### 7. Improved Transaction Cursor Management (❌ No Coverage)
**Implemented:** 2025-10-20 (commit: cd4d52d)

**What Changed:**
- Fixed cursor persistence bug in `TransactionSyncService`
- Cursor now read BEFORE updating sync state
- Better handling of initial syncs (no cursor) vs incremental syncs (with cursor)
- Improved logging for cursor-based pagination

**Current Coverage:**
- ❌ **MISSING:** Cursor persistence test (initial → incremental)
- ❌ **MISSING:** Cursor read-before-update test
- ❌ **MISSING:** Pagination across multiple pages test

---

## Proposed New Integration Tests

### Test File 1: `test/integration/account-balances.test.ts`
**Purpose:** Test account balance tool and data flow

**Test Cases:**
1. ✅ Should return error when no accounts connected
2. ✅ Should fetch and return account balances
3. ✅ Should calculate net worth correctly (assets - liabilities)
4. ✅ Should group accounts by type (depository, credit, loan, investment)
5. ✅ Should include widget metadata in response
6. ✅ Should format balances with 2 decimal places
7. ✅ Should show last synced timestamp
8. ✅ Should handle accounts with null balances

---

### Test File 2: `test/integration/async-recategorization.test.ts`
**Purpose:** Test async recategorization service and fire-and-forget pattern

**Test Cases:**
1. ✅ Should save custom rules to storage
2. ✅ Should return immediately (fire-and-forget)
3. ✅ Should recategorize all transactions in background
4. ✅ Should handle errors silently (no crash)
5. ✅ Should update transaction categories in database
6. ✅ Should show success message before recategorization completes
7. ✅ Should handle empty transaction list
8. ✅ Should poll for recategorization completion

---

### Test File 3: `test/integration/budget-labeling.test.ts`
**Purpose:** Test automatic budget labeling during transaction sync

**Test Cases:**
1. ✅ Should label transactions with matching budget IDs during sync
2. ✅ Should store budget IDs in `budget_ids` array column
3. ✅ Should match transactions across multiple budgets
4. ✅ Should handle transactions with no matching budgets
5. ✅ Should use pre-labeled data in `get-budgets` tool
6. ✅ Should re-label when budget rules change
7. ✅ Should handle overlapping budget filters
8. ✅ Should perform faster than real-time budget matching

---

### Test File 4: `test/integration/cron-jobs.test.ts`
**Purpose:** Test cron job infrastructure and batch sync

**Test Cases:**
1. ✅ Should run sync-transactions job successfully
2. ✅ Should sync all users with connections
3. ✅ Should filter by environment (production vs sandbox)
4. ✅ Should handle errors for individual users without crashing
5. ✅ Should log sync progress and results
6. ✅ Should validate environment before running production job
7. ✅ Should skip users with no connections
8. ✅ Should update sync state for each account

---

### Test File 5: `test/integration/transaction-cursor.test.ts`
**Purpose:** Test cursor-based transaction sync pagination

**Test Cases:**
1. ✅ Should start sync with no cursor (initial sync)
2. ✅ Should store cursor after first page
3. ✅ Should use stored cursor for subsequent syncs (incremental)
4. ✅ Should paginate through multiple pages
5. ✅ Should handle `has_more` flag correctly
6. ✅ Should preserve cursor on sync state update
7. ✅ Should handle cursor reset (full resync)
8. ✅ Should track total transactions across all pages

---

### Test File 6: `test/integration/widget-data-formats.test.ts`
**Purpose:** Test ChatGPT widget data formats and structured content

**Test Cases:**
1. ✅ Should include `structuredContent` in tool responses
2. ✅ Should format budget widget data correctly
3. ✅ Should format account balance widget data correctly
4. ✅ Should format connection status widget data correctly
5. ✅ Should handle empty data gracefully
6. ✅ Should include all required widget fields
7. ✅ Should validate widget data matches TypeScript interfaces
8. ✅ Should handle multiple institutions in widget data

---

## Test Patterns and Best Practices

Based on existing tests ([oauth-transaction-sync.test.ts](integration/oauth-transaction-sync.test.ts), [budget-tools.test.ts](integration/budget-tools.test.ts)), we should:

### 1. Mock Infrastructure
- Use `MockPlaidClient` for Plaid API calls
- Use `MockSupabaseClient` for database operations
- Set `ANTHROPIC_API_KEY` to mock value to skip real API calls
- Mock `categorizeTransactions` function for fast tests

### 2. Test Structure
```typescript
describe("Feature Name Integration Tests", () => {
  let mockPlaidClient: any;
  let mockSupabase: any;
  const testUserId = "test-user-feature-name";

  before(() => {
    // Set up mocks
    mockPlaidClient = new MockPlaidClient();
    mockSupabase = new MockSupabaseClient();
    setSupabaseMock(mockSupabase);
  });

  beforeEach(() => {
    // Clear mock data between tests
    mockSupabase.clear();
  });

  after(() => {
    // Cleanup
    resetSupabase();
  });

  it("should test something", async () => {
    // Test implementation
  });
});
```

### 3. Async Pattern Testing
For fire-and-forget patterns (transaction sync, recategorization):
- Use polling with timeout (max 10 seconds)
- Check database state (sync_state table, transactions table)
- Verify background operation completed
- Test error handling (operation should not crash)

### 4. Widget Testing
- Verify `_meta` field structure
- Validate `structuredContent` format
- Check `openai/outputTemplate` URI
- Test widget data completeness

---

## Priority Order

1. **HIGH:** `async-recategorization.test.ts` - Critical new feature, no coverage
2. **HIGH:** `budget-labeling.test.ts` - Critical new feature, no coverage
3. **MEDIUM:** `account-balances.test.ts` - Expand existing partial coverage
4. **MEDIUM:** `transaction-cursor.test.ts` - Important for data integrity
5. **LOW:** `cron-jobs.test.ts` - Can be tested manually in production
6. **LOW:** `widget-data-formats.test.ts` - Widget metadata already tested

---

## Next Steps

1. Write tests in priority order (HIGH → LOW)
2. Run `npm test` after each test file is created
3. Ensure all tests pass before proceeding to refactoring
4. Update [test/README.md](README.md) with new test files
5. Add test coverage to CI/CD pipeline if not already present

---

## Test Metrics Goal

- **Target Coverage:** 90%+ for new features
- **Current Coverage:** ~60% (estimated)
- **Gap:** 6 new test files, ~48 test cases

**After completing these tests:**
- ✅ All major features will have integration test coverage
- ✅ Refactoring can be done safely with confidence
- ✅ Regression detection will be automated
- ✅ Future feature development will have test examples to follow
