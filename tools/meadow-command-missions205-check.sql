begin;
do $$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); s jsonb; b jsonb; r bigint; a jsonb; rejected boolean;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true),(outsider,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Temporary verified mission fixture'),(outsider,'MM-'||left(outsider::text,8),'Temporary legacy mission fixture');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 a:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());r:=(a->>'revision')::bigint;
 select save_data into s from public.meadow_market_saves where user_id=u;insert into meadow_private.farm_command_accounts(user_id) values(u);
 rejected:=false;begin
  perform public.meadow_market_play_service('event',jsonb_build_object('id',gen_random_uuid(),'event','harvest','amount',100));
 exception when sqlstate '42501' then rejected:=true;end;
 if not rejected then raise exception 'Client minted mission progress for command farm';end if;
 perform set_config('meadow.command_owner',u::text,true);
 rejected:=false;begin
  perform public.meadow_market_play_service('event',jsonb_build_object('id',gen_random_uuid(),'event','harvest','amount',100));
 exception when sqlstate '42501' then rejected:=true;end;
 if not rejected then raise exception 'Spoofed marker minted mission progress';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 perform public.meadow_market_play_service('event',jsonb_build_object('id',gen_random_uuid(),'event','harvest','amount',1));
 if (select sum(amount) from public.meadow_market_mission_events where user_id=outsider)<>1 then raise exception 'Legacy player flow regressed';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);perform set_config('meadow.command_owner','',true);
 b:=jsonb_build_object('expected_revision',r,'commands','[{"type":"workers.return"}]'::jsonb);
 a:=public.meadow_market_commit_farm_command(u,request,b,s,'{"results":[],"events":[{"event":"harvest","amount":1},{"event":"harvest","amount":2},{"event":"water","amount":1},{"event":"fruit","amount":1}]}');
 if a->>'ok'<>'true' then raise exception 'Verified mission command failed';end if;
 if (select sum(amount) from public.meadow_market_mission_events where user_id=u and event='harvest')<>3 or (select count(*) from public.meadow_market_mission_events where user_id=u)<>2 then raise exception 'Verified mission grouping failed';end if;
 a:=public.meadow_market_commit_farm_command(u,request,b,s,'{}');
 if a->>'replayed'<>'true' or (select sum(amount) from public.meadow_market_mission_events where user_id=u and event='harvest')<>3 then raise exception 'Retry repeated mission credit';end if;
 select save_data into s from public.meadow_market_saves where user_id=u;r:=(a->>'revision')::bigint;b:=jsonb_set(b,'{expected_revision}',to_jsonb(r));
 rejected:=false;begin
  perform public.meadow_market_commit_farm_command(u,gen_random_uuid(),b,s||'{"coins":260}','{"events":[{"event":"harvest","amount":-1}]}');
 exception when sqlstate '22023' then rejected:=true;end;
 if not rejected then raise exception 'Malformed mission summary accepted';end if;
 if (select revision from public.meadow_market_saves where user_id=u)<>r or (select save_data->>'coins' from public.meadow_market_saves where user_id=u)<>'250' then raise exception 'Rejected summary partially committed save';end if;
 if has_table_privilege('authenticated','public.meadow_market_mission_events','INSERT')
  or has_function_privilege('authenticated','meadow_private.play_service_before_store(text,jsonb)','EXECUTE') then raise exception 'Direct mission writer exposed';end if;
end $$;
select 'Verified mission events commit once, raw cohort events rejected, legacy flow retained and malformed summaries roll back the whole save; all fixture data rolled back' result;
rollback;
