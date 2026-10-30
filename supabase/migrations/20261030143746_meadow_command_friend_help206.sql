-- A visitor's help and its log acknowledgment must accompany the same
-- accepted farm revision. No existing player is enrolled by this migration.
create function meadow_private.guard_command_help_ack() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.outcome='pending' and new.outcome<>old.outcome
  and exists(select 1 from meadow_private.farm_command_accounts where user_id=old.owner_id)
  and (coalesce(auth.jwt()->>'role','')<>'service_role'
   or current_setting('meadow.command_owner',true) is distinct from old.owner_id::text) then
  raise exception 'Visitor help is acknowledged with verified farm actions' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function meadow_private.guard_command_help_ack() from public,anon,authenticated,service_role;
create trigger meadow_command_help_ack before update of outcome on public.meadow_market_visit_events
 for each row execute function meadow_private.guard_command_help_ack();

do $migration$
declare body text; marker text;
begin
 body:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);
 marker:='''owned_collections'',coalesce';
 if position(marker in body)=0 then raise exception 'Review updated command reader before adding friend help';end if;
 body:=replace(body,marker,$read$
 'pending_help',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at,h.id) from
  (select id,map_id,action,target_id,target_cycle,created_at from public.meadow_market_visit_events
   where owner_id=p_user and outcome='pending' and action<>'visit'
   order by created_at,id limit 100) h),'[]'::jsonb),
$read$||marker);
 execute body;

 body:=pg_get_functiondef('meadow_private.commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure);
 marker:=' answer:=meadow_private.commit_economy_save((p_body->>''expected_revision'')::bigint,p_save_data,p_request_id);';
 if position(marker in body)=0 then raise exception 'Review updated command committer before adding help acknowledgments';end if;
 body:=replace(body,marker,marker||$ack$
 if answer->>'ok'='true' then
  if jsonb_typeof(coalesce(p_summary->'help','[]'::jsonb)) is distinct from 'array'
   or jsonb_array_length(coalesce(p_summary->'help','[]'::jsonb))>100
   or exists(select 1 from jsonb_array_elements(coalesce(p_summary->'help','[]'::jsonb)) e
    where jsonb_typeof(e) is distinct from 'object' or coalesce(e->>'outcome','') not in ('applied','not_needed')
     or coalesce(e->>'id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then
   raise exception 'Invalid visitor help acknowledgment' using errcode='22023';
  end if;
  update public.meadow_market_visit_events v set outcome=e->>'outcome',applied_at=clock_timestamp()
   from jsonb_array_elements(coalesce(p_summary->'help','[]'::jsonb)) e
   where v.id=(e->>'id')::uuid and v.owner_id=p_user and v.outcome='pending' and v.action<>'visit';
 end if;
$ack$);
 execute body;
end $migration$;
