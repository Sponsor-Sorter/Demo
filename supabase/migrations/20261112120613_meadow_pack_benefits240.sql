-- Meadow Markets pack extras. Existing receipt history is retained.
create table meadow_private.pack_benefit_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 sku text not null check(sku in ('welcome_garden','coop_charm','market_makeover')),
 source text not null,
 charges integer not null default 3 check(charges=3),
 created_at timestamptz not null default now(),
 revoked_at timestamptz,
 unique(user_id,sku,source)
);
alter table meadow_private.pack_benefit_grants enable row level security;
revoke all on meadow_private.pack_benefit_grants from public,anon,authenticated,service_role;
create index pack_benefit_grants_owner240 on meadow_private.pack_benefit_grants(user_id);

create function meadow_private.pack_grants240(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'sku',sku,'charges',charges,
  'revokedAt',case when revoked_at is null then null else floor(extract(epoch from revoked_at)*1000) end)
  order by created_at,id),'[]'::jsonb) from meadow_private.pack_benefit_grants where user_id=p_user
$$;
revoke all on function meadow_private.pack_grants240(uuid) from public,anon,authenticated,service_role;

create function meadow_private.ensure_pack_benefits240(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare x record; g uuid; credited integer; receipt_gems integer;
begin
 -- Common lock order with Play delivery, refunds and canonical farm commands.
 perform 1 from public.meadow_market_wallets where user_id=p_user for update;
 for x in select p.sku,c.source,r.token_hash,r.benefits from public.meadow_market_collectibles c
  join meadow_private.store_products p on p.delivery->>'collectible'=c.item_id
  left join meadow_private.store_purchases r on c.source='play:'||r.token_hash and r.user_id=c.user_id and r.product_id=p.product_id and r.revoked_at is null
  where c.user_id=p_user and p.sku in ('welcome_garden','coop_charm','market_makeover')
    and (c.source='story_pack_test' or r.token_hash is not null)
 loop
  insert into meadow_private.pack_benefit_grants(user_id,sku,source) values(p_user,x.sku,x.source)
   on conflict(user_id,sku,source) do nothing returning id into g;
  if g is null then continue;end if;
  -- New Play deliveries already credit product.gems. Old purchases credited zero.
  credited:=case when x.token_hash is null then 0 else coalesce((x.benefits->>'gems')::int,0) end;
  receipt_gems:=greatest(0,20-credited);
  if receipt_gems>0 then
   update public.meadow_market_wallets set gems=gems+receipt_gems,vip_xp=vip_xp+receipt_gems,updated_at=now() where user_id=p_user;
  end if;
  if x.token_hash is not null then
   update meadow_private.store_purchases set benefits=jsonb_set(benefits,'{gems}','20'::jsonb) where token_hash=x.token_hash;
  end if;
  insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
   values(p_user,gen_random_uuid(),'pack_extras','pack_extras:'||g::text,'{}');
 end loop;
end $$;
revoke all on function meadow_private.ensure_pack_benefits240(uuid) from public,anon,authenticated,service_role;

update meadow_private.store_products set gems=20
 where sku in ('welcome_garden','coop_charm','market_makeover');

CREATE OR REPLACE FUNCTION meadow_private.deliver_store_purchase239(p_user uuid, p_product text, p_token_hash text, p_order text, p_test boolean)
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
revoke all on function meadow_private.deliver_store_purchase239(uuid,text,text,text,boolean) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION meadow_private.claim_test_story_pack239(p_sku text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();p meadow_private.store_products;rid uuid;
begin
 perform meadow_private.control_guard('play');
 if u is null or not exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now()) or meadow_private.play_license_test_allowed(u) then raise exception 'Approved free test accounts only' using errcode='42501';end if;
 if p_sku not in ('welcome_garden','coop_charm','market_makeover') then raise exception 'Unknown keepsake';end if;
 select * into p from meadow_private.store_products where sku=p_sku;
 if not found or not (p.delivery ? 'collectible') then raise exception 'Keepsake unavailable';end if;
 insert into public.meadow_market_wallets(user_id) values(u) on conflict do nothing;
 perform 1 from public.meadow_market_wallets where user_id=u for update;
 insert into public.meadow_market_collectibles(user_id,item_id,source) values(u,p.delivery->>'collectible','story_pack_test') on conflict do nothing;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(u,gen_random_uuid(),'story_pack_test','story_pack_test:'||p_sku,jsonb_build_object('collectible',p.delivery->>'collectible')) on conflict do nothing returning id into rid;
 return jsonb_build_object('owned',true,'test',true);
end $function$
;
revoke all on function meadow_private.claim_test_story_pack239(text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION meadow_private.revoke_store_purchase239(p_token_hash text)
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
revoke all on function meadow_private.revoke_store_purchase239(text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION meadow_private.commerce_status239()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;s jsonb;
begin
 perform meadow_private.control_guard('read');r:=meadow_private.commerce_status();
 if (select enforced from meadow_private.control_config where id) then
  s:=meadow_private.control_state(auth.uid());
  if (s->>'banned')::boolean then r:=r||'{"payments_enabled":false,"ads_enabled":false}'::jsonb;end if;
 end if;return r;
end $function$
;
revoke all on function meadow_private.commerce_status239() from public,anon,authenticated,service_role;

create or replace function public.meadow_market_deliver_store_purchase(p_user uuid,p_product text,p_token_hash text,p_order text,p_test boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare answer jsonb;
begin
 answer:=meadow_private.deliver_store_purchase239(p_user,p_product,p_token_hash,p_order,p_test);
 perform meadow_private.ensure_pack_benefits240(p_user);
 return answer;
end $$;
create or replace function public.meadow_market_claim_test_story_pack(p_sku text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare answer jsonb;
begin
 answer:=meadow_private.claim_test_story_pack239(p_sku);
 perform meadow_private.ensure_pack_benefits240(auth.uid());
 return answer;
end $$;
create or replace function public.meadow_market_commerce_status() returns jsonb
language plpgsql security definer set search_path='' as $$
begin return meadow_private.commerce_status239()||jsonb_build_object('pack_grants',meadow_private.pack_grants240(auth.uid()));end $$;

create or replace function public.meadow_market_revoke_store_purchase(p_token_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare answer boolean; u uuid; s jsonb; g jsonb; at_ms bigint:=floor(extract(epoch from now())*1000);
begin
 answer:=meadow_private.revoke_store_purchase239(p_token_hash);
 if not answer then return false;end if;
 select user_id into u from meadow_private.store_purchases where token_hash=p_token_hash;
 update meadow_private.pack_benefit_grants set revoked_at=coalesce(revoked_at,now()) where user_id=u and source='play:'||p_token_hash;
 select save_data into s from public.meadow_market_saves where user_id=u for update;
 if s ? 'packBenefits' then
  g:=meadow_private.pack_grants240(u);
  s:=jsonb_set(s,'{packBenefits,grants}',g);
  s:=jsonb_set(s,'{packBenefits,windows}',coalesce((select jsonb_agg(
   case when exists(select 1 from meadow_private.pack_benefit_grants b where b.id::text=w->>'grant' and b.revoked_at is not null)
    then jsonb_set(w,'{until}',to_jsonb(least(coalesce((w->>'until')::bigint,at_ms),at_ms))) else w end)
   from jsonb_array_elements(coalesce(s#>'{packBenefits,windows}','[]')) w),'[]'));
  perform meadow_private.write_verified_refund(u,s,p_token_hash);
 end if;
 return true;
end $$;
-- Restrict wrappers explicitly; nothing exposes provider tokens or private grants.
revoke all on function public.meadow_market_deliver_store_purchase(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.meadow_market_deliver_store_purchase(uuid,text,text,text,boolean) to service_role;
revoke all on function public.meadow_market_revoke_store_purchase(text) from public,anon,authenticated;
grant execute on function public.meadow_market_revoke_store_purchase(text) to service_role;
revoke all on function public.meadow_market_claim_test_story_pack(text) from public,anon,service_role;
grant execute on function public.meadow_market_claim_test_story_pack(text) to authenticated;
revoke all on function public.meadow_market_commerce_status() from public,anon,service_role;
grant execute on function public.meadow_market_commerce_status() to authenticated;

CREATE OR REPLACE FUNCTION meadow_private.read_farm_command(p_user uuid, p_request_id uuid, p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare saved public.meadow_market_saves; ack meadow_private.farm_command_receipts; digest text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;

 if not exists(select 1 from public.meadow_market_profiles where user_id=p_user)
  or exists(select 1 from meadow_private.account_deletions where user_id=p_user)
 then raise exception 'Account unavailable' using errcode='42501';end if;
 if p_user is null or p_request_id is null or jsonb_typeof(p_body) is distinct from 'object'
  or octet_length(p_body::text)>65536 or jsonb_typeof(p_body->'commands') is distinct from 'array'
  or jsonb_array_length(p_body->'commands') not between 1 and 32
  or jsonb_typeof(p_body->'expected_revision') is distinct from 'number'
  or (p_body->>'expected_revision')::numeric<>trunc((p_body->>'expected_revision')::numeric)
  or (p_body->>'expected_revision')::numeric not between 0 and 9007199254740991
  or (select count(*) from jsonb_object_keys(p_body))<>2
 then raise exception 'Invalid farm command' using errcode='22023';end if;

 if p_body->'commands'='[{"type":"farm.initialize"}]'::jsonb and (p_body->>'expected_revision')::bigint=0 then
  select * into saved from public.meadow_market_saves where user_id=p_user;
  if not found then
   if not exists(select 1 from meadow_private.farm_start_config where singleton and new_farms)
    and not exists(select 1 from meadow_private.farm_command_accounts where user_id=p_user) then return jsonb_build_object('ok',false,'enabled',false);end if;
   return jsonb_build_object('ok',true,'enabled',true,'initializing',true,'revision',0,
    'server_time',floor(extract(epoch from clock_timestamp())*1000),
    'profile',(select jsonb_build_object('friend_code',friend_code,'display_name',display_name) from public.meadow_market_profiles where user_id=p_user));
  elsif not exists(select 1 from meadow_private.farm_command_receipts where user_id=p_user and request_id=p_request_id) then
   return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data,'save_protocol',saved.save_protocol);
  end if;
 end if;
 if not exists(select 1 from meadow_private.farm_command_accounts where user_id=p_user) then
  return jsonb_build_object('ok',false,'enabled',false);
 end if;
 select * into saved from public.meadow_market_saves where user_id=p_user;
 if not found then raise exception 'Saved farm required' using errcode='22023';end if;
 digest:=encode(sha256(convert_to(p_body::text,'UTF8')),'hex');
 select * into ack from meadow_private.farm_command_receipts where user_id=p_user and request_id=p_request_id;
 if found then
  if ack.body_hash<>digest then raise exception 'Command receipt reused for different actions' using errcode='22023';end if;
  return jsonb_build_object('ok',true,'replayed',true,'request_id',p_request_id,'accepted_revision',ack.revision,'revision',saved.revision,'save_data',saved.save_data,'summary',ack.summary);
 end if;
 if saved.revision<>(p_body->>'expected_revision')::bigint then
  return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data);
 end if;
 return jsonb_build_object('ok',true,'enabled',true,'revision',saved.revision,'save_data',saved.save_data,
  'server_time',floor(extract(epoch from clock_timestamp())*1000),
  
 'pending_help',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at,h.id) from
  (select id,map_id,action,target_id,target_cycle,created_at from public.meadow_market_visit_events
   where owner_id=p_user and outcome='pending' and action<>'visit'
   order by created_at,id limit 100) h),'[]'::jsonb),

 'market_rounds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'game',r.game,'goal',r.goal,'map',r.map,'verified',p.verified,'won',p.won,'expires_at',floor(extract(epoch from r.expires_at)*1000)))
  from meadow_private.reward_rounds r join public.meadow_market_play_runs p on p.id=r.id and p.user_id=r.user_id
  where r.user_id=p_user and r.closed and p.verified and p.won
   and r.game in ('market_pack','market_weigh') and r.expires_at>=clock_timestamp()
   and r.id::text in(select c->'data'->>'round' from jsonb_array_elements(p_body->'commands') c where c->>'type'='market.sell')
   and not exists(select 1 from meadow_private.market_sale_rounds used where used.user_id=p_user and used.round_id=r.id)), '[]'::jsonb),

 'visited_friend',case when exists(select 1 from jsonb_array_elements(p_body->'commands') c where (c->>'type'='lesson.claim' and c->>'target'='friends') or c->>'type'='social.visit') then
  exists(select 1 from public.meadow_market_visit_events where visitor_id=p_user and action='visit') else false end,

 'round_records',coalesce((select jsonb_agg(jsonb_build_object('game',x.game,'level',least(1000,greatest(x.legacy_level,coalesce(x.won_level,0)+1)),'wins',x.wins,'bestScore',x.best_score)) from
  (select p.game,p.legacy_level,max(r.level) filter(where r.won) as won_level,count(r.id) filter(where r.won) as wins,coalesce(max(r.points),0) as best_score
   from meadow_private.round_progress p left join public.meadow_market_play_runs r on r.user_id=p.user_id and r.game=p.game and r.verified
   where p.user_id=p_user and p.game in ('eggs','milk','word_search','market_pack','market_weigh') group by p.game,p.legacy_level) x),'[]'::jsonb),

 'shared_landmarks',coalesce((select jsonb_agg(theme order by theme) from public.meadow_market_village_projects where owner_id=p_user and completed_at is not null),'[]'::jsonb),
'pack_grants',meadow_private.pack_grants240(p_user),
 'owned_collections',coalesce((select jsonb_agg(item_id order by item_id) from public.meadow_market_collectibles where user_id=p_user),'[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION meadow_private.assert_farm_entitlements(p_before jsonb, p_after jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare f record; o jsonb; previous jsonb; matches int; copies int; k text; expected jsonb; proposed jsonb;
begin
 if coalesce(current_setting('meadow.command_owner',true),'') is distinct from coalesce(auth.uid()::text,'') and p_after->'packBenefits' is distinct from p_before->'packBenefits' then raise exception 'Pack boosters require a verified farm action' using errcode='22023';end if;
 for f in select key,value from jsonb_each(coalesce(p_after->'farms','{}')) loop
  for o in select value from jsonb_array_elements(coalesce(f.value->'objects','[]')) loop
   if not(o ?| array['autoWater','wellGemTier','queueSlots']) and o->>'type' not in ('well','kitchen','workshop') then continue;end if;
   select count(*) into matches from jsonb_each(coalesce(p_before->'farms','{}')) farm cross join lateral jsonb_array_elements(coalesce(farm.value->'objects','[]')) obj where obj.value->>'id'=o->>'id' and obj.value->>'type'=o->>'type';
   select count(*) into copies from jsonb_each(p_after->'farms') farm cross join lateral jsonb_array_elements(coalesce(farm.value->'objects','[]')) obj where obj.value->>'id'=o->>'id' and obj.value->>'type'=o->>'type';
   if copies>greatest(1,matches) then raise exception 'A farm upgrade cannot be copied to a second item' using errcode='22023';end if;
   select value into previous from jsonb_array_elements(coalesce(p_before->'farms'->f.key->'objects','[]')) where value->>'id'=o->>'id' and value->>'type'=o->>'type' limit 1;
   if not found then
    select count(*),jsonb_agg(obj.value)->0 into matches,previous from jsonb_each(coalesce(p_before->'farms','{}')) farm cross join lateral jsonb_array_elements(coalesce(farm.value->'objects','[]')) obj where obj.value->>'id'=o->>'id' and obj.value->>'type'=o->>'type';
    select count(*) into copies from jsonb_each(p_after->'farms') farm cross join lateral jsonb_array_elements(coalesce(farm.value->'objects','[]')) obj where obj.value->>'id'=o->>'id' and obj.value->>'type'=o->>'type';
    if matches<>1 or copies<>1 then previous:='{}';end if;
   end if;
   foreach k in array array['autoWater','wellGemTier','queueSlots'] loop
    expected:=coalesce(previous->k,case when k='autoWater' then 'false'::jsonb else '0'::jsonb end);
    proposed:=coalesce(o->k,case when k='autoWater' then 'false'::jsonb else '0'::jsonb end);
    if proposed is distinct from expected then raise exception 'This farm upgrade needs a verified gem receipt. Reload the saved farm before continuing.' using errcode='22023';end if;
   end loop;
  end loop;
 end loop;
end $function$
;

-- Backfill only currently owned verified/free-test packs, with per-entitlement uniqueness.
do $$ declare u uuid;begin for u in select distinct c.user_id from public.meadow_market_collectibles c join meadow_private.store_products p on p.delivery->>'collectible'=c.item_id where p.sku in ('welcome_garden','coop_charm','market_makeover') loop perform meadow_private.ensure_pack_benefits240(u);end loop;end $$;
