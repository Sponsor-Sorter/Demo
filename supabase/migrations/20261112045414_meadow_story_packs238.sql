-- Meadow Markets 238 only: fixed cosmetic keepsakes. Existing store gates and history stay intact.
insert into public.meadow_market_collection_catalog(id,definition) values ('collection_pack_welcome','{"sku":"welcome_garden","product":"mm_welcome_garden","id":"collection_pack_welcome","name":"Welcome Garden","w":2,"h":1,"chapter":0,"description":"A sunflower farm sign and two matching planters, arranged as one movable garden display.","contents":["Sunflower farm sign","Two matching flower planters"],"heightScale":2.4,"art":"assets/generated/story238/welcome_garden-r0.webp","thumb":"assets/generated/story238/welcome_garden-thumb.webp","kind":"collection","set":"Harvest Fair keepsakes","theme":"story","effect":"none","rarity":"keepsake","purchaseOnly":true,"walkable":false,"price":0}'::jsonb),
('collection_pack_coop','{"sku":"coop_charm","product":"mm_coop_charm","id":"collection_pack_coop","name":"Coop Charm","w":1,"h":1,"chapter":1,"description":"A carved rooster ornament, flower boxes and a blue picket panel, arranged as one movable coop-side display.","contents":["Painted rooster ornament","Daisy flower boxes","Blue country picket panel"],"heightScale":3.4,"art":"assets/generated/story238/coop_charm-r0.webp","thumb":"assets/generated/story238/coop_charm-thumb.webp","kind":"collection","set":"Harvest Fair keepsakes","theme":"story","effect":"none","rarity":"keepsake","purchaseOnly":true,"walkable":false,"price":0}'::jsonb),
('collection_pack_market','{"sku":"market_makeover","product":"mm_market_makeover","id":"collection_pack_market","name":"Market Makeover","w":2,"h":1,"chapter":3,"description":"A striped awning, hanging chalkboard and produce crates, arranged as one movable market display.","contents":["Striped market awning","Hanging chalkboard","Apple, carrot and cabbage display"],"heightScale":2.6,"art":"assets/generated/story238/market_makeover-r0.webp","thumb":"assets/generated/story238/market_makeover-thumb.webp","kind":"collection","set":"Harvest Fair keepsakes","theme":"story","effect":"none","rarity":"keepsake","purchaseOnly":true,"walkable":false,"price":0}'::jsonb) on conflict(id) do update set definition=excluded.definition;
insert into meadow_private.store_products(sku,product_id,delivery,consumable,enabled) values ('welcome_garden','mm_welcome_garden','{"collectible":"collection_pack_welcome"}'::jsonb,false,false),
('coop_charm','mm_coop_charm','{"collectible":"collection_pack_coop"}'::jsonb,false,false),
('market_makeover','mm_market_makeover','{"collectible":"collection_pack_market"}'::jsonb,false,false) on conflict(sku) do update set delivery=excluded.delivery,consumable=false;
-- Paid keepsakes never enter earned seeds or rotating gem offers.
create or replace view meadow_private.earned_collection_catalog238 with(security_invoker=true) as select * from public.meadow_market_collection_catalog where coalesce((definition->>'purchaseOnly')::boolean,false)=false;
revoke all on meadow_private.earned_collection_catalog238 from public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION meadow_private.collection_service(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid:=auth.uid(); coins_wallet public.meadow_market_wallets; cwallet public.meadow_market_collection_wallets;
 request uuid; found_receipt public.meadow_market_economy_receipts; item meadow_private.earned_collection_catalog238; prize text;
 day_key text:=to_char(now() at time zone 'UTC','YYYY-MM-DD');week_key text:=to_char(date_trunc('week',now() at time zone 'UTC'),'YYYY-MM-DD');
 offers jsonb; owned jsonb; available jsonb; achievements jsonb:='[]'; checks record; n int; best_level int; wins int; plays int; variety int; claims text; reward_tokens int:=0; weight numeric; roll numeric; rarity text; key text;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Connect your Meadow Markets account first';end if;
 insert into public.meadow_market_wallets(user_id) values(u) on conflict do nothing;
 select * into coins_wallet from public.meadow_market_wallets where user_id=u for update;
 insert into public.meadow_market_collection_wallets(user_id) values(u) on conflict do nothing;
 select * into cwallet from public.meadow_market_collection_wallets where user_id=u for update;
 select count(*),count(*) filter(where won),count(distinct game) into plays,wins,variety from public.meadow_market_play_runs where user_id=u;
 select greatest(1,coalesce((save_data->>'level')::int,1)) into best_level from public.meadow_market_saves where user_id=u;
 best_level:=coalesce(best_level,1);
 if p_action in ('draw','buy','claim','test_tokens') then
  request:=(p_data->>'id')::uuid;
  select * into found_receipt from public.meadow_market_economy_receipts where user_id=u and request_id=request;
  if not found then
   if p_action='draw' then
    if cwallet.tokens<1 then raise exception 'Earn a collection seed through achievements or claim your daily seed';end if;
    select sum(bucket_weight) into weight from (select distinct definition->>'rarity' rarity,case definition->>'rarity' when 'common' then 50 when 'rare' then 30 when 'epic' then 15 else 5 end bucket_weight from meadow_private.earned_collection_catalog238 c where not exists(select 1 from public.meadow_market_collectibles o where o.user_id=u and o.item_id=c.id)) buckets;
    if weight is null then raise exception 'Your collection is complete! No seed was spent';end if;
    roll:=random()*weight;
    for checks in select r.rarity,r.weight,sum(r.weight) over(order by r.rarity) ceiling from (select distinct definition->>'rarity' rarity,case definition->>'rarity' when 'common' then 50 when 'rare' then 30 when 'epic' then 15 else 5 end weight from meadow_private.earned_collection_catalog238 c where not exists(select 1 from public.meadow_market_collectibles o where o.user_id=u and o.item_id=c.id)) r order by r.rarity loop
     if roll<checks.ceiling then rarity:=checks.rarity;exit;end if;
    end loop;
    select * into item from meadow_private.earned_collection_catalog238 c where definition->>'rarity'=rarity and not exists(select 1 from public.meadow_market_collectibles o where o.user_id=u and o.item_id=c.id) order by random() limit 1;
    update public.meadow_market_collection_wallets set tokens=tokens-1 where user_id=u;
    prize:=item.id;
   elsif p_action='buy' then
    select * into item from meadow_private.earned_collection_catalog238 where id=p_data->>'item';
    if not found then raise exception 'Unknown collectible';end if;
    if not exists(select 1 from (select id from meadow_private.earned_collection_catalog238 order by md5(day_key||id) limit 6) d where d.id=item.id) and not exists(select 1 from (select id from meadow_private.earned_collection_catalog238 where definition->>'rarity' in ('rare','epic','legendary') order by md5(week_key||id) limit 4) w where w.id=item.id) then raise exception 'This collectible is not in the current rotation';end if;
    if exists(select 1 from public.meadow_market_collectibles where user_id=u and item_id=item.id) then raise exception 'You already own this collectible';end if;
    if coins_wallet.gems<(item.definition->>'price')::int then raise exception 'Get free test gems in the emporium first';end if;
    update public.meadow_market_wallets set gems=gems-(item.definition->>'price')::int,vip_xp=vip_xp+(item.definition->>'price')::int where user_id=u;
    prize:=item.id;
   elsif p_action='test_tokens' then
    if (select count(*) from public.meadow_market_economy_receipts where user_id=u and kind='collection_test_tokens' and created_at>=(now() at time zone 'UTC')::date::timestamptz)>=20 then raise exception 'Test seeds claimed twenty times today';end if;
    reward_tokens:=5;
   elsif p_action='claim' then
    key:=p_data->>'key';
    if key='daily' then claims:='collection_daily:'||day_key;reward_tokens:=1;
    elsif key='first_win' and wins>=1 then claims:='collection_first_win';reward_tokens:=2;
    elsif key='ten_wins' and wins>=10 then claims:='collection_ten_wins';reward_tokens:=3;
    elsif key='twenty_five_wins' and wins>=25 then claims:='collection_twenty_five_wins';reward_tokens:=5;
    elsif key='five_games' and variety>=5 then claims:='collection_five_games';reward_tokens:=3;
    elsif key='twenty_plays' and plays>=20 then claims:='collection_twenty_plays';reward_tokens:=3;
    elsif key='tractor' and exists(select 1 from public.meadow_market_play_runs where user_id=u and game='tractorrepair' and won) then claims:='collection_tractor';reward_tokens:=2;if not exists(select 1 from public.meadow_market_collectibles where user_id=u and item_id='collection_091') then prize:='collection_091';end if;
    elsif key='level' then
     n:=(p_data->>'level')::int;
     if n<5 or n>100 or n%5<>0 or best_level<n then raise exception 'Reach this level milestone first';end if;
     claims:='collection_level:'||n;reward_tokens:=2;
    else raise exception 'Keep playing to finish this achievement';end if;
    if exists(select 1 from public.meadow_market_economy_receipts where user_id=u and claim_key=claims) then raise exception 'This collection reward was already claimed';end if;
   end if;
   if prize is not null then insert into public.meadow_market_collectibles(user_id,item_id,source) values(u,prize,p_action);end if;
   if reward_tokens>0 then update public.meadow_market_collection_wallets set tokens=tokens+reward_tokens where user_id=u;end if;
   insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(u,request,'collection_'||p_action,claims,jsonb_build_object('collectible',prize)) returning * into found_receipt;
  else prize:=found_receipt.delivery->>'collectible';end if;
 elsif p_action<>'status' then raise exception 'Unknown collection action';end if;
 select coalesce(jsonb_agg(item_id order by acquired_at),'[]') into owned from public.meadow_market_collectibles where user_id=u;
 select jsonb_build_object('daily',(select jsonb_agg(id) from (select id from meadow_private.earned_collection_catalog238 order by md5(day_key||id) limit 6) d),'weekly',(select jsonb_agg(id) from (select id from meadow_private.earned_collection_catalog238 where definition->>'rarity' in ('rare','epic','legendary') order by md5(week_key||id) limit 4) w)) into offers;
 select coalesce(jsonb_agg(to_jsonb(b)),'[]') into available from (select definition->>'rarity' rarity,count(*) remaining,case definition->>'rarity' when 'common' then 50 when 'rare' then 30 when 'epic' then 15 else 5 end weight from meadow_private.earned_collection_catalog238 c where not exists(select 1 from public.meadow_market_collectibles o where o.user_id=u and o.item_id=c.id) group by definition->>'rarity') b;
 for checks in select * from (values ('daily','Visit the collection cabinet',1,1,1,'collection_daily:'||day_key),('first_win','Win your first farm game',wins,1,2,'collection_first_win'),('ten_wins','Win ten farm games',wins,10,3,'collection_ten_wins'),('twenty_five_wins','Win twenty-five farm games',wins,25,5,'collection_twenty_five_wins'),('five_games','Try five different games',variety,5,3,'collection_five_games'),('twenty_plays','Finish twenty games',plays,20,3,'collection_twenty_plays'),('tractor','Restore Rhys’s tractor · unlock vintage tractor treasure',case when exists(select 1 from public.meadow_market_play_runs where user_id=u and game='tractorrepair' and won) then 1 else 0 end,1,2,'collection_tractor')) t(id,title,progress,target,seeds,claim) loop
  achievements:=achievements||jsonb_build_array(jsonb_build_object('id',checks.id,'title',checks.title,'progress',checks.progress,'target',checks.target,'seeds',checks.seeds,'claimed',exists(select 1 from public.meadow_market_economy_receipts where user_id=u and claim_key=checks.claim)));
 end loop;
 for n in 1..20 loop
  achievements:=achievements||jsonb_build_array(jsonb_build_object('id','level','level',n*5,'title','Reach farm level '||n*5,'progress',best_level,'target',n*5,'seeds',2,'claimed',exists(select 1 from public.meadow_market_economy_receipts where user_id=u and claim_key='collection_level:'||n*5)));
 end loop;
 select * into cwallet from public.meadow_market_collection_wallets where user_id=u;
 select * into coins_wallet from public.meadow_market_wallets where user_id=u;
 return jsonb_build_object('owned',owned,'tokens',cwallet.tokens,'gems',coins_wallet.gems,'offers',offers,'odds',available,'achievements',achievements,'prize',prize,'test',true,'day',day_key,'week',week_key);
end $function$
;
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
  'owned_products',(select coalesce(jsonb_agg(p.sku),'[]') from meadow_private.store_products p where p.delivery ? 'collectible' and exists(select 1 from public.meadow_market_collectibles c where c.user_id=u and c.item_id=p.delivery->>'collectible')),
  'products',(select coalesce(jsonb_agg(jsonb_build_object('sku',p.sku,'product_id',p.product_id,'consumable',p.consumable)),'[]')
   from meadow_private.store_products p where case when license_test then meadow_private.play_license_test_allowed(u,p.product_id) else p.enabled end));
