create function sponsorship_private.can_read_group_members(gid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.friend_groups g where g.id=gid and (
 g.owner_id=auth.uid() or g.visibility='public'
 or exists(select 1 from public.friend_group_members m where m.group_id=g.id and m.user_id=auth.uid())
 or (g.visibility='friends' and exists(select 1 from public.user_friendships f where f.status='accepted'
 and ((f.user_id=g.owner_id and f.friend_id=auth.uid()) or (f.friend_id=g.owner_id and f.user_id=auth.uid()))))
 ));
$$;
revoke all on function sponsorship_private.can_read_group_members(uuid) from public,anon;
grant usage on schema sponsorship_private to authenticated;
grant execute on function sponsorship_private.can_read_group_members(uuid) to authenticated;
drop policy "friend_group_members.select_all_auth" on public.friend_group_members;
create policy group_members_visible_group on public.friend_group_members for select to authenticated
 using(sponsorship_private.can_read_group_members(group_id));

create function sponsorship_private.guard_group_membership() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 if tg_op='INSERT' then
  select owner_id into owner from public.friend_groups where id=new.group_id;
  if new.role is null or new.role not in ('owner','admin','member') or (new.role='owner' and new.user_id is distinct from owner) then raise exception 'Invalid member role'; end if;
  return new;
 end if;
 if tg_op='UPDATE' and row(new.group_id,new.user_id) is distinct from row(old.group_id,old.user_id) then raise exception 'Membership identity cannot change'; end if;
 select owner_id into owner from public.friend_groups where id=old.group_id;
 if old.user_id=owner and (tg_op='DELETE' or new.role is distinct from 'owner')
 and exists(select 1 from public.friend_groups where id=old.group_id) then raise exception 'Group owner membership cannot be removed'; end if;
 if tg_op='UPDATE' and new.role not in ('owner','admin','member') then raise exception 'Invalid member role'; end if;
 if tg_op='UPDATE' and new.role='owner' and new.user_id is distinct from owner then raise exception 'Only the group owner may hold the owner role'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function sponsorship_private.guard_group_membership() from public,anon,authenticated;
create trigger guard_group_membership before insert or update or delete on public.friend_group_members
 for each row execute function sponsorship_private.guard_group_membership();
