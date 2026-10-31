-- Named operator-controlled acceptance only. Public ads remain independently off.
-- Google AdMob must mark the exact native version as non-revenue test traffic.
create table meadow_private.ad_provider_acceptance (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 reason text not null check(length(reason) between 12 and 500),
 native_version text not null check(native_version='1.7.2'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check(expires_at>created_at and expires_at<=created_at+interval '1 day')
);
alter table meadow_private.ad_provider_acceptance enable row level security;
revoke all on meadow_private.ad_provider_acceptance from public,anon,authenticated,service_role;
comment on table meadow_private.ad_provider_acceptance is 'Private manual ad acceptance, max24h. Native version is operator evidence, not client attestation. Actual AdMob test mode is configured independently. No direct reward grants.';

create function meadow_private.ad_provider_test_allowed(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select meadow_private.farm_commerce_ready(p_user)
 and exists(select 1 from meadow_private.ad_provider_acceptance t
  join public.meadow_market_accounts a on a.user_id=t.user_id
  join auth.users u on u.id=a.user_id
  where t.user_id=p_user and t.created_at<=now() and t.expires_at>now()
   and a.ready and u.is_anonymous is false)
 and not exists(select 1 from meadow_private.store_review_holds h where h.user_id=p_user)
$$;
revoke all on function meadow_private.ad_provider_test_allowed(uuid) from public,anon,authenticated,service_role;

create or replace function meadow_private.commerce_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c meadow_private.commerce_config;tester boolean;protected boolean;license_test boolean;ad_test boolean;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Sign in to Meadow Markets' using errcode='28000';end if;
 select * into c from meadow_private.commerce_config where id;
 protected:=meadow_private.farm_commerce_ready(u);
 license_test:=meadow_private.play_license_test_allowed(u);
 ad_test:=meadow_private.ad_provider_test_allowed(u);
 tester:=not license_test and exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now());
 return jsonb_build_object('test_access',tester,'provider_test',license_test,'ads_provider_test',ad_test,'farm_authoritative',protected,
  'purchase_review_required',exists(select 1 from meadow_private.store_review_holds h where h.user_id=u),
  'payments_enabled',(c.payments_enabled and c.production_ready and protected and not exists(select 1 from meadow_private.store_review_holds h where h.user_id=u)) or license_test,
  'ads_enabled',(c.ads_enabled and c.production_ready and protected) or ad_test,
  'purchase_account_ready',exists(select 1 from public.meadow_market_accounts a join auth.users au on au.id=a.user_id where a.user_id=u and a.ready and au.is_anonymous is false),
  'account_id',encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),
  'products',(select coalesce(jsonb_agg(jsonb_build_object('sku',p.sku,'product_id',p.product_id,'consumable',p.consumable)),'[]')
   from meadow_private.store_products p where case when license_test then meadow_private.play_license_test_allowed(u,p.product_id) else p.enabled end));
end $$;

create or replace function meadow_private.start_ad_reward() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n uuid;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Sign in first';end if;
 if not exists(select 1 from meadow_private.commerce_config where id and ads_enabled and production_ready)
  and not meadow_private.ad_provider_test_allowed(u) then raise exception 'Ads are not enabled';end if;
 if not meadow_private.farm_commerce_ready(u) then raise exception 'Upgrade this farm to verified online play before rewarded ads' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,195));
 if exists(select 1 from meadow_private.account_deletions where user_id=u) then raise exception 'Account unavailable';end if;
 if (select count(*) from meadow_private.ad_rewards where user_id=u and created_at>now()-interval '1 hour')>=10 then raise exception 'Please try later';end if;
 if (select count(*) from meadow_private.ad_rewards where user_id=u and receipt_id is not null and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 then raise exception 'Three daily ad rewards already collected';end if;
 insert into meadow_private.ad_rewards(user_id) values(u) returning nonce into n;
 return jsonb_build_object('nonce',n);
end $$;
