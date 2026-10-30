begin;
do $$
declare u uuid:=gen_random_uuid(); body jsonb; reply jsonb; saved jsonb; revision bigint; request uuid:=gen_random_uuid(); rejected boolean;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Temporary account guard');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 reply:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 revision:=(reply->>'revision')::bigint;select save_data into saved from public.meadow_market_saves where user_id=u;
 insert into meadow_private.farm_command_accounts(user_id) values(u);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 body:=jsonb_build_object('expected_revision',revision,'commands','[{"type":"shop.check"}]'::jsonb);
 insert into meadow_private.account_deletions(user_id) values(u);
 rejected:=false;begin perform public.meadow_market_read_farm_command(u,request,body);exception when sqlstate '42501' then rejected:=true;end;
 if not rejected then raise exception 'Deletion-pending farm accepted a command read';end if;
 rejected:=false;begin perform public.meadow_market_commit_farm_command(u,request,body,saved,'{"events":[]}');exception when sqlstate '42501' then rejected:=true;end;
 if not rejected or (select s.revision from public.meadow_market_saves s where s.user_id=u)<>revision then raise exception 'Deletion-pending farm committed an action';end if;
 delete from meadow_private.account_deletions where user_id=u;
 reply:=public.meadow_market_read_farm_command(u,request,body);if reply->>'ok'<>'true' then raise exception 'Cancelled deletion did not restore command access';end if;
end $$;
rollback;
