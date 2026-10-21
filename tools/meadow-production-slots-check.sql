begin;
-- Existing disposable game test account; every fixture, gem and receipt rolls back.
update public.meadow_market_saves set save_data=jsonb_set(save_data,'{farms,willow,objects}',
 coalesce(save_data#>'{farms,willow,objects}','[]')||'[{"id":"queue-slot-check-120","type":"kitchen"}]'::jsonb)
where user_id='537146e0-f612-47ac-bb99-351b93892d24';
set local role authenticated;
select set_config('request.jwt.claim.sub','537146e0-f612-47ac-bb99-351b93892d24',true);
do $$declare a jsonb;b jsonb;g int;i int;begin
 a:=public.meadow_market_play_service('purchase',jsonb_build_object('id',gen_random_uuid(),'sku','gem_chest'));
 a:=public.meadow_market_play_service('purchase',jsonb_build_object('id',gen_random_uuid(),'sku','gem_chest'));g:=(a->'wallet'->>'gems')::int;
 a:=public.meadow_market_play_service('redeem','{"id":"12000000-0000-4000-8000-000000000001","sku":"queue_slot","expectedLevel":0,"map":"willow","target":"queue-slot-check-120"}');
 assert (a->'wallet'->>'gems')::int=g-20,'First slot charges 20 gems';
 assert a#>>'{receipt,delivery,queue_slot,level}'='1','Receipt delivers level one';
 b:=public.meadow_market_play_service('redeem','{"id":"12000000-0000-4000-8000-000000000001","sku":"queue_slot","expectedLevel":0,"map":"willow","target":"queue-slot-check-120"}');
 assert b->>'duplicate'='true' and b->'wallet'->>'gems'=a->'wallet'->>'gems','Retry never charges twice';
 a:=public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','queue_slot','map','willow','target','queue-slot-check-120','expectedLevel',1,'level',1,'cost',0));
 assert (a->'wallet'->>'gems')::int=g-60 and a#>>'{receipt,delivery,queue_slot,level}'='2','Server selects next level and price';
 for i in 3..8 loop
 a:=public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','queue_slot','map','willow','target','queue-slot-check-120','expectedLevel',i-1));
 end loop;
 assert (a->'wallet'->>'gems')::int=g-720,'Eight slots have bounded server prices';
 begin
 perform public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','queue_slot','map','willow','target','queue-slot-check-120','expectedLevel',8));
 raise exception 'Ninth upgrade allowed';
 exception when raise_exception then assert sqlerrm='All eight extra queue slots are unlocked','Max level enforced';end;
 begin
  perform public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','queue_slot','map','willow','target','someone-elses-building'));
  raise exception 'Unowned upgrade allowed';
 exception when raise_exception then assert sqlerrm='Save this production building online before upgrading','Unowned target rejected';end;
end$$;
rollback;
