-- Rollback-only database acceptance. These are not real Google orders/ad views.
begin;
set local statement_timeout='20s';
do $$
declare u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();saved public.meadow_market_saves;
 p record;reply jsonb;again jsonb;token text;denied boolean;nonce uuid;nonces uuid[]:='{}';n integer;
 expected jsonb:='{"pocket_gems":[100,0,false,true,{}],"gem_chest":[550,0,false,true,{}],"starter_pack":[150,0,false,true,{"gold":1000,"items":{"wheat":15,"carrot":15,"milk":5,"egg":5}}],"builders_pack":[300,0,false,true,{"gold":3000}],"reward_tickets":[0,5,false,true,{}],"pantry_pack":[0,0,false,true,{"items":{"wheat":20,"milk":10,"egg":10,"apple":10,"flour":10}}],"premium":[0,0,true,false,{}]}';
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',false);
 insert into auth.sessions(id,user_id) values(s,u);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'QA-'||left(u::text,8),'Rollback-only commerce225');
 insert into public.meadow_market_accounts(username,user_id,ready) values('qa_'||left(replace(u::text,'-',''),16),u,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s)::text,true);
 reply:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 select * into saved from public.meadow_market_saves where user_id=u;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform meadow_private.convert_reviewed_farm(u,gen_random_uuid(),saved.revision,encode(sha256(convert_to(saved.save_data::text,'UTF8')),'hex'),repeat('9',64),'Disposable rollback-only fixture, no player conversion');
 -- Changes remain invisible to other sessions and are rolled back below.
 update meadow_private.commerce_config set payments_enabled=true,ads_enabled=false,production_ready=true where id;
 update meadow_private.store_products set enabled=true;
 for p in select * from meadow_private.store_products loop
  if jsonb_build_array(p.gems,p.turns,p.premium,p.consumable,p.delivery) is distinct from expected->p.sku then raise exception 'Catalogue benefit drift: %',p.sku;end if;
  token:=encode(sha256(convert_to(u::text||p.sku,'UTF8')),'hex');
  reply:=public.meadow_market_deliver_store_purchase(u,p.product_id,token,'ROLLBACK-NOT-GOOGLE',true);
  update meadow_private.commerce_config set payments_enabled=false where id;
  again:=public.meadow_market_deliver_store_purchase(u,p.product_id,token,'ROLLBACK-NOT-GOOGLE',true);
  if reply->>'duplicate'<>'false' or again->>'duplicate'<>'true' or reply->>'receipt_id'<>again->>'receipt_id' then raise exception 'Purchase replay changed delivery';end if;
  perform public.meadow_market_settle_store_purchase(token);
  denied:=false;begin perform public.meadow_market_deliver_store_purchase(gen_random_uuid(),p.product_id,token,'ROLLBACK-NOT-GOOGLE',true);exception when raise_exception then denied:=true;end;
  if not denied then raise exception 'Purchase crossed farm ownership';end if;
  update meadow_private.commerce_config set payments_enabled=true where id;
 end loop;
 if (select count(*) from meadow_private.store_purchases where user_id=u)<>7 or not exists(select 1 from public.meadow_market_wallets where user_id=u and gems=1100 and reward_turns=5 and premium and vip_xp=1100) then raise exception 'Wrong combined bundle benefits';end if;
 if exists(select 1 from meadow_private.store_purchases where user_id=u and not settled) then raise exception 'Unsettled fixture';end if;
 for p in select token_hash from meadow_private.store_purchases where user_id=u loop
  perform public.meadow_market_revoke_store_purchase(p.token_hash);perform public.meadow_market_revoke_store_purchase(p.token_hash);
 end loop;
 if not exists(select 1 from public.meadow_market_wallets where user_id=u and gems=0 and reward_turns=0 and not premium and vip_xp=0) then raise exception 'Refund did not reverse wallet once';end if;
 if exists(select 1 from public.meadow_market_economy_receipts where user_id=u and kind='play_purchase' and delivery<>'{}') then raise exception 'Refunded uncollected supplies remain deliverable';end if;
 -- Remove only this transaction's fixture hold to test a separate ad lane.
 delete from meadow_private.store_review_holds where user_id=u;
 update meadow_private.commerce_config set payments_enabled=false,ads_enabled=false,production_ready=false where id;
 insert into meadow_private.ad_provider_acceptance(user_id,reason,native_version,expires_at) values(u,'Rollback-only callback delivery','1.7.2',now()+interval '1 hour');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s)::text,true);
 for n in 1..4 loop reply:=public.meadow_market_start_ad_reward();nonces:=array_append(nonces,(reply->>'nonce')::uuid);end loop;
 -- Existing signed callbacks still settle after all new issuance is closed.
 update meadow_private.ad_provider_acceptance set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where user_id=u;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 for n in 1..3 loop
  perform public.meadow_market_finish_ad_reward(nonces[n],encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),'rollback225-'||u::text||n,now());
  perform public.meadow_market_finish_ad_reward(nonces[n],encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),'rollback225-'||u::text||n,now());
 end loop;
 denied:=false;begin perform public.meadow_market_finish_ad_reward(nonces[4],repeat('a',64),'wrong-account225',now());exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Ad crossed account ownership';end if;
 denied:=false;begin perform public.meadow_market_finish_ad_reward(nonces[4],encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),'rollback225-fourth',now());exception when raise_exception then denied:=true;end;
 if not denied or not exists(select 1 from public.meadow_market_wallets where user_id=u and gems=15 and reward_turns=3 and not premium) then raise exception 'Ad replay/daily cap failed';end if;
end $$;
select 'Seven catalogue deliveries, replay/owner binding/settlement, seven refund reversals, ad account/daily limits and closed-issuance callback recovery passed; all data rolled back' as result;
rollback;
