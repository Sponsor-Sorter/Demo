-- Provider facts are recorded separately from workflow completion and payouts.
alter table public.sponsorship_orders
 add column checkout_expired boolean not null default false,
 add column refunded_cents bigint not null default 0 check(refunded_cents>=0 and refunded_cents<=total_cents),
 add column disputed boolean not null default false,
 add column payment_review_required boolean not null default false;

create table sponsorship_private.payment_events (
 event_id text primary key check(event_id ~ '^evt_[A-Za-z0-9]+$'),
 order_id uuid not null references public.sponsorship_orders(id),
 event_type text not null,
 created_at timestamptz not null default now()
);
alter table sponsorship_private.payment_events enable row level security;
revoke all on sponsorship_private.payment_events from public,anon,authenticated;

create function public.record_sponsorship_payment_event(
 event_id text,event_type text,session_id text default null,
 payment_intent_id text default null,refund_cents bigint default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare o public.sponsorship_orders;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'Server only'; end if;
 if event_type not in ('checkout.session.expired','checkout.session.async_payment_failed','charge.refunded','charge.dispute.created','charge.dispute.closed') then raise exception 'Unsupported payment event'; end if;
 select * into o from public.sponsorship_orders s
 where s.source='stripe' and ((session_id is not null and s.stripe_session_id=session_id)
 or (payment_intent_id is not null and s.stripe_payment_intent_id=payment_intent_id)) for update;
 if not found then return false; end if;
 if event_type='charge.refunded' and (refund_cents is null or refund_cents<0 or refund_cents>o.total_cents) then raise exception 'Invalid refund amount'; end if;
 insert into sponsorship_private.payment_events(event_id,order_id,event_type)
 values(event_id,o.id,event_type) on conflict do nothing;
 if not found then return true; end if;
 update public.sponsorship_orders s set
 checkout_expired=s.checkout_expired or (event_type='checkout.session.expired' and s.status='pending'),
 refunded_cents=case when event_type='charge.refunded' then greatest(s.refunded_cents,refund_cents) else s.refunded_cents end,
 disputed=s.disputed or event_type='charge.dispute.created',
 payment_review_required=s.payment_review_required or event_type in ('charge.refunded','charge.dispute.created','charge.dispute.closed')
 where s.id=o.id;
 -- Dispute closure never releases money automatically. A verified reconciliation is required.
 return true;
end; $$;
revoke all on function public.record_sponsorship_payment_event(text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.record_sponsorship_payment_event(text,text,text,text,bigint) to service_role;
