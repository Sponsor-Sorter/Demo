-- Disposable rollback fixtures. No provider charge or player password is used.
begin;
set local statement_timeout='30s';
do $$
declare u uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();n int;answer jsonb;denied boolean:=false;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',false);
 insert into auth.sessions(id,user_id) values(sid,u);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'QA240-'||left(u::text,8),'Rollback benefits240');
 insert into public.meadow_market_wallets(user_id) values(u) on conflict do nothing;
 insert into meadow_private.test_access(user_id,reason,expires_at) values(u,'Rollback old-owner fixture',now()+interval '1 hour');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid)::text,true);
 -- Reproduce the pre-update decoration-only grant, then run the real upgrade.
 answer:=meadow_private.claim_test_story_pack239('welcome_garden');
 if exists(select 1 from meadow_private.pack_benefit_grants where user_id=u) then raise exception 'Legacy fixture already had extras';end if;
 select gems into n from public.meadow_market_wallets where user_id=u;
 perform meadow_private.ensure_pack_benefits240(u);perform meadow_private.ensure_pack_benefits240(u);
 if not exists(select 1 from public.meadow_market_wallets where user_id=u and gems=n+20) then raise exception 'Old-owner gems were missing or duplicated';end if;
 if (select count(*) from meadow_private.pack_benefit_grants where user_id=u)<>1 then raise exception 'Old-owner booster grant duplicated';end if;
 if meadow_private.pack_grants240(u)->0->>'charges'<>'3' then raise exception 'Old-owner boosters missing';end if;
 answer:=public.meadow_market_commerce_status();
 if jsonb_array_length(answer->'pack_grants')<>1 or answer->'pack_grants'->0 ? 'source' then raise exception 'Public status omitted inventory or exposed provider source';end if;
 begin perform meadow_private.assert_farm_entitlements('{}','{"packBenefits":{"used":{},"windows":[{"rate":99}]}}');exception when sqlstate '22023' then denied:=true;end;
 if not denied then raise exception 'A client forged paid state';end if;
 if has_table_privilege('authenticated','meadow_private.pack_benefit_grants','select') or has_function_privilege('authenticated','meadow_private.ensure_pack_benefits240(uuid)','execute') then raise exception 'Grant table/function exposed';end if;
end $$;
rollback;
select 'PASS: old-owner extras once, inventory privacy, snapshot forgery denial and private privileges; fixture rolled back' result;
