-- Transfers are tied to verified orders, never legacy wallet/test balances.
create table sponsorship_private.connected_recipients (
 creator_user_id uuid not null references auth.users(id), livemode boolean not null,
 stripe_account_id text not null check(stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
 primary key(creator_user_id,livemode), unique(stripe_account_id,livemode)
);
alter table sponsorship_private.connected_recipients enable row level security;
create table sponsorship_private.settlements (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.sponsorship_orders(id),
 creator_user_id uuid not null, destination text not null, amount_cents bigint not null check(amount_cents>0),
 currency text not null, livemode boolean not null, status text not null default 'processing' check(status in ('processing','transferred')),
 stripe_transfer_id text unique, claimed_by uuid not null, started_at timestamptz not null default now(), transferred_at timestamptz
);
alter table sponsorship_private.settlements enable row level security;
revoke all on sponsorship_private.connected_recipients,sponsorship_private.settlements from public,anon,authenticated;
grant all on sponsorship_private.connected_recipients,sponsorship_private.settlements to service_role;

create function public.claim_sponsorship_settlement(p_order_id uuid,p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.sponsorship_orders; agreement public.private_offers; result sponsorship_private.settlements; destination text; live boolean;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Server only'; end if;
 if not exists(select 1 from public.users_extended_data where user_id=p_admin_id and is_admin and not coalesce(banned,false)) then raise exception 'Administrator required'; end if;
 select * into strict o from public.sponsorship_orders where id=p_order_id for update;
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
revoke all on function public.claim_sponsorship_settlement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_sponsorship_settlement(uuid,uuid) to service_role;

create function public.record_sponsorship_transfer(p_settlement_id uuid,p_transfer_id text,p_destination text,p_amount_cents bigint,p_currency text,p_livemode boolean)
returns void language plpgsql security definer set search_path='' as $$
declare s sponsorship_private.settlements;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Server only'; end if;
 select * into strict s from sponsorship_private.settlements where id=p_settlement_id for update;
 if p_transfer_id !~ '^tr_[A-Za-z0-9]+$' or p_transfer_id is null or row(p_destination,p_amount_cents,p_currency,p_livemode) is distinct from row(s.destination,s.amount_cents,s.currency,s.livemode) then raise exception 'Transfer does not match settlement'; end if;
 if s.stripe_transfer_id is not null and s.stripe_transfer_id<>p_transfer_id then raise exception 'Transfer already recorded'; end if;
 update sponsorship_private.settlements set status='transferred',stripe_transfer_id=p_transfer_id,transferred_at=coalesce(transferred_at,now()) where id=s.id;
 -- A transfer to Stripe balance is not a bank payout. Do not label it bank-paid.
end; $$;
revoke all on function public.record_sponsorship_transfer(uuid,text,text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.record_sponsorship_transfer(uuid,text,text,bigint,text,boolean) to service_role;
