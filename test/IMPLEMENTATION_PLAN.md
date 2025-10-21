# Test Implementation Plan - 4 Priority Tests

This document provides detailed implementation specifications for the 4 priority integration tests, including comprehensive mocking strategies to avoid using API credits.

## Quick Reference Links

### Related Documentation
- [Test Plan Overview](TEST_PLAN.md) - High-level test strategy and feature analysis
- [Test README](README.md) - How to run tests and current test coverage
- [CLAUDE.md](../CLAUDE.md) - Project overview and development guidelines

### Existing Test Files (Reference Examples)
- [oauth-transaction-sync.test.ts](integration/oauth-transaction-sync.test.ts) - Background sync pattern with polling
- [budget-tools.test.ts](integration/budget-tools.test.ts) - Tool handler testing patterns
- [plaid-tools.test.ts](integration/plaid-tools.test.ts) - Plaid API mocking examples

### Existing Mock Files
- [plaid-mock.ts](mocks/plaid-mock.ts) - Mock Plaid API client (reference implementation)
- [supabase-mock.ts](mocks/supabase-mock.ts) - Mock Supabase client (needs enhancement)
- [clerk-mock.ts](mocks/clerk-mock.ts) - Mock Clerk auth (for future use)

### Source Files to Test
- [recategorization-service.ts](../src/services/recategorization-service.ts) - Async recategorization logic
- [budget-labeling.ts](../src/utils/budget-labeling.ts) - Budget labeling logic
- [account handlers](../src/tools/accounts/handlers.ts) - Account balance tool (getAccountBalancesHandler)
- [cron jobs](../src/cron/jobs/) - Cron job infrastructure
- [claude.ts](../src/utils/clients/claude.ts) - Claude API client (needs mocking)

### Database Schema References
- [Migration 013](../migrations/013_create_accounts_table.sql) - Accounts table schema
- [Migration 014-015](../migrations/014_add_account_id_unique_constraint.sql) - Account sync state tables
- [Database Types](../src/storage/database.types.ts) - Auto-generated TypeScript types

---

## Third-Party API Dependencies

Our code uses these external APIs that need mocking:

1. **Anthropic Claude API** - Used for:
   - Transaction categorization (`categorizeTransactions`)
   - Budget filtering (`filterTransactionsForBudget`)

2. **Plaid API** - Used for:
   - Account connections (`linkTokenCreate`, `itemPublicTokenExchange`)
   - Account balances (`accountsGet`)
   - Transaction syncing (`transactionsSync`)

3. **Supabase Database** - Used for:
   - All data persistence (already mocked in `MockSupabaseClient`)

---

## Mock Infrastructure Setup

### New Mock: Claude API Client

**Location:** `test/mocks/claude-mock.ts`

**Purpose:** Mock all Claude API calls to avoid using Anthropic API credits

```typescript
/**
 * Mock Claude API client for testing
 * Prevents actual API calls and provides deterministic responses
 */
export class MockClaudeClient {
  /**
   * Mock categorization function
   * Returns simple categories without calling Claude API
   */
  static categorizeTransactions(
    transactions: TransactionForCategorization[],
    customRules?: string
  ): CategorizedTransaction[] {
    return transactions.map((tx) => {
      // Simple rule-based categorization for testing
      let category = "Other";

      const desc = tx.description.toLowerCase();

      if (desc.includes("coffee") || desc.includes("starbucks")) {
        category = "Food & Dining";
      } else if (desc.includes("grocery") || desc.includes("whole foods")) {
        category = "Food & Dining";
      } else if (desc.includes("gas") || desc.includes("shell")) {
        category = "Transportation";
      } else if (desc.includes("amazon") || desc.includes("target")) {
        category = "Shopping";
      } else if (desc.includes("netflix") || desc.includes("spotify")) {
        category = "Entertainment";
      } else if (desc.includes("interest") || desc.includes("payroll")) {
        category = "Income";
      }

      // Apply custom rules if provided (simple keyword matching)
      if (customRules) {
        const rulesLower = customRules.toLowerCase();
        if (rulesLower.includes("amazon") && rulesLower.includes("business")) {
          if (desc.includes("amazon")) {
            category = "Business";
          }
        }
      }

      return {
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        custom_category: category,
      };
    });
  }

  /**
   * Mock budget filter function
   * Returns simple matches without calling Claude API
   */
  static filterTransactionsForBudget(
    transactions: TransactionForBudgetFilter[],
    filterPrompt: string
  ): BudgetFilterResult[] {
    return transactions.map((tx) => {
      const promptLower = filterPrompt.toLowerCase();
      const descLower = tx.description.toLowerCase();

      // Simple keyword matching
      let matches = false;
      let reason = "Does not match budget criteria";

      // Extract keywords from filter prompt
      const keywords = promptLower.match(/\b[a-z]+\b/g) || [];

      for (const keyword of keywords) {
        if (keyword.length > 3 && descLower.includes(keyword)) {
          matches = true;
          reason = `Matches keyword: ${keyword}`;
          break;
        }
      }

      return {
        transaction_id: tx.id,
        matches,
        reason,
      };
    });
  }
}
```

