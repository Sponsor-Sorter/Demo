do $$ declare f text; begin
 select pg_get_functiondef('meadow_private.reward_round(text,jsonb)'::regprocedure) into f;
 f:=replace(f,'coalesce(max(level) filter(where won and verified),0)+1) into baselevel from public.meadow_market_play_runs where user_id=u and game=g','coalesce(max(p.level) filter(where p.won and p.verified),0)+1) into baselevel from public.meadow_market_play_runs p where p.user_id=u and p.game=g');
 execute f;
end $$;
