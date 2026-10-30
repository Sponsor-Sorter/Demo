-- Retire only the generated Auth login for an already erased Meadow Markets farm.
-- Shared identities fail closed. Existing seven-day cancellation and game purge stay intact.
create table meadow_private.auth_retirements (
 user_id uuid primary key, lease uuid, lease_until timestamptz,
 attempts integer not null default 0, created_at timestamptz not null default now(),
 retry_after timestamptz not null default now()
);
alter table meadow_private.auth_retirements enable row level security;
revoke all on meadow_private.auth_retirements from public,anon,authenticated,service_role;
grant usage on schema meadow_private to service_role;
create index meadow_auth_retirements_due on meadow_private.auth_retirements(retry_after);

create function meadow_private.exclusive_retired_login(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare candidate auth.users; col record; used boolean;
begin
 if p_user is null or not exists(select 1 from meadow_private.deleted_game_accounts where account_hash=encode(sha256(convert_to('meadow-deleted:'||p_user::text,'UTF8')),'hex')) then return false; end if;
 if exists(select 1 from public.meadow_market_profiles where user_id=p_user) or exists(select 1 from public.meadow_market_accounts where user_id=p_user) then return false; end if;
 select * into candidate from auth.users where id=p_user;
 if not found or candidate.deleted_at is not null or candidate.email_confirmed_at is null or candidate.email is distinct from 'player-'||p_user::text||'@players.sponsorsorter.com' or nullif(candidate.phone,'') is not null then return false; end if;
 -- User-editable metadata never proves ownership. Only the service-created exact alias qualifies.
 if exists(select 1 from auth.identities where user_id=p_user and provider<>'email')
 or exists(select 1 from auth.mfa_factors where user_id=p_user)
 or exists(select 1 from auth.oauth_consents where user_id=p_user) then return false; end if;
 if exists(select 1 from storage.objects where owner=p_user or owner_id=p_user::text) then return false; end if;
 -- Conservative inventory of every non-Meadow application table, including JSON participant lists.
 -- A new app/table is covered automatically; missing/unknown ownership keeps the login intact.
 for col in
  select n.nspname,c.relname,a.attname,t.typname
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
  join pg_catalog.pg_type t on t.oid=a.atttypid
  where c.relkind in ('r','p') and n.nspname not like 'pg_%'
   and n.nspname not in ('information_schema','auth','storage','vault','realtime','extensions','graphql','graphql_public','cron','net','supabase_migrations','supabase_functions','meadow_private','meadow_market_private')
   and not (n.nspname='public' and c.relname like 'meadow_market_%')
   and t.typname in ('uuid','text','varchar','json','jsonb','_uuid','_text','_varchar')
 loop
  if col.typname='uuid' then
   execute format('select exists(select 1 from %I.%I where %I=$1)',col.nspname,col.relname,col.attname) into used using p_user;
  else
   execute format('select exists(select 1 from %I.%I where strpos(%I::text,$1)>0)',col.nspname,col.relname,col.attname) into used using p_user::text;
  end if;
  if used then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function meadow_private.exclusive_retired_login(uuid) from public,anon,authenticated,service_role;

create function meadow_private.queue_retired_login() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from meadow_private.deleted_game_accounts where account_hash=encode(sha256(convert_to('meadow-deleted:'||old.user_id::text,'UTF8')),'hex'))
 and exists(select 1 from auth.users where id=old.user_id and email='player-'||old.user_id::text||'@players.sponsorsorter.com' and deleted_at is null) then
  insert into meadow_private.auth_retirements(user_id) values(old.user_id) on conflict do nothing;
 end if;
 return old;
end $$;
revoke all on function meadow_private.queue_retired_login() from public,anon,authenticated,service_role;
create trigger meadow_queue_retired_login after delete on public.meadow_market_profiles for each row execute function meadow_private.queue_retired_login();

create function meadow_private.retire_login(p_action text,p_user uuid,p_lease uuid,p_success boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job meadow_private.auth_retirements; jobs jsonb:='[]'; token uuid;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501'; end if;
 if p_action='claim' then
  for job in select * from meadow_private.auth_retirements where retry_after<=now() and (lease_until is null or lease_until<now()) order by created_at limit 3 for update skip locked loop
   if not meadow_private.exclusive_retired_login(job.user_id) then
    delete from meadow_private.auth_retirements where user_id=job.user_id;
    continue;
   end if;
   token:=gen_random_uuid();
   update meadow_private.auth_retirements set lease=token,lease_until=now()+interval '3 minutes',attempts=attempts+1 where user_id=job.user_id;
   jobs:=jobs||jsonb_build_array(jsonb_build_object('user_id',job.user_id,'lease',token));
  end loop;
  return jobs;
 end if;
 select * into job from meadow_private.auth_retirements where user_id=p_user for update;
 if not found or p_lease is null or job.lease is distinct from p_lease or job.lease_until<now() then return 'false'::jsonb; end if;
 if p_action='confirm' then return to_jsonb(meadow_private.exclusive_retired_login(p_user));
 elsif p_action='finish' then
  if p_success is true and (not exists(select 1 from auth.users where id=p_user) or exists(select 1 from auth.users where id=p_user and deleted_at is not null)) then
   delete from meadow_private.auth_retirements where user_id=p_user;
   return 'true'::jsonb;
  end if;
  update meadow_private.auth_retirements set lease=null,lease_until=null,retry_after=now()+interval '1 hour' where user_id=p_user;
  return 'false'::jsonb;
 end if;
 raise exception 'Unknown cleanup action';
end $$;
revoke all on function meadow_private.retire_login(text,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function meadow_private.retire_login(text,uuid,uuid,boolean) to service_role;
create function public.meadow_market_retire_login(p_action text,p_user uuid default null,p_lease uuid default null,p_success boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select meadow_private.retire_login(p_action,p_user,p_lease,p_success)$$;
revoke all on function public.meadow_market_retire_login(text,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.meadow_market_retire_login(text,uuid,uuid,boolean) to service_role;

create index meadow_reports_target_lookup on meadow_private.player_reports(target_id);
create index meadow_reports_retention_date on meadow_private.player_reports(created_at);
