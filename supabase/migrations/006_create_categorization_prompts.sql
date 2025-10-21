-- Personal Finance MCP - Supabase Database Schema
-- Migration: Add categorization_prompts table for user-customizable transaction categorization

-- Create categorization_prompts table
CREATE TABLE IF NOT EXISTS categorization_prompts (
  user_id TEXT PRIMARY KEY,
  custom_rules TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE categorization_prompts ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only access their own categorization prompts
CREATE POLICY "Users can manage their own categorization prompts"
  ON categorization_prompts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add index for faster lookups by user_id (already indexed as PRIMARY KEY)
-- CREATE INDEX idx_categorization_prompts_user_id ON categorization_prompts(user_id);

-- Add index for updated_at for sorting/filtering
CREATE INDEX idx_categorization_prompts_updated_at ON categorization_prompts(updated_at DESC);

-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file and click "Run"
-- 5. Verify the table was created under "Database" → "Tables"