### Enhanced Mock: Supabase Client

**Location:** `test/mocks/supabase-mock.ts`

**New tables to add:**
- `accounts` table (for account balances test)
- `transactions` table (for recategorization and budget labeling tests)
- `categorization_rules` table (for custom rules storage)
- `account_sync_state` table (already exists, verify support)

**Methods to add:**
```typescript
export class MockSupabaseClient {
  private sessions: Map<string, any> = new Map();
  private connections: Map<string, any> = new Map();
  private budgets: Map<string, any> = new Map();
  private accounts: Map<string, any> = new Map();  // NEW
  private transactions: Map<string, any> = new Map();  // NEW
  private categorizationRules: Map<string, any> = new Map();  // NEW
  private syncStates: Map<string, any> = new Map();  // NEW

  // Add support for accounts table
  // Add support for transactions table with budget_ids array
  // Add support for categorization_rules table
  // Add support for account_sync_state table
}
```

---

## Test 1: Async Recategorization

**File:** `test/integration/async-recategorization.test.ts`

### Overview
Tests that `update-categorization-rules` tool:
1. Saves custom rules to storage
2. Returns immediately (fire-and-forget)
3. Recategorizes all transactions in background
4. Updates transaction categories in database

### Mocking Strategy

**Mock Claude API:**
```typescript
// Mock the categorizeTransactions function
import * as claudeModule from "../../src/utils/clients/claude.js";

// Override categorizeTransactions in tests
const mockCategorize = vi.fn((transactions, rules) => {
  return MockClaudeClient.categorizeTransactions(transactions, rules);
});

// Stub the import
vi.mock("../../src/utils/clients/claude.js", () => ({
  categorizeTransactions: mockCategorize,
}));
```

**Mock Supabase:**
- Use existing `MockSupabaseClient`
- Add support for `categorization_rules` table
- Add support for `transactions` table with `custom_category` column

### Test Cases (4 Essential Tests)

```typescript
describe("Async Recategorization Integration Tests", () => {
  let mockSupabase: MockSupabaseClient;
  let mockCategorize: any;
  const testUserId = "test-user-recategorization";

  before(() => {
    // Set up mocks
    mockSupabase = new MockSupabaseClient();
    setSupabaseMock(mockSupabase);

    // Mock Claude API
    mockCategorize = vi.fn(MockClaudeClient.categorizeTransactions);
  });

  beforeEach(() => {
    mockSupabase.clear();
    mockCategorize.mockClear();
  });

  it("should save custom rules and return immediately (fire-and-forget)", async () => {
    // Populate with 50 transactions
    // Call update-categorization-rules with custom rule
    // Verify response returned in < 500ms
    // Verify response says "background recategorization started"
    // Verify rules are stored in categorization_rules table
  });

  it("should recategorize all transactions in background", async () => {
    // Populate with 20 transactions (mix of Amazon, Starbucks, etc.)
    // Call update-categorization-rules with "Amazon = Business"
    // Poll database for updated custom_category values
    // Verify all transactions were updated within 5 seconds
    // Verify Amazon transactions are now "Business"
  });

  it("should handle empty transaction list", async () => {
    // No transactions exist
    // Call update-categorization-rules
    // Verify response says "no transactions to recategorize"
    // Verify mockCategorize was NOT called
  });

  it("should handle errors silently without crashing", async () => {
    // Create 10 transactions
    // Mock categorizeTransactions to throw error
    // Call update-categorization-rules
    // Verify tool returns successfully (doesn't throw)
    // Verify error is logged but handler completed
  });
});
```

