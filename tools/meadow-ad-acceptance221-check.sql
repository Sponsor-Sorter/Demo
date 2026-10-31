-- Rollback-only SQL fixture, never evidence of an actual AdMob view or SSV.
begin;
do $$
declare u uuid:=gen_random_uuid();saved public.meadow_market_saves;reply jsonb;denied boolean;n integer;
begin
 if has_table_privilege('authenticated','meadow_private.ad_provider_acceptance','INSERT')
  or has_table_privilege('service_role','meadow_private.ad_provider_acceptance','INSERT')
  or has_function_privilege('authenticated','meadow_private.ad_provider_test_allowed(uuid)','EXECUTE') then raise exception 'Ad test access exposed';end if;
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',false);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Rollback-only ad fixture');
 insert into public.meadow_market_accounts(username,user_id,ready) values('qa_'||left(replace(u::text,'-',''),16),u,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 reply:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 update meadow_private.commerce_config set payments_enabled=false,ads_enabled=false,production_ready=false where id;
 insert into meadow_private.ad_provider_acceptance(user_id,reason,native_version,expires_at) values(u,'Rollback-only SQL ad acceptance','1.7.2',now()+interval '1 hour');
 if meadow_private.ad_provider_test_allowed(u) then raise exception 'Legacy ad account accepted';end if;
 select * into saved from public.meadow_market_saves where user_id=u;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 reply:=meadow_private.convert_reviewed_farm(u,gen_random_uuid(),saved.revision,encode(sha256(convert_to(saved.save_data::text,'UTF8')),'hex'),repeat('6',64),'Rollback-only test baseline, no player conversion');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 reply:=public.meadow_market_commerce_status();
 if reply->>'ads_provider_test'<>'true' or reply->>'ads_enabled'<>'true' or reply->>'payments_enabled'<>'false' then raise exception 'Ad acceptance leaked billing or stayed closed: %',reply;end if;
 if meadow_private.ad_provider_test_allowed(gen_random_uuid()) then raise exception 'Ad access crossed accounts';end if;
 for n in 1..10 loop reply:=public.meadow_market_start_ad_reward();if reply->>'nonce' is null then raise exception 'No nonce';end if;end loop;
 denied:=false;begin perform public.meadow_market_start_ad_reward();exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Ad start throttle bypassed';end if;
 if exists(select 1 from meadow_private.ad_rewards where user_id=u and receipt_id is not null) then raise exception 'Starting an ad granted a reward';end if;
 denied:=false;begin perform public.meadow_market_finish_ad_reward((reply->>'nonce')::uuid,repeat('a',64),'rollback-fixture',now());exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Player called reward delivery';end if;
 update meadow_private.ad_provider_acceptance set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where user_id=u;
 if meadow_private.ad_provider_test_allowed(u) then raise exception 'Expired ad access accepted';end if;
 reply:=public.meadow_market_commerce_status();if reply->>'ads_enabled'<>'false' then raise exception 'Expired test kept ads open';end if;
 update meadow_private.ad_provider_acceptance set created_at=now(),expires_at=now()+interval '1 hour' where user_id=u;
 update auth.users set is_anonymous=true where id=u;
 if meadow_private.ad_provider_test_allowed(u) then raise exception 'Anonymous ad tester accepted';end if;
 update auth.users set is_anonymous=false where id=u;
 insert into meadow_private.store_review_holds(user_id,reason) values(u,'Rollback-only refund hold');
 if meadow_private.ad_provider_test_allowed(u) then raise exception 'Review hold accepted';end if;
 delete from meadow_private.store_review_holds where user_id=u;
 insert into meadow_private.account_deletions(user_id) values(u);
 if meadow_private.ad_provider_test_allowed(u) then raise exception 'Deleting ad tester accepted';end if;
end $$;
rollback;
