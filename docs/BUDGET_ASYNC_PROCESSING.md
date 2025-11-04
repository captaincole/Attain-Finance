# Budget Async Processing

## Overview

Budget transaction labeling now runs asynchronously in the background. When users create or update budgets, they get an immediate response while transaction matching happens in the background.

## Architecture

### Flow

1. **User creates/updates budget** → Tool saves budget with `processing_status='processing'`
2. **Immediate response** → User sees "⏳ Processing..." message
3. **Background worker** → Labels transactions using Claude API
4. **Status update** → Sets `processing_status='ready'` or `'error'`
5. **User polls** → Calls `get-budgets` to see updated status

### Database Schema

```sql
-- Processing status tracking (migration 012)
ALTER TABLE budgets ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE budgets ADD COLUMN processing_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE budgets ADD COLUMN processing_error TEXT;

-- Status values: 'processing', 'ready', 'error'
```

## Code Components

### 1. Repository Functions ([src/storage/budgets/budgets.ts](../src/storage/budgets/budgets.ts))

```typescript
// Mark budget as processing
await markBudgetAsProcessing(userId, budgetId);

// Mark as ready (success)
await markBudgetAsReady(userId, budgetId);

// Mark as error (failed)
await markBudgetAsError(userId, budgetId, errorMessage);
```

### 2. Background Worker ([src/utils/budget-processing-worker.ts](../src/utils/budget-processing-worker.ts))

```typescript
// Start processing (non-blocking)
startBudgetProcessing(userId, budget);

// This runs in background:
// 1. markBudgetAsProcessing(userId, budget.id)
// 2. labelTransactionsForSingleBudget() <- Claude API call
// 3. markBudgetAsReady(userId, budget.id) or markBudgetAsError(userId, budget.id, error)
```

### 3. Tool Updates

**upsert-budget** ([src/tools/budgets/upsert-budget.ts](../src/tools/budgets/upsert-budget.ts)):
- Creates budget with `processing_status='processing'`
- Starts background worker
- Returns immediately with "⏳ Processing..." message

**get-budgets** ([src/tools/budgets/get-budgets.ts](../src/tools/budgets/get-budgets.ts)):
- Checks `processing_status` field
- Shows different UI based on status:
  - `'processing'` → "⏳ Processing transactions..."
  - `'error'` → "❌ Processing failed: {error}"
  - `'ready'` → Normal budget display with spending data

## User Experience

### Creating a Budget

```
User: "Create a coffee budget of $100 for the last 7 days"

Response (immediate):
✅ Budget Created

**Coffee Budget**
- Amount: $100.00
- Period: rolling (7 days)

⏳ Your budget is being processed...
Transaction matching is running in the background.
Check back in a moment to see results!
```

### Checking Status

```
User: "Show my budgets"

Response (while processing):
📊 Budget Status

⏳ **Coffee Budget**
- Status: Processing transactions...
- Amount: $100.00
- Period: rolling (7 days)

Your budget is being analyzed. Check back in a moment!

---

Response (after processing):
📊 Budget Status

🟢 **Coffee Budget**
- Spent: $42.50 / $100.00 (42%)
- Remaining: $57.50
- Period: rolling (7 days)
- Transactions: 12
- Date Range: 2025-10-08 to 2025-10-15
```

## Why Async Processing?

### Problem with Synchronous Processing
- Claude API calls for transaction matching take 5-15 seconds
- On serverless (Render), long requests can timeout
- Poor UX - users wait with no feedback

### Benefits of Async Processing
- **Immediate feedback** - Users see budget created instantly
- **No timeouts** - Processing continues in background
- **Better UX** - Clear status updates via polling
- **Scalable** - Handles large transaction sets without blocking

## Edge Cases

### Processing Errors
If labeling fails (API error, etc.):
- Status set to `'error'`
- Error message stored in `processing_error`
- User sees: "❌ Processing failed: {error}"

### Multiple Budgets
Each budget processes independently:
- Budget A can be "processing"
- Budget B can be "ready"
- Budget C can be "error"

### Updating During Processing
If user updates a budget while processing:
- Old processing is abandoned (no cancellation needed)
- New processing starts with updated criteria
- Status resets to "processing"

## Testing

```typescript
// Create budget and check status
await upsertBudget({ title: "Test", ... });
// → Returns immediately with processing_status='processing'

// Wait a moment, then check
await getBudgets();
// → Shows processing status

// Wait for completion (~10-15 seconds)
await getBudgets();
// → Shows ready status with transaction counts
```

## Monitoring

Check logs for processing flow:
```
[UPSERT-BUDGET] Created budget abc-123, starting async processing
[BUDGET-WORKER] Starting async processing for budget abc-123
[REPO/BUDGETS] Marked budget abc-123 as processing
[BUDGET-LABELING] Labeling transactions for single budget: Test Budget
[BUDGET-WORKER] Labeling complete for abc-123: 15 transactions matched
[REPO/BUDGETS] Marked budget abc-123 as ready
[BUDGET-WORKER] Budget abc-123 processing complete
```

## Future Improvements

1. **Webhooks** - Push notification when processing completes
2. **Progress updates** - Real-time % complete during processing
3. **Cancellation** - Allow users to cancel long-running processing
4. **Retry logic** - Auto-retry failed processing
5. **Queue system** - Use job queue (Bull/BullMQ) for better reliability
