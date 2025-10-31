-- Migration 021: Create liabilities tables
-- Purpose: Store liability details from Plaid Liabilities API
-- Supports credit cards, mortgages, and student loans with detailed metadata

-- =============================================================================
-- Credit Card Liabilities
-- =============================================================================
CREATE TABLE liabilities_credit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,

  -- APR data (array of objects with apr_percentage, apr_type, balance_subject_to_apr, interest_charge_amount)
  aprs JSONB,

  -- Payment status
  is_overdue BOOLEAN,
  last_payment_amount NUMERIC,
  last_payment_date DATE,

  -- Statement info
  last_statement_issue_date DATE,
  last_statement_balance NUMERIC,

  -- Next payment
  minimum_payment_amount NUMERIC,
  next_payment_due_date DATE,

  -- Timestamps
  last_synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- One credit liability per account
  UNIQUE(account_id)
);

-- =============================================================================
-- Mortgage Liabilities
-- =============================================================================
CREATE TABLE liabilities_mortgage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,

  -- Account details
  account_number TEXT,

  -- Loan terms
  loan_term TEXT, -- e.g., "30 year"
  loan_type_description TEXT, -- e.g., "conventional", "fixed", "variable"
  origination_date DATE,
  origination_principal_amount NUMERIC,
  maturity_date DATE,

  -- Interest
  interest_rate_percentage NUMERIC,
  interest_rate_type TEXT, -- "fixed" or "variable"

  -- Property
  property_address JSONB, -- { street, city, region, postal_code, country }

  -- Payments
  next_payment_due_date DATE,
  next_monthly_payment NUMERIC,
  last_payment_date DATE,
  last_payment_amount NUMERIC,

  -- Fees and balances
  current_late_fee NUMERIC,
  past_due_amount NUMERIC,
  escrow_balance NUMERIC,
  has_pmi BOOLEAN,
  has_prepayment_penalty BOOLEAN,

  -- Year-to-date
  ytd_interest_paid NUMERIC,
  ytd_principal_paid NUMERIC,

  -- Timestamps
  last_synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- One mortgage per account
  UNIQUE(account_id)
);

-- =============================================================================
-- Student Loan Liabilities
-- =============================================================================
CREATE TABLE liabilities_student (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,

  -- Account details
  account_number TEXT,
  sequence_number TEXT,

  -- Loan details
  loan_name TEXT, -- e.g., "Consolidation"
  guarantor TEXT, -- e.g., "DEPT OF ED"
  interest_rate_percentage NUMERIC,

  -- Loan status (object with type and end_date)
  loan_status JSONB,

  -- Repayment plan (object with type and description)
  repayment_plan JSONB,

  -- Dates
  disbursement_dates JSONB, -- array of dates
  origination_date DATE,
  expected_payoff_date DATE,

  -- Payments
  is_overdue BOOLEAN,
  minimum_payment_amount NUMERIC,
  next_payment_due_date DATE,
  last_payment_date DATE,
  last_payment_amount NUMERIC,
  payment_reference_number TEXT,

  -- Balances
  origination_principal_amount NUMERIC,
  outstanding_interest_amount NUMERIC,
  last_statement_balance NUMERIC,
  last_statement_issue_date DATE,

  -- Servicer
  servicer_address JSONB, -- { street, city, region, postal_code, country }

  -- Year-to-date
  ytd_interest_paid NUMERIC,
  ytd_principal_paid NUMERIC,

  -- Timestamps
  last_synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- One student loan per account
  UNIQUE(account_id)
);

-- =============================================================================
-- Indexes for fast queries
-- =============================================================================

-- Credit
CREATE INDEX idx_liabilities_credit_user_id ON liabilities_credit(user_id);
CREATE INDEX idx_liabilities_credit_account_id ON liabilities_credit(account_id);

-- Mortgage
CREATE INDEX idx_liabilities_mortgage_user_id ON liabilities_mortgage(user_id);
CREATE INDEX idx_liabilities_mortgage_account_id ON liabilities_mortgage(account_id);

-- Student
CREATE INDEX idx_liabilities_student_user_id ON liabilities_student(user_id);
CREATE INDEX idx_liabilities_student_account_id ON liabilities_student(account_id);

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE liabilities_credit IS 'Credit card liability details from Plaid Liabilities API';
COMMENT ON TABLE liabilities_mortgage IS 'Mortgage liability details from Plaid Liabilities API';
COMMENT ON TABLE liabilities_student IS 'Student loan liability details from Plaid Liabilities API';

COMMENT ON COLUMN liabilities_credit.aprs IS 'Array of APR objects: { apr_percentage, apr_type, balance_subject_to_apr, interest_charge_amount }';
COMMENT ON COLUMN liabilities_mortgage.property_address IS 'Property address object: { street, city, region, postal_code, country }';
COMMENT ON COLUMN liabilities_student.loan_status IS 'Loan status object: { type, end_date }';
COMMENT ON COLUMN liabilities_student.repayment_plan IS 'Repayment plan object: { type, description }';
COMMENT ON COLUMN liabilities_student.servicer_address IS 'Servicer address object: { street, city, region, postal_code, country }';
