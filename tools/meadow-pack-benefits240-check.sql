-- Transactional database fixtures, not Google Play orders or physical-device tests.
begin;
set local statement_timeout='30s';
do $$
declare u uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();saved public.meadow_market_saves;
 p record;r jsonb;again jsonb;token text;denied boolean;s jsonb;before_gems int;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',false);
 insert into auth.sessions(id,user_id) values(sid,u);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'QA238-'||left(u::text,8),'Rollback story238');
 insert into public.meadow_market_accounts(username,user_id,ready) values('qa238_'||left(replace(u::text,'-',''),12),u,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','service_role','session_id',sid)::text,true);
 -- The fixture is created by the backend; public new-farm issuance stays untouched.
 r:=meadow_private.commit_economy_save(0,'{"version":1,"coins":250,"level":3,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 select * into saved from public.meadow_market_saves where user_id=u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid)::text,true);
 denied:=false;begin perform public.meadow_market_claim_test_story_pack('welcome_garden');exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Public account bypassed Google checkout';end if;
 insert into meadow_private.test_access(user_id,reason,expires_at) values(u,'Rollback-only free cosmetic fixture',now()+interval '1 hour');
 r:=public.meadow_market_claim_test_story_pack('welcome_garden');again:=public.meadow_market_claim_test_story_pack('welcome_garden');
 if (select count(*) from public.meadow_market_collectibles where user_id=u)<>1 or (select count(*) from public.meadow_market_economy_receipts where user_id=u and kind='story_pack_test')<>1 then raise exception 'Free test pack duplicated';end if;
 -- Remove only this transaction's disposable test entitlement to exercise the independent provider lane.
 delete from public.meadow_market_collectibles where user_id=u;
 delete from meadow_private.test_access where user_id=u;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform meadow_private.convert_reviewed_farm(u,gen_random_uuid(),saved.revision,encode(sha256(convert_to(saved.save_data::text,'UTF8')),'hex'),repeat('9',64),'Rollback-only story238 fixture, no player conversion');
 insert into meadow_private.play_license_acceptance(user_id,product_ids,reason,expires_at) values(u,array['mm_welcome_garden','mm_coop_charm','mm_market_makeover'],'Rollback-only permanent cosmetic purchase fixtures',now()+interval '1 hour');
 select gems into before_gems from public.meadow_market_wallets where user_id=u;
 for p in select * from meadow_private.store_products where sku in ('welcome_garden','coop_charm','market_makeover') loop
  if p.consumable or p.gems<>20 or p.turns<>0 or p.premium or not(p.delivery?'collectible') then raise exception 'Unexpected pack benefits';end if;
  token:=encode(sha256(convert_to(u::text||p.sku,'UTF8')),'hex');
  denied:=false;begin perform public.meadow_market_deliver_store_purchase(u,p.product_id,token,'QA238-NOT-GOOGLE',false);exception when sqlstate '42501' then denied:=true;end;
  if not denied then raise exception 'Real order accepted in test-only lane';end if;
  r:=public.meadow_market_deliver_store_purchase(u,p.product_id,token,'QA238-NOT-GOOGLE',true);
  again:=public.meadow_market_deliver_store_purchase(u,p.product_id,token,'QA238-NOT-GOOGLE',true);
  if r->>'duplicate'<>'false' or again->>'duplicate'<>'true' or r->>'receipt_id'<>again->>'receipt_id' then raise exception 'Pack receipt replay changed delivery';end if;
  denied:=false;begin perform public.meadow_market_deliver_store_purchase(gen_random_uuid(),p.product_id,token,'QA238-NOT-GOOGLE',true);exception when raise_exception then denied:=true;end;
  if not denied then raise exception 'Pack crossed account boundary';end if;
  denied:=false;begin perform public.meadow_market_deliver_store_purchase(u,p.product_id,repeat('a',64),'QA238-NOT-GOOGLE',true);exception when raise_exception then denied:=true;end;
  if not denied then raise exception 'Owned permanent pack could be delivered twice';end if;
  perform public.meadow_market_settle_store_purchase(token);
  select * into saved from public.meadow_market_saves where user_id=u;
  insert into meadow_private.farm_reward_deliveries(receipt_id,user_id,revision,imported) values((r->>'receipt_id')::uuid,u,saved.revision,true);
  s:=jsonb_set(saved.save_data,'{farms,willow,objects}',coalesce(saved.save_data#>'{farms,willow,objects}','[]')||jsonb_build_array(jsonb_build_object('id','qa238-'||p.sku,'type',p.delivery->>'collectible','x',0,'y',0,'rotation',0)));
  perform meadow_private.write_verified_refund(u,s,token);
 end loop;
 if (select count(*) from public.meadow_market_collectibles where user_id=u)<>3 then raise exception 'Missing pack ownership';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid)::text,true);
 r:=public.meadow_market_commerce_status();
 if jsonb_array_length(r->'owned_products')<>3 then raise exception 'Restore status lost permanent ownership';end if;
 denied:=false;begin perform public.meadow_market_claim_test_story_pack('coop_charm');exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Provider account bypassed its checkout';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 for p in select token_hash from meadow_private.store_purchases where user_id=u loop
  perform public.meadow_market_revoke_store_purchase(p.token_hash);perform public.meadow_market_revoke_store_purchase(p.token_hash);
 end loop;
 if exists(select 1 from public.meadow_market_collectibles where user_id=u) then raise exception 'Refund left paid ownership';end if;
 if exists(select 1 from public.meadow_market_saves where user_id=u and save_data#>'{farms,willow,objects}'<>'[]'::jsonb) then raise exception 'Refund left paid placeables';end if;
 if (select count(*) from meadow_private.store_purchases where user_id=u and revoked_at is not null)<>3 then raise exception 'Purchase history was not retained';end if;
 if exists(select 1 from meadow_private.store_review_holds where user_id=u) then raise exception 'Cosmetic refund blocked unrelated purchases';end if;
 if not exists(select 1 from public.meadow_market_wallets where user_id=u and gems=before_gems and reward_turns=0 and premium=false) then raise exception 'Cosmetic purchase/refund changed currency';end if;
 if (select count(*) from meadow_private.earned_collection_catalog238)<>100 then raise exception 'Paid packs leaked into earned catalogue';end if;
 if (select count(*) from meadow_private.pack_benefit_grants where user_id=u)<>4 then raise exception 'Missing authoritative booster grants';end if;
 raise notice 'PASS: three packs, permanent ownership, duplicate and account guards, restore status, refund cleanup, retained history and earned collection isolation';
end $$;
rollback;
select 'story238 rollback fixtures passed; no fixture players or orders retained' as result;
