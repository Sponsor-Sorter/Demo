begin;
do $$
declare u uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); proof uuid:=gen_random_uuid(); foreign_proof uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); s jsonb; b jsonb; r bigint; a jsonb; rejected boolean;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true),(other,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Temporary market fixture'),(other,'MM-'||left(other::text,8),'Temporary other market fixture');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 a:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":100,"level":8,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{"carrot":6}}}}',gen_random_uuid());r:=(a->>'revision')::bigint;select save_data into s from public.meadow_market_saves where user_id=u;
 insert into meadow_private.farm_command_accounts(user_id) values(u);
 insert into meadow_private.reward_rounds(id,user_id,request_id,game,level,goal,duration,map,expires_at,closed,result) values(proof,u,gen_random_uuid(),'market_pack',1,3,45,'willow',now()+interval '20 minutes',true,'{}'),(foreign_proof,other,gen_random_uuid(),'market_pack',1,3,45,'willow',now()+interval '20 minutes',true,'{}');
 insert into public.meadow_market_play_runs(id,user_id,game,week,level,points,won,verified) values(proof,u,'market_pack',date_trunc('week',now() at time zone 'UTC')::date,1,1400,true,true),(foreign_proof,other,'market_pack',date_trunc('week',now() at time zone 'UTC')::date,1,1400,true,true);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 b:=jsonb_build_object('expected_revision',r,'commands',jsonb_build_array(jsonb_build_object('type','market.sell','map','willow','data',jsonb_build_object('round',proof,'item','carrot'))));
 a:=public.meadow_market_read_farm_command(u,request,b);
 if jsonb_array_length(a->'market_rounds')<>1 or a->'market_rounds'->0->>'id'<>proof::text then raise exception 'Owned verified market round not provided';end if;
 s:=jsonb_set(jsonb_set(s,'{coins}','136'),'{farms,willow,inventory,carrot}','3');
 a:=public.meadow_market_commit_farm_command(u,request,b,s,jsonb_build_object('events','[]'::jsonb,'market_sales',jsonb_build_array(jsonb_build_object('id',proof,'map','willow'))));
 if a->>'ok'<>'true' or a->'save_data'->>'coins'<>'136' or (select count(*) from meadow_private.market_sale_rounds where user_id=u)<>1 then raise exception 'Market sale did not commit atomically';end if;
 a:=public.meadow_market_commit_farm_command(u,request,b,s||'{"coins":9999}','{}');if a->>'replayed'<>'true' or a->'save_data'->>'coins'<>'136' then raise exception 'Same request sold twice';end if;
 r:=(a->>'revision')::bigint;b:=jsonb_set(b,'{expected_revision}',to_jsonb(r));a:=public.meadow_market_read_farm_command(u,gen_random_uuid(),b);if a->'market_rounds'<>'[]'::jsonb then raise exception 'Consumed proof offered again';end if;
 rejected:=false;begin perform public.meadow_market_commit_farm_command(u,gen_random_uuid(),b,s||'{"coins":172}',jsonb_build_object('events','[]'::jsonb,'market_sales',jsonb_build_array(jsonb_build_object('id',proof,'map','willow'))));exception when sqlstate '22023' then rejected:=true;end;
 if not rejected or (select save_data->>'coins' from public.meadow_market_saves where user_id=u)<>'136' then raise exception 'New request reused proof or partially changed gold';end if;
 rejected:=false;begin perform public.meadow_market_commit_farm_command(u,gen_random_uuid(),b,s||'{"coins":172}',jsonb_build_object('events','[]'::jsonb,'market_sales',jsonb_build_array(jsonb_build_object('id',foreign_proof,'map','willow'))));exception when sqlstate '22023' then rejected:=true;end;
 if not rejected then raise exception 'Another owner’s round sold goods';end if;
 if has_table_privilege('authenticated','meadow_private.market_sale_rounds','INSERT') or has_table_privilege('service_role','meadow_private.market_sale_rounds','INSERT') then raise exception 'Market redemption table is directly exposed';end if;
end $$;
select 'Market proof ownership, atomic gold/stock/round consumption, same-ID retry, new-ID double-spend denial and private grants passed; all test data rolled back' result;
rollback;
