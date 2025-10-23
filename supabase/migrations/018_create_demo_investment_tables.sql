-- Migration 018: Create demo investment tables for seeded holdings
-- These tables mirror Plaid's investments/holdings response structure
-- with only the minimal fields required for demo scenarios.

CREATE TABLE IF NOT EXISTS demo_investment_accounts (
  account_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mask TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  balances_current NUMERIC(18,4),
  balances_available NUMERIC(18,4),
  currency_code TEXT DEFAULT 'USD',
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_investment_accounts_user_id
  ON demo_investment_accounts(user_id);

CREATE TABLE IF NOT EXISTS demo_investment_securities (
  security_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ticker_symbol TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  close_price NUMERIC(18,4),
  close_price_as_of DATE,
  currency_code TEXT DEFAULT 'USD',
  is_cash_equivalent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_investment_holdings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES demo_investment_accounts(account_id) ON DELETE CASCADE,
  security_id TEXT NOT NULL REFERENCES demo_investment_securities(security_id) ON DELETE CASCADE,
  quantity NUMERIC(18,6) NOT NULL,
  cost_basis NUMERIC(18,4),
  institution_price NUMERIC(18,4),
  institution_price_as_of DATE,
  institution_value NUMERIC(18,4),
  currency_code TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_investment_holdings_user_id
  ON demo_investment_holdings(user_id);

CREATE INDEX IF NOT EXISTS idx_demo_investment_holdings_account_id
  ON demo_investment_holdings(account_id);

CREATE INDEX IF NOT EXISTS idx_demo_investment_holdings_security_id
  ON demo_investment_holdings(security_id);
