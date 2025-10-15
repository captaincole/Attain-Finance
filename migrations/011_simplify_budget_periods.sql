-- Migration 011: Simplify budget time periods
-- Changes budget periods to support two clear modes:
-- 1. Rolling budgets: Last N days (continuously rolling window)
-- 2. Fixed budgets: Calendar-based periods with configurable start date

-- Delete existing budgets (user confirmed they can recreate them)
DELETE FROM budgets;

-- Add new column for fixed budget anchor date
ALTER TABLE budgets ADD COLUMN fixed_period_start_date DATE;

-- Drop old constraints
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_time_period_check;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS custom_period_required;

-- Update time_period column to support new values
-- Rolling: 'rolling' (requires custom_period_days)
-- Fixed: 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly' (requires fixed_period_start_date)
ALTER TABLE budgets
  ADD CONSTRAINT budgets_time_period_check
  CHECK (time_period IN ('rolling', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'));

-- Update constraint: rolling requires custom_period_days, fixed periods require fixed_period_start_date
ALTER TABLE budgets
  ADD CONSTRAINT period_configuration_check CHECK (
    (time_period = 'rolling' AND custom_period_days IS NOT NULL AND custom_period_days > 0 AND fixed_period_start_date IS NULL) OR
    (time_period IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly') AND fixed_period_start_date IS NOT NULL AND custom_period_days IS NULL)
  );
