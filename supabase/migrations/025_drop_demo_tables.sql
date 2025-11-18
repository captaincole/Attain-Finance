-- Migration 025: Drop demo tables from production
-- These tables were created in the demo-investments-mvp branch for prototyping
-- but are no longer needed now that we use the seed.sql approach for demo data.

-- Drop demo transaction tables
DROP TABLE IF EXISTS demo_transactions CASCADE;
DROP TABLE IF EXISTS demo_transaction_accounts CASCADE;

-- Drop demo banking tables  
DROP TABLE IF EXISTS demo_banking_transactions CASCADE;
DROP TABLE IF EXISTS demo_banking_accounts CASCADE;

-- Drop demo liability tables
DROP TABLE IF EXISTS demo_liability_details CASCADE;
DROP TABLE IF EXISTS demo_liability_accounts CASCADE;
DROP TABLE IF EXISTS demo_credit_scores CASCADE;

-- Drop demo investment tables
DROP TABLE IF EXISTS demo_investment_holdings CASCADE;
DROP TABLE IF EXISTS demo_investment_securities CASCADE;
DROP TABLE IF EXISTS demo_investment_accounts CASCADE;
