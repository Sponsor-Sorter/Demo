-- Disposable database fixtures only. No real gift, order, owner receipt or account survives.
begin;
set local statement_timeout='20s';
do $$
declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); sess uuid:=gen_random_uuid(); fixture_actor uuid:=gen_random_uuid();
 gift uuid:=gen_random_uuid(); rid uuid; support_id uuid; token text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 token2 text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 token3 text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'); result jsonb; projection jsonb; denied boolean;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',false),(other_user,'authenticated','authenticated',false);
 insert into auth.sessions(id,user_id) values(sess,u);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name)
  values(u,'QA-'||left(u::text,8),'Rollback Premium234'),(other_user,'QA-'||left(other_user::text,8),'Rollback other234');
 insert into public.meadow_market_wallets(user_id,gems,premium,reward_turns,vip_xp,ads_enabled) values(u,77,true,3,101,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sess)::text,true);
 result:=public.meadow_market_premium_status();
 if result->>'premium'<>'false' then raise exception 'Cached Premium must not invent an entitlement';end if;
 if (public.meadow_market_play_service('status')->>'premium_verified')<>'true' then raise exception 'Club status lacks authoritative Premium marker';end if;
 -- Central active gift, isolation by target/app, future start, expiry and revocation.
 insert into public.fairplay_admin_complimentary_grants(id,request_id,app,target,entitlement,actor,reason)
 values(gift,gen_random_uuid(),'meadow',u,'premium',fixture_actor,'Rollback-only acceptance fixture');
 if (public.meadow_market_premium_status()->>'premium')<>'true' then raise exception 'Active central gift not consumed';end if;
 update public.fairplay_admin_complimentary_grants set target=other_user where id=gift;
 if meadow_private.refresh_premium(u) then raise exception 'Gift crossed account';end if;
 update public.fairplay_admin_complimentary_grants set target=u,app='littles',entitlement='littles_plus' where id=gift;
 if meadow_private.refresh_premium(u) then raise exception 'Gift crossed game';end if;
 update public.fairplay_admin_complimentary_grants set app='meadow',entitlement='premium',starts_at=now()+interval '1 hour' where id=gift;
 if meadow_private.refresh_premium(u) then raise exception 'Future gift activated early';end if;
 update public.fairplay_admin_complimentary_grants set starts_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where id=gift;
 if meadow_private.refresh_premium(u) then raise exception 'Expired gift remained active';end if;
 update public.fairplay_admin_complimentary_grants set expires_at=null,revoked_at=now(),revoked_by=fixture_actor,revocation_reason='Rollback-only revoke' where id=gift;
 if meadow_private.refresh_premium(u) then raise exception 'Revoked gift remained active';end if;
 -- Delivered paid rows are proof even while acknowledgement retries. Snapshot survives catalogue edits.
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
 values(u,gen_random_uuid(),'play_purchase','play:'||token,'{}') returning id into rid;
 insert into meadow_private.store_purchases(token_hash,user_id,product_id,receipt_id,test_purchase,settled,benefits)
 values(token,u,'mm_premium',rid,true,false,'{"premium":true,"gems":0,"turns":0}');
 update meadow_private.store_products set premium=false where product_id='mm_premium';
 if (public.meadow_market_premium_status()->>'premium')<>'true' then raise exception 'Acknowledgement/catalogue edit lost delivered paid access';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 projection:=public.meadow_market_premium_projection(u);
 if projection->>'paid'<>'true' or projection->>'premium'<>'true' or projection->>'complimentary'<>'false' then raise exception 'Admin projection conflates paid and gifted access';end if;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
 values(u,gen_random_uuid(),'play_purchase','play:'||token3,'{}') returning id into rid;
 insert into meadow_private.store_purchases(token_hash,user_id,product_id,receipt_id,test_purchase,settled,benefits)
 values(token3,u,'mm_premium',rid,true,false,'{"premium":true,"gems":0,"turns":0}');
 perform public.meadow_market_revoke_store_purchase(token3);
 if not (select premium from public.meadow_market_wallets where user_id=u) then raise exception 'Refund removed another valid paid purchase';end if;
 update public.fairplay_admin_complimentary_grants set revoked_at=null,revoked_by=null,revocation_reason=null where id=gift;
 perform public.meadow_market_revoke_store_purchase(token);
 if not (select premium from public.meadow_market_wallets where user_id=u) then raise exception 'Refund removed an active central gift';end if;
 update public.fairplay_admin_complimentary_grants set expires_at=now()-interval '1 hour' where id=gift;
 perform public.meadow_market_revoke_store_purchase(token);
 if (select premium from public.meadow_market_wallets where user_id=u) then raise exception 'Duplicate refund failed to re-evaluate expired gift';end if;
 -- Historical missing benefit snapshots fall back to the catalogue, without a settled gate.
 update meadow_private.store_products set premium=true where product_id='mm_premium';
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
 values(u,gen_random_uuid(),'play_purchase','play:'||token2,'{}') returning id into rid;
 insert into meadow_private.store_purchases(token_hash,user_id,product_id,receipt_id,test_purchase,settled,benefits)
 values(token2,u,'mm_premium',rid,true,false,'{}');
 if not meadow_private.refresh_premium(u) then raise exception 'Historical paid row lost catalogue fallback';end if;
 update meadow_private.store_purchases set benefits='{"premium":false}' where token_hash=token2;
 if meadow_private.refresh_premium(u) then raise exception 'Explicit false snapshot was replaced by catalogue';end if;
 update meadow_private.store_purchases set benefits='{"premium":true,"gems":0,"turns":0}' where token_hash=token2;
 -- Legacy support evidence is independent of both gift revocation and a refunded purchase.
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
 values(u,gen_random_uuid(),'support_grant','support:'||gen_random_uuid(),'{}') returning id into support_id;
 insert into meadow_private.support_grants(request_id,user_id,reason,body,receipt_id)
 values(gen_random_uuid(),u,'Rollback-only legacy support','{"premium":true}',support_id);
 perform public.meadow_market_revoke_store_purchase(token2);
 if not (select premium from public.meadow_market_wallets where user_id=u) then raise exception 'Refund removed legacy support grant';end if;
 projection:=public.meadow_market_premium_projection(u);
 if projection->>'paid'<>'false' or projection->>'support'<>'true' or projection->>'premium'<>'true' then raise exception 'Legacy source projection failed';end if;
 if not exists(select 1 from public.meadow_market_wallets where user_id=u and gems=77 and reward_turns=3 and vip_xp=101 and ads_enabled) then raise exception 'Premium recomputation changed unrelated wallet values';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sess)::text,true);
 denied:=false;begin perform public.meadow_market_premium_projection(other_user);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Client could read arbitrary account projection';end if;
 if has_function_privilege('anon','public.meadow_market_premium_status()','EXECUTE')
  or has_function_privilege('authenticated','public.meadow_market_premium_projection(uuid)','EXECUTE')
  or has_function_privilege('authenticated','meadow_private.premium_sources(uuid)','EXECUTE')
  or has_function_privilege('service_role','meadow_private.refresh_premium(uuid)','EXECUTE') then raise exception 'Internal entitlement privilege exposed';end if;
 delete from meadow_private.support_grants where user_id=u;
 insert into meadow_private.legacy_premium234(user_id,source) values(u,'pre234_server_test_preview');
 projection:=meadow_private.premium_sources(u);
 if projection->>'paid'<>'false' or projection->>'support'<>'true' or projection->>'legacy_preview'<>'true' or not meadow_private.refresh_premium(u)
  then raise exception 'Existing legacy preview was lost or classified as paid';end if;
 if has_table_privilege('authenticated','meadow_private.legacy_premium234','INSERT') or has_table_privilege('service_role','meadow_private.legacy_premium234','INSERT') then raise exception 'Frozen legacy preservation exposed a grant interface';end if;
 -- Approved existing free-test flow continues to create explicit private support proof.
 insert into meadow_private.test_access(user_id,reason,expires_at) values(u,'Rollback-only approved free test',now()+interval '1 hour');
 result:=public.meadow_market_play_service('purchase',jsonb_build_object('id',gen_random_uuid(),'sku','premium'));
 if result->'wallet'->>'premium'<>'true' or not exists(select 1 from meadow_private.support_grants where user_id=u and body->>'test_only'='true') then raise exception 'Approved free-test Premium flow regressed';end if;
end $$;
select 'Premium234: central grant/target/game/start/expiry/revocation, delivered paid acknowledgement/snapshot/fallback, refund/retry, support preservation, privileges and approved free testing passed; fixtures rolled back' as result;
rollback;
