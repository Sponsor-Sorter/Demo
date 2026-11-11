-- Meadow Markets only. Central gift writes/capability activation belong to Fairplay Admin.
-- Preserve already-enabled pre-store preview access. This frozen import is not a new grant
-- interface or purchase proof, and future wallet bits cannot add rows here.
create table meadow_private.legacy_premium234 (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 source text not null check(source='pre234_server_test_preview'),
 preserved_at timestamptz not null default now()
);
alter table meadow_private.legacy_premium234 enable row level security;
revoke all on meadow_private.legacy_premium234 from public,anon,authenticated,service_role;
insert into meadow_private.legacy_premium234(user_id,source)
 select w.user_id,'pre234_server_test_preview' from public.meadow_market_wallets w
 where w.premium and exists(select 1 from public.meadow_market_economy_receipts e where e.user_id=w.user_id and e.kind='purchase')
 and not exists(select 1 from meadow_private.store_purchases p where p.user_id=w.user_id)
 and not exists(select 1 from meadow_private.support_grants g where g.user_id=w.user_id and g.body->>'premium'='true')
 and not public.fairplay_complimentary_entitled('meadow',w.user_id,'premium');
comment on table meadow_private.legacy_premium234 is 'Frozen existing pre234 free-preview Premium access, backed by server test receipts. Not verified purchase evidence. No client or service-role grant interface.';

-- Verified delivery is the paid proof; Play acknowledgement may still be retrying.
create function meadow_private.premium_sources(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'paid',exists(select 1 from meadow_private.store_purchases a
   join public.meadow_market_economy_receipts e on e.id=a.receipt_id and e.user_id=a.user_id and e.kind='play_purchase'
   left join meadow_private.store_products p on p.product_id=a.product_id
   where a.user_id=p_user and a.revoked_at is null
    and case when a.benefits ? 'premium' then a.benefits->'premium'='true'::jsonb else coalesce(p.premium,false) end),
  'support',exists(select 1 from meadow_private.support_grants g where g.user_id=p_user and g.body->>'premium'='true')
   or exists(select 1 from meadow_private.legacy_premium234 l where l.user_id=p_user),
  'legacy_preview',exists(select 1 from meadow_private.legacy_premium234 l where l.user_id=p_user),
  'complimentary',public.fairplay_complimentary_entitled('meadow',p_user,'premium'))
$$;
revoke all on function meadow_private.premium_sources(uuid) from public,anon,authenticated,service_role;

create function meadow_private.refresh_premium(p_user uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare sources jsonb; effective boolean;
begin
 sources:=meadow_private.premium_sources(p_user);
 effective:=(sources->>'paid')::boolean or (sources->>'support')::boolean or (sources->>'complimentary')::boolean;
 update public.meadow_market_wallets set premium=effective,updated_at=now()
  where user_id=p_user and premium is distinct from effective;
 return effective;
end $$;
revoke all on function meadow_private.refresh_premium(uuid) from public,anon,authenticated,service_role;

-- Own-account refresh is deliberately lightweight: no receipt history or farm save mutation.
create function public.meadow_market_premium_status() returns jsonb
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
revoke all on function public.meadow_market_premium_status() from public,anon;
grant execute on function public.meadow_market_premium_status() to authenticated;

-- A service-only projection for the existing app-scoped admin reader; it grants nothing.
create function public.meadow_market_premium_projection(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role'
  then raise exception 'Backend only' using errcode='42501';end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=p_user) then return null;end if;
 s:=meadow_private.premium_sources(p_user);
 return s||jsonb_build_object('premium',(s->>'paid')::boolean or (s->>'support')::boolean or (s->>'complimentary')::boolean,
  'contract','meadow-premium234');
end $$;
revoke all on function public.meadow_market_premium_projection(uuid) from public,anon,authenticated;
grant execute on function public.meadow_market_premium_projection(uuid) to service_role;

-- Retain the existing commerce, test-access, moderation and deletion guards.
create or replace function meadow_private.play_service(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r jsonb; effective boolean;
begin
 if u is null then raise exception 'Sign in first' using errcode='28000';end if;
 if exists(select 1 from meadow_private.account_deletions where user_id=u) then raise exception 'Account deletion is pending. Cancel it in Settings to resume.';end if;
 if p_action in ('purchase','ad_reward') and not exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now()) then
  raise exception 'Use Google Play for purchases. Free test packs are available only to approved test accounts.' using errcode='42501';
 end if;
 if p_action='event' and exists(select 1 from meadow_private.farm_command_accounts where user_id=u) then
  raise exception 'Farm missions are recorded by verified farm actions' using errcode='42501';
 end if;
 perform meadow_private.refresh_premium(u);
 r:=meadow_private.play_service_before_store(p_action,p_data);
 -- Preserve future approved free-test Premium purchases as explicit server-only support evidence.
 if p_action='purchase' and p_data->>'sku'='premium' and r->'receipt'->>'id' is not null then
  insert into meadow_private.support_grants(request_id,user_id,reason,body,receipt_id)
  values((r->'receipt'->>'request_id')::uuid,u,'Approved free-test Premium purchase',
   '{"premium":true,"test_only":true,"reason":"Approved free-test Premium purchase"}',(r->'receipt'->>'id')::uuid)
  on conflict(request_id) do nothing;
 end if;
 effective:=meadow_private.refresh_premium(u);
 if r ? 'wallet' then r:=jsonb_set(r,'{wallet,premium}',to_jsonb(effective));end if;
 return r||jsonb_build_object('commerce',meadow_private.commerce_status(),'premium_verified',true);
end $$;

-- Only the Premium recomputation changes. Refund amounts, holds and farm-effect rollback stay intact.
do $migration$
declare definition text; original text;
begin
 definition:=pg_get_functiondef('public.meadow_market_revoke_store_purchase(text)'::regprocedure);
 original:=$old$ if p.premium then
  update public.meadow_market_wallets set premium=exists(select 1 from meadow_private.store_purchases a join meadow_private.store_products b on b.product_id=a.product_id where a.user_id=r.user_id and a.revoked_at is null and b.premium)
   or exists(select 1 from meadow_private.support_grants g where g.user_id=r.user_id and g.body->>'premium'='true') where user_id=r.user_id;
 end if;$old$;
 definition:=replace(definition,E'\r\n',E'\n');
 if position(original in definition)=0 then raise exception 'Refund function changed; review before applying';end if;
 definition:=replace(definition,original,' perform meadow_private.refresh_premium(r.user_id);');
 definition:=replace(definition,'if r.revoked_at is not null then return true;end if;',
  'if r.revoked_at is not null then perform meadow_private.refresh_premium(r.user_id);return true;end if;');
 execute definition;
end $migration$;

comment on function public.meadow_market_premium_status() is 'Meadow234: own-account paid OR private support OR active central gift, with expiry/revocation refresh. No grant writes.';
comment on function public.meadow_market_premium_projection(uuid) is 'Service-only Meadow234 entitlement evidence. Acknowledgement retry does not remove already delivered verified paid access. No grant writes.';
