begin;
do $$
declare u uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); token text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 s jsonb; answer jsonb; r bigint; rejected boolean; enrolled boolean;
begin
 for enrolled in select false union all select true loop
 u:=gen_random_uuid();rid:=gen_random_uuid();token:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 perform set_config('request.jwt.claims','{}',true);
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'REF-'||left(u::text,8),'Temporary refund fixture');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 s:='{"version":1,"coins":3100,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{"carrot":10}}}}';
 answer:=public.meadow_market_commit_economy_save(0,s,gen_random_uuid());r:=(answer->>'revision')::bigint;
 update public.meadow_market_wallets set gems=300,vip_xp=300 where user_id=u;
 insert into public.meadow_market_economy_receipts(id,user_id,request_id,kind,delivery)
 values(rid,u,gen_random_uuid(),'purchase','{"gold":3000,"items":{"carrot":5}}');
 insert into meadow_private.farm_reward_deliveries(receipt_id,user_id,revision) values(rid,u,r);
 insert into meadow_private.store_purchases(token_hash,user_id,product_id,receipt_id,test_purchase,benefits)
 values(token,u,'mm_builders_pack',rid,true,'{"gems":300,"turns":0,"premium":false}');
 if enrolled then insert into meadow_private.farm_command_accounts(user_id) values(u);end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 if not public.meadow_market_revoke_store_purchase(token) then raise exception 'Verified refund was not processed';end if;
 select save_data,revision into s,r from public.meadow_market_saves where user_id=u;
 if s->>'coins'<>'100' or s->'farms'->'willow'->'inventory'->>'carrot'<>'5' then raise exception 'Refund resource arithmetic failed';end if;
 if (select save_protocol from public.meadow_market_saves where user_id=u)<>(case when enrolled then 4 else 3 end) then raise exception 'Refund changed protocol incorrectly';end if;
 if exists(select 1 from public.meadow_market_wallets where user_id=u and (gems<>0 or vip_xp<>0)) then raise exception 'Refund left paid currency';end if;
 if nullif(current_setting('meadow.command_owner',true),'') is not null then raise exception 'Refund leaked its command marker';end if;
 if not exists(select 1 from meadow_private.farm_economy_journal where user_id=u and revision=r and lane='server_refund' and source_id=token and changes->>'gold'='-3000') then raise exception 'Refund audit missing';end if;
 if not exists(select 1 from meadow_private.store_review_holds where user_id=u) then raise exception 'Refund review hold missing';end if;
 if not public.meadow_market_revoke_store_purchase(token) or (select revision from public.meadow_market_saves where user_id=u)<>r then raise exception 'Refund replay changed the farm twice';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 rejected:=false;begin
  perform public.meadow_market_commit_economy_save(r,s||'{"coins":999999}',gen_random_uuid());
 exception when sqlstate '40001' then rejected:=true;end;
 if rejected is distinct from enrolled then raise exception 'Refund helper changed the rollout boundary';end if;
 if has_function_privilege('authenticated','meadow_private.write_verified_refund(uuid,jsonb,text)','EXECUTE')
 or has_function_privilege('service_role','meadow_private.write_verified_refund(uuid,jsonb,text)','EXECUTE') then raise exception 'Private refund helper was exposed';end if;
 end loop;
end $$;
select 'Verified refund supports protocol4, reverses resources once, restores marker, journals its source and preserves client denial; all fixture data rolled back' result;
rollback;
