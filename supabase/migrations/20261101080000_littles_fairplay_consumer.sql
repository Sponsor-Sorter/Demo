-- Meadow Market Littles only. Enforcement remains staged off until release.
begin;

create table meadow_littles_private.fairplay_control_config(
  id boolean primary key default true check(id),
  enforced boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into meadow_littles_private.fairplay_control_config(id,enforced) values(true,false);
alter table meadow_littles_private.fairplay_control_config enable row level security;
revoke all on meadow_littles_private.fairplay_control_config from public,anon,authenticated,service_role;

-- Exposes no actor input or session identifier. require_actor() verifies auth.uid,
-- the live Auth session, and Auth ban state without creating a Littles profile.
create function public.meadow_littles_validate_session() returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform meadow_littles_private.require_actor();
  return true;
end $$;
revoke all on function public.meadow_littles_validate_session() from public,anon,service_role;
grant execute on function public.meadow_littles_validate_session() to authenticated;

-- The central Fairplay contracts are service-role-only. This narrowly scoped
-- definer helper elevates only that call and restores request claims on errors.
create function meadow_littles_private.fairplay_status(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior_claims text:=current_setting('request.jwt.claims',true);result jsonb;
begin
  if p_user is null or not exists(select 1 from public.meadow_littles_profiles where user_id=p_user) then
    raise exception 'Littles account required' using errcode='42501';
  end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  begin
    result:=public.fairplay_game_moderation_status('littles',p_user);
  exception when others then
    perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
    raise;
  end;
  perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
  return result;
end $$;
revoke all on function meadow_littles_private.fairplay_status(uuid) from public,anon,authenticated,service_role;

create function meadow_littles_private.guard_read(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare state jsonb;
begin
  if not (select enforced from meadow_littles_private.fairplay_control_config where id=true) then return; end if;
  if not exists(select 1 from public.meadow_littles_profiles where user_id=p_user) then return; end if;
  state:=meadow_littles_private.fairplay_status(p_user);
  if coalesce((state->>'banned')::boolean,false) then
    raise exception 'LITTLES_BANNED' using errcode='42501';
  end if;
end $$;
revoke all on function meadow_littles_private.guard_read(uuid) from public,anon,authenticated,service_role;

create function meadow_littles_private.can_read(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare state jsonb;
begin
  if p_user is distinct from auth.uid() then return false; end if;
  if not (select enforced from meadow_littles_private.fairplay_control_config where id=true) then return true; end if;
  if not exists(select 1 from public.meadow_littles_profiles where user_id=p_user) then return false; end if;
  state:=meadow_littles_private.fairplay_status(p_user);
  return not coalesce((state->>'banned')::boolean,false);
exception when others then return false;
end $$;
revoke all on function meadow_littles_private.can_read(uuid) from public,anon;
grant execute on function meadow_littles_private.can_read(uuid) to authenticated;
create policy meadow_littles_fairplay_read on public.meadow_littles_saves as restrictive for select to authenticated
using(meadow_littles_private.can_read(user_id));

create function meadow_littles_private.guard_save(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare state jsonb;
begin
  if not (select enforced from meadow_littles_private.fairplay_control_config where id=true) then return; end if;
  state:=meadow_littles_private.fairplay_status(p_user);
  if coalesce((state->>'banned')::boolean,false) then
    raise exception 'LITTLES_BANNED' using errcode='42501';
  end if;
  -- Littles has no authenticated public lobby or matchmaking. Restrictions
  -- do not block local-only games or private cloud recovery.
end $$;
revoke all on function meadow_littles_private.guard_save(uuid) from public,anon,authenticated,service_role;

create or replace function meadow_littles_private.open(p_display_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=meadow_littles_private.require_actor();p public.meadow_littles_profiles;s public.meadow_littles_saves;guest boolean;
begin
  perform meadow_littles_private.guard_read(actor);
  if p_display_name is not null and (char_length(btrim(p_display_name)) not between 1 and 32 or p_display_name~'[[:cntrl:]]') then raise exception using errcode='22023',message='LITTLES_INVALID_DISPLAY_NAME';end if;
  insert into public.meadow_littles_profiles(user_id) values(actor) on conflict(user_id) do nothing;
  if p_display_name is not null then update public.meadow_littles_profiles set display_name=btrim(p_display_name),updated_at=now() where user_id=actor;end if;
  insert into public.meadow_littles_saves(user_id) values(actor) on conflict(user_id) do nothing;
  select * into p from public.meadow_littles_profiles where user_id=actor;
  select * into s from public.meadow_littles_saves where user_id=actor;
  select is_anonymous into guest from auth.users where id=actor;
  return jsonb_build_object('ok',true,'contract','meadow-littles-cloud-v1','profile',jsonb_build_object('user_id',actor,'display_name',p.display_name,'is_guest',coalesce(guest,false)),
   'save',jsonb_build_object('cloud_version',s.cloud_version,'revision',s.revision,'data',s.save_data,'updated_at',s.updated_at,'last_request_id',s.last_request_id),'entitlements_verified',false);
end $$;

create or replace function meadow_littles_private.save(
  p_request_id uuid,p_expected_revision bigint,p_cloud_version integer,
  p_save_data jsonb,p_expected_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=meadow_littles_private.require_actor();s public.meadow_littles_saves;fingerprint text;replayed boolean:=false;
begin
  if p_expected_user_id is distinct from actor then raise exception using errcode='42501',message='LITTLES_ACCOUNT_CHANGED';end if;
  perform meadow_littles_private.guard_save(actor);
  if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=9007199254740991 or p_cloud_version is distinct from 1 or p_save_data is null or jsonb_typeof(p_save_data)<>'object' or octet_length(p_save_data::text)>262144 or p_save_data->'schema' is distinct from '1'::jsonb then raise exception using errcode='22023',message='LITTLES_INVALID_SAVE';end if;
  fingerprint:=md5(jsonb_build_object('expected_revision',p_expected_revision,'cloud_version',p_cloud_version,'data',p_save_data)::text);
  select * into s from public.meadow_littles_saves where user_id=actor for update;
  if not found then raise exception using errcode='22023',message='LITTLES_OPEN_REQUIRED';end if;
  if s.last_request_id=p_request_id then
    if s.last_request_hash is distinct from fingerprint then raise sqlstate 'PT409' using message='LITTLES_REQUEST_BINDING_CONFLICT';end if;
    replayed:=true;
  else
    if s.revision<>p_expected_revision then raise sqlstate 'PT409' using message='LITTLES_SAVE_REVISION_CONFLICT';end if;
    if s.revision>0 and s.updated_at>now()-interval '500 milliseconds' then raise sqlstate 'PT429' using message='LITTLES_SAVE_RATE_LIMIT';end if;
    update public.meadow_littles_saves set revision=revision+1,cloud_version=p_cloud_version,save_data=p_save_data,last_request_id=p_request_id,last_request_hash=fingerprint,updated_at=now() where user_id=actor returning * into s;
  end if;
  return jsonb_build_object('ok',true,'contract','meadow-littles-cloud-v1','revision',s.revision,'request_id',p_request_id,'replayed',replayed,'updated_at',s.updated_at,'entitlements_verified',false);
end $$;

commit;
