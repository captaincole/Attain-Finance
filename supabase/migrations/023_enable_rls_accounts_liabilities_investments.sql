-- Migration 023: Enable Row Level Security across sensitive financial tables
-- Applies the Clerk-authenticated helper to accounts, liabilities, and investment holdings.

-- ============================================================================
-- Accounts
-- ============================================================================
alter table public.accounts enable row level security;
alter table public.accounts force row level security;

create policy "accounts users manage own rows"
  on public.accounts
  for all
  to authenticated, anon
  using (user_id = private.get_clerk_user_id())
  with check (user_id = private.get_clerk_user_id());

create policy "accounts service role full access"
  on public.accounts
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- Investment holdings
-- ============================================================================
alter table public.investment_holdings enable row level security;
alter table public.investment_holdings force row level security;

create policy "investment holdings users manage own rows"
  on public.investment_holdings
  for all
  to authenticated, anon
  using (user_id = private.get_clerk_user_id())
  with check (user_id = private.get_clerk_user_id());

create policy "investment holdings service role full access"
  on public.investment_holdings
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- Liabilities
-- ============================================================================
alter table public.liabilities_credit enable row level security;
alter table public.liabilities_credit force row level security;

create policy "liabilities credit users manage own rows"
  on public.liabilities_credit
  for all
  to authenticated, anon
  using (user_id = private.get_clerk_user_id())
  with check (user_id = private.get_clerk_user_id());

create policy "liabilities credit service role full access"
  on public.liabilities_credit
  for all
  to service_role
  using (true)
  with check (true);

alter table public.liabilities_mortgage enable row level security;
alter table public.liabilities_mortgage force row level security;

create policy "liabilities mortgage users manage own rows"
  on public.liabilities_mortgage
  for all
  to authenticated, anon
  using (user_id = private.get_clerk_user_id())
  with check (user_id = private.get_clerk_user_id());

create policy "liabilities mortgage service role full access"
  on public.liabilities_mortgage
  for all
  to service_role
  using (true)
  with check (true);

alter table public.liabilities_student enable row level security;
alter table public.liabilities_student force row level security;

create policy "liabilities student users manage own rows"
  on public.liabilities_student
  for all
  to authenticated, anon
  using (user_id = private.get_clerk_user_id())
  with check (user_id = private.get_clerk_user_id());

create policy "liabilities student service role full access"
  on public.liabilities_student
  for all
  to service_role
  using (true)
  with check (true);
