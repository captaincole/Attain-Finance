-- Migration: Add connection status and institution name to plaid_connections
-- Enables tracking connection health and displaying institution names without API calls

-- Add status column (active, error, syncing, etc.)
ALTER TABLE plaid_connections
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Add institution_name column for display purposes
ALTER TABLE plaid_connections
ADD COLUMN IF NOT EXISTS institution_name TEXT;

-- Add error tracking columns for diagnostics
ALTER TABLE plaid_connections
ADD COLUMN IF NOT EXISTS error_code TEXT;

ALTER TABLE plaid_connections
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create index on status for filtering broken connections
CREATE INDEX IF NOT EXISTS idx_plaid_connections_status ON plaid_connections(status);

-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file and click "Run"
-- 5. Regenerate types: npx supabase gen types typescript --local > src/storage/database.types.ts
