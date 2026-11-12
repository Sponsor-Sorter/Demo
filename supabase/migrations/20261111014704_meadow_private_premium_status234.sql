-- Put privileged own-account work behind the non-exposed private schema.
create function meadow_private.premium_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); effective boolean;
begin
 perform meadow_private.control_guard('read',u);
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u)
  then raise exception 'Sign in to Meadow Markets' using errcode='28000';end if;
 if exists(select 1 from meadow_private.account_deletions where user_id=u)
  then raise exception 'Account deletion is pending';end if;
 effective:=meadow_private.refresh_premium(u);
 return jsonb_build_object('premium',effective,'verified',true);
end $$;
revoke all on function meadow_private.premium_status() from public,anon,service_role;
grant execute on function meadow_private.premium_status() to authenticated;

create or replace function public.meadow_market_premium_status() returns jsonb
language sql security invoker set search_path='' as $$select meadow_private.premium_status()$$;
revoke all on function public.meadow_market_premium_status() from public,anon;
grant execute on function public.meadow_market_premium_status() to authenticated;