### Key Implementation Details

**Polling Pattern:**
```typescript
// Wait for recategorization to complete
const maxWaitMs = 5000;
const pollIntervalMs = 200;
const startTime = Date.now();

let allRecategorized = false;
while (!allRecategorized && Date.now() - startTime < maxWaitMs) {
  const transactions = await findTransactionsByUserId(testUserId);
  const categorizedCount = transactions.filter(
    (tx) => tx.customCategory !== null
  ).length;

  if (categorizedCount === transactions.length) {
    allRecategorized = true;
  } else {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

assert(allRecategorized, "All transactions should be recategorized within timeout");
```

---

## Test 2: Budget Labeling During Sync

**File:** `test/integration/budget-labeling.test.ts`

### Overview
Tests that transactions are automatically labeled with matching budget IDs during sync:
1. Budget matches are stored in `budget_ids` array column
2. Matching happens for all budgets
3. `get-budgets` tool uses pre-labeled data (fast queries)

### Mocking Strategy

**Mock Claude API:**
```typescript
// Mock filterTransactionsForBudget
const mockBudgetFilter = vi.fn((transactions, filterPrompt) => {
  return MockClaudeClient.filterTransactionsForBudget(transactions, filterPrompt);
});

vi.mock("../../src/utils/clients/claude.js", () => ({
  filterTransactionsForBudget: mockBudgetFilter,
  categorizeTransactions: vi.fn(MockClaudeClient.categorizeTransactions),
}));
```

**Mock Plaid API:**
- Use existing `MockPlaidClient`
- Ensure `transactionsSync` returns varied transactions

**Mock Supabase:**
- Use `MockSupabaseClient`
- Add support for `budget_ids` array column on transactions

### Test Cases (4 Essential Tests)

```typescript
describe("Budget Labeling Integration Tests", () => {
  let mockSupabase: MockSupabaseClient;
  let mockPlaidClient: MockPlaidClient;
  let mockBudgetFilter: any;
  const testUserId = "test-user-budget-labeling";

  before(() => {
    mockSupabase = new MockSupabaseClient();
    mockPlaidClient = new MockPlaidClient();
    setSupabaseMock(mockSupabase);

    mockBudgetFilter = vi.fn(MockClaudeClient.filterTransactionsForBudget);
  });

  beforeEach(() => {
    mockSupabase.clear();
    mockBudgetFilter.mockClear();
  });

  it("should label transactions with matching budget IDs during sync", async () => {
    // Create budget: "Coffee Budget" with filter "Starbucks, Dunkin"
    // Trigger transaction sync (has Starbucks transaction)
    // Poll for transactions to be synced and labeled
    // Verify Starbucks transaction has budget_ids array with coffee budget ID
    // Verify budget_ids is stored as array: ["budget-id-123"]
  });

  it("should match transactions across multiple budgets", async () => {
    // Create 3 budgets with overlapping filters:
    //   - "Coffee" (matches "Starbucks")
    //   - "Food & Dining" (matches "Starbucks")
    //   - "Groceries" (matches "Whole Foods")
    // Sync transactions: "Starbucks Coffee" and "Whole Foods"
    // Verify Starbucks has 2 budget IDs
    // Verify Whole Foods has 1 budget ID
  });

  it("should handle transactions with no matching budgets", async () => {
    // Create budget: "Groceries" (only matches grocery stores)
    // Sync transaction "Shell Gas Station"
    // Verify gas transaction.budget_ids is empty array []
    // Verify no errors thrown
  });

  it("should use pre-labeled data in get-budgets tool", async () => {
    // Create budget and sync 10 transactions (5 match, 5 don't)
    // Call get-budgets tool
    // Verify spending total includes only the 5 matching transactions
    // Verify query completed in < 200ms (using pre-labeled budget_ids)
  });
});
```

