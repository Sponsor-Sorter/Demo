-- Readable assertions, rolled back so no fake scores, purchases or rewards remain.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','537146e0-f612-47ac-bb99-351b93892d24',true);
do $$declare a jsonb; b jsonb; initial_gems int;begin
 a:=public.meadow_market_play_service('status');initial_gems:=(a->'wallet'->>'gems')::int;
 a:=public.meadow_market_play_service('purchase','{"id":"11000000-0000-4000-8000-000000000001","sku":"gem_chest"}');
 b:=public.meadow_market_play_service('purchase','{"id":"11000000-0000-4000-8000-000000000001","sku":"gem_chest"}');
 assert (a->'wallet'->>'gems')::int=initial_gems+550,'Pack credits gems';
 assert b->>'duplicate'='true' and a->'wallet'->>'gems'=b->'wallet'->>'gems','Same request never credits twice';
 a:=public.meadow_market_play_service('redeem','{"id":"11000000-0000-4000-8000-000000000002","sku":"supplies","items":{"milk":2,"wheat":3}}');
 assert (a->'wallet'->>'gems')::int=initial_gems+540,'Ingredients charge exact total';
 assert a->'receipt'->'delivery'->'items'='{"milk":2,"wheat":3}'::jsonb,'Ingredient receipt is replayable';
 a:=public.meadow_market_play_service('score','{"id":"11000000-0000-4000-8000-000000000003","game":"eggs","level":2,"completed":12,"goal":12,"remaining":15,"won":true}');
 a:=public.meadow_market_play_service('boards','{"game":"eggs","scope":"friends","period":"current"}');
 assert exists(select 1 from jsonb_array_elements(a->'rows') r where r->>'self'='true' and (r->>'points')::int>=3350),'Score and friends board';
 a:=public.meadow_market_play_service('purchase','{"id":"11000000-0000-4000-8000-000000000004","sku":"reward_tickets"}');
 a:=public.meadow_market_play_service('reward_turn','{"id":"11000000-0000-4000-8000-000000000005","game":"eggs","run":"11000000-0000-4000-8000-000000000003"}');
 assert a->'receipt'->'delivery'->'items'='{"egg":3}'::jsonb,'Extra reward includes game goods';
 begin
  perform public.meadow_market_play_service('reward_turn','{"id":"11000000-0000-4000-8000-000000000006","game":"eggs","run":"11000000-0000-4000-8000-000000000003"}');
  raise exception 'Duplicate turn claim was allowed';
 exception when raise_exception then assert sqlerrm='Reward already collected','A win allows only one ticket claim';end;
 a:=public.meadow_market_play_service('purchase','{"id":"11000000-0000-4000-8000-000000000007","sku":"premium"}');
 assert a->'wallet'->>'premium'='true','Premium persists in account wallet';
 begin
  perform public.meadow_market_play_service('claim_mission','{"id":"11000000-0000-4000-8000-000000000008","mission":"weekly_play"}');
  raise exception 'Incomplete mission allowed';
 exception when raise_exception then assert sqlerrm='Keep going to finish this mission','Incomplete rewards rejected';end;
 begin
  perform public.meadow_market_play_service('score','{"id":"11000000-0000-4000-8000-000000000009","game":"eggs","level":1,"completed":999999,"goal":12,"remaining":15,"won":true}');
  raise exception 'Invalid result allowed';
 exception when raise_exception then assert sqlerrm='Invalid game result','Malformed scores rejected';end;
end$$;
rollback;
