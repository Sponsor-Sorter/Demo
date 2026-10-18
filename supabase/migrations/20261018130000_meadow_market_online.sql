-- Meadow & Market online game data. Kept separate from all bb_* Bargain Barge tables.
create table if not exists public.meadow_market_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  friend_code text not null unique,
  display_name text not null default 'Meadow Farmer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meadow_market_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null check (jsonb_typeof(save_data) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.meadow_market_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id),
  unique (requester_id, recipient_id)
);

alter table public.meadow_market_profiles enable row level security;
alter table public.meadow_market_saves enable row level security;
alter table public.meadow_market_friendships enable row level security;

grant select on public.meadow_market_profiles to anon, authenticated;
grant insert, update on public.meadow_market_profiles to authenticated;
grant select, insert, update on public.meadow_market_saves to authenticated;
grant select, insert, update on public.meadow_market_friendships to authenticated;

drop policy if exists "Meadow Market profile directory" on public.meadow_market_profiles;
create policy "Meadow Market profile directory" on public.meadow_market_profiles
  for select to anon, authenticated using (true);
drop policy if exists "Meadow Market players manage own profile" on public.meadow_market_profiles;
create policy "Meadow Market players manage own profile" on public.meadow_market_profiles
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Meadow Market own or accepted friend save read" on public.meadow_market_saves;
create policy "Meadow Market own or accepted friend save read" on public.meadow_market_saves
  for select to authenticated using (
    user_id = (select auth.uid()) or exists (
      select 1 from public.meadow_market_friendships f
      where f.status = 'accepted'
        and ((f.requester_id = (select auth.uid()) and f.recipient_id = user_id)
          or (f.recipient_id = (select auth.uid()) and f.requester_id = user_id))
    )
  );
drop policy if exists "Meadow Market players write own save" on public.meadow_market_saves;
create policy "Meadow Market players write own save" on public.meadow_market_saves
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Meadow Market players update own save" on public.meadow_market_saves;
create policy "Meadow Market players update own save" on public.meadow_market_saves
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Meadow Market players see own friend requests" on public.meadow_market_friendships;
create policy "Meadow Market players see own friend requests" on public.meadow_market_friendships
  for select to authenticated using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));
drop policy if exists "Meadow Market players send friend requests" on public.meadow_market_friendships;
create policy "Meadow Market players send friend requests" on public.meadow_market_friendships
  for insert to authenticated with check (requester_id = (select auth.uid()) and status = 'pending');
drop policy if exists "Meadow Market recipients answer friend requests" on public.meadow_market_friendships;
create policy "Meadow Market recipients answer friend requests" on public.meadow_market_friendships
  for update to authenticated using (recipient_id = (select auth.uid()) and status = 'pending')
  with check (recipient_id = (select auth.uid()) and status in ('accepted','declined'));

do $$ begin
  alter publication supabase_realtime add table public.meadow_market_saves;
exception when duplicate_object then null;
end $$;
