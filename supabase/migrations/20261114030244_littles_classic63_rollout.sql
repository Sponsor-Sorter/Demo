-- Stage mechanics privately for installed-app acceptance, then publish the build.
-- No identities, preview membership, or account names leave this private config.
alter table meadow_littles_private.weekly_config
 add column quality_build integer not null default 62 check(quality_build between 62 and 9999),
 add column quality_preview_build integer not null default 63 check(quality_preview_build between 62 and 9999),
 add column quality_preview_users uuid[] not null default '{}';
create function meadow_littles_private.quality_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=meadow_littles_private.require_actor(); answer jsonb;
begin
 perform meadow_littles_private.guard_read(actor);
 select jsonb_build_object('public_quality_build',c.quality_build,'quality_build',
 greatest(c.quality_build,case when actor=any(c.quality_preview_users) then c.quality_preview_build else c.quality_build end))
 into answer from meadow_littles_private.weekly_config c where singleton;
 return coalesce(answer,jsonb_build_object('public_quality_build',62,'quality_build',62));
end $$;
revoke all on function meadow_littles_private.quality_status() from public,anon;
grant execute on function meadow_littles_private.quality_status() to authenticated;
create or replace function public.meadow_littles_weekly(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$
 select meadow_littles_private.weekly(p_action,p_data)||meadow_littles_private.quality_status()
$$;
revoke all on function public.meadow_littles_weekly(text,jsonb) from public,anon;
grant execute on function public.meadow_littles_weekly(text,jsonb) to authenticated;
