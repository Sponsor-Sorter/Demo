begin;
do $test$
declare u uuid:=gen_random_uuid(); s jsonb:='{"version":1,"coins":100,"farms":{"willow":{"objects":[],"inventory":{"carrot":5}}}}'; r jsonb; bad jsonb; rejected boolean; n bigint;
begin
 insert into auth.users(id,instance_id,aud,role) values(u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 r:=public.meadow_market_commit_save(0,s,gen_random_uuid());if r->>'ok'<>'true' then raise exception 'Valid inventory rejected';end if;
 for bad in select value from jsonb_array_elements('[{"carrot":-1},{"carrot":0.5},{"carrot":"5"},{"carrot":null},{"carrot":true},{"carrot":1000000000001},[],null]'::jsonb) loop
  rejected:=false;
  begin perform public.meadow_market_commit_save(1,jsonb_set(s,'{farms,willow,inventory}',bad),gen_random_uuid());exception when invalid_parameter_value then rejected:=true;end;
  if not rejected then raise exception 'RPC accepted invalid inventory: %',bad;end if;
  rejected:=false;
  begin update public.meadow_market_saves set save_data=jsonb_set(s||'{"_cloudRevision":1}','{farms,willow,inventory}',bad),save_protocol=1 where user_id=u;exception when invalid_parameter_value then rejected:=true;end;
  if not rejected then raise exception 'Direct/downgrade write accepted invalid inventory: %',bad;end if;
 end loop;
 for bad in select value from jsonb_array_elements('[-1,0.5,"5",null,true,1000000000001]'::jsonb) loop
  rejected:=false;
  begin update public.meadow_market_saves set save_data=jsonb_set(s||'{"_cloudRevision":1}','{coins}',bad) where user_id=u;exception when invalid_parameter_value then rejected:=true;end;
  if not rejected then raise exception 'Direct write accepted invalid gold: %',bad;end if;
 end loop;
 rejected:=false;begin update public.meadow_market_saves set save_data=jsonb_set(s||'{"_cloudRevision":1}','{farms,willow,objects}','{}') where user_id=u;exception when invalid_parameter_value then rejected:=true;end;if not rejected then raise exception 'Invalid object list accepted';end if;
 select revision into n from public.meadow_market_saves where user_id=u;if n<>1 then raise exception 'Rejected writes changed revision';end if;
 r:=public.meadow_market_commit_save(1,jsonb_set(s,'{farms,willow,inventory,carrot}','0'),gen_random_uuid());if r->>'ok'<>'true' or (r->>'revision')::bigint<>2 then raise exception 'Valid zero inventory failed';end if;
 execute 'reset role';
 if has_function_privilege('authenticated','meadow_private.guard_save_resources()','EXECUTE') then raise exception 'Trigger function exposed';end if;
end; $test$;
rollback;
select 'Resource bounds: valid/zero inventory, negative/fractional/string/null/boolean/oversized values, direct-write and protocol downgrade bypasses, object shape and unchanged failed revision passed; fixtures rolled back.' as result;
