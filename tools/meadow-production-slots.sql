-- Add one bounded, replayable exchange to the existing game-only wallet service.
-- Preserve the deployed function, its auth checks, wallet row lock and all other SKUs.
do $patch$
declare definition text; anchor text := 'elsif sku=''speed'' then'; addition text := $branch$
elsif sku='queue_slot' then
 g:=p_data->>'target';
 if g is null or length(g)>120 or coalesce(p_data->>'map','') not in ('willow','coast','pine','orchard','back','east') then raise exception 'Invalid production building'; end if;
 if not exists (
   select 1 from public.meadow_market_saves s,
   lateral jsonb_array_elements(coalesce(s.save_data->'farms'->(p_data->>'map')->'objects','[]'::jsonb)) o
   where s.user_id=u and o->>'id'=g and o->>'type' in ('kitchen','workshop')
 ) then raise exception 'Save this production building online before upgrading'; end if;
 select coalesce(max((e.delivery->'queue_slot'->>'level')::int),0) into completed
 from public.meadow_market_economy_receipts e
 where e.user_id=u and e.delivery->'queue_slot'->>'target'=g;
 if completed>=8 then raise exception 'All eight extra queue slots are unlocked'; end if;
 if coalesce((p_data->>'expectedLevel')::int,-1)<>completed then raise exception 'Queue upgrade changed on another device. Reload before buying'; end if;
 goal:=coalesce((p_data->>'amount')::int,1);
 if goal<1 or goal>8 or completed+goal>8 then raise exception 'Invalid queue bundle size'; end if;
 cost:=goal+1;completed:=completed+goal;ck:='queue_slot:'||g||':'||completed;
 delivery:=jsonb_build_object('queue_slot',jsonb_build_object('target',g,'map',p_data->>'map','level',completed));
 elsif sku='speed' then
$branch$;
begin
 select pg_get_functiondef('meadow_private.play_service(text,jsonb)'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'Production upgrade patch anchor missing'; end if;
 if position('elsif sku=''queue_slot'' then' in definition)>0 then
  definition:=substring(definition from 1 for position('elsif sku=''queue_slot'' then' in definition)-1)||addition||substring(definition from position(anchor in definition)+length(anchor));
 else
  definition:=replace(definition,anchor,addition);
 end if;
 execute definition;
end
$patch$;
