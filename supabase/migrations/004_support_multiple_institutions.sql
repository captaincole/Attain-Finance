-- Migration: Support multiple Plaid connections per user
-- Allows users to connect multiple banks (e.g., Bank of America + Chase)

-- Step 1: Drop the old primary key constraint
ALTER TABLE plaid_connections DROP CONSTRAINT plaid_connections_pkey;

-- Step 2: Add item_id as the new primary key (item_id is unique across all Plaid items)
ALTER TABLE plaid_connections ADD PRIMARY KEY (item_id);

-- Step 3: Create index on user_id for fast lookups of all connections for a user
CREATE INDEX idx_plaid_connections_user_id ON plaid_connections(user_id);

-- Step 4: Add unique constraint to prevent duplicate item_id entries
-- (This is already enforced by PRIMARY KEY, but making it explicit for clarity)
-- ALTER TABLE plaid_connections ADD CONSTRAINT unique_item_id UNIQUE (item_id);

-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file and click "Run"
-- 5. Verify the schema change under "Database" → "Tables" → "plaid_connections"
--
-- Note: Existing connections will be preserved. If you have test data, you may want to
-- clear the table first: DELETE FROM plaid_connections;
