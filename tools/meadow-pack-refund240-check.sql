-- Rollback-only provider-lane fixture, never a Google order or device purchase.
begin;
do $$
declare u uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();saved public.meadow_market_saves;
 token text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');r jsonb;g uuid;s jsonb;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',false);
 insert into auth.sessions(id,user_id) values(sid,u);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'QA240R-'||left(u::text,8),'Rollback used pack');
 insert into public.meadow_market_accounts(username,user_id,ready) values('qa240r_'||left(replace(u::text,'-',''),12),u,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','service_role','session_id',sid)::text,true);
 r:=meadow_private.commit_economy_save(0,'{"version":1,"coins":250,"level":3,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 select * into saved from public.meadow_market_saves where user_id=u;
 perform meadow_private.convert_reviewed_farm(u,gen_random_uuid(),saved.revision,encode(sha256(convert_to(saved.save_data::text,'UTF8')),'hex'),repeat('9',64),'Rollback-only consumed pack fixture');
 insert into meadow_private.play_license_acceptance(user_id,product_ids,reason,expires_at) values(u,array['mm_welcome_garden'],'Rollback-only consumed pack',now()+interval '1 hour');
 r:=public.meadow_market_deliver_store_purchase(u,'mm_welcome_garden',token,'QA240-NOT-GOOGLE',true);
 select id into g from meadow_private.pack_benefit_grants where user_id=u;
 select save_data into s from public.meadow_market_saves where user_id=u;
 s:=s||jsonb_build_object('packBenefits',jsonb_build_object('version',1,'grants',meadow_private.pack_grants240(u),'used',jsonb_build_object(g::text,1),'windows',jsonb_build_array(jsonb_build_object('sku','welcome_garden','kind','crop','map','willow','grant',g,'rate',.25,'permanent',false,'from',floor(extract(epoch from now())*1000)-1000,'until',floor(extract(epoch from now())*1000)+899000))));
 -- The fixture represents a previously accepted activation, not a client write.
 perform meadow_private.write_verified_refund(u,s,token);
 update public.meadow_market_wallets set gems=0 where user_id=u;
 perform public.meadow_market_revoke_store_purchase(token);perform public.meadow_market_revoke_store_purchase(token);
 if not exists(select 1 from meadow_private.store_review_holds where user_id=u) then raise exception 'Consumed benefits allowed a refund/rebuy loop';end if;
 if not exists(select 1 from meadow_private.pack_benefit_grants where id=g and revoked_at is not null) then raise exception 'Unused charges were not revoked';end if;
 if exists(select 1 from public.meadow_market_saves where user_id=u and (save_data#>>'{packBenefits,windows,0,until}')::bigint>floor(extract(epoch from now())*1000)) then raise exception 'Refund left an active booster';end if;
 if (select count(*) from meadow_private.store_purchases where user_id=u and revoked_at is not null)<>1 then raise exception 'Refund history removed or duplicated';end if;
end $$;
rollback;
select 'PASS: consumed pack refund closes effects, revokes charges, retains history and requires review; fixture rolled back' result;
