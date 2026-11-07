-- A delayed signed callback belongs to its nonce's UTC day, not all later days.
set local statement_timeout='15s';
create or replace function public.meadow_market_finish_ad_reward(p_nonce uuid,p_account text,p_transaction text,p_at timestamptz) returns boolean language plpgsql security definer set search_path='' as $$
declare r meadow_private.ad_rewards; rid uuid;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 if p_transaction is null or length(p_transaction) not between 8 and 256 or p_at is null then raise exception 'Invalid ad reward';end if;
 select * into r from meadow_private.ad_rewards where nonce=p_nonce for update;
 if not found or p_account is distinct from encode(sha256(convert_to('meadow-markets:'||r.user_id::text,'UTF8')),'hex') then raise exception 'Ad account mismatch';end if;
 if r.receipt_id is not null then if r.transaction_id<>p_transaction then raise exception 'Ad nonce reused';end if;return true;end if;
 if p_at<r.created_at-interval '1 minute' or p_at>r.expires_at or clock_timestamp()>r.created_at+interval '24 hours' then raise exception 'Ad reward expired';end if;
 insert into public.meadow_market_wallets(user_id) values(r.user_id) on conflict do nothing;
 perform 1 from public.meadow_market_wallets where user_id=r.user_id for update;
 if exists(select 1 from meadow_private.account_deletions where user_id=r.user_id) then raise exception 'Account unavailable';end if;
 if (select count(*) from meadow_private.ad_rewards where user_id=r.user_id and receipt_id is not null and created_at>=date_trunc('day',r.created_at at time zone 'UTC') at time zone 'UTC' and created_at<(date_trunc('day',r.created_at at time zone 'UTC')+interval '1 day') at time zone 'UTC')>=3 then raise exception 'Daily ad reward limit';end if;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(r.user_id,p_nonce,'admob_reward','admob:'||p_transaction,'{}') returning id into rid;
 update public.meadow_market_wallets set gems=gems+5,reward_turns=reward_turns+1,updated_at=now() where user_id=r.user_id;
 update meadow_private.ad_rewards set transaction_id=p_transaction,receipt_id=rid where nonce=p_nonce;
 return true;
end $$;
revoke all on function public.meadow_market_finish_ad_reward(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.meadow_market_finish_ad_reward(uuid,text,text,timestamptz) to service_role;

