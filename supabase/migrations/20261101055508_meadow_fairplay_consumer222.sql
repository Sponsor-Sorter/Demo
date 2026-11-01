-- Meadow-only consumer. Staged off until candidate acceptance and reviewed rollout.
create table meadow_private.control_config(id boolean primary key default true check(id),enforced boolean not null default false);
insert into meadow_private.control_config values(true,false);
create table meadow_private.control_admissions(
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 admitted_at timestamptz not null default now(),last_seen timestamptz not null default now());
alter table meadow_private.control_config enable row level security;
alter table meadow_private.control_admissions enable row level security;
revoke all on meadow_private.control_config,meadow_private.control_admissions from public,anon,authenticated,service_role;

create function meadow_private.control_session_valid(u uuid,s uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select u is not null and s is not null and exists(select 1 from auth.sessions where id=s and user_id=u and (not_after is null or not_after>now()))
$$;
create function meadow_private.control_session() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare s text:=coalesce(nullif(current_setting('meadow.control_session',true),''),auth.jwt()->>'session_id');
begin
 if s is null or s!~*'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then return null;end if;
 if meadow_private.control_session_valid(auth.uid(),s::uuid) then return s::uuid;end if;return null;
end $$;

-- This broker elevates only its bounded central-contract call and restores the
-- original verified claims even on failure. No app/actor parameter is public.
create function meadow_private.control_state(u uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old text:=current_setting('request.jwt.claims',true);r jsonb;
begin
 if auth.jwt()->>'role'='authenticated' and u is distinct from auth.uid() then raise exception 'MEADOW_IDENTITY_DENIED' using errcode='42501';end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=u) then return '{"app":"meadow","banned":false,"restricted":false,"decisions":[]}'::jsonb;end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 begin r:=public.fairplay_game_moderation_status('meadow',u);
 exception when others then perform set_config('request.jwt.claims',coalesce(old,''),true);raise;end;
 perform set_config('request.jwt.claims',coalesce(old,''),true);return r;
end $$;

create function meadow_private.control_guard(mode text,u uuid default auth.uid(),s uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare state jsonb;maintenance boolean;changed timestamptz;role_name text:=auth.jwt()->>'role';
begin
 if not (select enforced from meadow_private.control_config where id) then return;end if;
 if role_name='authenticated' then
  if u is distinct from auth.uid() then raise exception 'MEADOW_IDENTITY_DENIED' using errcode='42501';end if;
  s:=meadow_private.control_session();
 elsif role_name='service_role' then
  s:=coalesce(s,nullif(current_setting('meadow.control_session',true),'')::uuid);
 else raise exception 'MEADOW_SESSION_EXPIRED' using errcode='28000';end if;
 if not meadow_private.control_session_valid(u,s) then raise exception 'MEADOW_SESSION_EXPIRED' using errcode='28000';end if;
 if mode='read' then return;end if;
 state:=meadow_private.control_state(u);
 if (state->>'banned')::boolean then raise exception 'MEADOW_BANNED' using errcode='42501';end if;
 if mode in('social','ranked') and (state->>'restricted')::boolean then raise exception 'MEADOW_SOCIAL_RESTRICTED' using errcode='42501';end if;
 select r.maintenance,r.updated_at into maintenance,changed from public.fairplay_admin_runtime r where app='meadow';
 -- Admission is an authenticated game session, not every browser navigation.
 if coalesce(maintenance,false) and not exists(select 1 from meadow_private.control_admissions a where a.session_id=s and a.user_id=u and a.admitted_at<changed) then
  raise exception 'MEADOW_MAINTENANCE' using errcode='55000';end if;
 if mode<>'profile' and exists(select 1 from public.meadow_market_profiles where user_id=u) then
  insert into meadow_private.control_admissions(session_id,user_id) values(s,u) on conflict(session_id) do update set last_seen=now() where control_admissions.last_seen<now()-interval '30 seconds';
 end if;
end $$;

create function meadow_private.control_can_read(row_owner uuid,social boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select case when not (select enforced from meadow_private.control_config where id) then true
 when meadow_private.control_session() is null then false
 when row_owner=auth.uid() or not social then true
 else not exists(select 1 from public.fairplay_admin_moderation_decisions d where d.app='meadow' and d.revoked_at is null and d.starts_at<=now() and d.expires_at>now()
  and ((d.target=auth.uid() and d.kind in('moderation.ban','moderation.restrict')) or (d.target=row_owner and d.kind in('moderation.ban','moderation.restrict')))) end
$$;

create function meadow_private.control_table_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare mode text:='play';u uuid:=auth.uid();
begin
 -- Operator settlement/erasure is not a new player action. Command RPCs are
 -- separately guarded and carry a validated session through their save write.
 if auth.jwt()->>'role'='authenticated' then
  if tg_table_name='meadow_market_profiles' then
   if tg_op='DELETE' then if (select enforced from meadow_private.control_config where id) then raise exception 'Use the account deletion request in Settings';end if;
   elsif tg_op='INSERT' then mode:='profile';
   elsif to_jsonb(new)->'display_name' is distinct from to_jsonb(old)->'display_name' or to_jsonb(new)->'friend_code' is distinct from to_jsonb(old)->'friend_code' then mode:='social';else mode:='read';end if;
  elsif tg_table_name='meadow_market_friendships' then mode:=case when tg_op='DELETE' then 'read' else 'social' end;
  elsif tg_table_name='meadow_market_visit_events' and tg_op='UPDATE' and to_jsonb(new)->>'outcome'='not_needed' then mode:='read';end if;
  perform meadow_private.control_guard(mode,u);
  if tg_table_name='meadow_market_friendships' and tg_op<>'DELETE' and exists(select 1 from public.fairplay_admin_moderation_decisions d where d.app='meadow' and d.target in((to_jsonb(new)->>'requester_id')::uuid,(to_jsonb(new)->>'recipient_id')::uuid) and d.kind in('moderation.ban','moderation.restrict') and d.revoked_at is null and d.starts_at<=now() and d.expires_at>now())
   and (select enforced from meadow_private.control_config where id) then raise exception 'MEADOW_SOCIAL_RESTRICTED' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
do $$declare t text;begin
 foreach t in array array['profiles','saves','friendships','visit_events'] loop
 execute format('create trigger meadow_control_write before insert or update or delete on public.%I for each row execute function meadow_private.control_table_write()','meadow_market_'||t);
 end loop;
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'meadow_market_%' and rowsecurity loop
  if t in('meadow_market_profiles','meadow_market_saves') then
   execute format('create policy meadow_control_read on public.%I as restrictive for select to authenticated using (meadow_private.control_can_read(user_id,true))',t);
  else execute format('create policy meadow_control_read on public.%I as restrictive for select to authenticated using ((select meadow_private.control_can_read(null,%L)))',t,t='meadow_market_friendships');end if;
 end loop;
end $$;

create function public.meadow_market_control_session() returns jsonb
language plpgsql security definer set search_path='' as $$
declare s uuid:=meadow_private.control_session();u uuid:=auth.uid();
begin
 if auth.jwt()->>'role'<>'authenticated' or s is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'MEADOW_SESSION_EXPIRED' using errcode='28000';end if;
 return jsonb_build_object('id',u,'session_id',s);
end $$;

create function public.meadow_market_control_service(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();s uuid:=meadow_private.control_session();old text:=current_setting('request.jwt.claims',true);r jsonb;state jsonb;runtime jsonb;admitted boolean;client_build integer;
begin
 if auth.jwt()->>'role'<>'authenticated' or s is null then raise exception 'MEADOW_SESSION_EXPIRED' using errcode='28000';end if;
 if p_action<>'status' and not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Open your Meadow farm first' using errcode='42501';end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>12000 or p_action not in('status','admit','ack','appeal') then raise exception 'Invalid control request' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k<>all(case p_action when 'ack' then array['decision'] when 'appeal' then array['decision','request_id','reason'] else array['build'] end)) then raise exception 'Actor and app are server controlled' using errcode='22023';end if;
 if p_data?'build' and (jsonb_typeof(p_data->'build')<>'number' or coalesce(p_data->>'build','')!~'^[1-9][0-9]{0,5}$') then raise exception 'Invalid notice build' using errcode='22023';end if;
 -- Client build selects informational notices only; it never grants access.
 client_build:=coalesce((p_data->>'build')::integer,222);
 if p_action='admit' then perform meadow_private.control_guard('play',u,s);end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 begin
  if p_action='ack' then r:=public.fairplay_game_warning_ack('meadow',u,(p_data->>'decision')::uuid);
  elsif p_action='appeal' then r:=public.fairplay_game_appeal('meadow',u,(p_data->>'decision')::uuid,(p_data->>'request_id')::uuid,p_data->>'reason');
  else
   state:=meadow_private.control_state(u);runtime:=public.fairplay_game_runtime('meadow',client_build);
   admitted:=exists(select 1 from meadow_private.control_admissions a where a.user_id=u and a.session_id=s and (not coalesce((runtime->>'maintenance')::boolean,false) or a.admitted_at<(select updated_at from public.fairplay_admin_runtime where app='meadow')));
   r:=jsonb_build_object('moderation',state,'runtime',runtime,'admitted',admitted,'game_account_ready',exists(select 1 from public.meadow_market_profiles where user_id=u),'enforced',(select enforced from meadow_private.control_config where id),'consumer_build',222,'notice_build',client_build);
  end if;
 exception when others then perform set_config('request.jwt.claims',coalesce(old,''),true);raise;end;
 perform set_config('request.jwt.claims',coalesce(old,''),true);return r;
end $$;

create function public.meadow_market_control_read_command(p_user uuid,p_session uuid,p_request_id uuid,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role'<>'service_role' or not meadow_private.control_session_valid(p_user,p_session) then raise exception 'MEADOW_SESSION_EXPIRED' using errcode='28000';end if;
 perform set_config('meadow.control_session',p_session::text,true);
 perform meadow_private.control_guard('play',p_user,p_session);
 return meadow_private.read_farm_command(p_user,p_request_id,p_body);
end $$;
create function public.meadow_market_control_commit_command(p_user uuid,p_session uuid,p_request_id uuid,p_body jsonb,p_save_data jsonb,p_summary jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role'<>'service_role' or not meadow_private.control_session_valid(p_user,p_session) then raise exception 'MEADOW_SESSION_EXPIRED' using errcode='28000';end if;
 perform set_config('meadow.control_session',p_session::text,true);
 perform meadow_private.control_guard('play',p_user,p_session);
 return meadow_private.commit_farm_command(p_user,p_request_id,p_body,p_save_data,p_summary);
end $$;

-- Existing report/block API remains backward compatible; reports now also reach
-- the central queue atomically. Target is a verified Meadow record and its
-- relationship/visit evidence is selected by the server, never uploaded proof.
create or replace function public.meadow_market_social_safety(p_action text,p_target uuid default null,p_reason text default null,p_details text default '',p_request uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r jsonb;receipt jsonb;context text;proof jsonb;old text:=current_setting('request.jwt.claims',true);
begin
 perform meadow_private.control_guard('read',u);
 r:=meadow_private.social_safety(p_action,p_target,p_reason,p_details,p_request);
 if p_action='report' then
  select 'friend:'||f.id,jsonb_build_object('source','server_friendship','status',f.status) into context,proof from public.meadow_market_friendships f where (f.requester_id=u and f.recipient_id=p_target) or (f.requester_id=p_target and f.recipient_id=u) order by f.created_at desc limit 1;
  if context is null then select 'visit:'||v.id,jsonb_build_object('source','server_visit','action',v.action,'map',v.map_id) into context,proof from public.meadow_market_visit_events v where (v.owner_id=u and v.visitor_id=p_target) or (v.owner_id=p_target and v.visitor_id=u) order by v.created_at desc limit 1;end if;
  if context is null then context:='directory:'||p_target::text;proof:=jsonb_build_object('source','server_public_directory');end if;
  proof:=proof||jsonb_build_object('allegation_unproven',true,'target_public_name',(select display_name from public.meadow_market_profiles where user_id=p_target));
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  begin receipt:=public.fairplay_game_report('meadow',u,p_target,p_request,case p_reason when 'name' then 'abusive_name' else p_reason end,p_details,context,proof);
  exception when others then perform set_config('request.jwt.claims',coalesce(old,''),true);raise;end;
  perform set_config('request.jwt.claims',coalesce(old,''),true);r:=r||jsonb_build_object('report',receipt);
 end if;return r;
end $$;

revoke all on function meadow_private.control_guard(text,uuid,uuid),meadow_private.control_can_read(uuid,boolean),meadow_private.control_state(uuid),meadow_private.control_session_valid(uuid,uuid),meadow_private.control_session(),meadow_private.control_table_write() from public,anon;
revoke all on function meadow_private.control_state(uuid),meadow_private.control_session_valid(uuid,uuid),meadow_private.control_session(),meadow_private.control_table_write() from authenticated,service_role;
grant execute on function meadow_private.control_guard(text,uuid,uuid),meadow_private.control_can_read(uuid,boolean) to authenticated,service_role;
revoke all on function public.meadow_market_control_session(),public.meadow_market_control_service(text,jsonb) from public,anon,service_role;
grant execute on function public.meadow_market_control_session(),public.meadow_market_control_service(text,jsonb) to authenticated;
revoke all on function public.meadow_market_control_read_command(uuid,uuid,uuid,jsonb),public.meadow_market_control_commit_command(uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.meadow_market_control_read_command(uuid,uuid,uuid,jsonb),public.meadow_market_control_commit_command(uuid,uuid,uuid,jsonb,jsonb,jsonb) to service_role;

create or replace function public.meadow_market_start_ad_reward() returns jsonb language plpgsql set search_path='' as $$begin perform meadow_private.control_guard('play');return meadow_private.start_ad_reward();end $$;
create or replace function public.meadow_market_commerce_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;s jsonb;
begin
 perform meadow_private.control_guard('read');r:=meadow_private.commerce_status();
 if (select enforced from meadow_private.control_config where id) then
  s:=meadow_private.control_state(auth.uid());
  if (s->>'banned')::boolean then r:=r||'{"payments_enabled":false,"ads_enabled":false}'::jsonb;end if;
 end if;return r;
end $$;
create or replace function public.meadow_market_farm_ledger() returns jsonb language plpgsql set search_path='' as $$begin perform meadow_private.control_guard('read');return meadow_private.farm_ledger();end $$;
create or replace function public.meadow_market_rebase_farm_rewards(p_from_cursor bigint) returns jsonb language plpgsql set search_path='' as $$begin perform meadow_private.control_guard('play');return meadow_private.rebase_farm_rewards(p_from_cursor);end $$;
create or replace function public.meadow_market_account_deletion(p_action text default 'status') returns jsonb language plpgsql set search_path='' as $$begin perform meadow_private.control_guard('read');return meadow_private.account_deletion(p_action);end $$;

create function public.meadow_market_control_event(p_user uuid,p_event uuid,p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role'<>'service_role' or p_code not in('MEADOW_BANNED','MEADOW_SOCIAL_RESTRICTED','MEADOW_MAINTENANCE') then raise exception 'Backend only' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('meadow-control-event:'||p_user::text,0));
 if (select count(*) from public.fairplay_admin_game_events where app='meadow' and player_id=p_user and kind='command_rejected' and created_at>now()-interval '1 hour')>=10 then return '{"accepted":false,"limited":true}'::jsonb;end if;
 return public.fairplay_game_event('meadow',p_event,'command_rejected',p_user,'Meadow server rejected a protected action',jsonb_build_object('code',p_code,'consumer_build',222,'source','verified_game_backend'));
end $$;
revoke all on function public.meadow_market_control_event(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.meadow_market_control_event(uuid,uuid,text) to service_role;
create function public.meadow_market_control_heartbeat(p_public_client boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role'<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 return public.fairplay_game_event('meadow',gen_random_uuid(),'heartbeat',null,'On-demand Meadow consumer acceptance; not an uptime monitor',jsonb_build_object('consumer_version','meadow-control222','features',jsonb_build_array('reports','moderation','warnings','appeals','maintenance','notices','telemetry'),'metrics',jsonb_build_object('client_rollout',case when p_public_client then 'public222' else 'candidate222' end,'enforcement',(select enforced from meadow_private.control_config where id),'native_ads_policy','fixed restricted defaults; public ads disabled','observation','on-demand acceptance, not uptime')));
end $$;
revoke all on function public.meadow_market_control_heartbeat(boolean) from public,anon,authenticated;
grant execute on function public.meadow_market_control_heartbeat(boolean) to service_role;
-- Guard every existing player RPC as well as direct table writes/reads.
CREATE OR REPLACE FUNCTION public.meadow_market_commit_save(p_expected_revision bigint, p_save_data jsonb, p_write_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); saved public.meadow_market_saves%rowtype; digest text; bytes integer;
begin
 perform meadow_private.control_guard('play',auth.uid());
 if u is null then raise exception 'Sign in to save a farm' using errcode='28000'; end if;
 if p_expected_revision is null or p_expected_revision<0 or p_write_id is null then raise exception 'Invalid save revision' using errcode='22023'; end if;
 bytes:=octet_length(p_save_data::text);
 if p_save_data is null or jsonb_typeof(p_save_data)<>'object' or bytes>4194304
    or (p_save_data->>'version') is distinct from '1' or jsonb_typeof(p_save_data->'farms') is distinct from 'object'
    or jsonb_typeof(p_save_data->'coins') is distinct from 'number'
    or (p_save_data->>'coins')::numeric<0 or (p_save_data->>'coins')::numeric>1000000000000
    or (p_save_data->>'coins')::numeric<>trunc((p_save_data->>'coins')::numeric)
 then raise exception 'Invalid farm save' using errcode='22023';end if;
 p_save_data:=jsonb_set(p_save_data,'{_cloudRevision}',to_jsonb(p_expected_revision),true);
 digest:=encode(sha256(convert_to(p_save_data::text,'UTF8')),'hex');
 select * into saved from public.meadow_market_saves where user_id=u for update;
 if found then
  if saved.save_write_id=p_write_id then
   if saved.save_write_hash is distinct from digest then raise exception 'Save receipt reused for different data' using errcode='22023';end if;
   return jsonb_build_object('ok',true,'revision',saved.revision,'write_id',p_write_id,'replayed',true);
  end if;
  if saved.revision<>p_expected_revision then return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data);end if;
  update public.meadow_market_saves set save_data=p_save_data,save_protocol=2,save_write_id=p_write_id,save_write_hash=digest where user_id=u returning * into saved;
 else
  if p_expected_revision<>0 then return jsonb_build_object('ok',false,'conflict',true,'revision',0,'save_data',null);end if;
  insert into public.meadow_market_saves(user_id,save_data,save_protocol,save_write_id,save_write_hash)
   values(u,p_save_data,2,p_write_id,digest) on conflict(user_id) do nothing returning * into saved;
  if not found then
   select * into saved from public.meadow_market_saves where user_id=u for update;
   if saved.save_write_id=p_write_id and saved.save_write_hash=digest then return jsonb_build_object('ok',true,'revision',saved.revision,'write_id',p_write_id,'replayed',true);end if;
   return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data);
  end if;
 end if;
 return jsonb_build_object('ok',true,'revision',saved.revision,'write_id',p_write_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_commit_economy_save(p_expected_revision bigint, p_save_data jsonb, p_write_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard('play',auth.uid()); return meadow_private.commit_economy_save(p_expected_revision,p_save_data,p_write_id);end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_ack_help(p_events jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ declare affected integer; begin
 perform meadow_private.control_guard('play',auth.uid()); if auth.uid() is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>100 then raise exception 'Invalid help acknowledgment'; end if; update public.meadow_market_visit_events v set outcome=e.value->>'outcome',applied_at=now() from jsonb_array_elements(p_events) e where v.id=(e.value->>'id')::uuid and v.owner_id=auth.uid() and v.outcome='pending' and e.value->>'outcome' in ('applied','not_needed');get diagnostics affected=row_count; return affected; end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_read_farm_command(p_user uuid, p_request_id uuid, p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard('play',p_user); return meadow_private.read_farm_command(p_user,p_request_id,p_body);end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_commit_farm_command(p_user uuid, p_request_id uuid, p_body jsonb, p_save_data jsonb, p_summary jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard('play',p_user); return meadow_private.commit_farm_command(p_user,p_request_id,p_body,p_save_data,p_summary);end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_reward_round(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard(case when p_action='start' then 'ranked' else 'play' end,auth.uid()); return meadow_private.reward_round(p_action,p_data);end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_record_visit(p_owner uuid, p_map text, p_action text, p_target text, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard('social',auth.uid()); if not meadow_private.control_can_read(p_owner,true) then raise exception 'MEADOW_SOCIAL_RESTRICTED' using errcode='42501';end if; return meadow_private.record_visit(p_owner,p_map,p_action,p_target,p_request);end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_play_service(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard(case when p_action='status' then 'read' when p_action in('board','score') then 'ranked' else 'play' end,auth.uid()); return meadow_private.play_service(p_action,p_data);end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_collection_service(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard(case when p_action in('status','catalogue') then 'read' else 'play' end,auth.uid()); return meadow_private.collection_service(p_action,p_data);end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_journey_service(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard(case when p_action='status' then 'read' when p_action in('help','contribute') then 'social' else 'play' end,auth.uid()); return meadow_market_private.journey_service(p_action,p_data);end $function$;

CREATE OR REPLACE FUNCTION public.meadow_market_diagnostic_event(p_build integer, p_module text, p_line integer, p_category text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard('read',auth.uid()); return meadow_private.diagnostic_event(p_build,p_module,p_line,p_category);end $function$;
