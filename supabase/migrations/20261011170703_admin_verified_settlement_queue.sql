create function public.admin_verified_settlement_queue() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.users_extended_data where user_id=auth.uid() and is_admin and not coalesce(banned,false)) then raise exception 'Administrator required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(q)) from (
 select o.id as order_id,o.offer_id,p.offer_title,p.sponsee_username as creator,o.amount_cents,o.currency,
 o.stripe_session_id like 'cs_live_%' as livemode,coalesce(s.status,'awaiting_transfer') as settlement_status,s.stripe_transfer_id,
 (o.refunded_cents>0 or o.disputed or o.payment_review_required) as review_required,
 p.stage=4 and p.status='completed' and coalesce(p.sponsor_live_confirmed,false) and coalesce(p.sponsee_live_confirmed,false) as completed,
 o.funded_at
 from public.sponsorship_orders o join public.private_offers p on p.id=o.offer_id
 left join sponsorship_private.settlements s on s.order_id=o.id and s.creator_user_id=o.creator_user_id
 where o.source='stripe' and o.status='funded' order by o.funded_at desc limit 100
 )q),'[]'::jsonb);
end; $$;
revoke all on function public.admin_verified_settlement_queue() from public,anon;
grant execute on function public.admin_verified_settlement_queue() to authenticated;
