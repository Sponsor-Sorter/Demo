-- Meadow Markets only. Passwords remain in Supabase Auth, never in these tables.
create table if not exists public.meadow_market_accounts (
  username text primary key check (username ~ '^[a-z0-9_]{3,20}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  ready boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.meadow_market_accounts enable row level security;
revoke all on public.meadow_market_accounts from anon, authenticated;
grant select on public.meadow_market_accounts to authenticated;
grant all on public.meadow_market_accounts to service_role;
create policy meadow_accounts_owner_read on public.meadow_market_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.meadow_market_auth_limits (
  bucket text primary key,
  attempts integer not null default 0,
  expires_at timestamptz not null
);
alter table public.meadow_market_auth_limits enable row level security;
revoke all on public.meadow_market_auth_limits from anon, authenticated;
grant all on public.meadow_market_auth_limits to service_role;
create policy meadow_auth_limits_service_only on public.meadow_market_auth_limits
  for all to service_role using (true) with check (true);
create index if not exists meadow_market_auth_limits_expiry on public.meadow_market_auth_limits(expires_at);
create or replace function public.meadow_market_auth_attempt(p_bucket text, p_max integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  delete from public.meadow_market_auth_limits where expires_at < now();
  insert into public.meadow_market_auth_limits(bucket,attempts,expires_at)
  values(p_bucket,1,now()+interval '15 minutes')
  on conflict(bucket) do update set attempts=public.meadow_market_auth_limits.attempts+1
  returning attempts into n;
  return n <= least(greatest(p_max,1),30);
end $$;
revoke all on function public.meadow_market_auth_attempt(text,integer) from public, anon, authenticated;
grant execute on function public.meadow_market_auth_attempt(text,integer) to service_role;
