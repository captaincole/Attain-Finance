-- Migration 019: Create investment_holdings table
-- Purpose: Store investment holdings data from Plaid Investments API
-- This enables users to view their portfolio across 401k, IRA, brokerage, and crypto accounts

CREATE TABLE investment_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  security_id TEXT NOT NULL,

  -- Holding data from Plaid
  quantity NUMERIC NOT NULL,
  institution_price NUMERIC NOT NULL,
  institution_price_as_of DATE,
  institution_value NUMERIC NOT NULL,
  cost_basis NUMERIC,

  -- Security metadata (denormalized for fast lookups without joins)
  ticker_symbol TEXT,
  security_name TEXT,
  security_type TEXT, -- equity, mutual fund, etf, cash, cryptocurrency, etc.
  security_subtype TEXT, -- common stock, mutual fund, cryptocurrency, etc.
  close_price NUMERIC,
  close_price_as_of DATE,

  -- Currency
  iso_currency_code TEXT,
  unofficial_currency_code TEXT, -- for cryptocurrencies

  -- Timestamps
  last_synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure each security appears only once per account
  UNIQUE(account_id, security_id)
);

-- Indexes for fast queries
CREATE INDEX idx_investment_holdings_user_id ON investment_holdings(user_id);
CREATE INDEX idx_investment_holdings_account_id ON investment_holdings(account_id);
CREATE INDEX idx_investment_holdings_security_id ON investment_holdings(security_id);

-- Comments for documentation
COMMENT ON TABLE investment_holdings IS 'Investment holdings from Plaid Investments API - shows what users are invested in';
COMMENT ON COLUMN investment_holdings.security_id IS 'Plaid security_id - unique identifier for the security';
COMMENT ON COLUMN investment_holdings.institution_value IS 'Current total value of holding (quantity × institution_price)';
COMMENT ON COLUMN investment_holdings.cost_basis IS 'Total amount spent to acquire this holding';
