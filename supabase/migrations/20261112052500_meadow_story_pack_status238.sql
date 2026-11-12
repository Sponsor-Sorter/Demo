CREATE OR REPLACE FUNCTION meadow_private.commerce_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Cached clients must never treat an acceptance lease as production ads.
  'ads_enabled',(c.ads_enabled and c.production_ready and protected) and not ad_test,
  'isolated_ads_enabled',ad_test,
  'purchase_account_ready',exists(select 1 from public.meadow_market_accounts a join auth.users au on au.id=a.user_id where a.user_id=u and a.ready and au.is_anonymous is false),
  'account_id',encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),
  'owned_products',(select coalesce(jsonb_agg(p.sku),'[]') from meadow_private.store_products p where p.delivery ? 'collectible' and exists(select 1 from public.meadow_market_collectibles owned_item where owned_item.user_id=u and owned_item.item_id=p.delivery->>'collectible')),
  'products',(select coalesce(jsonb_agg(jsonb_build_object('sku',p.sku,'product_id',p.product_id,'consumable',p.consumable)),'[]')
   from meadow_private.store_products p where case when license_test then meadow_private.play_license_test_allowed(u,p.product_id) else p.enabled end));
end $function$
;
