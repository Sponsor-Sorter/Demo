-- Isolated Google license tests; no customer checkout or ad activation.
create table meadow_private.play_license_acceptance (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 product_ids text[] not null check(cardinality(product_ids) between 1 and 2
  and product_ids <@ array['mm_pocket_gems','mm_premium']::text[]),
 reason text not null check(length(reason) between 12 and 500),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check(expires_at>created_at and expires_at<=created_at+interval '7 days')
);
alter table meadow_private.play_license_acceptance enable row level security;
revoke all on meadow_private.play_license_acceptance from public,anon,authenticated,service_role;
comment on table meadow_private.play_license_acceptance is 'Operator-only, expiring provider acceptance. Google must independently verify purchaseType=0. This does not authorize real purchases or ads.';

create function meadow_private.play_license_test_allowed(p_user uuid,p_product text default null) returns boolean
language sql stable security definer set search_path='' as $$
 select meadow_private.farm_commerce_ready(p_user)
 and exists(select 1 from meadow_private.play_license_acceptance t
  join public.meadow_market_accounts a on a.user_id=t.user_id
  join auth.users u on u.id=a.user_id
  where t.user_id=p_user and t.created_at<=now() and t.expires_at>now()
   and a.ready and u.is_anonymous is false
   and (p_product is null or p_product=any(t.product_ids)))
 and not exists(select 1 from meadow_private.store_review_holds h where h.user_id=p_user);
$$;
revoke all on function meadow_private.play_license_test_allowed(uuid,text) from public,anon,authenticated,service_role;

create or replace function meadow_private.commerce_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c meadow_private.commerce_config;tester boolean;protected boolean;license_test boolean;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Sign in to Meadow Markets' using errcode='28000';end if;
 select * into c from meadow_private.commerce_config where id;
 protected:=meadow_private.farm_commerce_ready(u);
 license_test:=meadow_private.play_license_test_allowed(u);
 tester:=not license_test and exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now());
 return jsonb_build_object('test_access',tester,'provider_test',license_test,'farm_authoritative',protected,
  'payments_enabled',(c.payments_enabled and c.production_ready and protected) or license_test,
  'ads_enabled',c.ads_enabled and c.production_ready and protected,
  'purchase_account_ready',exists(select 1 from public.meadow_market_accounts a join auth.users au on au.id=a.user_id where a.user_id=u and a.ready and au.is_anonymous is false),
  'account_id',encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),
  'products',(select coalesce(jsonb_agg(jsonb_build_object('sku',p.sku,'product_id',p.product_id,'consumable',p.consumable)),'[]')
   from meadow_private.store_products p where case when license_test then meadow_private.play_license_test_allowed(u,p.product_id) else p.enabled end));
end $$;

do $migration$
declare body text;marker text;
begin
 body:=pg_get_functiondef('public.meadow_market_deliver_store_purchase(uuid,text,text,text,boolean)'::regprocedure);
 marker:=' if not c.payments_enabled or not c.production_ready then raise exception ''Store not open'';end if;';
 if position(marker in body)=0 then raise exception 'Review purchase delivery before adding license acceptance';end if;
 body:=replace(body,marker,$gate$
 if meadow_private.play_license_test_allowed(p_user) then
  if p_test is distinct from true or not meadow_private.play_license_test_allowed(p_user,p_product) then
   raise exception 'Only the approved Google license test purchase is allowed' using errcode='42501';
  end if;
 elsif not c.payments_enabled or not c.production_ready then raise exception 'Store not open';end if;
$gate$);
 marker:='where product_id=p_product and enabled;';
 if position(marker in body)=0 then raise exception 'Review product availability before adding license acceptance';end if;
 body:=replace(body,marker,'where product_id=p_product and (enabled or (p_test is true and meadow_private.play_license_test_allowed(p_user,p_product)));');
 execute body;
end $migration$;
