begin;
do $$
declare u uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); response jsonb; records jsonb;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true),(other,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Temporary round owner'),(other,'MM-'||left(other::text,8),'Temporary other owner');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 response:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 insert into meadow_private.farm_command_accounts(user_id) values(u);
 insert into meadow_private.round_progress(user_id,game,legacy_level) values(u,'eggs',1);
 insert into public.meadow_market_play_runs(id,user_id,game,week,level,points,won,verified) values
 (gen_random_uuid(),u,'eggs','2026-10-26',2,1200,true,true),
 (gen_random_uuid(),u,'eggs','2026-10-26',3,1300,false,true),
 (gen_random_uuid(),u,'eggs','2026-10-26',90,999999,true,false),
 (gen_random_uuid(),other,'eggs','2026-10-26',99,999999,true,true);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 response:=public.meadow_market_read_farm_command(u,gen_random_uuid(),jsonb_build_object('expected_revision',(response->>'revision')::bigint,'commands','[{"type":"shop.check"}]'::jsonb));records:=response->'round_records';
 if jsonb_array_length(records)<>1 or records->0->>'game'<>'eggs' or (records->0->>'level')::int<>3 or (records->0->>'wins')::int<>1 or (records->0->>'bestScore')::int<>1300 then raise exception 'Verified round records mixed owners, losses, levels or unverified scores';end if;
end $$;
rollback;