### Key Implementation Details

**Test Pre-Labeling Performance:**
```typescript
// Pre-labeled query (using budget_ids column)
const startPreLabeled = Date.now();
const budgetsPreLabeled = await getBudgetsHandler(testUserId, {}, mockPlaidClient);
const timePreLabeled = Date.now() - startPreLabeled;

console.log(`Pre-labeled query time: ${timePreLabeled}ms`);
assert(timePreLabeled < 100, "Pre-labeled query should be < 100ms");

// Note: We can't test real-time filtering speed without actually calling Claude API
// But we can assert the pre-labeled approach is fast
```

---

## Test 3: Account Balances Tool

**File:** `test/integration/account-balances.test.ts`

### Overview
Tests the `get-account-balances` tool:
1. Fetches account data from database
2. Calculates net worth (assets - liabilities)
3. Groups accounts by type
4. Returns widget metadata

### Mocking Strategy

**Mock Plaid API:**
- Use existing `MockPlaidClient`
- Ensure `accountsGet` returns varied account types

**Mock Supabase:**
- Use `MockSupabaseClient`
- Add support for `accounts` table

### Test Cases (4 Essential Tests)

```typescript
describe("Account Balances Integration Tests", () => {
  let mockSupabase: MockSupabaseClient;
  const testUserId = "test-user-accounts";

  before(() => {
    mockSupabase = new MockSupabaseClient();
    setSupabaseMock(mockSupabase);
  });

  beforeEach(() => {
    mockSupabase.clear();
  });

  it("should return error when no accounts connected", async () => {
    const result = await getAccountBalancesHandler(testUserId);

    assert(result.content[0].text.includes("No Accounts Found"));
    assert(result.content[0].text.includes("Connect my account"));
  });

  it("should fetch and return account balances with proper formatting", async () => {
    // Create 2 accounts in database
    await mockSupabase.from("accounts").insert([
      {
        account_id: "acc_checking",
        user_id: testUserId,
        item_id: "item_1",
        name: "Checking Account",
        type: "depository",
        subtype: "checking",
        current_balance: 1234.50,
        available_balance: 1200.00,
        created_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      },
      {
        account_id: "acc_savings",
        user_id: testUserId,
        item_id: "item_1",
        name: "Savings Account",
        type: "depository",
        subtype: "savings",
        current_balance: 5000.00,
        available_balance: 5000.00,
        created_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      },
    ]);

    const result = await getAccountBalancesHandler(testUserId);

    // Verify formatting with 2 decimal places
    assert(result.content[0].text.includes("$1,234.50"));
    assert(result.content[0].text.includes("$5,000.00"));
    // Verify last synced info present
    assert(result.content[0].text.includes("Last synced"));
  });

  it("should calculate net worth correctly (assets - liabilities)", async () => {
    // Create mixed accounts:
    // - Checking: $1,000 (asset)
    // - Savings: $5,000 (asset)
    // - Credit Card: -$500 (liability - negative balance)
    // Expected net worth: $6,000 - $500 = $5,500

    await mockSupabase.from("accounts").insert([
      { type: "depository", subtype: "checking", current_balance: 1000, user_id: testUserId },
      { type: "depository", subtype: "savings", current_balance: 5000, user_id: testUserId },
      { type: "credit", subtype: "credit card", current_balance: -500, user_id: testUserId },
    ]);

    const result = await getAccountBalancesHandler(testUserId);

    assert(result.content[0].text.includes("Net Worth: $5,500.00"));
    // Verify accounts grouped by type
    assert(result.content[0].text.includes("Depository Accounts"));
    assert(result.content[0].text.includes("Credit Accounts"));
  });

  it("should include widget metadata in response", async () => {
    // Create at least 1 account
    await mockSupabase.from("accounts").insert({
      account_id: "acc_1",
      user_id: testUserId,
      type: "depository",
      current_balance: 1000,
    });

    const result = await getAccountBalancesHandler(testUserId);

    assert(result._meta, "Should have widget metadata");
    assert.equal(
      result._meta["openai/outputTemplate"],
      "ui://widget/connected-institutions.html"
    );
    assert(result.structuredContent, "Should have structured content for widget");
    assert(result.structuredContent.institutions, "Should have institutions array");
  });
});
```

