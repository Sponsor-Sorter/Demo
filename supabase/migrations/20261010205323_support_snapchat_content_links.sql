create or replace function sponsorship_private.validate_published_content()
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
    when 'snapchat' then host ~ '(^|\.)snapchat\.com$'
    when 'linkedin' then host ~ '(^|\.)linkedin\.com$'
    else false end) then raise exception 'Content URL does not match the agreed platform'; end if;
  end loop;
 end if;
 return new;
end;
$$;
create or replace function sponsorship_private.protect_offer_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is not null and not exists(select 1 from public.users_extended_data where user_id=auth.uid() and is_admin and not coalesce(banned,false)) then
   if row(new.sponsor_id,new.sponsee_id,new.sponsor_email,new.sponsee_email,new.offer_amount,new.payment_schedule,new.group_offer,new.payout_status,new.payout_id,new.platforms)
      is distinct from row(old.sponsor_id,old.sponsee_id,old.sponsor_email,old.sponsee_email,old.offer_amount,old.payment_schedule,old.group_offer,old.payout_status,old.payout_id,old.platforms) then
     raise exception 'Agreed parties and payment terms cannot be changed';
   end if;
 end if;
 return new;
end;
$$;