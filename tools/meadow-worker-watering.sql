-- Existing Meadow Markets wallet: one watering licence per owned well.
do $patch$
declare definition text; anchor text := 'elsif sku=''speed'' then'; addition text := $branch$
elsif sku='well_watering' then
 g:=p_data->>'target';
 if g is null or length(g)>120 then raise exception 'Invalid family well'; end if;
 select o into delivery from public.meadow_market_saves s,
 lateral jsonb_array_elements(coalesce(s.save_data->'farms'->(p_data->>'map')->'objects','[]'::jsonb)) o
 where s.user_id=u and o->>'id'=g and o->>'type'='well' limit 1;
 if delivery is null then raise exception 'Save this family well online first'; end if;
 if coalesce((delivery->>'autoWater')::boolean,false) then raise exception 'Automatic watering is already owned'; end if;
 cost:=20;ck:='well_watering:'||g;
 delivery:=jsonb_build_object('well_watering',jsonb_build_object('target',g,'map',p_data->>'map'));
 elsif sku='speed' then
$branch$;
begin
 select pg_get_functiondef('meadow_private.play_service(text,jsonb)'::regprocedure) into definition;
 if position('elsif sku=''well_watering'' then' in definition)>0 then return; end if;
 if position(anchor in definition)=0 then raise exception 'Watering patch anchor missing'; end if;
 execute replace(definition,anchor,addition);
end
$patch$;
