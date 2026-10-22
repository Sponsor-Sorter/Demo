-- Extend the current live implementation, preserving later features, ACLs and search_path.
do $migration$
declare
 definition text := pg_get_functiondef('meadow_private.play_service(text,jsonb)'::regprocedure);
 needle text := $guard$'colourbynumber','matchpainting') or lv$guard$;
 replacement text := $guard$'colourbynumber','matchpainting','word_search') or lv$guard$;
begin
 if position('Invalid word search result' in definition)>0 then return; end if;
 if position(needle in definition)=0 or position('pts:=completed*100+' in definition)=0 then
  raise exception 'Meadow score function changed; inspect before applying this migration';
 end if;
 definition := replace(definition,needle,replacement);
 definition := replace(definition,'pts:=completed*100+',E'if g=''word_search'' and (goal<>20 or lv<>1) then raise exception ''Invalid word search result''; end if;\n  pts:=completed*100+');
 execute definition;
end;
$migration$;
