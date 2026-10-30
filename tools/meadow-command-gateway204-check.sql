begin;
do $$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); s jsonb; b jsonb; answer jsonb; r bigint; rejected boolean;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true),(outsider,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Temporary command fixture'),(outsider,'MM-'||left(outsider::text,8),'Temporary isolated fixture');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 s:='{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[{"id":"plot","type":"plot","stage":0}],"inventory":{}}}}';
 answer:=public.meadow_market_commit_economy_save(0,s,gen_random_uuid());r:=(answer->>'revision')::bigint;
 select save_data into s from public.meadow_market_saves where user_id=u;
 insert into meadow_private.farm_command_accounts(user_id) values(u);
 b:=jsonb_build_object('expected_revision',r,'commands',jsonb_build_array(jsonb_build_object('type','plot.till','map','willow','target','plot')));
 rejected:=false;begin
  perform public.meadow_market_commit_economy_save(r,s||'{"coins":999999}',gen_random_uuid());
 exception when sqlstate '40001' then rejected:=true;end;
 if not rejected then raise exception 'Enrolled farm accepted raw gold';end if;
 -- A spoofed transaction marker by an authenticated caller is not sufficient.
 perform set_config('meadow.command_owner',u::text,true);
 rejected:=false;begin
  perform public.meadow_market_commit_economy_save(r,s,gen_random_uuid());
 exception when sqlstate '40001' then rejected:=true;end;
 if not rejected then raise exception 'Marker bypassed authenticated role';end if;
 rejected:=false;begin
  perform public.meadow_market_read_farm_command(u,request,b);
 exception when sqlstate '42501' then rejected:=true;end;
 if not rejected then raise exception 'Authenticated caller reached service gateway';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 answer:=public.meadow_market_read_farm_command(u,request,b);
 if answer->>'enabled'<>'true' or answer->'save_data'<>s or (answer->>'server_time')::numeric<=0 then raise exception 'Server context failed';end if;
 answer:=public.meadow_market_read_farm_command(outsider,request,b);
 if answer->>'enabled'<>'false' then raise exception 'Other owner leaked into cohort';end if;
 rejected:=false;begin
  perform public.meadow_market_commit_farm_command(u,gen_random_uuid(),b,jsonb_set(s,'{farms,willow,objects,0,autoWater}','true'),'{"events":[]}');
 exception when sqlstate '22023' then rejected:=true;end;
 if not rejected then raise exception 'Command gateway bypassed paid-entitlement protection';end if;
 s:=jsonb_set(s,'{farms,willow,objects,0,stage}','1');
 answer:=public.meadow_market_commit_farm_command(u,request,b,s,'{"results":[{"type":"plot.till"}],"events":[],"rules":"fixture"}');
 if answer->>'ok'<>'true' or (answer->>'revision')::bigint<>r+1 then raise exception 'Command did not commit';end if;
 if (select save_protocol from public.meadow_market_saves where user_id=u)<>4 then raise exception 'Protocol downgraded';end if;
 if auth.jwt()->>'role'<>'service_role' or auth.uid() is not null then raise exception 'Owner claims leaked after commit';end if;
 answer:=public.meadow_market_commit_farm_command(u,request,b,s||'{"coins":999999}','{"events":[]}');
 if answer->>'replayed'<>'true' or answer->'save_data'->>'coins'<>'250' then raise exception 'Retry reapplied forged candidate';end if;
 rejected:=false;begin
  perform public.meadow_market_commit_farm_command(u,request,b||'{"commands":[{"type":"shop.check"}]}',s,'{"events":[]}');
 exception when sqlstate '22023' then rejected:=true;end;
 if not rejected then raise exception 'Request id reused for different commands';end if;
 answer:=public.meadow_market_commit_farm_command(u,gen_random_uuid(),b,s,'{"events":[]}');
 if answer->>'conflict'<>'true' then raise exception 'Stale revision not rejected';end if;
 if (select count(*) from meadow_private.farm_command_receipts where user_id=u)<>1 then raise exception 'Duplicate command receipt';end if;
 -- A pending verified reward is applied in the SAME transaction as an action.
 select save_data into s from public.meadow_market_saves where user_id=u;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,delivery) values(u,gen_random_uuid(),'game_reward','{"gold":25}');
 answer:=public.meadow_market_commit_farm_command(u,gen_random_uuid(),jsonb_build_object('expected_revision',r+1,'commands','[{"type":"shop.check"}]'::jsonb),s,'{"events":[]}');
 if answer->'save_data'->>'coins'<>'275' or answer->'save_data'->'_farmEconomy'->>'cursor'<>'1' then raise exception 'Verified reward did not join command commit';end if;
 answer:=public.meadow_market_commit_farm_command(u,request,b,s,'{"events":[]}');
 if answer->>'replayed'<>'true' or (answer->>'accepted_revision')::bigint<>r+1 or (answer->>'revision')::bigint<>r+2 or answer->'save_data'->>'coins'<>'275' then raise exception 'Old accepted retry overwrote newer farm';end if;
 if (select count(*) from meadow_private.farm_reward_deliveries where user_id=u)<>1 then raise exception 'Reward delivered twice';end if;
 if has_function_privilege('authenticated','public.meadow_market_commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE')
 or has_function_privilege('anon','public.meadow_market_read_farm_command(uuid,uuid,jsonb)','EXECUTE')
 or has_table_privilege('authenticated','meadow_private.farm_command_accounts','INSERT') then raise exception 'Public command privilege leak';end if;
 delete from public.meadow_market_profiles where user_id=u;
 if exists(select 1 from meadow_private.farm_command_receipts where user_id=u) or exists(select 1 from meadow_private.farm_command_accounts where user_id=u) then raise exception 'Game erasure did not cascade';end if;
end $$;
select 'Command-only writes, owner isolation, role/marker checks, CAS, replay, mismatched retry, grants and erasure passed; all test data rolled back' as result;
rollback;
