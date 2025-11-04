-- Migration 022: Enable Row Level Security for transactions
-- Adds helper for extracting Clerk user ID from Supabase requests
-- and enforces per-user access policies on the transactions table.

-- Create a dedicated schema for security helper functions.
create schema if not exists private;

-- Ensure application roles can use the private schema and helper.
grant usage on schema private to authenticated, anon, service_role;

-- Helper function: extract Clerk user ID from Supabase request context.
-- Relies on the Clerk session token (auth.jwt()->>'sub').
create or replace function private.get_clerk_user_id()
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  resolved_user_id text;
begin
  resolved_user_id := auth.jwt()->>'sub';
  if resolved_user_id is null then
    raise log 'RLS transactions: missing Clerk sub claim in JWT.';
  end if;

  return resolved_user_id;
end;
$$;

-- Allow runtime roles to execute the helper.
grant execute on function private.get_clerk_user_id() to authenticated, anon, service_role;

-- Enforce RLS on transactions table.
alter table public.transactions enable row level security;
alter table public.transactions force row level security;

create policy "transactions users manage own rows"
  on public.transactions
  for all
  to authenticated, anon
  using (
    user_id = private.get_clerk_user_id()
  )
  with check (
    user_id = private.get_clerk_user_id()
  );

-- Policy: service role retains unrestricted access for background jobs and tests.
create policy "transactions service role full access"
  on public.transactions
  for all
  to service_role
  using (true)
  with check (true);
