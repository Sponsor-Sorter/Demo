begin;
update public.meadow_market_saves set save_data=jsonb_set(jsonb_set(save_data,'{level}','40'),'{farms,willow,objects}',coalesce(save_data#>'{farms,willow,objects}','[]')||'[{"id":"well-upgrade-check124","type":"well","tier":7},{"id":"well-early-check124","type":"well","tier":3}]'::jsonb) where user_id='537146e0-f612-47ac-bb99-351b93892d24';
set local role authenticated;
select set_config('request.jwt.claim.sub','537146e0-f612-47ac-bb99-351b93892d24',true);
do $$declare a jsonb;b jsonb;g int;i int;begin
 a:=public.meadow_market_play_service('purchase',jsonb_build_object('id',gen_random_uuid(),'sku','gem_chest'));g:=(a->'wallet'->>'gems')::int;
 a:=public.meadow_market_play_service('redeem','{"id":"12400000-0000-4000-8000-000000000001","sku":"well_upgrade","expectedLevel":0,"map":"willow","target":"well-upgrade-check124"}');
 assert (a->'wallet'->>'gems')::int=g-25 and a#>>'{receipt,delivery,well_upgrade,level}'='1','First tier delivers one and costs 25';
 b:=public.meadow_market_play_service('redeem','{"id":"12400000-0000-4000-8000-000000000001","sku":"well_upgrade","expectedLevel":0,"map":"willow","target":"well-upgrade-check124"}');
 assert b->>'duplicate'='true' and b->'wallet'->>'gems'=a->'wallet'->>'gems','Retry cannot charge twice';
 begin
 perform public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','well_upgrade','expectedLevel',0,'map','willow','target','well-upgrade-check124'));
 raise exception 'Stale upgrade allowed';exception when raise_exception then assert sqlerrm='Well upgrade changed on another device. Reload before buying';end;
 for i in 2..4 loop a:=public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','well_upgrade','expectedLevel',i-1,'map','willow','target','well-upgrade-check124','cost',0));end loop;
 assert (a->'wallet'->>'gems')::int=g-315 and a#>>'{receipt,delivery,well_upgrade,level}'='4','Server controls all four prices';
 begin
 perform public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','well_upgrade','expectedLevel',4,'map','willow','target','well-upgrade-check124'));
 raise exception 'Fifth tier allowed';exception when raise_exception then assert sqlerrm='All four crystal well upgrades are unlocked';end;
 begin
 perform public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','well_upgrade','expectedLevel',0,'map','willow','target','someone-elses-well'));
 raise exception 'Unowned upgrade allowed';exception when raise_exception then assert sqlerrm='Save this family well online before upgrading';end;
 begin
 perform public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','well_upgrade','expectedLevel',0,'map','willow','target','well-early-check124'));
 raise exception 'Early gem upgrade allowed';exception when raise_exception then assert sqlerrm='Complete the seven gold well upgrades first';end;
end$$;
reset role;
update public.meadow_market_saves set save_data=jsonb_set(jsonb_set(save_data,'{level}','24'),'{farms,willow,objects}',(save_data#>'{farms,willow,objects}')||'[{"id":"well-low-level-check124","type":"well","tier":7}]'::jsonb) where user_id='537146e0-f612-47ac-bb99-351b93892d24';
set local role authenticated;
do $$begin
 begin
 perform public.meadow_market_play_service('redeem',jsonb_build_object('id',gen_random_uuid(),'sku','well_upgrade','expectedLevel',0,'map','willow','target','well-low-level-check124'));
 raise exception 'Level gate bypassed';exception when raise_exception then assert sqlerrm='Reach level 25 for this crystal well upgrade';end;
end$$;
rollback;
