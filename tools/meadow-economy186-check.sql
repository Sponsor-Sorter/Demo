-- Transactional assertions only: no farms, awards or test credentials persist.
begin;
do $$
declare u uuid; historical uuid:=gen_random_uuid(); reward uuid:=gen_random_uuid(); perks uuid:=gen_random_uuid();
 request uuid:=gen_random_uuid(); start_revision bigint; s jsonb; answer jsonb; again jsonb; actual jsonb; n int;
begin
 select user_id into u from public.meadow_market_profiles where friend_code='MEADOW-CX1Y5';
 if u is null then raise exception 'Audit profile missing';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 -- Isolate this rolled-back fixture from its previous audit runs.
 delete from meadow_private.farm_save_receipts where user_id=u;
 delete from meadow_private.farm_reward_deliveries where user_id=u;
 delete from meadow_private.farm_economy_journal where user_id=u;
 s:=jsonb_build_object('version',1,'coins',100,'xp',85,'level',1,'active','east','sharedPantryVersion',1,
  'club',jsonb_build_object('applied',jsonb_build_array(historical)),
  'farms','{"willow":{"inventory":{"egg":1,"carrot":2},"objects":[{"id":"well","type":"well"}]},"east":{"inventory":{"egg":1,"carrot":2},"objects":[{"id":"well","type":"well"},{"id":"oven","type":"kitchen","jobs":[{"startAt":100000,"finishAt":200000}]}]}}'::jsonb);
 update public.meadow_market_saves set save_data=s,save_protocol=2 where user_id=u returning revision into start_revision;
 if start_revision is null then raise exception 'Audit save missing';end if;
 -- Existing receipts already acknowledged by this server fixture are imported.
 insert into meadow_private.farm_reward_deliveries(receipt_id,user_id,revision,imported)
  select id,u,start_revision,true from public.meadow_market_economy_receipts where user_id=u;
 insert into public.meadow_market_economy_receipts(id,user_id,request_id,kind,delivery) values
  (historical,u,gen_random_uuid(),'purchase','{"gold":100,"items":{"carrot":2}}'),
  (reward,u,gen_random_uuid(),'game_reward','{"gold":25,"xp":8,"map":"east","game":"eggs","items":{"egg":3}}'),
  (perks,u,gen_random_uuid(),'redeem','{"well_watering":{"map":"east","target":"well"},"well_upgrade":{"map":"east","target":"well","level":3},"queue_slot":{"map":"east","target":"oven","level":4},"speed":{"map":"east","target":"oven","minutes":1}}');
 -- A forged local applied list must not suppress an undelivered server reward.
 s:=jsonb_set(s,'{club,applied}',jsonb_build_array(historical,reward,perks));
 answer:=public.meadow_market_commit_economy_save(start_revision,s,request);
 if answer->>'ok'<>'true' or answer->'economy'->>'to'<>'1' then raise exception 'Save not accepted: %',answer;end if;
 select save_data into actual from public.meadow_market_saves where user_id=u;
 if actual->>'coins'<>'160' or actual->>'level'<>'2' or actual->>'xp'<>'3' then raise exception 'Gold/XP/level mismatch: %',actual;end if;
 if actual->'farms'->'willow'->'inventory'->>'egg'<>'4' or actual->'farms'->'east'->'inventory'->>'egg'<>'4' or actual->'inventory'->>'carrot'<>'2' then raise exception 'Shared basket doubled or import re-awarded';end if;
 if actual->'farms'->'willow'->'objects'->0 ? 'autoWater' or actual->'farms'->'east'->'objects'->0->>'autoWater'<>'true' then raise exception 'Upgrade went to wrong map';end if;
 if actual->'farms'->'east'->'objects'->1->>'queueSlots'<>'4' or actual->'farms'->'east'->'objects'->1->'jobs'->0->>'finishAt'<>'140000' then raise exception 'Queue/speed mismatch';end if;
 if not exists(select 1 from jsonb_array_elements(answer->'economy'->'receipts') e where e->'delivery'->'speed'->'basis'->'east'->'jobs'->0->>'finishAt'='200000') then raise exception 'Speed basis missing';end if;
 select count(*) into n from meadow_private.farm_reward_deliveries where user_id=u and receipt_id=historical and imported;
 if n<>1 then raise exception 'Historical import failed';end if;
 again:=public.meadow_market_commit_economy_save(start_revision,s,request);
 if again->>'replayed'<>'true' or again->'economy'<>answer->'economy' then raise exception 'Lost-reply replay mismatch';end if;
 begin
  perform public.meadow_market_commit_economy_save(start_revision,s||'{"coins":999}',request);
  raise exception 'Changed request was accepted';
 exception when sqlstate '22023' then null;end;
 again:=public.meadow_market_commit_economy_save((answer->>'revision')::bigint,jsonb_set(actual,'{coins}','157'),gen_random_uuid());
 if again->>'ok'<>'true' or jsonb_array_length(again->'economy'->'receipts')<>0 then raise exception 'Receipt repeated';end if;
 answer:=public.meadow_market_commit_economy_save(start_revision,s,request);
 if answer->>'conflict'<>'true' then raise exception 'Old retry overwrote a later save';end if;
 select count(*) into n from meadow_private.farm_economy_journal where user_id=u and lane='server_receipt' and source_id=reward::text;
 if n<>1 then raise exception 'Reward journal duplicated';end if;
 if not exists(select 1 from meadow_private.farm_economy_journal where user_id=u and lane='legacy_snapshot' and changes->>'gold'='-3') then raise exception 'Farm spend not journalled';end if;
 if (public.meadow_market_farm_ledger()->>'pending')::int<>0 then raise exception 'Undelivered receipts remain';end if;
 answer:=public.meadow_market_rebase_farm_rewards(0);
 if answer->>'cursor'<>'1' or jsonb_array_length(answer->'patches')<>1 then raise exception 'Conflict reward rebase missing';end if;
 if jsonb_array_length(public.meadow_market_rebase_farm_rewards(1)->'patches')<>0 then raise exception 'Rebase repeated a delivered cursor';end if;
 begin perform public.meadow_market_rebase_farm_rewards(2);raise exception 'Future cursor accepted';exception when raise_exception then if sqlerrm='Future cursor accepted' then raise;end if;end;
 select save_data into actual from public.meadow_market_saves where user_id=u;
 select jsonb_object_agg(key,total) into answer from (
  select key,sum((value::text)::numeric) total from meadow_private.farm_economy_journal j,lateral jsonb_each(j.changes)
   where j.user_id=u group by key
 ) totals;
 if meadow_private.farm_balance_delta(answer,meadow_private.farm_balances(actual))<>'{}' then raise exception 'Journal does not reconstruct balances';end if;
 answer:=public.meadow_market_commit_economy_save((again->>'revision')::bigint,jsonb_set(actual,'{_farmEconomy,cursor}','0'),gen_random_uuid());
 if answer->>'conflict'<>'true' then raise exception 'Stale reward cursor was accepted';end if;
end $$;
set local role authenticated;
do $$
declare s public.meadow_market_saves;
begin
 select * into s from public.meadow_market_saves where user_id=auth.uid();
 begin
  perform public.meadow_market_commit_save(s.revision,s.save_data,gen_random_uuid());
  raise exception 'Old client downgraded enrolled save';
 exception when sqlstate '40001' then null;end;
 begin
  perform count(*) from meadow_private.farm_economy_journal;
  raise exception 'Player accessed private journal';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Farm ledger assertions passed; all fixture changes rolled back' as result;
rollback;
