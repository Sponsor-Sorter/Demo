begin;
create temporary table safety_fixture as select gen_random_uuid() as a,gen_random_uuid() as b,gen_random_uuid() as c,gen_random_uuid() as report;
grant select on safety_fixture to authenticated;
insert into auth.users(id) select a from safety_fixture union all select b from safety_fixture union all select c from safety_fixture;
insert into public.meadow_market_profiles(user_id,friend_code,display_name) select id,'safety-'||id::text,'Safety fixture' from auth.users where id in(select a from safety_fixture union select b from safety_fixture union select c from safety_fixture);
insert into public.meadow_market_saves(user_id,save_data) select a,'{}'::jsonb from safety_fixture union all select b,'{}'::jsonb from safety_fixture;
select set_config('request.jwt.claim.sub',a::text,true) from safety_fixture;
set local role authenticated;
do $$ begin
 begin
  update public.meadow_market_profiles set display_name='New name' where user_id=(select a from safety_fixture);
  raise exception 'FAIL name without rules';
 exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
select public.meadow_market_social_safety('accept_rules');
insert into public.meadow_market_friendships(requester_id,recipient_id,status) select a,b,'pending' from safety_fixture;
select set_config('request.jwt.claim.sub',b::text,true) from safety_fixture;
select public.meadow_market_social_safety('accept_rules');
update public.meadow_market_friendships set status='accepted' where recipient_id=(select b from safety_fixture);
do $$ begin
 if (select count(*) from public.meadow_market_saves where user_id=(select a from safety_fixture))<>1 then raise exception 'FAIL friend read'; end if;
end $$;
select set_config('request.jwt.claim.sub',a::text,true) from safety_fixture;
select public.meadow_market_social_safety('report',b,'name','Fixture report',report) from safety_fixture;
select public.meadow_market_social_safety('report',b,'name','Fixture report',report) from safety_fixture;
select public.meadow_market_social_safety('block',b) from safety_fixture;
do $$ begin
 if exists(select 1 from public.meadow_market_profiles where user_id=(select b from safety_fixture)) then raise exception 'FAIL blocked profile'; end if;
 if exists(select 1 from public.meadow_market_saves where user_id=(select b from safety_fixture)) then raise exception 'FAIL blocked save'; end if;
 if not exists(select 1 from public.meadow_market_saves where user_id=(select a from safety_fixture)) then raise exception 'FAIL own farm access'; end if;
 begin
  insert into public.meadow_market_friendships(requester_id,recipient_id,status) select a,b,'pending' from safety_fixture;
  raise exception 'FAIL invitation allowed';
 exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin
  perform public.meadow_market_record_visit(b,'willow','visit','',gen_random_uuid()) from safety_fixture;
  raise exception 'FAIL blocked visit allowed';
 exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin
  perform public.meadow_market_social_safety('report',a,'name','',gen_random_uuid()) from safety_fixture;
  raise exception 'FAIL self report allowed';
 exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',b::text,true) from safety_fixture;
do $$ begin
 if exists(select 1 from public.meadow_market_profiles where user_id=(select a from safety_fixture)) then raise exception 'FAIL reverse profile'; end if;
 if exists(select 1 from public.meadow_market_saves where user_id=(select a from safety_fixture)) then raise exception 'FAIL reverse farm'; end if;
 if exists(select 1 from public.meadow_market_blocks) then raise exception 'FAIL private block list'; end if;
 begin
  perform public.meadow_market_social_safety('report',a,'name','Fixture report',report) from safety_fixture;
  raise exception 'FAIL another owner reused report';
 exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',a::text,true) from safety_fixture;
select public.meadow_market_social_safety('unblock',b) from safety_fixture;
do $$ begin
 if exists(select 1 from public.meadow_market_friendships) then raise exception 'FAIL unblock restores friendship'; end if;
 if exists(select 1 from public.meadow_market_saves where user_id=(select b from safety_fixture)) then raise exception 'FAIL unblock grants farm'; end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=(select b from safety_fixture)) then raise exception 'FAIL directory not restored'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from meadow_private.player_reports where id=(select report from safety_fixture))<>1 then raise exception 'FAIL report duplication'; end if;
 if has_function_privilege('anon','public.meadow_market_social_safety(text,uuid,text,text,uuid)','execute') then raise exception 'FAIL anonymous RPC'; end if;
 if has_table_privilege('authenticated','meadow_private.player_reports','select') then raise exception 'FAIL reports exposed'; end if;
end $$;
rollback;
select 'PASS: rules, accepted-friend reads, report replay/ownership, bilateral blocks, private lists, own saves, denied invitations/visits, unblock isolation, private reports; fixtures rolled back' as result;
