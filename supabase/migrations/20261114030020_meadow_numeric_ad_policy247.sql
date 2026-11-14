-- Add only the reviewed private policy projection. Gates/products/rewards remain
-- owned by the existing own-account commerce and pack functions.
set local statement_timeout='15s';
do $$
declare definition text; owner_name text;
begin
 select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into definition,owner_name
 from pg_proc p where p.oid='public.meadow_market_commerce_status()'::regprocedure;
 if owner_name<>'postgres' or position('meadow_private.commerce_status239()' in definition)=0
 or position('meadow_private.pack_grants240(auth.uid())' in definition)=0 then
  raise exception 'Review current Meadow commerce adapter before applying247';
 end if;
end $$;

create function meadow_private.numeric_ad_policy247() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if to_regprocedure('fairplay_admin_private.meadow_ad_policy_read_v1()') is null then return null;end if;
 -- Resolve only the fixed private reader. Do not catch ACL or deployment errors
 -- and misrepresent them as a valid accepted policy.
 execute 'select fairplay_admin_private.meadow_ad_policy_read_v1()' into result;
 return result;
end $$;
revoke all on function meadow_private.numeric_ad_policy247() from public,anon,authenticated,service_role;

create or replace function public.meadow_market_commerce_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 -- Existing checks run first, derive auth.uid(), retain moderation and all pack
 -- grant fields. No supplied app/actor/build can widen the caller's authority.
 result:=meadow_private.commerce_status239()||jsonb_build_object('pack_grants',meadow_private.pack_grants240(auth.uid()));
 return result||jsonb_build_object('numeric_ad_policy',meadow_private.numeric_ad_policy247());
end $$;
revoke all on function public.meadow_market_commerce_status() from public,anon,service_role;
grant execute on function public.meadow_market_commerce_status() to authenticated;
comment on function meadow_private.numeric_ad_policy247() is 'Meadow247: fixed optional private reader, no actor/app parameters or browser grant; missing reader only yields null.';