### Key Implementation Details

**Net Worth Calculation Test:**
```typescript
// Create test accounts
const accounts = [
  { type: "depository", subtype: "checking", current_balance: 1000 },   // Asset
  { type: "depository", subtype: "savings", current_balance: 5000 },    // Asset
  { type: "credit", subtype: "credit card", current_balance: -500 },    // Liability (negative)
  { type: "loan", subtype: "student", current_balance: -2000 },         // Liability (negative)
];

for (const acc of accounts) {
  await mockSupabase.from("accounts").insert({
    ...acc,
    account_id: `acc_${acc.subtype}`,
    user_id: testUserId,
    item_id: "item_1",
    name: acc.subtype,
  });
}

const result = await getAccountBalancesHandler(testUserId);

// Assets: 1000 + 5000 = 6000
// Liabilities: 500 + 2000 = 2500
// Net Worth: 6000 - 2500 = 3500
assert(result.content[0].text.includes("Net Worth: $3,500.00"));
```

---

## Test 4: Cron Job Infrastructure

**File:** `test/integration/cron-jobs.test.ts`

### Overview
Tests cron job runner and infrastructure (NOT the underlying business logic):
1. Runner executes registered jobs
2. Environment validation works
3. Error handling isolates job failures
4. Logging captures output

### Mocking Strategy

**Mock Plaid API:**
- Use `MockPlaidClient` for any connection checks

**Mock Supabase:**
- Use `MockSupabaseClient` for connection queries

**Mock Business Logic:**
- Do NOT test `TransactionSyncService` (tested elsewhere)
- Do NOT test `UserBatchSyncService` internals
- ONLY test that cron runner calls the expected functions

### Test Cases (4 Essential Tests - Focus on Infrastructure, Not Business Logic)

