-- Recovery keys stay hashed. Reserve before Auth writes; consume only after it succeeds.
alter table public.meadow_market_accounts add column if not exists recovery_lease uuid;
alter table public.meadow_market_accounts add column if not exists recovery_lease_until timestamptz;
create or replace function public.meadow_market_reserve_recovery(p_username text,p_hash text,p_token uuid)
returns uuid language sql security invoker set search_path='' as $$
 update public.meadow_market_accounts set recovery_lease=p_token,recovery_lease_until=clock_timestamp()+interval '2 minutes'
 where username=p_username and ready and recovery_hash=p_hash
 and (recovery_lease is null or recovery_lease_until<clock_timestamp()) returning user_id;
$$;
create or replace function public.meadow_market_finish_recovery(p_user uuid,p_token uuid,p_success boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.meadow_market_accounts set
 recovery_hash=case when p_success then null else recovery_hash end,
 recovery_set_at=case when p_success then null else recovery_set_at end,
 recovery_lease=null,recovery_lease_until=null
 where user_id=p_user and recovery_lease=p_token;
 return found;
end;
$$;
create or replace function public.meadow_market_set_recovery(p_user uuid,p_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_hash is null or p_hash!~'^[a-f0-9]{64}$' then return false; end if;
 update public.meadow_market_accounts set recovery_hash=p_hash,recovery_set_at=clock_timestamp(),recovery_lease=null,recovery_lease_until=null
 where user_id=p_user and ready and (recovery_lease is null or recovery_lease_until<clock_timestamp());
 return found;
end;
$$;
revoke all on function public.meadow_market_claim_recovery(text,text) from public,anon,authenticated,service_role;
revoke all on function public.meadow_market_reserve_recovery(text,text,uuid),public.meadow_market_finish_recovery(uuid,uuid,boolean),public.meadow_market_set_recovery(uuid,text) from public,anon,authenticated;
grant execute on function public.meadow_market_reserve_recovery(text,text,uuid),public.meadow_market_finish_recovery(uuid,uuid,boolean),public.meadow_market_set_recovery(uuid,text) to service_role;
