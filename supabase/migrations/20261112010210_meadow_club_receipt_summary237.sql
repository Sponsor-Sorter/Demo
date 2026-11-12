-- Receipt history stays intact. Status returns only the own-account facts the
-- Emporium needs, rather than transferring thousands of historic deliveries.
begin;
do $$begin
 if encode(sha256(convert_to(replace(pg_get_functiondef('public.meadow_market_play_service(text,jsonb)'::regprocedure),chr(13),''),'UTF8')),'hex')<>'71289a15082a26f0d6502d801c385ccd3b2add5507b16b5bd7fe7237fad57ad1'
 then raise exception 'Review current play-service wrapper before adding receipt status';end if;
end$$;
create function meadow_private.receipt_summary237() returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare u uuid:=auth.uid();day text:=to_char(now(),'YYYY-MM-DD');
begin
 perform meadow_private.control_guard('read',u);
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u)
  or exists(select 1 from meadow_private.account_deletions where user_id=u)
 then raise exception 'Account unavailable' using errcode='42501';end if;
 return jsonb_build_object('version',237,'day',day,
  'vip_daily_claimed',exists(select 1 from public.meadow_market_economy_receipts where user_id=u and claim_key='vip_daily:'||day),
  'pending',exists(select 1 from public.meadow_market_economy_receipts e where e.user_id=u
   and not exists(select 1 from meadow_private.farm_reward_deliveries d where d.receipt_id=e.id)));
end$$;
revoke all on function meadow_private.receipt_summary237() from public,anon,authenticated,service_role;
grant execute on function meadow_private.receipt_summary237() to authenticated;
create or replace function public.meadow_market_play_service(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform meadow_private.control_guard(case when p_action='status' then 'read' when p_action in('board','score') then 'ranked' else 'play' end,auth.uid());
 result:=meadow_private.play_service(p_action,p_data);
 if p_action='status' then result:=result||jsonb_build_object('receipt_summary',meadow_private.receipt_summary237());end if;
 return result;
end$$;
commit;
