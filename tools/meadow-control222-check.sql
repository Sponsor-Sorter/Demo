-- Synthetic rollback acceptance. No staff enrollment or real-player sanctions.
begin;
create function pg_temp.denied(q text,expected text default null) returns void language plpgsql as $$
declare rejected boolean:=false;
begin begin execute q;exception when others then rejected:=true;if expected is not null and sqlstate<>expected then raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end if;end;
 if not rejected then raise exception 'Unexpectedly allowed: %',q;end if;
end $$;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();s uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();sv uuid:=gen_random_uuid();ban uuid:=gen_random_uuid();warn uuid:=gen_random_uuid();foreign_warning uuid:=gen_random_uuid();actor uuid:=gen_random_uuid();reviewer uuid:=gen_random_uuid();request_id uuid:=gen_random_uuid();result jsonb;again jsonb;before_claims text;target_id uuid;target_ids uuid[]:='{}';counter integer;
begin
 if has_table_privilege('authenticated','meadow_private.control_config','UPDATE') or has_table_privilege('service_role','meadow_private.control_config','UPDATE') or has_function_privilege('authenticated','public.meadow_market_control_read_command(uuid,uuid,uuid,jsonb)','EXECUTE') then raise exception 'Control access exposed';end if;
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',false),(v,'authenticated','authenticated',false),(other_id,'authenticated','authenticated',false);
 insert into auth.sessions(id,user_id) values(s,u),(s2,u),(sv,v);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'QA-'||left(u::text,8),'Synthetic Meadow A'),(v,'QA-'||left(v::text,8),'Synthetic Meadow B');
 for counter in 1..10 loop
  target_id:=gen_random_uuid();target_ids:=array_append(target_ids,target_id);
  insert into auth.users(id,aud,role,is_anonymous) values(target_id,'authenticated','authenticated',false);
  insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(target_id,'QA-'||left(target_id::text,8),'Synthetic report target');
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u,'session_id',s)::text,true);
 result:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 update meadow_private.control_config set enforced=true where id;
 before_claims:=current_setting('request.jwt.claims');
 result:=public.meadow_market_control_service('admit');
 if result->>'admitted'<>'true' or result->'moderation'->>'app'<>'meadow' or current_setting('request.jwt.claims')<>before_claims then raise exception 'Admission/binding/claims restoration failed';end if;
 perform pg_temp.denied($q$select public.meadow_market_control_service('status','{"app":"littles","actor":"spoof"}')$q$,'22023');
 perform pg_temp.denied(format('select meadow_private.control_state(%L::uuid)',v),'42501');
 perform set_config('request.jwt.claims','{}',true);perform pg_temp.denied('select public.meadow_market_control_service(''status'')','28000');
 perform set_config('request.jwt.claims',before_claims,true);
 delete from auth.sessions where id=s;perform pg_temp.denied('select public.meadow_market_control_service(''status'')','28000');
 insert into auth.sessions(id,user_id) values(s,u);
 update auth.sessions set not_after=now()-interval '1 minute' where id=s;perform pg_temp.denied('select public.meadow_market_control_service(''status'')','28000');update auth.sessions set not_after=null where id=s;
 result:=public.meadow_market_control_service('admit');
 insert into public.fairplay_admin_moderation_decisions(id,request_id,app,target,kind,case_id,reason,actor,reviewer,expires_at) values
  (gen_random_uuid(),gen_random_uuid(),'littles',u,'moderation.ban','synthetic','Wrong game must not apply',actor,reviewer,now()+interval '1 hour'),
  (warn,gen_random_uuid(),'meadow',u,'moderation.warning','synthetic','Synthetic warning',actor,reviewer,now()+interval '1 hour'),
  (foreign_warning,gen_random_uuid(),'meadow',v,'moderation.warning','synthetic','Other synthetic warning',actor,reviewer,now()+interval '1 hour');
 perform meadow_private.control_guard('play');
 result:=public.meadow_market_control_service('ack',jsonb_build_object('decision',warn));
 if result->>'ok'<>'true' then raise exception 'Warning ack failed';end if;
 perform pg_temp.denied(format('select public.meadow_market_control_service(''ack'',%L::jsonb)',jsonb_build_object('decision',foreign_warning)));
 insert into public.fairplay_admin_moderation_decisions(id,request_id,app,target,kind,case_id,reason,actor,reviewer,expires_at) values(ban,gen_random_uuid(),'meadow',u,'moderation.ban','synthetic','Synthetic access test',actor,reviewer,now()+interval '1 hour');
 perform pg_temp.denied('select meadow_private.control_guard(''play'')','42501');
 perform pg_temp.denied('select public.meadow_market_reward_round(''start'',''{"game":"eggs"}'')','42501');
 perform pg_temp.denied('select public.meadow_market_commit_economy_save(1,''{}'',gen_random_uuid())','42501');
 result:=public.meadow_market_control_service('status');if result->'moderation'->>'banned'<>'true' then raise exception 'Banned player cannot see reason';end if;
 execute 'set local role authenticated';
 select count(*) into counter from public.meadow_market_saves where user_id=u;
 if counter<>1 then raise exception 'Own read-only save was hidden during ban';end if;
 perform pg_temp.denied('update public.meadow_market_saves set save_data=save_data','42501');
 perform pg_temp.denied('update public.meadow_market_profiles set display_name=''Bypass'' where user_id=auth.uid()','42501');
 execute 'reset role';
 result:=public.meadow_market_account_deletion('status'); -- Recovery/privacy access survives ban.
 result:=public.meadow_market_control_service('appeal',jsonb_build_object('decision',ban,'request_id',request_id,'reason','Synthetic review request'));
 again:=public.meadow_market_control_service('appeal',jsonb_build_object('decision',ban,'request_id',request_id,'reason','Synthetic review request'));
 if again->>'duplicate'<>'true' or again->>'reference'<>result->>'reference' then raise exception 'Appeal duplicate delivery';end if;
 perform pg_temp.denied(format('select public.meadow_market_control_service(''appeal'',%L::jsonb)',jsonb_build_object('decision',foreign_warning,'request_id',gen_random_uuid(),'reason','Wrong owner test')));
 update public.fairplay_admin_moderation_decisions set revoked_at=now() where id=ban;perform meadow_private.control_guard('play');
 update public.fairplay_admin_moderation_decisions set revoked_at=null,expires_at=now()-interval '1 minute' where id=ban;perform meadow_private.control_guard('play');
 update public.fairplay_admin_moderation_decisions set kind='moderation.restrict',expires_at=now()+interval '1 hour' where id=ban;
 perform meadow_private.control_guard('play');perform pg_temp.denied('select meadow_private.control_guard(''social'')','42501');perform pg_temp.denied('select meadow_private.control_guard(''ranked'')','42501');
 if meadow_private.control_can_read(v,true) then raise exception 'Restricted social directory visible';end if;
 request_id:=gen_random_uuid();result:=public.meadow_market_social_safety('report',v,'name','Synthetic report, no violation proven',request_id);
 again:=public.meadow_market_social_safety('report',v,'name','Synthetic report, no violation proven',request_id);
 if again->'report'->>'duplicate'<>'true' or (select count(*) from public.fairplay_admin_player_reports where reporter=u)<>1 then raise exception 'Report dedup failed';end if;
 if not exists(select 1 from public.fairplay_admin_player_reports r where r.reporter=u and r.target=v and r.app='meadow' and r.evidence->>'source'='server_public_directory' and r.evidence->>'allegation_unproven'='true') then raise exception 'Server context missing';end if;
 for counter in 1..9 loop result:=public.meadow_market_social_safety('report',target_ids[counter],'other','Synthetic rate-limit acceptance',gen_random_uuid());end loop;
 perform pg_temp.denied(format('select public.meadow_market_social_safety(''report'',%L::uuid,''other'',''Synthetic over-limit report'',gen_random_uuid())',target_ids[10]));
 perform pg_temp.denied(format('select public.meadow_market_social_safety(''report'',%L::uuid,''other'',''Self test'',gen_random_uuid())',u));
 perform pg_temp.denied(format('select public.meadow_market_social_safety(''report'',%L::uuid,''other'',''Wrong game target'',gen_random_uuid())',other_id));
 update public.fairplay_admin_moderation_decisions set revoked_at=now() where id=ban;
 update meadow_private.control_admissions set admitted_at=now()-interval '1 minute' where session_id=s;
 insert into public.fairplay_admin_runtime(app,maintenance,updated_at) values('meadow',true,now()) on conflict(app) do update set maintenance=true,updated_at=now();
 perform meadow_private.control_guard('play');
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u,'session_id',s2)::text,true);
 perform pg_temp.denied('select meadow_private.control_guard(''play'')','55000');perform meadow_private.control_guard('read');
 result:=public.meadow_market_control_service('status');if result->>'admitted'<>'false' or result->'runtime'->>'maintenance'<>'true' then raise exception 'Maintenance admission semantics wrong';end if;
 execute 'set local role authenticated';
 select count(*) into counter from public.meadow_market_saves where user_id=u;
 if counter<>1 then raise exception 'Maintenance hid read-only farm';end if;
 perform pg_temp.denied('update public.meadow_market_saves set save_data=save_data','55000');
 execute 'reset role';
 insert into public.fairplay_admin_game_notices(id,app,title,message,min_build,max_build,expires_at,actor,reviewer) values
 (gen_random_uuid(),'meadow','Visible synthetic notice','Build222 only',222,222,now()+interval '1 hour',actor,reviewer),
 (gen_random_uuid(),'meadow','Other build','Not222',223,999,now()+interval '1 hour',actor,reviewer),
 (gen_random_uuid(),'meadow','Expired','Not active',222,222,now()-interval '1 minute',actor,reviewer),
 (gen_random_uuid(),'littles','Other app','Not Meadow',222,222,now()+interval '1 hour',actor,reviewer);
 result:=public.meadow_market_control_service('status');if jsonb_array_length(result->'runtime'->'notices')<>1 then raise exception 'Notice build/app/expiry filter failed';end if;
 result:=public.meadow_market_control_service('status','{"build":221}');if jsonb_array_length(result->'runtime'->'notices')<>0 then raise exception 'Old-build notices leaked';end if;
 perform pg_temp.denied('select public.meadow_market_control_service(''status'',''{"build":"222"}'')','22023');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);perform set_config('meadow.control_session','',true);
 perform pg_temp.denied(format('select public.meadow_market_read_farm_command(%L::uuid,gen_random_uuid(),''{}'')',u),'28000');
 perform pg_temp.denied(format('select public.meadow_market_control_read_command(%L::uuid,%L::uuid,gen_random_uuid(),''{}'')',v,s),'28000');
 for counter in 1..11 loop result:=public.meadow_market_control_event(u,gen_random_uuid(),'MEADOW_BANNED');end loop;
 if result->>'limited'<>'true' then raise exception 'Telemetry throttle missing';end if;
 if exists(select 1 from public.fairplay_admin_game_events where app='meadow' and player_id=u and (body ?| array['email','token','password','ip','cookie','authorization'] or body->>'source'<>'verified_game_backend')) then raise exception 'Unsafe telemetry body';end if;
 result:=public.meadow_market_control_heartbeat(false);
 if (select consumer_version from public.fairplay_admin_game_integrations where app='meadow')<>'meadow-control222' then raise exception 'Candidate declaration missing';end if;
end $$;
rollback;
