-- Migration 021: Create demo transaction tables for seeded credit card data

CREATE TABLE IF NOT EXISTS demo_transaction_accounts (
  account_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  name TEXT NOT NULL,
  mask TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  current_balance NUMERIC(18, 2),
  currency_code TEXT DEFAULT 'USD',
  credit_limit NUMERIC(18, 2),
  available_credit NUMERIC(18, 2),
  apr NUMERIC(6, 3),
  minimum_payment NUMERIC(18, 2),
  statement_due_date DATE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_transaction_accounts_user_id
  ON demo_transaction_accounts(user_id);

CREATE TABLE IF NOT EXISTS demo_transactions (
  transaction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES demo_transaction_accounts(account_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  posted_date DATE,
  description TEXT NOT NULL,
  merchant_name TEXT,
  category TEXT,
  amount NUMERIC(18, 2) NOT NULL,
  direction TEXT NOT NULL,
  pending BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_transactions_user_id
  ON demo_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_demo_transactions_account_id
  ON demo_transactions(account_id);

CREATE INDEX IF NOT EXISTS idx_demo_transactions_date
  ON demo_transactions(date);
