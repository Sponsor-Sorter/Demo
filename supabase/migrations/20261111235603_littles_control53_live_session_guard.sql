-- RLS must reject a revoked Auth session as the cloud RPCs already do.
-- Keep the existing narrowly scoped private definer helper and grants.
create or replace function meadow_littles_private.can_read(p_user uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare state jsonb;
begin
 if p_user is distinct from auth.uid() then return false;end if;
 if meadow_littles_private.require_actor() is distinct from p_user then return false;end if;
 if not (select enforced from meadow_littles_private.fairplay_control_config where id=true) then return true;end if;
 if not exists(select 1 from public.meadow_littles_profiles where user_id=p_user) then return false;end if;
 state:=meadow_littles_private.fairplay_status(p_user);
 return not coalesce((state->>'banned')::boolean,false);
exception when others then return false;
end $$;
revoke all on function meadow_littles_private.can_read(uuid) from public,anon;
grant execute on function meadow_littles_private.can_read(uuid) to authenticated;
