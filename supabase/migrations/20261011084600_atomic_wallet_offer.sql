-- Server-owned purchase snapshots. Legacy offers are deliberately not backfilled.
create table public.sponsorship_orders (
 id uuid primary key default gen_random_uuid(),
 sponsor_user_id uuid not null, creator_user_id uuid not null,
 request_id uuid not null, draft jsonb not null,
 amount_cents bigint not null check(amount_cents between 1 and 90909090),
 fee_cents bigint not null check(fee_cents>=0),
 total_cents bigint generated always as (amount_cents+fee_cents) stored,
 currency text not null default 'usd' check(currency='usd'),
 source text not null check(source in ('wallet','stripe')),
 status text not null default 'pending' check(status in ('pending','funded')),
 stripe_session_id text unique, stripe_payment_intent_id text unique,
 offer_id uuid unique references public.private_offers(id),
 created_at timestamptz not null default now(), funded_at timestamptz,
 unique(sponsor_user_id,request_id), check(sponsor_user_id<>creator_user_id)
);
alter table public.sponsorship_orders enable row level security;
revoke all on public.sponsorship_orders from anon,authenticated;
grant select on public.sponsorship_orders to authenticated;
grant all on public.sponsorship_orders to service_role;
create policy order_participants on public.sponsorship_orders for select to authenticated
 using(auth.uid() in (sponsor_user_id,creator_user_id));
create index sponsorship_orders_creator on public.sponsorship_orders(creator_user_id,created_at desc);

-- Not callable through the public API. The snapshot contains only validated terms.
create function sponsorship_private.materialize_order(order_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.sponsorship_orders; d public.private_offers; result uuid;
begin
 select * into strict o from public.sponsorship_orders where id=order_id for update;
 if o.offer_id is not null then return o.offer_id; end if;
 if o.status<>'funded' then raise exception 'Funding has not been confirmed'; end if;
 d:=jsonb_populate_record(null::public.private_offers,o.draft);
 insert into public.private_offers(id,sponsor_id,sponsee_id,sponsor_email,sponsee_email,
 sponsor_username,sponsee_username,sponsor_company,offer_title,offer_description,
 offer_amount,payment_schedule,job_type,deliverable_type,instructions,sponsorship_duration,
 deadline,offer_images,optional_file,platforms,stage,status,active,archived,
 sponsee_live_confirmed,sponsor_live_confirmed,payout_status,package_snapshot)
 values(gen_random_uuid(),d.sponsor_id,d.sponsee_id,d.sponsor_email,d.sponsee_email,
 d.sponsor_username,d.sponsee_username,d.sponsor_company,d.offer_title,d.offer_description,
 o.amount_cents::numeric/100,'full_on_completion',d.job_type,d.deliverable_type,d.instructions,'One Off',
 d.deadline,d.offer_images,d.optional_file,d.platforms,1,'pending',true,false,false,false,'unpaid',o.draft->'package_snapshot')
 returning id into result;
 update public.sponsorship_orders set offer_id=result where id=order_id;
 return result;
end; $$;
revoke all on function sponsorship_private.materialize_order(uuid) from public,anon,authenticated;

create function public.prepare_sponsorship_order(offer jsonb, payment_source text, request_id uuid)
returns public.sponsorship_orders language plpgsql security definer set search_path='' as $$
declare sponsor public.users_extended_data; creator public.users_extended_data;
 d public.private_offers; result public.sponsorship_orders; cents bigint; package jsonb;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required'; end if;
 select * into sponsor from public.users_extended_data where user_id=auth.uid() for update;
 if sponsor.id is null or sponsor."userType" is distinct from 'sponsor' or coalesce(sponsor.banned,false) then raise exception 'Sponsor account required'; end if;
 if payment_source not in ('wallet','stripe') or payment_source is null or request_id is null then raise exception 'Invalid purchase request'; end if;
 select * into result from public.sponsorship_orders o where o.sponsor_user_id=auth.uid() and o.request_id=prepare_sponsorship_order.request_id;
 if found then return result; end if;
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
revoke all on function public.prepare_sponsorship_order(jsonb,text,uuid) from public,anon;
grant execute on function public.prepare_sponsorship_order(jsonb,text,uuid) to authenticated;

create function public.bind_sponsorship_checkout(order_id uuid, session_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Server only'; end if;
 if session_id is null or session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$' then raise exception 'Invalid checkout'; end if;
 update public.sponsorship_orders set stripe_session_id=session_id where id=order_id and source='stripe' and status='pending' and (stripe_session_id is null or stripe_session_id=session_id);
 if not found then raise exception 'Checkout cannot be bound'; end if;
end; $$;
revoke all on function public.bind_sponsorship_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.bind_sponsorship_checkout(uuid,text) to service_role;

create function public.fund_sponsorship_checkout(order_id uuid,session_id text,payment_intent_id text,paid_cents bigint,paid_currency text) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.sponsorship_orders;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Server only'; end if;
 select * into strict o from public.sponsorship_orders where id=order_id for update;
 if o.source<>'stripe' or o.stripe_session_id is distinct from session_id or o.total_cents is distinct from paid_cents or o.currency is distinct from paid_currency
 or payment_intent_id is null or payment_intent_id !~ '^pi_[A-Za-z0-9]+$' then raise exception 'Checkout does not match purchase'; end if;
 if o.status='funded' then
  if o.stripe_payment_intent_id is distinct from payment_intent_id then raise exception 'Payment mismatch'; end if;
  return o.offer_id;
 end if;
 update public.sponsorship_orders set status='funded',funded_at=now(),stripe_payment_intent_id=payment_intent_id where id=order_id;
 return sponsorship_private.materialize_order(order_id);
end; $$;
revoke all on function public.fund_sponsorship_checkout(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.fund_sponsorship_checkout(uuid,text,text,bigint,text) to service_role;