end $function$
;
CREATE OR REPLACE FUNCTION public.meadow_market_deliver_store_purchase(p_user uuid, p_product text, p_token_hash text, p_order text, p_test boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p meadow_private.store_products; prior meadow_private.store_purchases; rid uuid; w public.meadow_market_wallets; c meadow_private.commerce_config;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' or p_test is null then raise exception 'Invalid purchase';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
 select * into prior from meadow_private.store_purchases where token_hash=p_token_hash;
 if found then
  if prior.user_id<>p_user or prior.product_id<>p_product or prior.revoked_at is not null then raise exception 'Purchase belongs to another account or was revoked';end if;
  return jsonb_build_object('receipt_id',prior.receipt_id,'duplicate',true,'settled',prior.settled);
 end if;
 select * into c from meadow_private.commerce_config where id;

 if meadow_private.play_license_test_allowed(p_user) then
  if p_test is distinct from true or not meadow_private.play_license_test_allowed(p_user,p_product) then
   raise exception 'Only the approved Google license test purchase is allowed' using errcode='42501';
  end if;
 elsif not c.payments_enabled or not c.production_ready then raise exception 'Store not open';end if;

 if not meadow_private.farm_commerce_ready(p_user) then raise exception 'Upgrade this farm to verified online play before purchasing' using errcode='42501';end if;
 if not exists(select 1 from public.meadow_market_accounts a join auth.users au on au.id=a.user_id where a.user_id=p_user and a.ready and au.is_anonymous is false) then raise exception 'Protect your farm before purchasing' using errcode='42501';end if;
 if exists(select 1 from meadow_private.store_review_holds where user_id=p_user) then raise exception 'Purchases need a support review after a refund';end if;
 select * into p from meadow_private.store_products where product_id=p_product and (enabled or (p_test is true and meadow_private.play_license_test_allowed(p_user,p_product)));
 if not found then raise exception 'Product unavailable';end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=p_user) or exists(select 1 from meadow_private.account_deletions where user_id=p_user) then raise exception 'Account unavailable';end if;
 insert into public.meadow_market_wallets(user_id) values(p_user) on conflict do nothing;
 select * into w from public.meadow_market_wallets where user_id=p_user for update;
 if p.delivery ? 'collectible' and exists(select 1 from public.meadow_market_collectibles where user_id=p_user and item_id=p.delivery->>'collectible') then raise exception 'Product already owned';end if;
 if not p.consumable and exists(select 1 from meadow_private.store_purchases where user_id=p_user and product_id=p_product and revoked_at is null) then raise exception 'Product already owned';end if;
 if p.delivery ? 'collectible' then insert into public.meadow_market_collectibles(user_id,item_id,source) values(p_user,p.delivery->>'collectible','play:'||p_token_hash);end if;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
 values(p_user,gen_random_uuid(),'play_purchase','play:'||p_token_hash,p.delivery) returning id into rid;
 update public.meadow_market_wallets set gems=gems+p.gems,reward_turns=reward_turns+p.turns,vip_xp=vip_xp+p.gems,premium=premium or p.premium,updated_at=now() where user_id=p_user;
 insert into meadow_private.store_purchases(token_hash,user_id,product_id,receipt_id,order_id,test_purchase,benefits) values(p_token_hash,p_user,p_product,rid,p_order,p_test,jsonb_build_object('gems',p.gems,'turns',p.turns,'premium',p.premium,'delivery',p.delivery));
 return jsonb_build_object('receipt_id',rid,'duplicate',false,'settled',false);
