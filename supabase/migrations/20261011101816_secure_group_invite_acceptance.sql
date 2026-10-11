-- Restrict invited membership to the actual recipient and ordinary member role.
drop policy if exists "friend_group_members.insert_via_pending_invite" on public.friend_group_members;
create policy "friend_group_members.insert_via_pending_invite" on public.friend_group_members
for insert to authenticated with check (
 user_id=(select auth.uid()) and role='member' and
 exists(select 1 from public.friend_group_invites i where i.group_id=friend_group_members.group_id and i.invitee_id=(select auth.uid()) and i.status='pending')
);
create or replace function public.accept_group_invitation(invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.friend_group_invites%rowtype;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required'; end if;
 select * into invitation from public.friend_group_invites where id=invitation_id for update;
 if not found or invitation.invitee_id is distinct from auth.uid() then raise exception 'Invitation not available'; end if;
 if invitation.status='accepted' and exists(select 1 from public.friend_group_members where group_id=invitation.group_id and user_id=auth.uid()) then return invitation.group_id; end if;
 if invitation.status<>'pending' then raise exception 'Invitation is no longer pending'; end if;
 if not exists(select 1 from public.users_extended_data where user_id=auth.uid() and lower("planType")='pro' and not coalesce(banned,false)) then raise exception 'An active Pro account is required to join'; end if;
 insert into public.friend_group_members(group_id,user_id,role) values(invitation.group_id,auth.uid(),'member') on conflict(group_id,user_id) do nothing;
 update public.friend_group_invites set status='accepted',responded_at=now() where id=invitation.id;
 return invitation.group_id;
end $$;
revoke all on function public.accept_group_invitation(uuid) from public,anon;
grant execute on function public.accept_group_invitation(uuid) to authenticated;

-- Reports cannot spoof the reporter or arrive already handled.
create or replace function public.normalize_new_moderation_report()
returns trigger language plpgsql set search_path='' as $$
declare reporter_name text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if new.reason is null or length(trim(new.reason))=0 or length(new.reason)>200 or length(coalesce(new.details,''))>4000 then raise exception 'Invalid report reason or details'; end if;
 select username into reporter_name from public.users_extended_data where user_id=auth.uid();
 new:=jsonb_populate_record(new,jsonb_build_object('reporter_id',auth.uid(),'reporter_user_id',auth.uid(),'reporter_username',reporter_name,'status','pending','created_at',now(),'handled_by',null,'handled_at',null,'resolution',null));
 return new;
end $$;
revoke all on function public.normalize_new_moderation_report() from public,anon,authenticated;
create trigger normalize_new_report before insert on public.reported_users for each row execute function public.normalize_new_moderation_report();
create trigger normalize_new_report before insert on public.reported_offers for each row execute function public.normalize_new_moderation_report();
create trigger normalize_new_report before insert on public.reported_reviews for each row execute function public.normalize_new_moderation_report();
create trigger normalize_new_report before insert on public.reported_comments for each row execute function public.normalize_new_moderation_report();
