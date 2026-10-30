begin;
do $$
declare u uuid:=gen_random_uuid(); s jsonb; proposed jsonb; answer jsonb; rev bigint; rejected boolean;
begin
 insert into auth.users(id,aud,role,email,is_anonymous) values(u,'authenticated','authenticated','fixture-'||u||'@example.test',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MEADOW-'||left(u::text,8),'Temporary entitlement fixture');
 perform set_config('request.jwt.claim.sub',u::text,true);
 s:='{"version":1,"coins":100,"xp":0,"level":1,"active":"willow","sharedPantryVersion":1,"club":{"applied":[]},"farms":{"willow":{"inventory":{},"objects":[{"id":"well","type":"well"},{"id":"oven","type":"kitchen"}]},"east":{"inventory":{},"objects":[]}}}'::jsonb;
 insert into public.meadow_market_saves(user_id,save_data,save_protocol) values(u,s,3) returning revision into rev;
 foreach proposed in array array[jsonb_set(s,'{farms,willow,objects,0,autoWater}','true'),jsonb_set(s,'{farms,willow,objects,0,wellGemTier}','4'),jsonb_set(s,'{farms,willow,objects,1,queueSlots}','8')] loop
  rejected:=false;begin perform public.meadow_market_commit_economy_save(rev,proposed,gen_random_uuid());exception when sqlstate '22023' then rejected:=true;end;
  if not rejected then raise exception 'Forged paid upgrade accepted';end if;
 end loop;
 -- A real server receipt still applies after validation, then retries safely.
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,delivery) values(u,gen_random_uuid(),'redeem','{"well_watering":{"map":"willow","target":"well"},"well_upgrade":{"map":"willow","target":"well","level":2},"queue_slot":{"map":"willow","target":"oven","level":3}}');
 answer:=public.meadow_market_commit_economy_save(rev,s,gen_random_uuid());
 if not(answer->>'ok')::boolean then raise exception 'Valid receipt rejected';end if;
 select save_data,revision into s,rev from public.meadow_market_saves where user_id=u;
 if s#>>'{farms,willow,objects,0,autoWater}'<>'true' or s#>>'{farms,willow,objects,0,wellGemTier}'<>'2' or s#>>'{farms,willow,objects,1,queueSlots}'<>'3' then raise exception 'Verified benefits not applied';end if;
 -- Moving the licensed well between maps preserves its paid state.
 proposed:=jsonb_set(jsonb_set(s,'{farms,east,objects}',jsonb_build_array(s#>'{farms,willow,objects,0}')),'{farms,willow,objects}',jsonb_build_array(s#>'{farms,willow,objects,1}'));
 answer:=public.meadow_market_commit_economy_save(rev,proposed,gen_random_uuid());
 if not(answer->>'ok')::boolean then raise exception 'Licensed item move rejected';end if;
 select save_data,revision into s,rev from public.meadow_market_saves where user_id=u;
 -- Duplicating that well into a second map cannot clone a paid licence.
 proposed:=jsonb_set(s,'{farms,willow,objects}',(s#>'{farms,willow,objects}')||jsonb_build_array(s#>'{farms,east,objects,0}'));
 rejected:=false;begin perform public.meadow_market_commit_economy_save(rev,proposed,gen_random_uuid());exception when sqlstate '22023' then rejected:=true;end;
 if not rejected then raise exception 'Paid licence clone accepted';end if;
 proposed:=jsonb_set(s,'{farms,east,objects}',(s#>'{farms,east,objects}')||jsonb_build_array(s#>'{farms,east,objects,0}'));
 rejected:=false;begin perform public.meadow_market_commit_economy_save(rev,proposed,gen_random_uuid());exception when sqlstate '22023' then rejected:=true;end;
 if not rejected then raise exception 'Same-map paid licence clone accepted';end if;
 rejected:=false;begin perform meadow_private.assert_farm_entitlements(null,proposed);exception when sqlstate '22023' then rejected:=true;end;
 if not rejected then raise exception 'New-save licence forgery accepted';end if;
 if has_function_privilege('anon','meadow_private.assert_farm_entitlements(jsonb,jsonb)','EXECUTE') or has_function_privilege('authenticated','meadow_private.assert_farm_entitlements(jsonb,jsonb)','EXECUTE') then raise exception 'Private guard exposed';end if;
end $$;
rollback;
