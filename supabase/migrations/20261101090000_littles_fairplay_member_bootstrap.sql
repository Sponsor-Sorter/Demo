-- Register the authenticated user as a Littles member before requesting
-- moderation status. This allows Fairplay to show decisions and appeals for
-- a newly created account without returning any cloud save to a banned user.
begin;

create function public.meadow_littles_register_member() returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=meadow_littles_private.require_actor();
begin
  insert into public.meadow_littles_profiles(user_id) values(actor) on conflict(user_id) do nothing;
  return true;
end $$;
revoke all on function public.meadow_littles_register_member() from public,anon,service_role;
grant execute on function public.meadow_littles_register_member() to authenticated;

-- An unregistered banned user who calls open directly must not create a profile
-- and then read a save. The profile insert and guard are in one transaction,
-- so a failed moderation check rolls the insert back.
create or replace function meadow_littles_private.open(p_display_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=meadow_littles_private.require_actor();p public.meadow_littles_profiles;s public.meadow_littles_saves;guest boolean;
begin
  if p_display_name is not null and (char_length(btrim(p_display_name)) not between 1 and 32 or p_display_name~'[[:cntrl:]]') then raise exception using errcode='22023',message='LITTLES_INVALID_DISPLAY_NAME';end if;
  insert into public.meadow_littles_profiles(user_id) values(actor) on conflict(user_id) do nothing;
  perform meadow_littles_private.guard_read(actor);
  if p_display_name is not null then update public.meadow_littles_profiles set display_name=btrim(p_display_name),updated_at=now() where user_id=actor;end if;
  insert into public.meadow_littles_saves(user_id) values(actor) on conflict(user_id) do nothing;
  select * into p from public.meadow_littles_profiles where user_id=actor;
  select * into s from public.meadow_littles_saves where user_id=actor;
  select is_anonymous into guest from auth.users where id=actor;
  return jsonb_build_object('ok',true,'contract','meadow-littles-cloud-v1','profile',jsonb_build_object('user_id',actor,'display_name',p.display_name,'is_guest',coalesce(guest,false)),
   'save',jsonb_build_object('cloud_version',s.cloud_version,'revision',s.revision,'data',s.save_data,'updated_at',s.updated_at,'last_request_id',s.last_request_id),'entitlements_verified',false);
end $$;

commit;
