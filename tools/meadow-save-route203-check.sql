begin;
do $$
declare u uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MEADOW-'||left(u::text,8),'Temporary route fixture');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$
declare rejected boolean; s jsonb:='{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[{"id":"well","type":"well"}],"inventory":{}}}}'; answer jsonb;
begin
 rejected:=false;
 begin
  perform public.meadow_market_commit_save(0,jsonb_set(s,'{farms,willow,objects,0,autoWater}','true'),gen_random_uuid());
 exception when sqlstate '40001' then rejected:=true;end;
 if not rejected then raise exception 'Legacy RPC allowed a forged fresh baseline';end if;
 rejected:=false;
 begin
  insert into public.meadow_market_saves(user_id,save_data) values(auth.uid(),s);
 exception when sqlstate '40001' then rejected:=true;end;
 if not rejected then raise exception 'Direct save allowed a fresh baseline';end if;
 rejected:=false;
 begin
  perform public.meadow_market_commit_economy_save(0,jsonb_set(s,'{farms,willow,objects,0,autoWater}','true'),gen_random_uuid());
 exception when sqlstate '22023' then rejected:=true;end;
 if not rejected then raise exception 'Current RPC accepted an unverified paid baseline';end if;
 answer:=public.meadow_market_commit_economy_save(0,s,gen_random_uuid());
 if answer->>'ok'<>'true' then raise exception 'Current save route did not work';end if;
end $$;
reset role;
select 'Fresh legacy/direct writes rejected; current RPC checked paid perks and saved normally; all fixture changes rolled back' as result;
rollback;
