-- 017_drop_user_visualizations.sql
-- Drops the user_visualizations table and related artifacts

-- Drop index if it exists (created in 007_create_user_visualizations.sql)
DROP INDEX IF EXISTS idx_user_visualizations_updated_at;

-- Drop policy if it exists
DROP POLICY IF EXISTS "Users can manage their own visualizations" ON user_visualizations;

-- Disable RLS (optional before drop)
ALTER TABLE IF EXISTS user_visualizations DISABLE ROW LEVEL SECURITY;

-- Drop table
DROP TABLE IF EXISTS user_visualizations;
