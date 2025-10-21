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
