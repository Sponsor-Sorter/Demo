-- Friendship tutorial reward uses an authenticated, recorded farm visit,
-- never a client-completed flag. Read only when that lesson is requested.
do $migration$
declare body text; marker text;
begin
 body:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);
 marker:='''owned_collections'',coalesce';
 if position(marker in body)=0 then raise exception 'Review command reader before adding visit lesson proof';end if;
 body:=replace(body,marker,$proof$
 'visited_friend',case when exists(select 1 from jsonb_array_elements(p_body->'commands') c where c->>'type'='lesson.claim' and c->>'target'='friends') then
  exists(select 1 from public.meadow_market_visit_events where visitor_id=p_user and action='visit') else false end,
$proof$||marker);
 execute body;
end $migration$;
