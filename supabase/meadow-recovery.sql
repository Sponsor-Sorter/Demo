-- Meadow Markets username recovery. No plaintext recovery keys are retained.
alter table public.meadow_market_accounts add column if not exists recovery_hash text;
alter table public.meadow_market_accounts add column if not exists recovery_set_at timestamptz;
revoke select on public.meadow_market_accounts from authenticated;
grant select(username,user_id,ready,created_at,recovery_set_at) on public.meadow_market_accounts to authenticated;
create or replace function public.meadow_market_claim_recovery(p_username text,p_hash text)
returns uuid language sql security invoker set search_path = '' as $$
 update public.meadow_market_accounts set recovery_hash=null,recovery_set_at=null
 where username=p_username and ready=true and recovery_hash=p_hash
 returning user_id;
$$;
revoke all on function public.meadow_market_claim_recovery(text,text) from public,anon,authenticated;
grant execute on function public.meadow_market_claim_recovery(text,text) to service_role;
