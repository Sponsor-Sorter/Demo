alter table public.sponsorship_orders add column offer_kind text not null default 'private' check(offer_kind in ('private','group')),
 add column group_id uuid references public.friend_groups(id),
 add column group_offer_id uuid unique references public.group_offers(id);

create function public.prepare_group_sponsorship_order(offer jsonb,request_id uuid) returns public.sponsorship_orders
language plpgsql security definer set search_path='' as $$
declare sponsor public.users_extended_data; g public.friend_groups; d public.group_offers; result public.sponsorship_orders; cents bigint;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required'; end if;
 select * into strict sponsor from public.users_extended_data where user_id=auth.uid() and "userType"='sponsor' and not coalesce(banned,false);
 if request_id is null or jsonb_typeof(offer) is distinct from 'object' then raise exception 'Offer details required'; end if;
 select * into result from public.sponsorship_orders o where o.sponsor_user_id=auth.uid() and o.request_id=prepare_group_sponsorship_order.request_id;
 if found then
  if result.offer_kind<>'group' then raise exception 'Request belongs to a different purchase'; end if;
  return result;
 end if;
 d:=jsonb_populate_record(null::public.group_offers,offer);
 select * into strict g from public.friend_groups where id=d.group_id and allow_offers;
 if g.owner_id=auth.uid() then raise exception 'Cannot sponsor your own group'; end if;
 if d.offer_amount is null or d.offer_amount::text in ('NaN','Infinity','-Infinity') or d.offer_amount<=0 or d.offer_amount>909090.90 or round(d.offer_amount,2)<>d.offer_amount then raise exception 'Invalid budget'; end if;
 if length(trim(coalesce(d.offer_title,''))) not between 3 and 160 or length(trim(coalesce(d.offer_description,''))) not between 10 and 10000 or d.deadline is null or d.deadline<current_date or coalesce(cardinality(d.platforms),0) not between 1 and 12 then raise exception 'Check title, description, deadline and platforms'; end if;
 if length(coalesce(d.instructions,''))>10000 or length(coalesce(d.job_type,''))>100 or length(coalesce(d.deliverable_type,''))>100 or coalesce(cardinality(d.offer_images),0)>10 then raise exception 'Offer details are too long'; end if;
 cents:=(d.offer_amount*100)::bigint;
 insert into public.sponsorship_orders(sponsor_user_id,creator_user_id,request_id,amount_cents,fee_cents,source,offer_kind,group_id,draft)
 values(sponsor.user_id,g.owner_id,request_id,cents,round(cents::numeric/10)::bigint,'stripe','group',g.id,
 jsonb_build_object('group_id',g.id,'sponsor_id',sponsor.user_id,'sponsor_username',sponsor.username,'sponsor_email',sponsor.email,'sponsor_company',sponsor.company_name,'offer_title',trim(d.offer_title),'offer_description',trim(d.offer_description),'payment_schedule',d.payment_schedule,'job_type',d.job_type,'deliverable_type',d.deliverable_type,'instructions',d.instructions,'sponsorship_duration',d.sponsorship_duration,'deadline',d.deadline,'offer_images',coalesce(d.offer_images,'{}'::text[]),'optional_file',d.optional_file,'platforms',d.platforms)) returning * into result;
 return result;
end; $$;
revoke all on function public.prepare_group_sponsorship_order(jsonb,uuid) from public,anon;
grant execute on function public.prepare_group_sponsorship_order(jsonb,uuid) to authenticated;

