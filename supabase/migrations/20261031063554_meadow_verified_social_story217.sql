-- Reuse the authenticated social service's recorded first-visit proof for
-- the Homestead story. No client-supplied count, gold or lesson flag is trusted.
do $migration$
declare body text; marker text;
begin
 body:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);
 marker:='c->>''type''=''lesson.claim'' and c->>''target''=''friends''';
 if position(marker in body)=0 then raise exception 'Review visit proof reader before updating social story';end if;
 body:=replace(body,marker,'(c->>''type''=''lesson.claim'' and c->>''target''=''friends'') or c->>''type''=''social.visit''');
 execute body;
end $migration$;
