-- Meadow Markets only: friend visits and bounded, non-destructive farm help.
create schema if not exists meadow_private;
revoke all on schema meadow_private from public, anon;
grant usage on schema meadow_private to authenticated;
create table public.meadow_market_visit_events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 visitor_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 map_id text not null check(length(map_id) between 1 and 32),
 action text not null check(action in ('visit','water','feed','cheer')),
 target_id text not null default '' check(length(target_id)<=100),
 target_name text not null default '' check(length(target_name)<=80),
 created_at timestamptz not null default now(),
 applied_at timestamptz,
 target_cycle numeric,
 outcome text not null default 'pending' check(outcome in ('visited','pending','applied','not_needed')),
 check(owner_id<>visitor_id)
);
comment on table public.meadow_market_visit_events is 'Meadow Markets visitor history and friend-help events; separate from BargainBarge and Sponsor Sorter.';
create index meadow_visit_owner_recent on public.meadow_market_visit_events(owner_id,created_at desc);
create index meadow_visit_visitor_recent on public.meadow_market_visit_events(visitor_id,owner_id,created_at desc);
alter table public.meadow_market_visit_events enable row level security;
revoke all on public.meadow_market_visit_events from anon,authenticated;
grant select on public.meadow_market_visit_events to authenticated;
grant update(applied_at,outcome) on public.meadow_market_visit_events to authenticated;
create policy "Meadow visits visible to host and visitor" on public.meadow_market_visit_events for select to authenticated using ((select auth.uid())=owner_id or (select auth.uid())=visitor_id);
create policy "Meadow host acknowledges delivered help" on public.meadow_market_visit_events for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id and applied_at is not null and applied_at<=now());
create or replace function meadow_private.record_visit(p_owner uuid,p_map text,p_action text,p_target text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ev public.meadow_market_visit_events; farm jsonb; thing jsonb; used integer; label text;
begin
 if actor is null or actor=p_owner then raise exception 'Visit an accepted friend to help.'; end if;
 if p_action not in ('visit','water','feed','cheer') or p_request is null then raise exception 'Choose a valid farm activity.'; end if;
 if not exists(select 1 from public.meadow_market_friendships f where f.status='accepted' and ((f.requester_id=actor and f.recipient_id=p_owner) or (f.requester_id=p_owner and f.recipient_id=actor))) then raise exception 'Only accepted farm friends can visit and help.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_owner::text,0));
 select * into ev from public.meadow_market_visit_events where id=p_request;
 if found then
   if ev.visitor_id<>actor or ev.owner_id<>p_owner then raise exception 'This activity reference is unavailable.'; end if;
   return to_jsonb(ev)||jsonb_build_object('duplicate',true);
 end if;
 select s.save_data->'farms'->p_map into farm from public.meadow_market_saves s where s.user_id=p_owner;
 if farm is null then raise exception 'That farm area is not available.'; end if;
 if p_action='visit' then
   select * into ev from public.meadow_market_visit_events where owner_id=p_owner and visitor_id=actor and map_id=p_map and action='visit' and created_at>now()-interval '10 minutes' order by created_at desc limit 1;
   if found then return to_jsonb(ev)||jsonb_build_object('duplicate',true); end if;
 else
   select * into ev from public.meadow_market_visit_events where owner_id=p_owner and visitor_id=actor and map_id=p_map and target_id=p_target and action=p_action and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' order by created_at desc limit 1;
   if found then return to_jsonb(ev)||jsonb_build_object('duplicate',true); end if;
   select count(*) into used from public.meadow_market_visit_events where owner_id=p_owner and visitor_id=actor and action<>'visit' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
   if used>=3 then raise exception 'You have given this friend three helping hands today. Come back tomorrow!'; end if;
   select x into thing from jsonb_array_elements(coalesce(farm->'objects','[]'::jsonb)) x where x->>'id'=p_target;
   if thing is null then raise exception 'That farm item has moved or is unavailable.'; end if;
   if p_action='water' then
     if thing->>'type'<>'plot' or coalesce((thing->>'plantedAt')::numeric,0)<=0 or coalesce((thing->>'wateredUntil')::numeric,0)>0 then raise exception 'Choose a growing crop that needs water.'; end if;
     label:=coalesce(thing->>'crop','crop')||' field';
   else
     if thing->>'type' not in ('chicken','cow','sheep','goat','alpaca') then raise exception 'Choose an animal to help.'; end if;
     label:=coalesce(thing->>'name',thing->>'type');
   end if;
 end if;
 insert into public.meadow_market_visit_events(id,owner_id,visitor_id,map_id,action,target_id,target_name,target_cycle,outcome)
 values(p_request,p_owner,actor,p_map,p_action,case when p_action='visit' then '' else p_target end,left(coalesce(label,''),80),case when p_action='water' then (thing->>'plantedAt')::numeric else null end,case when p_action='visit' then 'visited' else 'pending' end) returning * into ev;
 return to_jsonb(ev)||jsonb_build_object('remaining',3-coalesce(used,0)-case when p_action='visit' then 0 else 1 end);
end $$;
revoke all on function meadow_private.record_visit(uuid,text,text,text,uuid) from public,anon;
grant execute on function meadow_private.record_visit(uuid,text,text,text,uuid) to authenticated;
create or replace function public.meadow_market_record_visit(p_owner uuid,p_map text,p_action text,p_target text,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$ select meadow_private.record_visit(p_owner,p_map,p_action,p_target,p_request); $$;
revoke all on function public.meadow_market_record_visit(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.meadow_market_record_visit(uuid,text,text,text,uuid) to authenticated;
do $$ begin alter publication supabase_realtime add table public.meadow_market_visit_events; exception when duplicate_object then null; end $$;
