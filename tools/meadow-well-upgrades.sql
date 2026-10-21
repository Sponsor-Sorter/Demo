-- Meadow Markets only: four bounded crystal-well upgrades in the existing wallet service.
do $patch$
declare definition text; anchor text := 'elsif sku=''speed'' then'; addition text := $branch$
elsif sku='well_upgrade' then
 g:=p_data->>'target';
 if g is null or length(g)>120 or coalesce(p_data->>'map','') not in ('willow','coast','pine','orchard','back','east') then raise exception 'Invalid family well'; end if;
 select o into delivery from public.meadow_market_saves s,
 lateral jsonb_array_elements(coalesce(s.save_data->'farms'->(p_data->>'map')->'objects','[]'::jsonb)) o
 where s.user_id=u and o->>'id'=g and o->>'type'='well' limit 1;
 if delivery is null then raise exception 'Save this family well online before upgrading'; end if;
 if coalesce((delivery->>'tier')::int,0)<7 then raise exception 'Complete the seven gold well upgrades first'; end if;
 select coalesce(max((e.delivery->'well_upgrade'->>'level')::int),0)+1 into completed
 from public.meadow_market_economy_receipts e where e.user_id=u and e.delivery->'well_upgrade'->>'target'=g;
 if completed>4 then raise exception 'All four crystal well upgrades are unlocked'; end if;
 if coalesce((p_data->>'expectedLevel')::int,-1)<>completed-1 then raise exception 'Well upgrade changed on another device. Reload before buying'; end if;
 select coalesce((save_data->>'level')::int,1) into lv from public.meadow_market_saves where user_id=u;
 if lv<(array[25,28,32,36])[completed] then raise exception 'Reach level % for this crystal well upgrade',(array[25,28,32,36])[completed]; end if;
 cost:=(array[25,50,90,150])[completed];ck:='well_upgrade:'||g||':'||completed;
 delivery:=jsonb_build_object('well_upgrade',jsonb_build_object('target',g,'map',p_data->>'map','level',completed));
 elsif sku='speed' then
$branch$;
begin
 select pg_get_functiondef('meadow_private.play_service(text,jsonb)'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'Well upgrade patch anchor missing'; end if;
 if position('elsif sku=''well_upgrade'' then' in definition)>0 then
 definition:=substring(definition from 1 for position('elsif sku=''well_upgrade'' then' in definition)-1)||addition||substring(definition from position(anchor in definition)+length(anchor));
 else definition:=replace(definition,anchor,addition);end if;
 execute definition;
end
$patch$;
