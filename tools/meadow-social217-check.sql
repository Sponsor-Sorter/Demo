begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();r bigint;a jsonb;b jsonb;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true),(v,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Temporary social proof'),(v,'MM-'||left(v::text,8),'Temporary social friend');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 a:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());r:=(a->>'revision')::bigint;
 insert into meadow_private.farm_command_accounts(user_id) values(u);
 b:=jsonb_build_object('expected_revision',r,'commands','[{"type":"social.visit","map":"willow"}]'::jsonb);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 a:=public.meadow_market_read_farm_command(u,gen_random_uuid(),b);
 if a->>'visited_friend'<>'false' then raise exception 'Unrecorded visit was accepted';end if;
 insert into public.meadow_market_visit_events(owner_id,visitor_id,map_id,action,target_id) values(u,v,'willow','visit','');
 a:=public.meadow_market_read_farm_command(u,gen_random_uuid(),b);
 if a->>'visited_friend'<>'false' then raise exception 'Another player visit was accepted';end if;
 insert into public.meadow_market_visit_events(owner_id,visitor_id,map_id,action,target_id) values(v,u,'willow','visit','');
 a:=public.meadow_market_read_farm_command(u,gen_random_uuid(),b);
 if a->>'visited_friend'<>'true' then raise exception 'Recorded own visit was ignored';end if;
 b:=jsonb_set(b,'{commands}','[{"type":"lesson.claim","target":"friends"}]');
 a:=public.meadow_market_read_farm_command(u,gen_random_uuid(),b);
 if a->>'visited_friend'<>'true' then raise exception 'Existing friend lesson proof regressed';end if;
 if has_function_privilege('authenticated','public.meadow_market_read_farm_command(uuid,uuid,jsonb)','EXECUTE') then raise exception 'Player can forge proof';end if;
end $$;
rollback;
