-- Migration 019: Create demo liability tables for seeded debts and credit scores

CREATE TABLE IF NOT EXISTS demo_liability_accounts (
  account_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mask TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  balances_current NUMERIC(18,4),
  balances_available NUMERIC(18,4),
  limit_amount NUMERIC(18,4),
  currency_code TEXT DEFAULT 'USD',
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_liability_accounts_user_id
  ON demo_liability_accounts(user_id);

CREATE TABLE IF NOT EXISTS demo_liability_details (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES demo_liability_accounts(account_id) ON DELETE CASCADE,
  liability_type TEXT NOT NULL,
  interest_rate NUMERIC(8,4),
  interest_rate_type TEXT,
  minimum_payment_amount NUMERIC(12,2),
  next_payment_due_date DATE,
  last_payment_amount NUMERIC(12,2),
  last_payment_date DATE,
  payoff_date DATE,
  original_principal_amount NUMERIC(18,2),
  outstanding_principal_amount NUMERIC(18,2),
  escrow_balance NUMERIC(18,2),
  past_due_amount NUMERIC(18,2),
  term_description TEXT,
  lender_name TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_liability_details_user_id
  ON demo_liability_details(user_id);

CREATE INDEX IF NOT EXISTS idx_demo_liability_details_account_id
  ON demo_liability_details(account_id);

CREATE TABLE IF NOT EXISTS demo_credit_scores (
  user_id TEXT PRIMARY KEY,
  score INTEGER NOT NULL,
  score_date DATE NOT NULL,
  provider TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
