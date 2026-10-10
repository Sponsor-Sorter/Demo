create schema if not exists sponsorship_private;
revoke all on schema sponsorship_private from public, anon;
grant usage on schema sponsorship_private to authenticated;

-- Resolve parties from protected account records, never caller-supplied comment fields.
create function sponsorship_private.offer_access(offer_key text, access_kind text default 'view')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.private_offers o
    join public.users_extended_data u on u.user_id = auth.uid()
    where o.id::text = offer_key and not coalesce(u.banned,false)
      and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
      and case access_kind
        when 'creator' then lower(u.email)=lower(o.sponsee_email)
        when 'sponsor' then lower(u.email)=lower(o.sponsor_email)
        when 'upload' then lower(u.email)=lower(o.sponsee_email)
          and o.stage in (2,3) and not coalesce(o.archived,false)
          and o.status in ('accepted','in_progress')
        else coalesce(u.is_admin,false) or lower(u.email) in (lower(o.sponsor_email),lower(o.sponsee_email))
      end
  );
$$;
revoke all on function sponsorship_private.offer_access(text,text) from public,anon;
grant execute on function sponsorship_private.offer_access(text,text) to authenticated;

create table public.offer_submissions (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.private_offers(id) on delete restrict,
 creator_id uuid not null,
 object_path text not null unique,
 original_name text not null check(length(original_name) between 1 and 180),
 mime_type text not null check(mime_type in ('video/mp4','video/webm','video/quicktime')),
 size_bytes bigint not null check(size_bytes between 1 and 52428800),
 version integer not null check(version>0),
 notes text not null default '' check(length(notes)<=4000),
 status text not null default 'pending' check(status in ('pending','approved','changes_requested')),
 feedback text not null default '' check(length(feedback)<=4000),
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(offer_id,version)
);
alter table public.offer_submissions enable row level security;
revoke all on public.offer_submissions from anon,authenticated;
grant select on public.offer_submissions to authenticated;
create policy offer_submission_participants on public.offer_submissions for select to authenticated
using(sponsorship_private.offer_access(offer_id::text,'view'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('offer-submissions','offer-submissions',false,52428800,array['video/mp4','video/webm','video/quicktime']);
-- Restrictive policies are essential: legacy Storage policies grant access across buckets.
create policy draft_read_guard on storage.objects as restrictive for select to authenticated
using(bucket_id <> 'offer-submissions' or sponsorship_private.offer_access(split_part(name,'/',1),'view'));
create policy draft_upload_guard on storage.objects as restrictive for insert to authenticated
with check(bucket_id <> 'offer-submissions' or (
  sponsorship_private.offer_access(split_part(name,'/',1),'upload')
  and split_part(name,'/',2)=auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|mov)$'
));
create policy draft_no_replace on storage.objects as restrictive for update to authenticated
using(bucket_id <> 'offer-submissions') with check(bucket_id <> 'offer-submissions');
create policy draft_delete_guard on storage.objects as restrictive for delete to authenticated
using(bucket_id <> 'offer-submissions' or (
  owner_id=auth.uid()::text and sponsorship_private.offer_access(split_part(name,'/',1),'view')
  and not exists(select 1 from public.offer_submissions s where s.object_path=name)
));
create policy draft_read on storage.objects for select to authenticated
using(bucket_id='offer-submissions' and sponsorship_private.offer_access(split_part(name,'/',1),'view'));
create policy draft_upload on storage.objects for insert to authenticated
with check(bucket_id='offer-submissions' and sponsorship_private.offer_access(split_part(name,'/',1),'upload'));
create policy draft_delete_orphan on storage.objects for delete to authenticated
using(bucket_id='offer-submissions' and owner_id=auth.uid()::text);

create function public.submit_offer_video(p_offer_id uuid,p_object_path text,p_original_name text,p_notes text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare asset storage.objects; result_id uuid; next_version integer;
begin
 if auth.uid() is null or not sponsorship_private.offer_access(p_offer_id::text,'upload') then
   raise exception 'Only the creator can submit drafts for an accepted offer'; end if;
 perform 1 from public.private_offers where id=p_offer_id for update;
 -- Recheck after the lock: publishing and submitting must serialize.
 if not sponsorship_private.offer_access(p_offer_id::text,'upload') then raise exception 'Offer no longer accepts drafts'; end if;
 select id into result_id from public.offer_submissions where object_path=p_object_path and offer_id=p_offer_id and creator_id=auth.uid();
 if result_id is not null then return result_id; end if;
 if split_part(p_object_path,'/',1)<>p_offer_id::text or split_part(p_object_path,'/',2)<>auth.uid()::text then
   raise exception 'Invalid draft location'; end if;
 select * into asset from storage.objects where bucket_id='offer-submissions' and name=p_object_path;
 if asset.id is null or asset.owner_id is distinct from auth.uid()::text then raise exception 'Upload not found'; end if;
 select coalesce(max(version),0)+1 into next_version from public.offer_submissions where offer_id=p_offer_id;
 if next_version>50 then raise exception 'Draft limit reached; contact support'; end if;
 insert into public.offer_submissions(offer_id,creator_id,object_path,original_name,mime_type,size_bytes,version,notes)
 values(p_offer_id,auth.uid(),p_object_path,p_original_name,asset.metadata->>'mimetype',
   (asset.metadata->>'size')::bigint,next_version,coalesce(p_notes,'')) returning id into result_id;
 return result_id;
end;
$$;
create function public.review_offer_video(p_submission_id uuid,p_decision text,p_feedback text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare submission public.offer_submissions; parent_id uuid;
begin
 select offer_id into parent_id from public.offer_submissions where id=p_submission_id;
 if auth.uid() is null or not sponsorship_private.offer_access(parent_id::text,'sponsor') then raise exception 'Only the sponsor can review this draft'; end if;
 perform 1 from public.private_offers where id=parent_id for update;
 select * into submission from public.offer_submissions where id=p_submission_id for update;
 if p_decision not in ('approved','changes_requested') then raise exception 'Invalid review decision'; end if;
 if submission.status=p_decision and submission.reviewed_by=auth.uid() then return; end if;
 if submission.status<>'pending' or submission.version<>(select max(version) from public.offer_submissions where offer_id=parent_id) then
   raise exception 'Only the latest pending draft can be reviewed'; end if;
 if not exists(select 1 from public.private_offers where id=parent_id and stage in (2,3) and not coalesce(archived,false)) then
   raise exception 'Offer no longer accepts draft reviews'; end if;
 if p_decision='changes_requested' and length(trim(coalesce(p_feedback,'')))=0 then raise exception 'Describe the requested changes'; end if;
 update public.offer_submissions set status=p_decision, feedback=coalesce(p_feedback,''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_submission_id;
end;
$$;
revoke all on function public.submit_offer_video(uuid,text,text,text),public.review_offer_video(uuid,text,text) from public,anon;
grant execute on function public.submit_offer_video(uuid,text,text,text),public.review_offer_video(uuid,text,text) to authenticated;

-- A submitted draft must be approved before publishing, including direct API writes.
create function sponsorship_private.require_draft_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare decision text;
begin
 if new.stage>=4 or new.status in ('live','completed','review_completed','review-completed') then
   select status into decision from public.offer_submissions where offer_id=old.id order by version desc limit 1;
   if decision is not null and decision<>'approved' then raise exception 'The sponsor must approve the latest video draft before publishing'; end if;
 end if;
 return new;
end;
$$;
revoke all on function sponsorship_private.require_draft_approval() from public,anon,authenticated;
create trigger require_offer_draft_approval before update on public.private_offers
for each row execute function sponsorship_private.require_draft_approval();

-- Existing permissive comment policies cannot authorize unrelated users.
create policy comment_party_guard on public.private_offer_comments as restrictive for all to authenticated
using(sponsorship_private.offer_access(offer_id::text,'view'))
with check(sponsorship_private.offer_access(offer_id::text,'view') and user_id=auth.uid());
-- Agreed parties and prices cannot be rewritten through the browser after creation.
create function sponsorship_private.protect_offer_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is not null and not exists(select 1 from public.users_extended_data where user_id=auth.uid() and is_admin and not coalesce(banned,false)) then
   if row(new.sponsor_id,new.sponsee_id,new.sponsor_email,new.sponsee_email,new.offer_amount,new.payment_schedule,new.group_offer,new.payout_status,new.payout_id)
      is distinct from row(old.sponsor_id,old.sponsee_id,old.sponsor_email,old.sponsee_email,old.offer_amount,old.payment_schedule,old.group_offer,old.payout_status,old.payout_id) then
     raise exception 'Agreed parties and payment terms cannot be changed';
   end if;
 end if;
 return new;
end;
$$;
revoke all on function sponsorship_private.protect_offer_terms() from public,anon,authenticated;
create trigger protect_private_offer_terms before update on public.private_offers
for each row execute function sponsorship_private.protect_offer_terms();
create function sponsorship_private.validate_published_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare i integer; host text; platform text;
begin
 if (old.stage<4 and new.stage>=4) or new.live_urls is distinct from old.live_urls or new.url_dates is distinct from old.url_dates then
  if coalesce(cardinality(new.platforms),0)=0 or cardinality(new.live_urls) is distinct from cardinality(new.platforms)
     or cardinality(new.url_dates) is distinct from cardinality(new.platforms) then
    raise exception 'Provide a content link and date for every agreed platform';
  end if;
  for i in 1..cardinality(new.platforms) loop
   if new.live_urls[i] is null or new.live_urls[i] !~ '^https://[A-Za-z0-9.-]+/' or new.url_dates[i] is null then
     raise exception 'Each platform requires an HTTPS content URL and publication date';
   end if;
   host:=lower(substring(new.live_urls[i] from '^https://([A-Za-z0-9.-]+)/'));
   platform:=lower(trim(new.platforms[i]));
   if not (case platform
    when 'youtube' then host ~ '(^|\.)(youtube\.com|youtu\.be)$'
    when 'tiktok' then host ~ '(^|\.)tiktok\.com$'
    when 'instagram' then host ~ '(^|\.)instagram\.com$'
    when 'facebook' then host ~ '(^|\.)(facebook\.com|fb\.watch)$'
    when 'twitch' then host ~ '(^|\.)twitch\.tv$'
    when 'twitter' then host ~ '(^|\.)(twitter\.com|x\.com)$'
    when 'x' then host ~ '(^|\.)(twitter\.com|x\.com)$'
    when 'linkedin' then host ~ '(^|\.)linkedin\.com$'
    else false end) then raise exception 'Content URL does not match the agreed platform'; end if;
  end loop;
 end if;
 return new;
end;
$$;
revoke all on function sponsorship_private.validate_published_content() from public,anon,authenticated;
create trigger validate_private_offer_content before update on public.private_offers
for each row execute function sponsorship_private.validate_published_content();
create function sponsorship_private.protect_offer_comment_author()
returns trigger language plpgsql security definer set search_path = '' as $$
declare account public.users_extended_data; offer public.private_offers;
begin
 if auth.uid() is null and auth.jwt()->>'role'='service_role' then return new; end if;
 if auth.uid() is null then raise exception 'Sign in to send an offer message'; end if;
 if tg_op='UPDATE' and row(new.offer_id,new.user_id,new.created_at) is distinct from row(old.offer_id,old.user_id,old.created_at) then
  raise exception 'Message authorship cannot be reassigned'; end if;
 if new.user_id is distinct from auth.uid() or not sponsorship_private.offer_access(new.offer_id::text,'view') then
  raise exception 'Only offer participants can send messages'; end if;
 select * into account from public.users_extended_data where user_id=auth.uid() limit 1;
 select * into offer from public.private_offers where id=new.offer_id;
 new.sender:=account.username;
 new.sponsor_id:=offer.sponsor_id; new.sponsee_id:=offer.sponsee_id;
 new.sponsor_email:=offer.sponsor_email; new.sponsee_email:=offer.sponsee_email;
 if length(trim(coalesce(new.comment_text,'')))=0 or length(new.comment_text)>10000 then raise exception 'Message must contain 1–10000 characters'; end if;
 return new;
end;
$$;
revoke all on function sponsorship_private.protect_offer_comment_author() from public,anon,authenticated;
create trigger protect_private_offer_comment_author before insert or update on public.private_offer_comments
for each row execute function sponsorship_private.protect_offer_comment_author();
