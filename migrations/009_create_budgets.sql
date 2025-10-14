-- Migration 009: Create budgets table
-- Stores user-defined budgets with AI-powered transaction filtering

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  filter_prompt TEXT NOT NULL,
  budget_amount DECIMAL(10, 2) NOT NULL,
  time_period TEXT NOT NULL CHECK (time_period IN ('daily', 'weekly', 'monthly', 'custom')),
  custom_period_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure custom_period_days is provided when time_period is 'custom'
  CONSTRAINT custom_period_required CHECK (
    (time_period = 'custom' AND custom_period_days IS NOT NULL) OR
    (time_period != 'custom')
  )
);

-- Index for fast user lookups
CREATE INDEX idx_budgets_user_id ON budgets(user_id);

-- Index for ordering by creation/update time
CREATE INDEX idx_budgets_updated_at ON budgets(updated_at DESC);
