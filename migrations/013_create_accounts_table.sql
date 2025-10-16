-- Migration 013: Create accounts table for storing Plaid account balances
-- This table stores current account balances fetched from Plaid.
-- Balances are refreshed during transaction syncs and initial connection.

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES plaid_connections(item_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,  -- Plaid's account identifier

  -- Account metadata
  name TEXT NOT NULL,  -- User-friendly name like "Chase Checking"
  official_name TEXT,  -- Official institution name
  type TEXT NOT NULL,  -- depository, credit, loan, investment
  subtype TEXT,  -- checking, savings, credit card, etc.

  -- Balance information
  current_balance DECIMAL(12,2),
  available_balance DECIMAL(12,2),
  limit_amount DECIMAL(12,2),  -- Credit limit for credit accounts
  currency_code TEXT DEFAULT 'USD',

  -- Timestamps
  last_synced_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, account_id)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Index for institution lookups
CREATE INDEX IF NOT EXISTS idx_accounts_item_id ON accounts(item_id);
