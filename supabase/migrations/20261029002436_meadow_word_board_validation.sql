do $$ declare f text; begin
 select pg_get_functiondef('meadow_private.reward_round(text,jsonb)'::regprocedure) into f;
 f:=replace(f,'coalesce(p_data->>''board'','''')!~''^[A-Z]{256}$''','length(coalesce(p_data->>''board'',''''))<>256 or coalesce(p_data->>''board'','''')!~''^[A-Z]+$''');
 execute f;
end $$;
