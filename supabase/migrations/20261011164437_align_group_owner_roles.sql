alter table public.friend_group_members drop constraint friend_group_members_role_chk;
alter table public.friend_group_members add constraint friend_group_members_role_chk check(role in ('member','admin','owner'));
create or replace function public.is_group_admin(gid uuid,uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(uid,auth.uid())=auth.uid() and
 (exists(select 1 from public.friend_groups g where g.id=gid and g.owner_id=auth.uid())
 or exists(select 1 from public.friend_group_members m where m.group_id=gid and m.user_id=auth.uid() and m.role in ('owner','admin')));
$$;
revoke all on function public.is_group_admin(uuid,uuid) from public,anon;
grant execute on function public.is_group_admin(uuid,uuid) to authenticated;
