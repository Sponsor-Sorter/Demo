-- Own-account display facts only. The existing claim_week transaction remains
-- the sole authority for granting a weekly prize and rejecting duplicate claims.
begin;
do $$begin
 if encode(sha256(convert_to(replace(pg_get_functiondef('public.meadow_market_play_service(text,jsonb)'::regprocedure),chr(13),''),'UTF8')),'hex')<>'1b36396e248bd7f37419a78564613b8ed9f825bdcd8ed4d1c71ea83dbf516a6b'
 then raise exception 'Review current club wrapper before adding weekly prize status';end if;
end$$;

create function meadow_private.weekly_prize_status251(p_game text,p_week date) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare u uuid:=auth.uid();wk date:=date_trunc('week',now())::date;rank_n bigint;claimed boolean;eligible boolean;state text;
begin
 perform meadow_private.control_guard('read',u);
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u)
  or exists(select 1 from meadow_private.account_deletions where user_id=u)
 then raise exception 'Account unavailable' using errcode='42501';end if;
 if p_game is null or p_game!~'^[a-z_]{1,40}$' or p_week is null or p_week>wk or p_week<>date_trunc('week',p_week)::date
 then raise exception 'Invalid leaderboard selection' using errcode='22023';end if;
 -- Exactly the verified GLOBAL dense rank used by claim_week. Friends filters,
 -- unverified records and the displayed top-100 limit cannot affect this fact.
 with best as(select user_id,max(points) points from public.meadow_market_play_runs
  where verified and week=p_week and game=p_game group by user_id),
 ranks as(select user_id,dense_rank() over(order by points desc) place from best)
 select place into rank_n from ranks where user_id=u;
 select exists(select 1 from public.meadow_market_economy_receipts
  where user_id=u and claim_key='week:'||p_week||':'||p_game) into claimed;
 eligible:=p_week<wk and rank_n between 1 and 10 and not claimed;
 state:=case when claimed then 'claimed' when p_week=wk then 'in_progress'
  when rank_n is null then 'no_score' when rank_n>10 then 'outside_top_ten' else 'eligible' end;
 return jsonb_build_object('version',251,'verified',true,'game',p_game,'week',p_week,
  'rank',rank_n,'claimed',claimed,'eligible',coalesce(eligible,false),'status',state,
  'gems',case when rank_n between 1 and 10 then case rank_n when 1 then 150 when 2 then 100 when 3 then 50 else 20 end else 0 end,
  'gold',case when rank_n between 1 and 10 then case rank_n when 1 then 500 when 2 then 300 when 3 then 150 else 75 end else 0 end);
end$$;
revoke all on function meadow_private.weekly_prize_status251(text,date) from public,anon,authenticated,service_role;
grant execute on function meadow_private.weekly_prize_status251(text,date) to authenticated;

create or replace function public.meadow_market_play_service(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform meadow_private.control_guard(case when p_action='status' then 'read' when p_action in('board','score') then 'ranked' else 'play' end,auth.uid());
 result:=meadow_private.play_service(p_action,p_data);
 if p_action='status' then result:=result||jsonb_build_object('receipt_summary',meadow_private.receipt_summary237());end if;
 if p_action='boards' then result:=result||jsonb_build_object('weekly_prize',meadow_private.weekly_prize_status251(p_data->>'game',(result->>'week')::date));end if;
 return result;
end$$;
commit;
