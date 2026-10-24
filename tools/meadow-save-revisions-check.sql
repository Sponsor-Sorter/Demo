begin;
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); receipt uuid:=gen_random_uuid(); s jsonb:='{"version":1,"coins":100,"seen":100,"farms":{"willow":{"objects":[]}}}'::jsonb; r jsonb; n bigint; rejected boolean;
begin
 insert into auth.users(id,instance_id,aud,role) values(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated'),(b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',a::text,true);
 execute 'set local role authenticated';
 r:=public.meadow_market_commit_save(0,s,receipt);
 if r->>'ok'<>'true' or (r->>'revision')::bigint<>1 then raise exception 'First save failed: %',r;end if;
 r:=public.meadow_market_commit_save(0,s,receipt);
 if r->>'replayed'<>'true' or (r->>'revision')::bigint<>1 then raise exception 'Retry was not idempotent';end if;
 r:=public.meadow_market_commit_save(0,s||'{"coins":999}',gen_random_uuid());
 if r->>'conflict'<>'true' or (r->'save_data'->>'coins')::integer<>100 then raise exception 'Stale write changed the farm';end if;
 rejected:=false;begin perform public.meadow_market_commit_save(0,s||'{"coins":200}',receipt);exception when invalid_parameter_value then rejected:=true;end;if not rejected then raise exception 'Changed retry payload accepted';end if;
 rejected:=false;begin update public.meadow_market_saves set save_data=s,save_protocol=1 where user_id=a;exception when serialization_failure then rejected:=true;end;if not rejected then raise exception 'Legacy overwrite bypassed revision check';end if;
 rejected:=false;begin perform public.meadow_market_commit_save(1,s||'{"coins":-1}',gen_random_uuid());exception when invalid_parameter_value then rejected:=true;end;if not rejected then raise exception 'Negative coins accepted';end if;
 rejected:=false;begin perform public.meadow_market_commit_save(1,'{}'::jsonb,gen_random_uuid());exception when invalid_parameter_value then rejected:=true;end;if not rejected then raise exception 'Missing farm structure accepted';end if;
 -- Supplying an arbitrary revision column cannot bypass the trigger's monotonic server counter.
 update public.meadow_market_saves set revision=999,save_data=s||'{"_cloudRevision":1,"coins":101}' where user_id=a;
 select revision into n from public.meadow_market_saves where user_id=a;if n<>2 then raise exception 'Client controlled server revision';end if;
 r:=public.meadow_market_commit_save(1,s,gen_random_uuid());if r->>'conflict'<>'true' then raise exception 'Delayed second-device save accepted';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 select count(*) into n from public.meadow_market_saves where user_id=a;if n<>0 then raise exception 'Other account save exposed';end if;
 r:=public.meadow_market_commit_save(0,s||'{"coins":300}',gen_random_uuid());if r->>'ok'<>'true' then raise exception 'Second account failed';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 select (save_data->>'coins')::integer into n from public.meadow_market_saves where user_id=a;if n<>101 then raise exception 'Other owner altered first farm';end if;
 perform set_config('request.jwt.claim.sub','',true);
 rejected:=false;begin perform public.meadow_market_commit_save(0,s,gen_random_uuid());exception when invalid_authorization_specification then rejected:=true;end;if not rejected then raise exception 'Missing identity accepted';end if;
 execute 'reset role';
 if has_function_privilege('anon','public.meadow_market_commit_save(bigint,jsonb,uuid)','EXECUTE') then raise exception 'Anonymous role may call save endpoint';end if;
end; $test$;
rollback;
select 'Save revisions: first write, retry receipt, stale write, changed receipt body, legacy bypass, bounds, server counter, second owner and no identity passed; all fixtures rolled back.' as result;
