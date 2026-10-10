-- Keep workflow permissions on the server, including requests from older pages.
create function sponsorship_private.guard_offer_actor()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor public.users_extended_data; creator boolean; sponsor boolean;
begin
 if auth.uid() is null then
  if auth.jwt()->>'role'='service_role' or current_setting('role') in ('none','postgres') then return new; end if;
  raise exception 'Sign in to manage sponsorships';
 end if;
 select * into actor from public.users_extended_data where user_id=auth.uid() limit 1;
 if actor.user_id is null or actor.email is null or coalesce(actor.banned,false) or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Account cannot manage sponsorships'; end if;
 if coalesce(actor.is_admin,false) then return new; end if;
 if new.stage is null or new.stage not between 1 and 5 or new.status is null then raise exception 'Invalid sponsorship state'; end if;
 if tg_op='INSERT' then
  if lower(actor.email) not in (lower(new.sponsor_email),lower(new.sponsee_email)) or new.sponsor_email is null or new.sponsee_email is null then raise exception 'Offer must belong to your account'; end if;
  if new.stage not in (1,2,3) or new.stage is null or new.status not in ('pending','accepted','in_progress') or new.status is null
     or coalesce(new.sponsor_live_confirmed,false) or coalesce(new.sponsee_live_confirmed,false)
     or new.payout_id is not null or coalesce(new.payout_status,'unpaid')<>'unpaid' then raise exception 'New offers cannot claim completion or payment'; end if;
  if new.offer_amount is null or new.offer_amount::text in ('NaN','Infinity','-Infinity') or new.offer_amount<=0 then raise exception 'Offer amount must be positive and finite'; end if;
  return new;
 end if;
 creator:=sponsorship_private.offer_access(old.id::text,'creator');
 sponsor:=sponsorship_private.offer_access(old.id::text,'sponsor');
 if not creator and not sponsor then raise exception 'Only participants can manage this offer'; end if;
 if new.stage is distinct from old.stage then
  if new.stage=5 then raise exception 'Payment completion requires verified server settlement'; end if;
  if not creator or not coalesce(((old.stage=1 and new.stage=2 and new.status='accepted') or (old.stage=2 and new.stage=3) or (old.stage=3 and new.stage=4 and new.status='live')),false) then
   raise exception 'Invalid sponsorship stage transition'; end if;
 end if;
 if row(new.creation_date,new.live_urls,new.url_dates,new.live_url,new.live_date,new.sponsee_live_confirmed)
    is distinct from row(old.creation_date,old.live_urls,old.url_dates,old.live_url,old.live_date,old.sponsee_live_confirmed) and not creator then
  raise exception 'Only the creator can submit publication details'; end if;
 if coalesce(old.sponsor_live_confirmed,false) and row(new.live_urls,new.url_dates,new.live_url,new.live_date,new.sponsee_live_confirmed)
    is distinct from row(old.live_urls,old.url_dates,old.live_url,old.live_date,old.sponsee_live_confirmed) then
  raise exception 'Confirmed publication details require support review to change'; end if;
 if new.sponsor_live_confirmed is distinct from old.sponsor_live_confirmed then
  if not sponsor or not coalesce(new.sponsor_live_confirmed,false) or old.stage<>4 or not coalesce(old.sponsee_live_confirmed,false)
     or coalesce(cardinality(old.live_urls),0)=0 then raise exception 'Only the sponsor can confirm submitted live content'; end if;
 end if;
 if new.status is distinct from old.status then
  if not coalesce(((creator and old.stage=1 and new.stage=2 and new.status='accepted')
   or (creator and old.stage=1 and new.stage=1 and new.status='rejected')
   or (creator and old.stage=3 and new.stage=4 and new.status='live' and coalesce(new.sponsee_live_confirmed,false))
   or (sponsor and old.stage=4 and new.stage=4 and new.status='completed' and coalesce(new.sponsor_live_confirmed,false))
   or (old.stage=5 and new.stage=5 and new.status in ('review_completed','review-completed'))),false) then
    raise exception 'Invalid sponsorship status transition'; end if;
 end if;
 return new;
end;
$$;
revoke all on function sponsorship_private.guard_offer_actor() from public,anon,authenticated;
create trigger guard_private_offer_actor before insert or update on public.private_offers
for each row execute function sponsorship_private.guard_offer_actor();
