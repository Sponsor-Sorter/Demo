create table public.creator_packages (
 id uuid primary key default gen_random_uuid(),
 creator_user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 3 and 120),
 deliverables text not null check(length(trim(deliverables)) between 10 and 4000),
 price_cents bigint not null check(price_cents between 100 and 90909090),
 currency text not null default 'usd' check(currency='usd'),
 platforms text[] not null check(cardinality(platforms) between 1 and 7 and platforms <@ array['youtube','instagram','tiktok','twitch','facebook','twitter','snapchat']),
 revisions integer not null default 1 check(revisions between 0 and 20),
 turnaround_days integer not null default 7 check(turnaround_days between 1 and 365),
 usage_rights text not null default 'Agree usage permissions in the proposal.' check(length(usage_rights) between 1 and 2000),
 availability text not null default 'open' check(availability in ('open','limited','paused')),
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create index creator_packages_owner on public.creator_packages(creator_user_id);
alter table public.creator_packages enable row level security;
revoke all on public.creator_packages from anon,authenticated;
grant select on public.creator_packages to anon;
grant select,insert,update,delete on public.creator_packages to authenticated;
create policy creator_packages_public on public.creator_packages for select to anon,authenticated
 using(published and exists(select 1 from public.public_user_profiles p where p.user_id=creator_user_id));
create policy creator_packages_owner on public.creator_packages to authenticated
 using(creator_user_id=auth.uid()) with check(creator_user_id=auth.uid()
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.users_extended_data p where p.user_id=auth.uid() and p."userType"='besponsored' and not coalesce(p.banned,false)));

-- Future agreements keep the purchased package version, not a mutable catalog link.
alter table public.private_offers add column package_snapshot jsonb;
create function sponsorship_private.protect_package_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.package_snapshot is distinct from old.package_snapshot then raise exception 'Package agreement cannot be changed'; end if;
 return new;
end; $$;
revoke all on function sponsorship_private.protect_package_snapshot() from public,anon,authenticated;
create trigger protect_package_snapshot before update on public.private_offers for each row execute function sponsorship_private.protect_package_snapshot();
