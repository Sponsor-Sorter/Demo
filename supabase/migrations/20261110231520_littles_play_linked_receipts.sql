-- Atomic linked-token retirement prevents a refunded replacement reviving an old receipt.
drop function public.meadow_littles_play_record(uuid,text,text,text,timestamptz,timestamptz,boolean);
create function public.meadow_littles_play_record(p_user uuid,p_account_hash text,p_token_hash text,p_state text,p_expires timestamptz,p_observed timestamptz,p_test boolean,p_linked_hash text default null) returns void language plpgsql security invoker set search_path='' as $$
declare prior meadow_littles_private.play_subscriptions; linked meadow_littles_private.play_subscriptions; lock_hash text;
begin
 if p_observed>now()+interval '2 minutes' or p_observed<now()-interval '5 minutes' or p_expires is null then raise exception 'INVALID_OBSERVATION';end if;
 if p_linked_hash is not null and (p_linked_hash!~'^[a-f0-9]{64}$' or p_linked_hash=p_token_hash) then raise exception 'INVALID_LINKED_RECEIPT';end if;
 for lock_hash in select distinct h from unnest(array[p_token_hash,p_linked_hash]) h where h is not null order by h loop
  perform pg_advisory_xact_lock(hashtextextended(lock_hash,0));
 end loop;
 perform 1 from meadow_littles_private.play_accounts a where a.user_id=p_user and a.account_hash=p_account_hash for update;
 if not found then raise exception 'PURCHASE_ACCOUNT_MISMATCH';end if;
 if p_test and not exists(select 1 from meadow_littles_private.play_testers t where t.user_id=p_user and t.expires_at>now()) then raise exception 'LICENSE_TEST_NOT_ENABLED';end if;
 select * into prior from meadow_littles_private.play_subscriptions where token_hash=p_token_hash for update;
 if found then
  if prior.user_id<>p_user then raise exception 'PURCHASE_ACCOUNT_MISMATCH';end if;
  if prior.observed_at>=p_observed then return;end if;
 end if;
 if p_linked_hash is not null then
  select * into linked from meadow_littles_private.play_subscriptions where token_hash=p_linked_hash for update;
  if found and linked.user_id<>p_user then raise exception 'PURCHASE_ACCOUNT_MISMATCH';end if;
 end if;
 insert into meadow_littles_private.play_subscriptions(token_hash,user_id,state,expires_at,observed_at,is_test)
 values(p_token_hash,p_user,p_state,p_expires,p_observed,p_test)
 on conflict(token_hash) do update set state=excluded.state,expires_at=excluded.expires_at,observed_at=excluded.observed_at,is_test=excluded.is_test;
 if p_linked_hash is not null and p_state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED') and p_expires>now() then
  update meadow_littles_private.play_subscriptions set state='SUBSCRIPTION_STATE_EXPIRED',expires_at=least(expires_at,now()),observed_at=greatest(observed_at,p_observed) where token_hash=p_linked_hash and user_id=p_user;
 end if;
end $$;
revoke all on function public.meadow_littles_play_record(uuid,text,text,text,timestamptz,timestamptz,boolean,text) from public,anon,authenticated;
grant execute on function public.meadow_littles_play_record(uuid,text,text,text,timestamptz,timestamptz,boolean,text) to service_role;
