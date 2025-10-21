-- Migration: Add plaid_env column to track environment (sandbox vs production)
-- This allows us to identify which connections are using real bank data

-- Add plaid_env column with default value 'sandbox'
ALTER TABLE plaid_connections
ADD COLUMN plaid_env TEXT NOT NULL DEFAULT 'sandbox'
CHECK (plaid_env IN ('sandbox', 'development', 'production'));

-- Add index for filtering by environment
CREATE INDEX idx_plaid_connections_env ON plaid_connections(plaid_env);

-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file and click "Run"
-- 5. Verify the column was added under "Database" → "Tables" → "plaid_connections"