```typescript
describe("Cron Job Infrastructure Tests", () => {
  let mockSupabase: MockSupabaseClient;
  let originalEnv: string | undefined;
  const testUserId = "test-user-cron";

  before(() => {
    mockSupabase = new MockSupabaseClient();
    setSupabaseMock(mockSupabase);
    originalEnv = process.env.PLAID_ENV;
  });

  beforeEach(() => {
    mockSupabase.clear();
  });

  after(() => {
    process.env.PLAID_ENV = originalEnv;
  });

  it("should validate environment before running production job", async () => {
    // Set PLAID_ENV=sandbox (wrong environment)
    process.env.PLAID_ENV = "sandbox";

    // Try to run production job
    try {
      await syncTransactionsJob.run();
      assert.fail("Should have thrown error");
    } catch (error) {
      // Verify error message mentions environment requirement
      assert(error.message.includes("PLAID_ENV=production"));
    }
  });

  it("should run sync-transactions job with correct environment", async () => {
    // Set PLAID_ENV=production
    process.env.PLAID_ENV = "production";

    // Create a production connection
    await mockSupabase.from("plaid_connections").insert({
      user_id: testUserId,
      item_id: "item_prod_1",
      access_token: "access_prod_token",
      plaid_env: "production",
      created_at: new Date().toISOString(),
    });

    // Run the job (should not throw)
    await syncTransactionsJob.run();

    // Verify job completed (no assertion needed - if it throws, test fails)
  });

  it("should filter connections by environment (production vs sandbox)", async () => {
    // Create 2 connections: 1 production, 1 sandbox
    await mockSupabase.from("plaid_connections").insert([
      {
        user_id: testUserId,
        item_id: "item_prod",
        access_token: "access_prod",
        plaid_env: "production",
        created_at: new Date().toISOString(),
      },
      {
        user_id: `${testUserId}_sandbox`,
        item_id: "item_sandbox",
        access_token: "access_sandbox",
        plaid_env: "sandbox",
        created_at: new Date().toISOString(),
      },
    ]);

    // Run production job
    process.env.PLAID_ENV = "production";
    await syncTransactionsJob.run();

    // Run sandbox job
    await syncTransactionsSandboxJob.run();

    // Both jobs should complete without errors
    // (We're not testing business logic, just that jobs run)
  });

  it("should list all registered cron jobs", async () => {
    // This test verifies cron runner infrastructure
    // Import runner with job registry
    const runner = await import("../../src/cron/runner.js");

    // Verify jobs are registered
    // (Implementation detail: check if runner exports job list or has getJobs())
    // For now, just verify we can import sync jobs
    const { syncTransactionsJob } = await import("../../src/cron/jobs/sync-transactions.js");
    const { syncTransactionsSandboxJob } = await import("../../src/cron/jobs/sync-transactions-sandbox.js");

    assert(syncTransactionsJob, "Production sync job should be defined");
    assert(syncTransactionsSandboxJob, "Sandbox sync job should be defined");
    assert.equal(syncTransactionsJob.name, "sync-transactions");
    assert.equal(syncTransactionsSandboxJob.name, "sync-transactions-sandbox");
  });
});
```

### Key Implementation Details

**Spy on Business Logic:**
```typescript
// Spy on UserBatchSyncService to verify it was called
import * as batchSyncModule from "../../src/cron/services/user-batch-sync.service.js";

const syncAllUsersSpy = vi.spyOn(
  batchSyncModule.UserBatchSyncService.prototype,
  "syncAllUsers"
);

// Run job
await syncTransactionsJob.run();

// Verify spy was called
assert(syncAllUsersSpy.called, "UserBatchSyncService.syncAllUsers should be called");
assert.equal(syncAllUsersSpy.callCount, 1, "Should call syncAllUsers exactly once");

// Verify it was called with correct environment filter
const callArgs = syncAllUsersSpy.calls[0].args[0];
assert.equal(callArgs.environment, "production");
```

---

## Mock Organization Summary

### Files to Create/Update

1. **NEW:** `test/mocks/claude-mock.ts`
   - `MockClaudeClient` class
   - `categorizeTransactions()` method
   - `filterTransactionsForBudget()` method

2. **UPDATE:** `test/mocks/supabase-mock.ts`
   - Add `accounts` Map and support
   - Add `transactions` Map with `budget_ids` array support
   - Add `categorization_rules` Map and support
   - Add `account_sync_state` Map (verify exists)

3. **EXISTING:** `test/mocks/plaid-mock.ts`
   - Already supports all needed Plaid endpoints
   - No changes required

### Mock Usage Pattern

```typescript
// Standard test setup
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import { MockSupabaseClient } from "../mocks/supabase-mock.js";
import { MockClaudeClient } from "../mocks/claude-mock.js";  // NEW
import { setSupabaseMock } from "../../src/storage/supabase.js";

// Mock Claude API module
vi.mock("../../src/utils/clients/claude.js", () => ({
  categorizeTransactions: vi.fn(MockClaudeClient.categorizeTransactions),
  filterTransactionsForBudget: vi.fn(MockClaudeClient.filterTransactionsForBudget),
}));

// Set up test environment
before(() => {
  process.env.ANTHROPIC_API_KEY = "mock-api-key";
  const mockSupabase = new MockSupabaseClient();
  setSupabaseMock(mockSupabase);
});
```

---

## Execution Plan

### Phase 1: Create Mock Infrastructure (20 mins)
1. Create `test/mocks/claude-mock.ts`
2. Update `test/mocks/supabase-mock.ts` with new tables
3. Test mocks in isolation (simple unit tests)

