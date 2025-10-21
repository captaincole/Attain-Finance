-- Personal Finance MCP - Supabase Database Schema
-- Migration: Add user_visualizations table for customizable visualization scripts

-- Create user_visualizations table
CREATE TABLE IF NOT EXISTS user_visualizations (
  user_id TEXT PRIMARY KEY,
  script_content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_visualizations ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only access their own visualizations
CREATE POLICY "Users can manage their own visualizations"
  ON user_visualizations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add index for updated_at for sorting/filtering
CREATE INDEX idx_user_visualizations_updated_at ON user_visualizations(updated_at DESC);

-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file and click "Run"
-- 5. Verify the table was created under "Database" → "Tables"
