-- Meadow Markets only. Blocks are bilateral for visibility and invitations.
create table public.meadow_market_blocks (
 owner_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 target_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 target_name text not null default '' check(length(target_name)<=80),
 created_at timestamptz not null default now(), primary key(owner_id,target_id), check(owner_id<>target_id)
);
create index meadow_blocks_reverse on public.meadow_market_blocks(target_id,owner_id);
alter table public.meadow_market_blocks enable row level security;
revoke all on public.meadow_market_blocks from public,anon,authenticated;
grant select on public.meadow_market_blocks to authenticated;
create policy "Meadow own blocked list" on public.meadow_market_blocks for select to authenticated using(owner_id=(select auth.uid()));
create table meadow_private.community_acceptances (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 version integer not null, accepted_at timestamptz not null default now()
);
create table meadow_private.player_reports (
 id uuid primary key, reporter_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 target_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 reason text not null check(reason in ('name','harassment','cheating','other')),
 details text not null default '' check(length(details)<=500),
 created_at timestamptz not null default now(), status text not null default 'new' check(status in ('new','reviewing','resolved','dismissed')),
 check(reporter_id<>target_id)
);
create index meadow_reports_recent on meadow_private.player_reports(reporter_id,created_at);
create index meadow_reports_queue on meadow_private.player_reports(status,created_at);
alter table meadow_private.community_acceptances enable row level security;
alter table meadow_private.player_reports enable row level security;
revoke all on meadow_private.community_acceptances,meadow_private.player_reports from public,anon,authenticated;

create function meadow_private.blocked_with(other uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.meadow_market_blocks b where
 (b.owner_id=auth.uid() and b.target_id=other) or (b.target_id=auth.uid() and b.owner_id=other));
$$;
revoke all on function meadow_private.blocked_with(uuid) from public,anon;
grant execute on function meadow_private.blocked_with(uuid) to authenticated;
create policy "Meadow block profile visibility" on public.meadow_market_profiles as restrictive for select to authenticated using(not meadow_private.blocked_with(user_id));
create policy "Meadow block farm visibility" on public.meadow_market_saves as restrictive for select to authenticated using(not meadow_private.blocked_with(user_id));
create policy "Meadow block friendship access" on public.meadow_market_friendships as restrictive for all to authenticated
 using(not meadow_private.blocked_with(case when requester_id=(select auth.uid()) then recipient_id else requester_id end))
 with check(not meadow_private.blocked_with(case when requester_id=(select auth.uid()) then recipient_id else requester_id end));
create policy "Meadow block visitor visibility" on public.meadow_market_visit_events as restrictive for select to authenticated
 using(not meadow_private.blocked_with(case when owner_id=(select auth.uid()) then visitor_id else owner_id end));
-- No unauthenticated player directory; existing public profile reads require sign-in.
alter policy "Meadow Market profile directory" on public.meadow_market_profiles to authenticated;

