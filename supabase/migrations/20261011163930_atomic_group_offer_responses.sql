-- Snapshot participant allocations once, and create responses/agreements atomically.
alter table public.group_offers add column participant_user_ids uuid[];
revoke insert,update,delete on public.group_offer_responses from anon,authenticated;

create function public.respond_group_offer(p_offer_id uuid,p_response text) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.group_offers; actor public.users_extended_data; sponsor public.users_extended_data; response public.group_offer_responses; agreement uuid; participants uuid[]; cents bigint; position integer;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required'; end if;
 select * into strict actor from public.users_extended_data where user_id=auth.uid() and "userType"='besponsored' and not coalesce(banned,false);
 select * into strict o from public.group_offers where id=p_offer_id for update;
 if not exists(select 1 from public.friend_group_members where group_id=o.group_id and user_id=auth.uid()) and not exists(select 1 from public.friend_groups where id=o.group_id and owner_id=auth.uid()) then raise exception 'Group membership required'; end if;
 if p_response not in ('accepted','rejected') or p_response is null then raise exception 'Invalid response'; end if;
 select * into response from public.group_offer_responses where offer_id=o.id and member_user_id=auth.uid();
 if response.private_offer_id is not null then
  if p_response='accepted' then return response.private_offer_id; end if;
  raise exception 'An accepted agreement cannot be rejected here';
 end if;
 if coalesce(o.status,'pending') not in ('pending','accepted','active') or o.deadline<current_date then raise exception 'Offer is closed'; end if;
 if p_response='rejected' then
  insert into public.group_offer_responses(group_id,offer_id,member_user_id,status,rejected_at)
  values(o.group_id,o.id,auth.uid(),'rejected',now()) on conflict(offer_id,member_user_id) do update set status='rejected',rejected_at=now();
  return null;
 end if;
 if o.offer_amount is null or o.offer_amount::text in ('NaN','Infinity','-Infinity') or o.offer_amount<=0 or round(o.offer_amount,2)<>o.offer_amount then raise exception 'Invalid group budget'; end if;
 if o.participant_user_ids is null then
  select array_agg(u.user_id order by u.user_id) into participants from public.users_extended_data u
  where u."userType"='besponsored' and not coalesce(u.banned,false)
  and (exists(select 1 from public.friend_group_members m where m.group_id=o.group_id and m.user_id=u.user_id) or exists(select 1 from public.friend_groups g where g.id=o.group_id and g.owner_id=u.user_id))
  and not exists(select 1 from public.group_offer_responses r where r.offer_id=o.id and r.member_user_id=u.user_id and r.status='rejected');
  update public.group_offers set participant_user_ids=participants where id=o.id;
 else participants:=o.participant_user_ids; end if;
 position:=array_position(participants,auth.uid());
 if position is null then raise exception 'You are not included in this offer allocation'; end if;
 cents:=floor(o.offer_amount*100/cardinality(participants))::bigint+case when position<=mod((o.offer_amount*100)::bigint,cardinality(participants)) then 1 else 0 end;
 if cents<1 then raise exception 'Budget is too small for the group'; end if;
 select * into strict sponsor from public.users_extended_data where user_id=o.sponsor_id or id=o.sponsor_id limit 1;
 if coalesce(sponsor.banned,false) then raise exception 'Sponsor is unavailable'; end if;
 insert into public.private_offers(sponsor_id,sponsee_id,sponsor_email,sponsee_email,sponsor_username,sponsee_username,sponsor_company,offer_title,offer_description,offer_amount,offer_images,platforms,job_type,deliverable_type,payment_schedule,sponsorship_duration,deadline,instructions,optional_file,creation_date,status,active,group_offer,stage,payout_status,sponsee_live_confirmed,sponsor_live_confirmed)
 values(sponsor.id,actor.user_id,sponsor.email,actor.email,sponsor.username,actor.username,sponsor.company_name,o.offer_title,o.offer_description,cents::numeric/100,o.offer_images,o.platforms,o.job_type,o.deliverable_type,o.payment_schedule,o.sponsorship_duration,o.deadline,o.instructions,o.optional_file,current_date,'accepted',true,'true',2,'unpaid',false,false) returning id into agreement;
 insert into public.group_offer_responses(group_id,offer_id,member_user_id,status,accepted_at,private_offer_id)
 values(o.group_id,o.id,auth.uid(),'accepted',now(),agreement) on conflict(offer_id,member_user_id) do update set status='accepted',accepted_at=now(),rejected_at=null,private_offer_id=agreement;
 return agreement;
end; $$;
revoke all on function public.respond_group_offer(uuid,text) from public,anon;
grant execute on function public.respond_group_offer(uuid,text) to authenticated;

create function public.refresh_group_offer_completion(p_offer_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare o public.group_offers; changed integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into strict o from public.group_offers where id=p_offer_id;
 if o.sponsor_id<>auth.uid() and not exists(select 1 from public.friend_group_members where group_id=o.group_id and user_id=auth.uid()) and not exists(select 1 from public.friend_groups where id=o.group_id and owner_id=auth.uid()) then raise exception 'Group access required'; end if;
 update public.group_offer_responses r set status='completed',completed_at=now(),live_url=p.live_url
 from public.private_offers p where r.offer_id=o.id and r.private_offer_id=p.id and r.status='accepted'
 and p.sponsee_id=r.member_user_id and p.stage>=4 and p.status in ('completed','review_completed','review-completed') and p.sponsor_live_confirmed and p.sponsee_live_confirmed;
 get diagnostics changed=row_count; return changed;
end; $$;
revoke all on function public.refresh_group_offer_completion(uuid) from public,anon;
grant execute on function public.refresh_group_offer_completion(uuid) to authenticated;

create function sponsorship_private.guard_group_offer_terms() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user in ('postgres','service_role') then return coalesce(NEW,OLD); end if;
 if TG_OP='DELETE' then
  if exists(select 1 from public.group_offer_responses where offer_id=OLD.id and private_offer_id is not null) then raise exception 'Accepted agreements must be retained'; end if;
  return OLD;
 end if;
 if NEW.participant_user_ids is distinct from OLD.participant_user_ids then raise exception 'Participant allocations are server managed'; end if;
 if row(NEW.stripe_session_id,NEW.stripe_payment_status) is distinct from row(OLD.stripe_session_id,OLD.stripe_payment_status) then raise exception 'Only the payment service can confirm funding'; end if;
 if NEW.status='completed' and OLD.status is distinct from NEW.status then raise exception 'Completion requires server settlement'; end if;
 if OLD.participant_user_ids is not null and row(NEW.group_id,NEW.sponsor_id,NEW.offer_amount,NEW.platforms,NEW.offer_title,NEW.offer_description,NEW.deadline,NEW.payment_schedule,NEW.instructions)
 is distinct from row(OLD.group_id,OLD.sponsor_id,OLD.offer_amount,OLD.platforms,OLD.offer_title,OLD.offer_description,OLD.deadline,OLD.payment_schedule,OLD.instructions) then raise exception 'Accepted group terms cannot change'; end if;
 return NEW;
end; $$;
revoke all on function sponsorship_private.guard_group_offer_terms() from public,anon,authenticated;
create trigger guard_group_offer_terms before update or delete on public.group_offers for each row execute function sponsorship_private.guard_group_offer_terms();
