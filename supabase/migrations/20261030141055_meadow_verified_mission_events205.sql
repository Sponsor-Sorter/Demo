-- Mission progress for the staged cohort comes only from accepted farm
-- commands. Legacy players keep their existing flow until the complete client
-- migration is ready. This migration does not enroll anyone.
do $migration$
declare body text; marker text;
begin
 body:=pg_get_functiondef('meadow_private.play_service(text,jsonb)'::regprocedure);
 marker:=' r:=meadow_private.play_service_before_store(p_action,p_data);';
 if position(marker in body)=0 then raise exception 'Review updated play service before adding verified mission events';end if;
 body:=replace(body,marker,$guard$
 if p_action='event' and exists(select 1 from meadow_private.farm_command_accounts where user_id=u) then
  raise exception 'Farm missions are recorded by verified farm actions' using errcode='42501';
 end if;
$guard$||marker);
 execute body;

 body:=pg_get_functiondef('meadow_private.commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure);
 marker:=' update meadow_private.farm_economy_journal set lane=''verified_action'',source_id=p_request_id::text';
 if position(marker in body)=0 then raise exception 'Review updated farm committer before adding mission events';end if;
 -- Reducer summaries are service-only. Insert in the same transaction as the
 -- canonical save and command receipt; a replay never repeats these events.
 body:=replace(body,marker,$events$
 if jsonb_typeof(p_summary->'events') is distinct from 'array'
  or jsonb_array_length(p_summary->'events')>5000 then
  raise exception 'Invalid verified mission events' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(p_summary->'events') e
  where jsonb_typeof(e) is distinct from 'object'
   or jsonb_typeof(e->'event') is distinct from 'string'
   or jsonb_typeof(e->'amount') is distinct from 'number'
   or coalesce(e->>'amount','')!~'^[0-9]+$'
   or (e->>'amount')::numeric not between 1 and 1000000000) then
  raise exception 'Invalid verified mission amount' using errcode='22023';
 end if;
 insert into public.meadow_market_mission_events(id,user_id,event,amount)
 select gen_random_uuid(),p_user,e->>'event',sum((e->>'amount')::int)::int
 from jsonb_array_elements(p_summary->'events') e
 where e->>'event' in ('harvest','care','sell','upgrade','place','craft','water','plant')
 group by e->>'event';
$events$||marker);
 execute body;
end $migration$;
