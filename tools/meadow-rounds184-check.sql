-- All changes are rolled back, including the deliberately moved test clocks.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.meadow_market_profiles where friend_code='MEADOW-CX1Y5'),true);
do $$
declare a jsonb; b jsonb; ticket uuid; events jsonb; initial_gems int; round_n int; claimed uuid; test_account record; token uuid:=gen_random_uuid();
begin
 assert auth.uid() is not null,'Audit guest exists';
 assert not has_table_privilege('authenticated','meadow_private.reward_rounds','INSERT'),'No direct round writes';
 assert not has_function_privilege('anon','public.meadow_market_reward_round(text,jsonb)','EXECUTE'),'No anonymous RPC without authentication';
 assert not has_function_privilege('authenticated','public.meadow_market_reserve_recovery(text,text,uuid)','EXECUTE'),'Players cannot reserve recovery keys directly';
 a:=public.meadow_market_play_service('status');initial_gems:=(a->'wallet'->>'gems')::int;
 a:=public.meadow_market_reward_round('start',jsonb_build_object('id',gen_random_uuid(),'game','eggs','level',1,'map','willow'));ticket:=(a->'round'->>'id')::uuid;
 begin
  perform public.meadow_market_reward_round('finish',jsonb_build_object('id',ticket,'won',true,'completed',12,'elapsed',0,'events','[]'::jsonb));
  raise exception 'Impossible instant win accepted';
 exception when raise_exception then assert sqlerrm='Round finished too quickly','Impossible instant win rejected'; end;
 update meadow_private.reward_rounds set started_at=clock_timestamp()-interval '30 seconds' where id=ticket;
 select jsonb_agg(jsonb_build_object('egg',n,'t',n*1.25+.2) order by n) into events from generate_series(1,12) n;
 a:=public.meadow_market_reward_round('finish',jsonb_build_object('id',ticket,'won',true,'completed',12,'elapsed',16,'events',events));
 assert a->>'verified'='true' and a->>'rewarded'='true','Legitimate issued round pays';
 b:=public.meadow_market_reward_round('finish',jsonb_build_object('id',ticket,'won',true,'completed',99999,'elapsed',0));
 assert b->>'duplicate'='true' and a->'receipt'->>'id'=b->'receipt'->>'id','Lost response retry returns same receipt';
 begin
  perform public.meadow_market_play_service('reward_turn',jsonb_build_object('id',gen_random_uuid(),'run',ticket));raise exception 'Free win paid twice';
 exception when raise_exception then assert sqlerrm in ('Finish and sync a winning game first','Get more reward tickets in the test shop'),'Free win cannot also use a ticket'; end;
 for round_n in 2..4 loop
  a:=public.meadow_market_reward_round('start',jsonb_build_object('id',gen_random_uuid(),'game','eggs','level',1));ticket:=(a->'round'->>'id')::uuid;
  update meadow_private.reward_rounds set started_at=clock_timestamp()-interval '30 seconds' where id=ticket;
  a:=public.meadow_market_reward_round('finish',jsonb_build_object('id',ticket,'won',true,'completed',12,'elapsed',16,'events',events));
  assert (a->>'rewarded')::boolean=(round_n<=3),'Only three rewarded wins per UTC day';
 end loop;
 a:=public.meadow_market_reward_round('start',jsonb_build_object('id',gen_random_uuid(),'game','milk','level',1));ticket:=(a->'round'->>'id')::uuid;
 update meadow_private.reward_rounds set started_at=clock_timestamp()-interval '20 seconds' where id=ticket;
 select jsonb_agg(jsonb_build_object('hit',true,'t',n*pi()/2.6) order by n) into events from generate_series(1,8)n;
 a:=public.meadow_market_reward_round('finish',jsonb_build_object('id',ticket,'won',true,'completed',8,'elapsed',10,'events',events));assert a->>'verified'='true','Golden-zone milk actions accepted';
 a:=public.meadow_market_reward_round('start',jsonb_build_object('id',gen_random_uuid(),'game','milk','level',1));ticket:=(a->'round'->>'id')::uuid;
 update meadow_private.reward_rounds set started_at=clock_timestamp()-interval '20 seconds' where id=ticket;
 begin
  perform public.meadow_market_reward_round('finish',jsonb_build_object('id',ticket,'won',false,'completed',1,'elapsed',1,'events','[{"hit":true,"t":0.5}]'::jsonb));raise exception 'Invalid timing hit accepted';
 exception when raise_exception then assert sqlerrm='Action missed the golden zone','False timing hit rejected'; end;
 begin
  perform public.meadow_market_play_service('ad_reward',jsonb_build_object('id',gen_random_uuid()));raise exception 'Unissued ad accepted';
 exception when raise_exception then assert sqlerrm='Start a rewarded preview in the updated game first','No instant ad shortcut'; end;
 a:=public.meadow_market_reward_round('start',jsonb_build_object('id',gen_random_uuid(),'game','ad'));ticket:=(a->'round'->>'id')::uuid;
 update meadow_private.reward_rounds set started_at=clock_timestamp()-interval '6 seconds' where id=ticket;
 a:=public.meadow_market_reward_round('finish',jsonb_build_object('id',ticket,'won',true,'completed',1,'elapsed',5));
 b:=public.meadow_market_reward_round('finish',jsonb_build_object('id',ticket,'won',true,'completed',1,'elapsed',5));
 assert (a->'wallet'->>'gems')::int=initial_gems+5 and a->'wallet'=b->'wallet','Ad credits exactly once';
 a:=public.meadow_market_play_service('boards','{"game":"eggs","scope":"global"}');assert exists(select 1 from jsonb_array_elements(a->'rows')v where (v->>'self')::boolean),'Verified result appears on board';
 select username,user_id into test_account from public.meadow_market_accounts where ready order by created_at limit 1;
 assert test_account.user_id is not null,'Registered recovery fixture exists';
 update public.meadow_market_accounts set recovery_hash=repeat('a',64),recovery_lease=null,recovery_lease_until=null where user_id=test_account.user_id;
 claimed:=public.meadow_market_reserve_recovery(test_account.username,repeat('a',64),token);assert claimed=test_account.user_id,'Valid recovery reserved';
 assert public.meadow_market_reserve_recovery(test_account.username,repeat('a',64),gen_random_uuid()) is null,'Concurrent reset denied';
 assert not public.meadow_market_set_recovery(test_account.user_id,repeat('b',64)),'Replacement cannot race a reset';
 assert not public.meadow_market_finish_recovery(test_account.user_id,gen_random_uuid(),true),'Wrong lease cannot consume key';
 assert public.meadow_market_finish_recovery(test_account.user_id,token,false),'Auth failure releases reservation';
 token:=gen_random_uuid();claimed:=public.meadow_market_reserve_recovery(test_account.username,repeat('a',64),token);assert claimed=test_account.user_id,'Released key can retry';
 assert public.meadow_market_finish_recovery(test_account.user_id,token,true),'Successful password change consumes key';
 assert public.meadow_market_reserve_recovery(test_account.username,repeat('a',64),gen_random_uuid()) is null,'Used key cannot be reused';
end $$;
rollback;
