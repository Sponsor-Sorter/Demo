-- Backend-only observation seam. No rewards, profiles, ACLs or sanctions change.
-- Preserve the current function body, owner, SECURITY DEFINER and grants. Refuse
-- drift rather than silently changing a different generic 22023 rejection.
begin;
do $migration$
declare definition text;
 old_branch constant text:='raise exception ''Command receipt reused for different actions'' using errcode=''22023'';';
 new_branch constant text:='raise exception ''Command receipt reused for different actions'' using errcode=''22023'', detail=''MEADOW_COMMAND_RECEIPT_CONFLICT_V1'';';
begin
 definition:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);
 if position(new_branch in definition)>0 and position(old_branch in definition)=0 then return;end if;
 if (length(definition)-length(replace(definition,old_branch,'')))/length(old_branch)<>1
 then raise exception 'Meadow command receipt denial seam changed; review before applying';end if;
 execute replace(definition,old_branch,new_branch);
end $migration$;
commit;
