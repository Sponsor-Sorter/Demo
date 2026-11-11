-- A replayed request cannot mint different support evidence from its first receipt.
do $migration$
declare definition text; original text:=$old$if p_action='purchase' and p_data->>'sku'='premium' and r->'receipt'->>'id' is not null then$old$;
begin
 definition:=pg_get_functiondef('meadow_private.play_service(text,jsonb)'::regprocedure);
 if position(original in definition)=0 then raise exception 'Review changed test-purchase wrapper before applying';end if;
 execute replace(definition,original,$new$if p_action='purchase' and p_data->>'sku'='premium' and coalesce((r->>'duplicate')::boolean,false)=false and r->'receipt'->>'id' is not null then$new$);
end $migration$;
