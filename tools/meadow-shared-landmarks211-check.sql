begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();other uuid:=gen_random_uuid();r jsonb;rev bigint;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true),(v,'authenticated','authenticated',true),(other,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Temporary landmark owner'),(v,'MM-'||left(v::text,8),'Temporary helper'),(other,'MM-'||left(other::text,8),'Temporary other owner');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 r:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":12,"xp":0,"active":"willow","journey":{"projects":{"hall":2}},"farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());rev:=(r->>'revision')::bigint;
 insert into meadow_private.community_acceptances(user_id,version) values(u,1),(v,1);
 insert into public.meadow_market_friendships(requester_id,recipient_id,status) values(u,v,'accepted');
 r:=public.meadow_market_journey_service('start','{"theme":"garden"}');
 if (r#>>'{projects,0,stage}')::int<>0 then raise exception 'New landmark must start empty';end if;
 -- The trigger runs under the visitor JWT; completion must still apply to owner.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);
 insert into public.meadow_market_visit_events(owner_id,visitor_id,map_id,action,target_id,target_name,target_cycle,outcome,created_at)
 select u,v,'willow','water','bed-'||i,'Temporary bed',i,'applied',clock_timestamp() from generate_series(1,15) i;
 if not exists(select 1 from public.meadow_market_village_projects where owner_id=u and completed_at is not null) then raise exception 'Acknowledged help did not permanently complete landmark';end if;
 delete from public.meadow_market_friendships where requester_id=u and recipient_id=v;
 delete from public.meadow_market_visit_events where owner_id=u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 r:=public.meadow_market_journey_service('status');if (r#>>'{projects,0,stage}')::int<>3 then raise exception 'Friend removal or log retention undid landmark';end if;
 r:=public.meadow_market_journey_service('start','{"theme":"river"}');
 begin perform public.meadow_market_journey_service('start','{"theme":"hall"}');raise exception 'Unfinished landmark did not block the next one';exception when others then if sqlerrm='Unfinished landmark did not block the next one' then raise;end if;end;
 insert into public.meadow_market_village_projects(owner_id,theme,completed_at) values(other,'hall',clock_timestamp());
 insert into meadow_private.farm_command_accounts(user_id) values(u);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 r:=public.meadow_market_read_farm_command(u,gen_random_uuid(),jsonb_build_object('expected_revision',rev,'commands','[{"type":"shop.check"}]'::jsonb));
 if r->'shared_landmarks'<>'["garden"]'::jsonb then raise exception 'Command reader mixed permanent landmarks or owners';end if;
 if has_table_privilege('authenticated','public.meadow_market_village_projects','UPDATE') or has_function_privilege('authenticated','meadow_private.refresh_shared_landmarks(uuid)','EXECUTE') then raise exception 'Players can mint landmark completion';end if;
end $$;
rollback;
