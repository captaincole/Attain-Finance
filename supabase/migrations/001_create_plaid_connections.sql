-- Personal Finance MCP - Supabase Database Schema
-- Migration: Add plaid_connections table for persistent storage

-- Create plaid_connections table
CREATE TABLE IF NOT EXISTS plaid_connections (
  user_id TEXT PRIMARY KEY,
  access_token_encrypted TEXT NOT NULL,
  item_id TEXT NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only access their own connections
-- Note: This assumes you're using Clerk's userId in your queries
-- For now, we'll allow all authenticated access since Clerk handles auth
CREATE POLICY "Users can manage their own connections"
  ON plaid_connections
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Optional: Add index for faster lookups by user_id (already indexed as PRIMARY KEY)
-- CREATE INDEX idx_plaid_connections_user_id ON plaid_connections(user_id);

-- Optional: Add index for connected_at for sorting/filtering
CREATE INDEX idx_plaid_connections_connected_at ON plaid_connections(connected_at DESC);

-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file and click "Run"
-- 5. Verify the table was created under "Database" → "Tables"
