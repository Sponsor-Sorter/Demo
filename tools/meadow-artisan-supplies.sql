-- Extend only Meadow Markets supply IDs; retain authentication, wallet locks and prices.
do $patch$
declare definition text;old_list text := $old$'goatcheese','scarf')$old$;new_list text := $new$'goatcheese','scarf','butter','mushroomsoup','berrytart','applepie','blanket','giftbasket')$new$;
begin
 select pg_get_functiondef('meadow_private.play_service(text,jsonb)'::regprocedure) into definition;
 if position(old_list in definition)>0 then execute replace(definition,old_list,new_list);
 elsif position(new_list in definition)=0 then raise exception 'Artisan supply patch anchor missing';end if;
end
$patch$;
