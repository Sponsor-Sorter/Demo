begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','537146e0-f612-47ac-bb99-351b93892d24',true);
do $$declare a jsonb;b jsonb;g int;begin
 a:=public.meadow_market_play_service('purchase',jsonb_build_object('id',gen_random_uuid(),'sku','gem_chest'));g:=(a->'wallet'->>'gems')::int;
 a:=public.meadow_market_play_service('redeem','{"id":"12600000-0000-4000-8000-000000000001","sku":"supplies","items":{"butter":1,"mushroomsoup":1,"berrytart":1,"applepie":1,"blanket":1,"giftbasket":1}}');
 assert (a->'wallet'->>'gems')::int=g-12 and a#>>'{receipt,delivery,items,butter}'='1','Six new items use validated prices';
 b:=public.meadow_market_play_service('redeem','{"id":"12600000-0000-4000-8000-000000000001","sku":"supplies","items":{"butter":1,"mushroomsoup":1,"berrytart":1,"applepie":1,"blanket":1,"giftbasket":1}}');assert b->>'duplicate'='true' and b->'wallet'->>'gems'=a->'wallet'->>'gems','Retry cannot charge twice';
 begin
 perform public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','supplies','items',jsonb_build_object('unknown-artisan-item',1)));
 raise exception 'Invalid supply accepted';exception when raise_exception then assert sqlerrm='Unknown supply';end;
end$$;
rollback;
