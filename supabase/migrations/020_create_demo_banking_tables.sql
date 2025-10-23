-- Migration 020: Create demo banking tables to store checking account snapshot

CREATE TABLE IF NOT EXISTS demo_banking_accounts (
  account_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  name TEXT NOT NULL,
  mask TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  balances_current NUMERIC(18,4) NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_banking_accounts_user_id
  ON demo_banking_accounts(user_id);

CREATE TABLE IF NOT EXISTS demo_banking_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES demo_banking_accounts(account_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  direction TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_banking_transactions_user_id
  ON demo_banking_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_demo_banking_transactions_account_id
  ON demo_banking_transactions(account_id);