end $function$
;
CREATE OR REPLACE FUNCTION public.meadow_market_revoke_store_purchase(p_token_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r meadow_private.store_purchases; p meadow_private.store_products; e public.meadow_market_economy_receipts;
 saved public.meadow_market_saves; s jsonb; home text; f record; item record; bag jsonb;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
 select * into r from meadow_private.store_purchases where token_hash=p_token_hash;
 if not found then return false;end if;
 if r.revoked_at is not null then perform meadow_private.refresh_premium(r.user_id);return true;end if;
 perform 1 from public.meadow_market_wallets where user_id=r.user_id for update;
 select * into saved from public.meadow_market_saves where user_id=r.user_id for update;
 select * into p from meadow_private.store_products where product_id=r.product_id;
 select * into e from public.meadow_market_economy_receipts where id=r.receipt_id;
 if p.delivery ? 'collectible' then delete from public.meadow_market_collectibles where user_id=r.user_id and item_id=p.delivery->>'collectible' and source='play:'||p_token_hash;end if;
 update meadow_private.store_purchases set revoked_at=now() where token_hash=p_token_hash;
 update public.meadow_market_wallets set gems=greatest(0,gems-coalesce((r.benefits->>'gems')::int,p.gems)),reward_turns=greatest(0,reward_turns-coalesce((r.benefits->>'turns')::int,p.turns)),vip_xp=greatest(0,vip_xp-coalesce((r.benefits->>'gems')::int,p.gems)),updated_at=now() where user_id=r.user_id;
 perform meadow_private.refresh_premium(r.user_id);
 -- Prevent an uncollected refunded bundle arriving at the next farm save.
 if not exists(select 1 from meadow_private.farm_reward_deliveries where receipt_id=r.receipt_id) then
  update public.meadow_market_economy_receipts set delivery='{}' where id=r.receipt_id;
 elsif saved.user_id is not null then
  s:=jsonb_set(saved.save_data,'{coins}',to_jsonb(greatest(0,coalesce((saved.save_data->>'coins')::numeric,0)-coalesce((e.delivery->>'gold')::numeric,0))));
  home:=case when s->>'sharedPantryVersion'='1' then 'willow' when s->'farms' ? (e.delivery->>'map') then e.delivery->>'map' else s->>'active' end;
  bag:=coalesce(s->'farms'->home->'inventory','{}');
  for item in select key,value from jsonb_each(coalesce(e.delivery->'items','{}')) loop bag:=jsonb_set(bag,array[item.key],to_jsonb(greatest(0,coalesce((bag->>item.key)::int,0)-(item.value::text)::int)));end loop;
  s:=jsonb_set(s,array['farms',home,'inventory'],bag);
  if s->>'sharedPantryVersion'='1' then
   for f in select key from jsonb_each(s->'farms') loop s:=jsonb_set(s,array['farms',f.key,'inventory'],bag);end loop;
   s:=jsonb_set(s,'{inventory}',bag);
  end if;
  if p.delivery ? 'collectible' then
   for f in select key,value from jsonb_each(s->'farms') loop
    s:=jsonb_set(s,array['farms',f.key,'objects'],coalesce((select jsonb_agg(v) from jsonb_array_elements(f.value->'objects') v where v->>'type' is distinct from p.delivery->>'collectible'),'[]'::jsonb));
   end loop;
   if s->'collectionState' ? 'owned' then s:=jsonb_set(s,'{collectionState,owned}',coalesce((select jsonb_agg(v) from jsonb_array_elements(s->'collectionState'->'owned') v where v#>>'{}' is distinct from p.delivery->>'collectible'),'[]'::jsonb));end if;
  end if;
  perform meadow_private.write_verified_refund(r.user_id,s,r.token_hash);
 end if;
 -- Spent consumables need review; no repeated refund/purchase loop is permitted.
 if not (p.delivery ? 'collectible') then
 insert into meadow_private.store_review_holds(user_id,reason) values(r.user_id,'Google Play refund; review remaining virtual goods before another purchase') on conflict do nothing;
 end if;
 return true;
end $function$
;
create or replace function public.meadow_market_claim_test_story_pack(p_sku text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p meadow_private.store_products;rid uuid;
begin
 perform meadow_private.control_guard('play');
 if u is null or not exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now()) or meadow_private.play_license_test_allowed(u) then raise exception 'Approved free test accounts only' using errcode='42501';end if;
 if p_sku not in ('welcome_garden','coop_charm','market_makeover') then raise exception 'Unknown keepsake';end if;
 select * into p from meadow_private.store_products where sku=p_sku;
 if not found or not (p.delivery ? 'collectible') then raise exception 'Keepsake unavailable';end if;
 perform 1 from public.meadow_market_wallets where user_id=u for update;
 insert into public.meadow_market_collectibles(user_id,item_id,source) values(u,p.delivery->>'collectible','story_pack_test') on conflict do nothing;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(u,gen_random_uuid(),'story_pack_test','story_pack_test:'||p_sku,jsonb_build_object('collectible',p.delivery->>'collectible')) on conflict do nothing returning id into rid;
 return jsonb_build_object('owned',true,'test',true);
end $$;
revoke all on function public.meadow_market_claim_test_story_pack(text) from public,anon,service_role;
grant execute on function public.meadow_market_claim_test_story_pack(text) to authenticated;
comment on function public.meadow_market_claim_test_story_pack(text) is 'Meadow Markets approved free-test keepsakes only; never verifies or simulates a Google Play order.';
