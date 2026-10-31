-- SQL-only delivery fixtures, never a substitute for a Google provider test.
begin;
do $$
declare u uuid:=gen_random_uuid();reply jsonb;saved public.meadow_market_saves;denied boolean;g bigint;receipt text;
begin
 if has_table_privilege('authenticated','meadow_private.play_license_acceptance','INSERT')
  or has_table_privilege('service_role','meadow_private.play_license_acceptance','INSERT')
  or has_function_privilege('authenticated','meadow_private.play_license_test_allowed(uuid,text)','EXECUTE') then
  raise exception 'Acceptance permissions exposed';end if;
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',false);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Disposable license SQL fixture');
 insert into public.meadow_market_accounts(username,user_id,ready) values('qa_'||left(replace(u::text,'-',''),16),u,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 reply:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 update meadow_private.commerce_config set payments_enabled=false,ads_enabled=false,production_ready=false where id;
 update meadow_private.store_products set enabled=false;
 insert into meadow_private.play_license_acceptance(user_id,product_ids,reason,expires_at)
  values(u,array['mm_pocket_gems','mm_premium'],'Rollback-only SQL delivery acceptance',now()+interval '1 day');
 insert into meadow_private.test_access(user_id,reason,expires_at) values(u,'Free packs must not bypass provider acceptance',now()+interval '1 day');
 if meadow_private.play_license_test_allowed(u) then raise exception 'Legacy farm accepted';end if;
 reply:=public.meadow_market_commerce_status();if reply->>'payments_enabled'<>'false' then raise exception 'Legacy farm opened checkout';end if;
 select * into saved from public.meadow_market_saves where user_id=u;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 reply:=meadow_private.convert_reviewed_farm(u,gen_random_uuid(),saved.revision,encode(sha256(convert_to(saved.save_data::text,'UTF8')),'hex'),repeat('3',64),'Disposable rollback-only opening balance, not a player conversion');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 reply:=public.meadow_market_commerce_status();
 if reply->>'test_access'<>'false' or reply->>'provider_test'<>'true' or reply->>'payments_enabled'<>'true'
  or reply->>'ads_enabled'<>'false' or jsonb_array_length(reply->'products')<>2 then raise exception 'License status incorrect: %',reply;end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 denied:=false;begin perform public.meadow_market_deliver_store_purchase(u,'mm_pocket_gems',repeat('1',64),'QA-NOT-GOOGLE',false);exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Real purchase accepted in license lane';end if;
 denied:=false;begin perform public.meadow_market_deliver_store_purchase(u,'mm_gem_chest',repeat('2',64),'QA-NOT-GOOGLE',true);exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Unlisted product accepted';end if;
 select gems into g from public.meadow_market_wallets where user_id=u;g:=coalesce(g,0);
 reply:=public.meadow_market_deliver_store_purchase(u,'mm_pocket_gems',repeat('3',64),'QA-NOT-GOOGLE',true);receipt:=reply->>'receipt_id';
 if reply->>'duplicate'<>'false' then raise exception 'First fixture not delivered';end if;
 if (select gems from public.meadow_market_wallets where user_id=u)<>g+100 then raise exception 'Wrong fixture gem delivery';end if;
 update meadow_private.play_license_acceptance set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id=u;
 if meadow_private.play_license_test_allowed(u) then raise exception 'Expired acceptance remains live';end if;
 reply:=public.meadow_market_deliver_store_purchase(u,'mm_pocket_gems',repeat('3',64),'QA-NOT-GOOGLE',true);
 if reply->>'duplicate'<>'true' or reply->>'receipt_id'<>receipt then raise exception 'Existing receipt replay blocked or replaced';end if;
 if (select gems from public.meadow_market_wallets where user_id=u)<>g+100 then raise exception 'Duplicate fixture delivery';end if;
 update meadow_private.play_license_acceptance set created_at=now(),expires_at=now()+interval '1 day' where user_id=u;
 update auth.users set is_anonymous=true where id=u;
 if meadow_private.play_license_test_allowed(u) then raise exception 'Anonymous account accepted';end if;
 update auth.users set is_anonymous=false where id=u;
 insert into meadow_private.store_review_holds(user_id,reason) values(u,'Fixture refund hold');
 if meadow_private.play_license_test_allowed(u) then raise exception 'Refund hold accepted';end if;
 update meadow_private.commerce_config set payments_enabled=true,production_ready=true where id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 reply:=public.meadow_market_commerce_status();
 if reply->>'payments_enabled'<>'false' or reply->>'purchase_review_required'<>'true' then raise exception 'Refund hold can open a payment';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 delete from meadow_private.store_review_holds where user_id=u;
 insert into meadow_private.account_deletions(user_id) values(u);
 if meadow_private.play_license_test_allowed(u) then raise exception 'Deletion-pending account accepted';end if;
 delete from meadow_private.account_deletions where user_id=u;
 update meadow_private.commerce_config set payments_enabled=true,production_ready=true where id;
 denied:=false;begin perform public.meadow_market_deliver_store_purchase(u,'mm_pocket_gems',repeat('4',64),'QA-NOT-GOOGLE',false);exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Public flags bypassed test-only lane';end if;
end $$;
rollback;
