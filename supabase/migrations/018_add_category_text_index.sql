-- Migration 018: Add text pattern index for custom_category
-- Optimizes case-insensitive category filtering using ILIKE queries
--
-- Without this index, category filters would require full table scans
-- With this index, Postgres can use the index for ILIKE '%Food%' queries
--
-- Note: We use text_pattern_ops for efficient LIKE/ILIKE pattern matching
-- This is PostgreSQL-specific but works perfectly with Supabase

-- Create text pattern index for custom_category
-- Supports case-insensitive pattern matching (ILIKE '%term%')
CREATE INDEX idx_transactions_custom_category_text
  ON transactions(lower(custom_category) text_pattern_ops);

-- Composite index for user + category queries (most common pattern)
CREATE INDEX idx_transactions_user_category
  ON transactions(user_id, custom_category);

-- Comment to explain the indexes
COMMENT ON INDEX idx_transactions_custom_category_text IS
  'Text pattern index for case-insensitive category filtering (ILIKE queries)';
COMMENT ON INDEX idx_transactions_user_category IS
  'Composite index for user + category filtering (exact match)';