alter function sponsorship_private.materialize_order(uuid) rename to materialize_private_order;
create function sponsorship_private.materialize_order(order_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.sponsorship_orders; d public.group_offers; result uuid;
begin
 select * into strict o from public.sponsorship_orders where id=order_id for update;
 if o.offer_kind='private' then return sponsorship_private.materialize_private_order(order_id); end if;
 if o.group_offer_id is not null then return o.group_offer_id; end if;
 if o.status<>'funded' then raise exception 'Funding has not been confirmed'; end if;
 d:=jsonb_populate_record(null::public.group_offers,o.draft);
 insert into public.group_offers(group_id,sponsor_id,sponsor_username,sponsor_email,sponsor_company,offer_title,offer_description,offer_amount,payment_schedule,job_type,deliverable_type,instructions,sponsorship_duration,deadline,offer_images,optional_file,platforms,status,stripe_session_id,stripe_payment_status)
 values(o.group_id,o.sponsor_user_id,d.sponsor_username,d.sponsor_email,d.sponsor_company,d.offer_title,d.offer_description,o.amount_cents::numeric/100,d.payment_schedule,d.job_type,d.deliverable_type,d.instructions,d.sponsorship_duration,d.deadline,d.offer_images,d.optional_file,d.platforms,'pending',o.stripe_session_id,'paid') returning id into result;
 update public.sponsorship_orders set group_offer_id=result where id=order_id;
 return result;
end; $$;
revoke all on function sponsorship_private.materialize_order(uuid) from public,anon,authenticated;

create or replace function public.fund_sponsorship_checkout(order_id uuid,session_id text,payment_intent_id text,paid_cents bigint,paid_currency text) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.sponsorship_orders;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Server only'; end if;
 select * into strict o from public.sponsorship_orders where id=order_id for update;
 if o.source<>'stripe' or o.stripe_session_id is distinct from session_id or o.total_cents is distinct from paid_cents or o.currency is distinct from paid_currency or payment_intent_id is null or payment_intent_id !~ '^pi_[A-Za-z0-9]+$' then raise exception 'Checkout does not match purchase'; end if;
 if o.status='funded' then
  if o.stripe_payment_intent_id is distinct from payment_intent_id then raise exception 'Payment mismatch'; end if;
  return coalesce(o.offer_id,o.group_offer_id);
 end if;
 update public.sponsorship_orders set status='funded',funded_at=now(),stripe_payment_intent_id=payment_intent_id where id=order_id;
 return sponsorship_private.materialize_order(order_id);
end; $$;

-- A real funding record must also be present; client-supplied paid flags are insufficient.
create function sponsorship_private.guard_new_group_funding() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','service_role') then raise exception 'Use verified group checkout to create an offer'; end if;
 return NEW;
end; $$;
revoke all on function sponsorship_private.guard_new_group_funding() from public,anon,authenticated;
create trigger guard_new_group_funding before insert on public.group_offers for each row execute function sponsorship_private.guard_new_group_funding();

alter table sponsorship_private.settlements drop constraint settlements_order_id_key;
alter table sponsorship_private.settlements add constraint settlements_order_creator_key unique(order_id,creator_user_id);

create function public.claim_group_sponsorship_settlement(p_agreement_id uuid,p_admin_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.sponsorship_orders; agreement public.private_offers; g public.group_offers; response public.group_offer_responses; result sponsorship_private.settlements; destination text; live boolean; cents bigint; position integer;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Server only'; end if;
 if not exists(select 1 from public.users_extended_data where user_id=p_admin_id and is_admin and not coalesce(banned,false)) then raise exception 'Administrator required'; end if;
 select * into strict response from public.group_offer_responses where private_offer_id=p_agreement_id;
 select * into strict o from public.sponsorship_orders where group_offer_id=response.offer_id and offer_kind='group' for update;
 select * into result from sponsorship_private.settlements where order_id=o.id and creator_user_id=response.member_user_id;
 if found and result.status='transferred' then return to_jsonb(result); end if;
 if o.source<>'stripe' or o.status<>'funded' or o.stripe_payment_intent_id is null or o.refunded_cents>0 or o.disputed or o.payment_review_required then raise exception 'Verified funding without a review hold is required'; end if;
 select * into strict agreement from public.private_offers where id=p_agreement_id for update;
 if agreement.stage<>4 or agreement.status<>'completed' or not coalesce(agreement.sponsor_live_confirmed,false) or not coalesce(agreement.sponsee_live_confirmed,false) or agreement.sponsee_id is distinct from response.member_user_id then raise exception 'Both participants must confirm completion'; end if;
 select * into strict g from public.group_offers where id=o.group_offer_id;
 position:=array_position(g.participant_user_ids,response.member_user_id);
 if position is null or g.offer_amount*100<>o.amount_cents then raise exception 'Allocation requires review'; end if;
 cents:=floor(o.amount_cents::numeric/cardinality(g.participant_user_ids))::bigint+case when position<=mod(o.amount_cents,cardinality(g.participant_user_ids)) then 1 else 0 end;
 if agreement.offer_amount*100<>cents then raise exception 'Agreement does not match funded allocation'; end if;
 live:=o.stripe_session_id like 'cs_live_%';
 select stripe_account_id into destination from sponsorship_private.connected_recipients where creator_user_id=response.member_user_id and livemode=live;
 if destination is null then raise exception 'Verified payment recipient required'; end if;
 if result.id is null then
  insert into sponsorship_private.settlements(order_id,creator_user_id,destination,amount_cents,currency,livemode,claimed_by)
  values(o.id,response.member_user_id,destination,cents,o.currency,live,p_admin_id) returning * into result;
 end if;
 return to_jsonb(result)||jsonb_build_object('payment_intent_id',o.stripe_payment_intent_id,'total_cents',o.total_cents);
end; $$;
revoke all on function public.claim_group_sponsorship_settlement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_group_sponsorship_settlement(uuid,uuid) to service_role;

create or replace function public.claim_sponsorship_settlement(p_order_id uuid,p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.sponsorship_orders; agreement public.private_offers; result sponsorship_private.settlements; destination text; live boolean;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Server only'; end if;
 if not exists(select 1 from public.users_extended_data where user_id=p_admin_id and is_admin and not coalesce(banned,false)) then raise exception 'Administrator required'; end if;
 select * into strict o from public.sponsorship_orders where id=p_order_id for update;
 if o.offer_kind<>'private' then raise exception 'Use group agreement settlement'; end if;
 select * into result from sponsorship_private.settlements where order_id=o.id;
 if found and result.status='transferred' then return to_jsonb(result); end if;
 if o.source<>'stripe' or o.status<>'funded' or o.stripe_payment_intent_id is null or o.offer_id is null then raise exception 'Verified Stripe funding required'; end if;
 if o.refunded_cents>0 or o.disputed or o.payment_review_required then raise exception 'Payment is on review hold'; end if;
 select * into strict agreement from public.private_offers where id=o.offer_id for update;
 if agreement.stage<>4 or agreement.status<>'completed' or not coalesce(agreement.sponsor_live_confirmed,false) or not coalesce(agreement.sponsee_live_confirmed,false) then raise exception 'Both participants must confirm completion'; end if;
 live:=o.stripe_session_id like 'cs_live_%';
 select stripe_account_id into destination from sponsorship_private.connected_recipients where creator_user_id=o.creator_user_id and livemode=live;
 if destination is null then raise exception 'Verified payment recipient required'; end if;
 if result.id is null then
  insert into sponsorship_private.settlements(order_id,creator_user_id,destination,amount_cents,currency,livemode,claimed_by)
  values(o.id,o.creator_user_id,destination,o.amount_cents,o.currency,live,p_admin_id) returning * into result;
 end if;
 return to_jsonb(result)||jsonb_build_object('payment_intent_id',o.stripe_payment_intent_id,'total_cents',o.total_cents);
end; $$;

create or replace function public.prepare_sponsorship_order(offer jsonb, payment_source text, request_id uuid)
returns public.sponsorship_orders language plpgsql security definer set search_path='' as $$
declare sponsor public.users_extended_data; creator public.users_extended_data;
 d public.private_offers; result public.sponsorship_orders; cents bigint; package jsonb;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required'; end if;
 select * into sponsor from public.users_extended_data where user_id=auth.uid() for update;
 if sponsor.id is null or sponsor."userType" is distinct from 'sponsor' or coalesce(sponsor.banned,false) then raise exception 'Sponsor account required'; end if;
 if payment_source not in ('wallet','stripe') or payment_source is null or request_id is null then raise exception 'Invalid purchase request'; end if;
 select * into result from public.sponsorship_orders o where o.sponsor_user_id=auth.uid() and o.request_id=prepare_sponsorship_order.request_id;
 if found then
  if result.offer_kind<>'private' then raise exception 'Request belongs to a different purchase'; end if;
  return result;
 end if;
 if jsonb_typeof(offer)<>'object' or offer is null then raise exception 'Offer details required'; end if;
 d:=jsonb_populate_record(null::public.private_offers,offer);
 select * into creator from public.users_extended_data where user_id=d.sponsee_id;
 if creator.id is null or creator."userType" is distinct from 'besponsored' or coalesce(creator.banned,false) or creator.user_id=sponsor.user_id then raise exception 'Creator account unavailable'; end if;
 if offer->>'package_id' is not null then
  select to_jsonb(p) into package from public.creator_packages p where p.id=(offer->>'package_id')::uuid and p.creator_user_id=creator.user_id and p.published and p.availability<>'paused'
   and exists(select 1 from public.public_user_profiles v where v.user_id=creator.user_id);
  if package is null then raise exception 'Package is unavailable'; end if;
  if d.offer_amount*100 is distinct from (package->>'price_cents')::numeric then raise exception 'Package price changed. Review it before paying'; end if;
  d.platforms:=array(select jsonb_array_elements_text(package->'platforms'));
  d.offer_description:=(package->>'deliverables')||E'\n\nIncluded revisions: '||(package->>'revisions')||E'\nTurnaround in days: '||(package->>'turnaround_days')||E'\nUsage permissions: '||(package->>'usage_rights')||E'\n\nAdditional brief: '||coalesce(d.offer_description,'');
 end if;
 if d.offer_amount is null or d.offer_amount::text in ('NaN','Infinity','-Infinity') or d.offer_amount<=0 or d.offer_amount>909090.90 or round(d.offer_amount,2)<>d.offer_amount then raise exception 'Invalid offer amount'; end if;
 if length(trim(coalesce(d.offer_title,''))) not between 3 and 160 or length(trim(coalesce(d.offer_description,''))) not between 10 and 10000
 or d.deadline is null or d.deadline<current_date or coalesce(cardinality(d.platforms),0) not between 1 and 12 then raise exception 'Check title, description, deadline and platforms'; end if;
 if length(coalesce(d.instructions,''))>10000 or length(coalesce(d.job_type,''))>100 or length(coalesce(d.deliverable_type,''))>100 or coalesce(cardinality(d.offer_images),0)>10 then raise exception 'Offer details are too long'; end if;
 cents:=(d.offer_amount*100)::bigint;
 insert into public.sponsorship_orders(sponsor_user_id,creator_user_id,request_id,amount_cents,fee_cents,source,draft)
 values(sponsor.user_id,creator.user_id,request_id,cents,round(cents::numeric/10)::bigint,payment_source,
 jsonb_build_object('sponsor_id',sponsor.id,'sponsee_id',creator.user_id,'sponsor_email',sponsor.email,'sponsee_email',creator.email,
 'sponsor_username',sponsor.username,'sponsee_username',creator.username,'sponsor_company',sponsor.company_name,
 'offer_title',trim(d.offer_title),'offer_description',trim(d.offer_description),'job_type',d.job_type,
 'deliverable_type',d.deliverable_type,'instructions',d.instructions,'deadline',d.deadline,
 'offer_images',coalesce(d.offer_images,'{}'::text[]),'optional_file',d.optional_file,'platforms',d.platforms,'package_snapshot',package)) returning * into result;
 if payment_source='wallet' then
  if not public.use_wallet_funds(sponsor.id,result.total_cents::numeric/100) then raise exception 'Insufficient available wallet balance'; end if;
  update public.sponsorship_orders set status='funded',funded_at=now() where id=result.id;
  perform sponsorship_private.materialize_order(result.id);
  select * into result from public.sponsorship_orders where id=result.id;
 end if;
 return result;
end; $$;
