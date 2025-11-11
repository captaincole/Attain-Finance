-- Migration 024: Create net_worth_snapshots table
-- Stores weekly net worth checkpoints so we can show trends on the dashboard
-- Data will be populated by cron jobs and account sync flows.

create table if not exists net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  snapshot_date date not null,
  net_worth_amount numeric not null,
  assets_total numeric not null,
  liabilities_total numeric not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (user_id, snapshot_date)
);

create index if not exists idx_net_worth_snapshots_user_date
  on net_worth_snapshots (user_id, snapshot_date desc);

comment on table net_worth_snapshots is 'Weekly snapshots of a user''s total assets, liabilities, and net worth';
