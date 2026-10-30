-- All current clients save through the locked, receipt-aware protocol3 RPC.
-- Retiring direct writes and the invoker protocol2 route also prevents a fresh
-- account from planting forged paid upgrades in a legacy baseline first.
create or replace function meadow_private.guard_farm_economy_protocol() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  raise exception 'Update Meadow Markets before syncing this farm' using errcode='40001';
 end if;
 return new;
end $$;
revoke all on function meadow_private.guard_farm_economy_protocol() from public,anon,authenticated;
