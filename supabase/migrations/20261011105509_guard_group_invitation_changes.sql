-- Freeze invitation identity and enforce valid actor-specific transitions.
create or replace function public.guard_group_invitation_change()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.id is distinct from old.id or new.group_id is distinct from old.group_id or new.inviter_id is distinct from old.inviter_id or new.invitee_id is distinct from old.invitee_id or new.created_at is distinct from old.created_at then raise exception 'Invitation identity cannot change'; end if;
 if new.status is not distinct from old.status then new.responded_at:=old.responded_at; return new; end if;
 if old.status<>'pending' then raise exception 'Invitation already answered'; end if;
 if auth.uid()=old.invitee_id and new.status in ('accepted','declined') then
   if new.status='accepted' and not exists(select 1 from public.friend_group_members where group_id=old.group_id and user_id=auth.uid()) then raise exception 'Accept invitation through the join operation'; end if;
 elsif auth.uid()=old.inviter_id and new.status='revoked' then null;
 else raise exception 'Invalid invitation transition'; end if;
 new.responded_at:=now();return new;
end $$;
revoke all on function public.guard_group_invitation_change() from public,anon,authenticated;
create trigger guard_group_invitation_change before update on public.friend_group_invites for each row execute function public.guard_group_invitation_change();
