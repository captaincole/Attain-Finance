-- Personal Finance MCP - Supabase Database Schema
-- Migration 002: Add plaid_sessions table for stateless serverless support

-- Create plaid_sessions table to track Plaid Link OAuth flows
CREATE TABLE IF NOT EXISTS plaid_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 minutes',
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE plaid_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy: Allow all authenticated access (Clerk handles auth)
CREATE POLICY "Users can manage sessions"
  ON plaid_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add index for efficient lookups by session_id (already indexed as PRIMARY KEY)
-- Add index for user_id lookups
CREATE INDEX idx_plaid_sessions_user_id ON plaid_sessions(user_id);

-- Add index for cleanup queries (expired sessions)
CREATE INDEX idx_plaid_sessions_expires_at ON plaid_sessions(expires_at);

-- Add index for status filtering
CREATE INDEX idx_plaid_sessions_status ON plaid_sessions(status);

-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file and click "Run"
-- 5. Verify the table was created under "Database" → "Tables"
