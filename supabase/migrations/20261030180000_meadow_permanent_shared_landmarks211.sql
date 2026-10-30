-- Completed landmarks are permanent player progress. Removing a friend or
-- expiring old visitor events must not dismantle an already completed project.
alter table public.meadow_market_village_projects add column completed_at timestamptz;

create function meadow_private.refresh_shared_landmarks(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Only the service role and the owner-checked RPC/trigger definers can execute
 -- this private helper. A visitor's JWT must not prevent the owner's progress.
 update public.meadow_market_village_projects p set completed_at=clock_timestamp()
 where p.owner_id=p_user and p.completed_at is null and
  (select count(*) from (select 1 from public.meadow_market_visit_events v where v.owner_id=p.owner_id
   and v.created_at>=p.created_at and v.outcome='applied' and v.action in ('water','feed','cheer')
   limit case p.theme when 'garden' then 15 when 'river' then 25 else 40 end) q)
  >=case p.theme when 'garden' then 15 when 'river' then 25 else 40 end;
end $$;
revoke all on function meadow_private.refresh_shared_landmarks(uuid) from public,anon,authenticated;
grant execute on function meadow_private.refresh_shared_landmarks(uuid) to service_role;

create function meadow_private.landmark_help_applied() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.outcome is not distinct from new.outcome then return new;end if;
 perform meadow_private.refresh_shared_landmarks(new.owner_id);return new;
end $$;
revoke all on function meadow_private.landmark_help_applied() from public,anon,authenticated,service_role;
create trigger meadow_landmark_help_applied after insert or update of outcome on public.meadow_market_visit_events
 for each row when(new.outcome='applied' and new.action in ('water','feed','cheer'))
 execute function meadow_private.landmark_help_applied();

-- Backfill from actual acknowledged help, never from cached save flags.
update public.meadow_market_village_projects p set completed_at=clock_timestamp()
where p.completed_at is null and
 (select count(*) from (select 1 from public.meadow_market_visit_events v where v.owner_id=p.owner_id
  and v.created_at>=p.created_at and v.outcome='applied' and v.action in ('water','feed','cheer')
  limit case p.theme when 'garden' then 15 when 'river' then 25 else 40 end) q)
 >=case p.theme when 'garden' then 15 when 'river' then 25 else 40 end;

create or replace function meadow_market_private.journey_service(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();saved jsonb;chosen text;result jsonb;
begin
 if who is null then raise exception 'Sign in to Meadow Markets first.';end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=who) then raise exception 'Create your game farmer profile first.';end if;
 if exists(select 1 from meadow_private.account_deletions where user_id=who) then raise exception 'Account unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,73));
 perform meadow_private.refresh_shared_landmarks(who);
 if p_action='start' then
  chosen:=p_data->>'theme';if chosen is null or chosen not in ('garden','river','hall') then raise exception 'Choose a village landmark.';end if;
  select save_data into saved from public.meadow_market_saves where user_id=who;
  if coalesce((saved->>'level')::numeric,0)<12 or coalesce((saved#>>'{journey,projects,hall}')::numeric,0)<2 then raise exception 'Restore your community hall to stage two first.';end if;
  if exists(select 1 from public.meadow_market_village_projects where owner_id=who and theme=chosen) then null;
  elsif exists(select 1 from public.meadow_market_village_projects where owner_id=who and completed_at is null) then raise exception 'Finish your current shared landmark before starting another.';
  else insert into public.meadow_market_village_projects(owner_id,theme) values(who,chosen);end if;
 elsif p_action<>'status' then raise exception 'Unknown village project action.';end if;
 with allowed as (
  select p.*,profile.display_name,case p.theme when 'garden' then 15 when 'river' then 25 else 40 end as target
  from public.meadow_market_village_projects p join public.meadow_market_profiles profile on profile.user_id=p.owner_id
  where p.owner_id=who or exists(select 1 from public.meadow_market_friendships f where f.status='accepted' and
   ((f.requester_id=who and f.recipient_id=p.owner_id) or (f.recipient_id=who and f.requester_id=p.owner_id)))
 ), progress as (
  select p.*,case when p.completed_at is not null then p.target else least(p.target,
   (select count(*) from (select 1 from public.meadow_market_visit_events v where v.owner_id=p.owner_id
    and v.created_at>=p.created_at and v.outcome='applied' and v.action in ('water','feed','cheer') limit p.target) q)) end as helped
  from allowed p
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'owner',owner_id,'name',display_name,'theme',theme,
  'createdAt',created_at,'helped',helped,'target',target,'mine',owner_id=who,
  'stage',case when helped>=target then 3 when helped>=8 then 2 when helped>=3 then 1 else 0 end)
  order by(owner_id=who) desc,created_at desc),'[]'::jsonb) into result from progress;
 return jsonb_build_object('projects',result);
end $$;

do $migration$
declare body text;marker text;
begin
 body:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);marker:='''owned_collections'',coalesce';
 if position(marker in body)=0 then raise exception 'Review command reader before adding permanent landmark proof';end if;
 body:=replace(body,marker,$proof$
 'shared_landmarks',coalesce((select jsonb_agg(theme order by theme) from public.meadow_market_village_projects where owner_id=p_user and completed_at is not null),'[]'::jsonb),
$proof$||marker);execute body;
end $migration$;
