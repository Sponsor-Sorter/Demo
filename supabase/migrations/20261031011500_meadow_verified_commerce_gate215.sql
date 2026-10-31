-- Opening the store globally must not charge a farm still using beta snapshots.
-- Receipt replay and already-issued provider callbacks remain deliverable.
create function meadow_private.farm_commerce_ready(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.meadow_market_saves s
  join meadow_private.farm_command_accounts c on c.user_id=s.user_id
  join meadow_private.farm_origins o on o.user_id=s.user_id
  where s.user_id=p_user and s.save_protocol=4
   and not exists(select 1 from meadow_private.account_deletions d where d.user_id=s.user_id));
$$;
revoke all on function meadow_private.farm_commerce_ready(uuid) from public,anon,authenticated;

create or replace function meadow_private.commerce_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c meadow_private.commerce_config;tester boolean;protected boolean;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Sign in to Meadow Markets' using errcode='28000';end if;
 select * into c from meadow_private.commerce_config where id;
 tester:=exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now());
 protected:=meadow_private.farm_commerce_ready(u);
 return jsonb_build_object('test_access',tester,'farm_authoritative',protected,
  'payments_enabled',c.payments_enabled and c.production_ready and protected,
  'ads_enabled',c.ads_enabled and c.production_ready and protected,
  'purchase_account_ready',exists(select 1 from public.meadow_market_accounts a join auth.users au on au.id=a.user_id where a.user_id=u and a.ready and au.is_anonymous is false),
  'account_id',encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),
  'products',(select coalesce(jsonb_agg(jsonb_build_object('sku',sku,'product_id',product_id,'consumable',consumable)),'[]') from meadow_private.store_products where enabled));
end $$;

do $migration$
declare body text;marker text;
begin
 body:=pg_get_functiondef('public.meadow_market_deliver_store_purchase(uuid,text,text,text,boolean)'::regprocedure);
 marker:=' if not c.payments_enabled or not c.production_ready then raise exception ''Store not open'';end if;';
 if position(marker in body)=0 then raise exception 'Review purchase delivery before adding farm gate';end if;
 body:=replace(body,marker,marker||E'\n if not meadow_private.farm_commerce_ready(p_user) then raise exception ''Upgrade this farm to verified online play before purchasing'' using errcode=''42501'';end if;');execute body;
 body:=pg_get_functiondef('meadow_private.start_ad_reward()'::regprocedure);
 marker:=' perform pg_advisory_xact_lock(hashtextextended(u::text,195));';
 if position(marker in body)=0 then raise exception 'Review ad issuance before adding farm gate';end if;
 body:=replace(body,marker,E' if not meadow_private.farm_commerce_ready(u) then raise exception ''Upgrade this farm to verified online play before rewarded ads'' using errcode=''42501'';end if;\n'||marker);execute body;
end $migration$;
