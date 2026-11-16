-- Depends on Root's reviewed fairplay-gift-codes-v1 core/private schema.
-- Preparation only: Root reviews this exact source before any hosted apply.
begin;
create function fairplay_gifts_private.meadow_eligible_v1(p_user uuid,p_kind text)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(
  p_user is not null and p_user=auth.uid() and p_kind in ('currency','entitlement')
  and meadow_private.control_session() is not null
  and exists(select 1 from auth.users u where u.id=p_user and not coalesce(u.is_anonymous,false)
    and (u.banned_until is null or u.banned_until<=now()))
  and exists(select 1 from public.meadow_market_profiles p where p.user_id=p_user)
  and not exists(select 1 from meadow_private.account_deletions d where d.user_id=p_user)
  and not exists(select 1 from public.fairplay_admin_moderation_decisions d
    where d.app='meadow' and d.target=p_user and d.kind='moderation.ban'
      and d.revoked_at is null and d.starts_at<=now() and (d.expires_at is null or d.expires_at>now()))
  -- Like control_guard: absent configuration is not maintenance. A configured
  -- maintenance window still permits a session admitted before it started.
  and not exists(select 1 from public.fairplay_admin_runtime r where r.app='meadow'
    and r.maintenance and not exists(select 1 from meadow_private.control_admissions a
      where a.user_id=p_user and a.session_id=meadow_private.control_session()
        and a.admitted_at<r.updated_at))
 ,false)
$$;
alter function fairplay_gifts_private.meadow_eligible_v1(uuid,text) owner to postgres;
revoke all on function fairplay_gifts_private.meadow_eligible_v1(uuid,text) from public,anon,authenticated,service_role;

create function fairplay_gifts_private.meadow_currency_v1(
 p_user uuid,p_currency text,p_amount bigint,p_redemption uuid
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 cap bigint; prior public.meadow_market_economy_receipts; payload jsonb; result jsonb;
 wallet public.meadow_market_wallets; gold numeric; pending_gold numeric;
begin
 if not fairplay_gifts_private.meadow_eligible_v1(p_user,'currency') then
  raise exception 'MEADOW_GIFT_ACCOUNT_NOT_READY' using errcode='42501';
 end if;
 cap:=case p_currency when 'gems' then 100000 when 'gold' then 1000000 when 'reward_turns' then 10000 else 0 end;
 if p_redemption is null or p_currency is null or p_amount is null or p_amount<1 or p_amount>cap then
  raise exception 'MEADOW_GIFT_INVALID_REWARD' using errcode='22023';
 end if;
 payload:=jsonb_build_object('gift_code',jsonb_build_object('contract','fairplay-gift-codes-v1',
   'redemption',p_redemption,'currency',p_currency,'amount',p_amount));
 if p_currency='gold' then payload:=payload||jsonb_build_object('gold',p_amount);end if;
 result:=jsonb_build_object('currency',p_currency,'amount',p_amount,'receipt_id',p_redemption,
   'delivery',case when p_currency='gold' then 'server_receipt' else 'credited' end);

 -- Same wallet-first ordering used by farm/receipt commands. The central code
 -- row is already locked by Root; this adapter never makes another code call.
 insert into public.meadow_market_wallets(user_id) values(p_user) on conflict do nothing;
 select * into strict wallet from public.meadow_market_wallets where user_id=p_user for update;
 select * into prior from public.meadow_market_economy_receipts where id=p_redemption;
 if found then
  if prior.user_id is distinct from p_user or prior.request_id is distinct from p_redemption or prior.kind is distinct from 'gift_code'
    or prior.claim_key is distinct from 'gift-code-v1:'||p_redemption::text or prior.delivery is distinct from payload then
   raise exception 'MEADOW_GIFT_RECEIPT_CONFLICT' using errcode='22023';
  end if;
  return result;
 end if;
 if exists(select 1 from public.meadow_market_economy_receipts
   where user_id=p_user and (request_id=p_redemption or claim_key='gift-code-v1:'||p_redemption::text)) then
  raise exception 'MEADOW_GIFT_RECEIPT_CONFLICT' using errcode='22023';
 end if;
 if (p_currency='gems' and wallet.gems::bigint>2147483647-p_amount)
   or (p_currency='reward_turns' and wallet.reward_turns::bigint>2147483647-p_amount) then
  raise exception 'MEADOW_GIFT_BALANCE_LIMIT' using errcode='22003';
 end if;
 if p_currency='gold' then
  select coalesce((s.save_data->>'coins')::numeric,0) into gold
   from public.meadow_market_saves s where s.user_id=p_user;
  select coalesce(sum(greatest(coalesce((e.delivery->>'gold')::numeric,0),0)),0) into pending_gold
   from public.meadow_market_economy_receipts e where e.user_id=p_user
    and not exists(select 1 from meadow_private.farm_reward_deliveries d where d.receipt_id=e.id);
  -- The existing verified action reducer accepts at most 1e12 farm coins.
  if coalesce(gold,0)+pending_gold+p_amount>1000000000000 then
   raise exception 'MEADOW_GIFT_BALANCE_LIMIT' using errcode='22003';
  end if;
 end if;
 insert into public.meadow_market_economy_receipts(id,user_id,request_id,kind,claim_key,delivery)
  values(p_redemption,p_user,p_redemption,'gift_code','gift-code-v1:'||p_redemption::text,payload);
 if p_currency='gems' then
  update public.meadow_market_wallets set gems=(gems::bigint+p_amount)::integer,updated_at=now() where user_id=p_user;
 elsif p_currency='reward_turns' then
  update public.meadow_market_wallets set reward_turns=(reward_turns::bigint+p_amount)::integer,updated_at=now() where user_id=p_user;
 end if;
 -- Gold is issued in the immutable receipt above. Only the existing verified
 -- gateway may apply it to protocol-4 farm saves and journal the delivery.
 return result;
end $$;
alter function fairplay_gifts_private.meadow_currency_v1(uuid,text,bigint,uuid) owner to postgres;
revoke all on function fairplay_gifts_private.meadow_currency_v1(uuid,text,bigint,uuid) from public,anon,authenticated,service_role;
comment on function fairplay_gifts_private.meadow_currency_v1(uuid,text,bigint,uuid)
 is 'Meadow gift-codes-v1: central-transaction-only currency receipt; no VIPXP, Premium, paid proof or client save mutation.';
commit;
