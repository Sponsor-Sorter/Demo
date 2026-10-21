-- Meadow Markets only: friend-help landmarks. Other apps and Littles are untouched.
create schema if not exists meadow_market_private;
revoke all on schema meadow_market_private from public, anon;
grant usage on schema meadow_market_private to authenticated;

create table public.meadow_market_village_projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 theme text not null check (theme in ('garden','river','hall')),
 created_at timestamptz not null default now(),
 unique(owner_id,theme)
);
alter table public.meadow_market_village_projects enable row level security;
revoke all on public.meadow_market_village_projects from public,anon,authenticated;
grant select on public.meadow_market_village_projects to authenticated;
create policy meadow_village_projects_read on public.meadow_market_village_projects
 for select to authenticated using (
 owner_id=(select auth.uid()) or exists (
  select 1 from public.meadow_market_friendships f where f.status='accepted' and
  ((f.requester_id=(select auth.uid()) and f.recipient_id=owner_id) or
   (f.recipient_id=(select auth.uid()) and f.requester_id=owner_id))
 ));
create index meadow_village_projects_owner on public.meadow_market_village_projects(owner_id,created_at);
create index if not exists meadow_visits_village_progress on public.meadow_market_visit_events(owner_id,created_at)
 where outcome='applied' and action in ('water','feed','cheer');

-- A definer is needed to count accepted friends' acknowledged help, including
-- rows their normal owner/visitor RLS correctly does not expose to this player.
-- Keep privileged code outside exposed schemas, and check friendship explicitly.
create function meadow_market_private.journey_service(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); saved jsonb; chosen text; result jsonb;
begin
 if who is null then raise exception 'Sign in to Meadow Markets first.'; end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=who) then
  raise exception 'Create your game farmer profile first.';
 end if;
 if p_action='start' then
  chosen:=p_data->>'theme';
  if chosen not in ('garden','river','hall') or chosen is null then raise exception 'Choose a village landmark.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(who::text,73));
  select save_data into saved from public.meadow_market_saves where user_id=who;
  if coalesce((saved->>'level')::numeric,0)<12 or coalesce((saved#>>'{journey,projects,hall}')::numeric,0)<2 then
   raise exception 'Restore your community hall to stage two first.';
  end if;
  if exists(select 1 from public.meadow_market_village_projects where owner_id=who and theme=chosen) then
   null; -- Retry-safe: return the existing project.
  elsif exists(
   select 1 from public.meadow_market_village_projects p where p.owner_id=who and
   (select count(*) from public.meadow_market_visit_events v
    where v.owner_id=who and v.created_at>=p.created_at and v.outcome='applied' and v.action in ('water','feed','cheer')
    and exists(select 1 from public.meadow_market_friendships f where f.status='accepted' and
     ((f.requester_id=who and f.recipient_id=v.visitor_id) or (f.recipient_id=who and f.requester_id=v.visitor_id)))
   ) < case p.theme when 'garden' then 15 when 'river' then 25 else 40 end
  ) then raise exception 'Finish your current shared landmark before starting another.';
  else insert into public.meadow_market_village_projects(owner_id,theme) values(who,chosen);
  end if;
 elsif p_action<>'status' then raise exception 'Unknown village project action.';
 end if;
 with allowed as (
  select p.*,profile.display_name,
   case p.theme when 'garden' then 15 when 'river' then 25 else 40 end as target
  from public.meadow_market_village_projects p join public.meadow_market_profiles profile on profile.user_id=p.owner_id
  where p.owner_id=who or exists(select 1 from public.meadow_market_friendships f where f.status='accepted' and
   ((f.requester_id=who and f.recipient_id=p.owner_id) or (f.recipient_id=who and f.requester_id=p.owner_id)))
 ), progress as (
  select p.*,least(p.target,(select count(*) from public.meadow_market_visit_events v where v.owner_id=p.owner_id
   and v.created_at>=p.created_at and v.outcome='applied' and v.action in ('water','feed','cheer')
   and exists(select 1 from public.meadow_market_friendships f where f.status='accepted' and
    ((f.requester_id=p.owner_id and f.recipient_id=v.visitor_id) or (f.recipient_id=p.owner_id and f.requester_id=v.visitor_id)))
  )) as helped from allowed p
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'owner',owner_id,'name',display_name,'theme',theme,
  'createdAt',created_at,'helped',helped,'target',target,'mine',owner_id=who,
  'stage',case when helped>=target then 3 when helped>=8 then 2 when helped>=3 then 1 else 0 end)
  order by (owner_id=who) desc,created_at desc),'[]'::jsonb) into result from progress;
 return jsonb_build_object('projects',result);
end $$;
revoke all on function meadow_market_private.journey_service(text,jsonb) from public,anon;
grant execute on function meadow_market_private.journey_service(text,jsonb) to authenticated;
create function public.meadow_market_journey_service(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select meadow_market_private.journey_service(p_action,p_data);
$$;
revoke all on function public.meadow_market_journey_service(text,jsonb) from public,anon;
grant execute on function public.meadow_market_journey_service(text,jsonb) to authenticated;
comment on table public.meadow_market_village_projects is 'Meadow Markets shared landmarks; acknowledged help from accepted friends only. No chat or personal contact details.';
