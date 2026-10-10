drop function if exists public.get_own_profile_email();
alter function public.is_current_user_admin() set search_path = pg_catalog, public;
revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated, service_role;