create function meadow_private.social_safety(p_action text,p_target uuid,p_reason text,p_details text,p_request uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); previous meadow_private.player_reports; result jsonb;
begin
 if actor is null or not exists(select 1 from public.meadow_market_profiles where user_id=actor) then raise exception 'Connect your farm first.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('meadow-safety:'||actor::text,0));
 if p_action='accept_rules' then
  insert into meadow_private.community_acceptances(user_id,version) values(actor,1)
  on conflict(user_id) do update set version=1,accepted_at=now();
 elsif p_action in ('block','unblock','report') then
  if p_target is null or p_target=actor or not exists(select 1 from public.meadow_market_profiles where user_id=p_target) then raise exception 'Choose another farm.'; end if;
  -- Match the visit function lock before removing a connection, so in-flight help settles first.
  perform pg_advisory_xact_lock(hashtextextended(least(actor::text,p_target::text)||greatest(actor::text,p_target::text),0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(actor::text,p_target::text)||least(actor::text,p_target::text),0));
  if p_action='block' then
   if not exists(select 1 from public.meadow_market_blocks where owner_id=actor and target_id=p_target) and (select count(*) from public.meadow_market_blocks where owner_id=actor)>=200 then raise exception 'Your blocked list is full. Manage it in Settings.'; end if;
   insert into public.meadow_market_blocks(owner_id,target_id,target_name)
   select actor,p_target,left(display_name,80) from public.meadow_market_profiles where user_id=p_target on conflict do nothing;
   delete from public.meadow_market_friendships where (requester_id=actor and recipient_id=p_target) or (requester_id=p_target and recipient_id=actor);
   update public.meadow_market_visit_events set outcome='not_needed',applied_at=now() where outcome='pending' and ((owner_id=actor and visitor_id=p_target) or (owner_id=p_target and visitor_id=actor));
  elsif p_action='unblock' then
   delete from public.meadow_market_blocks where owner_id=actor and target_id=p_target;
  else
   if p_request is null or p_reason is null or p_reason not in ('name','harassment','cheating','other') or length(coalesce(p_details,''))>500 then raise exception 'Choose a reason and keep details under 500 characters.'; end if;
   select * into previous from meadow_private.player_reports where id=p_request;
   if found then
    if previous.reporter_id<>actor or previous.target_id<>p_target or previous.reason<>p_reason or previous.details<>coalesce(p_details,'') then raise exception 'This report reference is unavailable.'; end if;
   else
    if (select count(*) from meadow_private.player_reports where reporter_id=actor and created_at>now()-interval '24 hours')>=20 then raise exception 'Report limit reached. Please try tomorrow or contact support.'; end if;
    insert into meadow_private.player_reports(id,reporter_id,target_id,reason,details) values(p_request,actor,p_target,p_reason,coalesce(p_details,''));
   end if;
  end if;
 elsif p_action<>'status' then raise exception 'Choose a valid safety action.';
 end if;
 select jsonb_build_object('rules_version',coalesce((select version from meadow_private.community_acceptances where user_id=actor),0),
 'blocked',coalesce((select jsonb_agg(jsonb_build_object('user_id',target_id,'name',target_name) order by created_at desc) from public.meadow_market_blocks where owner_id=actor),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function meadow_private.social_safety(text,uuid,text,text,uuid) from public,anon;
grant execute on function meadow_private.social_safety(text,uuid,text,text,uuid) to authenticated;
create function public.meadow_market_social_safety(p_action text,p_target uuid default null,p_reason text default null,p_details text default '',p_request uuid default null) returns jsonb
 language sql security invoker set search_path='' as $$ select meadow_private.social_safety(p_action,p_target,p_reason,p_details,p_request); $$;
revoke all on function public.meadow_market_social_safety(text,uuid,text,text,uuid) from public,anon;
grant execute on function public.meadow_market_social_safety(text,uuid,text,text,uuid) to authenticated;

create function meadow_private.guard_social_rules() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); other uuid;
begin
 if actor is null then return new; end if;
 if tg_table_name='meadow_market_profiles' then
  if new.display_name is not distinct from old.display_name then return new; end if;
 else
  if new.status='declined' then return new; end if;
  other:=case when new.requester_id=actor then new.recipient_id else new.requester_id end;
  perform pg_advisory_xact_lock(hashtextextended(least(actor::text,other::text)||greatest(actor::text,other::text),0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(actor::text,other::text)||least(actor::text,other::text),0));
  if meadow_private.blocked_with(other) then raise exception 'This farm connection is unavailable.'; end if;
 end if;
 if not exists(select 1 from meadow_private.community_acceptances where user_id=actor and version=1) then raise exception 'Read and accept the community rules before sharing a name or connecting with players.'; end if;
 return new;
end $$;
revoke all on function meadow_private.guard_social_rules() from public,anon,authenticated;
create trigger meadow_name_community_rules before update of display_name on public.meadow_market_profiles for each row execute function meadow_private.guard_social_rules();
create trigger meadow_connection_community_rules before insert or update on public.meadow_market_friendships for each row execute function meadow_private.guard_social_rules();
create function meadow_private.guard_blocked_visit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.meadow_market_blocks where (owner_id=new.owner_id and target_id=new.visitor_id) or (owner_id=new.visitor_id and target_id=new.owner_id)) then raise exception 'This farm connection is unavailable.'; end if;
 return new;
end $$;
revoke all on function meadow_private.guard_blocked_visit() from public,anon,authenticated;
create trigger meadow_blocked_visit before insert on public.meadow_market_visit_events for each row execute function meadow_private.guard_blocked_visit();
select cron.schedule('meadow-market-report-retention','17 3 * * *',$job$delete from meadow_private.player_reports where created_at < now()-interval '180 days'$job$);
comment on table meadow_private.player_reports is 'Meadow Markets only. Staff review queue; no automated sanctions. Retain up to 180 days, cascade on game profile deletion.';