### Phase 2: Write Test 1 - Async Recategorization (30 mins)
1. Create `test/integration/async-recategorization.test.ts`
2. Implement 4 test cases
3. Run `npm test` and verify all pass

### Phase 3: Write Test 2 - Budget Labeling (40 mins)
1. Create `test/integration/budget-labeling.test.ts`
2. Implement 4 test cases
3. Run `npm test` and verify all pass

### Phase 4: Write Test 3 - Account Balances (25 mins)
1. Create `test/integration/account-balances.test.ts`
2. Implement 4 test cases
3. Run `npm test` and verify all pass

### Phase 5: Write Test 4 - Cron Jobs (25 mins)
1. Create `test/integration/cron-jobs.test.ts`
2. Implement 4 test cases (infrastructure only)
3. Run `npm test` and verify all pass

### Phase 6: Verify and Document (10 mins)
1. Run full test suite: `npm test`
2. Verify 100% pass rate
3. Update [test/README.md](test/README.md) with new test files
4. Document any edge cases discovered

**Total Estimated Time:** ~2.5 hours (reduced from 3.5 hours by limiting to 4 tests each)

---

## Success Criteria

✅ All 4 test files created
✅ All 16 test cases implemented (4 per file)
✅ Zero API credits used (all third-party calls mocked)
✅ 100% pass rate on `npm test`
✅ Tests run in < 20 seconds total
✅ Coverage for all critical new features
✅ Safe to refactor with confidence
✅ Simple test suites that can be expanded later

---

## Next Steps After Implementation

1. Run tests before refactoring: `npm test`
2. Make refactoring changes
3. Run tests after each change: `npm test`
4. Fix any regressions immediately
5. Commit when all tests pass

This ensures your refactoring doesn't break existing functionality.

---

## Implementation Checklist

When you're ready to implement these tests, follow this checklist:

- [ ] **Phase 1:** Create mock infrastructure
  - [ ] Create `test/mocks/claude-mock.ts`
  - [ ] Update `test/mocks/supabase-mock.ts` with accounts, transactions, categorization_rules tables
  - [ ] Test mocks in isolation

- [ ] **Phase 2:** Async recategorization tests
  - [ ] Create `test/integration/async-recategorization.test.ts`
  - [ ] Implement 4 test cases
  - [ ] Verify all tests pass

- [ ] **Phase 3:** Budget labeling tests
  - [ ] Create `test/integration/budget-labeling.test.ts`
  - [ ] Implement 4 test cases
  - [ ] Verify all tests pass

- [ ] **Phase 4:** Account balances tests
  - [ ] Create `test/integration/account-balances.test.ts`
  - [ ] Implement 4 test cases
  - [ ] Verify all tests pass

- [ ] **Phase 5:** Cron job tests
  - [ ] Create `test/integration/cron-jobs.test.ts`
  - [ ] Implement 4 test cases
  - [ ] Verify all tests pass

- [ ] **Phase 6:** Final verification
  - [ ] Run full test suite: `npm test`
  - [ ] Update `test/README.md` with new test files
  - [ ] Document any discoveries or edge cases

---

## Notes for Future Development

- **Expanding Tests:** Each test file can easily be expanded by adding more test cases. The 4-test limit is just to get started quickly.
- **Mock Reusability:** The `MockClaudeClient` can be reused across all tests that need categorization or budget filtering.
- **Database State:** Always use `beforeEach(() => mockSupabase.clear())` to ensure clean state between tests.
- **Polling Pattern:** For async operations (recategorization, sync), use the polling pattern from `oauth-transaction-sync.test.ts:86-107`.
- **Error Testing:** Test both success and failure paths. Mock errors by stubbing functions to throw.

---

## Contact & Questions

If you have questions while implementing these tests, refer to:
- Existing test patterns in `test/integration/`
- Mock implementations in `test/mocks/`
- [CLAUDE.md](../CLAUDE.md) testing guidelines
