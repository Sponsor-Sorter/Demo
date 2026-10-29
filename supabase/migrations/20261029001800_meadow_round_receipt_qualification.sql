do $$ declare f text; begin
 select pg_get_functiondef('meadow_private.reward_round(text,jsonb)'::regprocedure) into f;
 f:=replace(f,'select count(*) into paid from public.meadow_market_economy_receipts where user_id=u and kind=''game_reward'' and delivery->>''game''=r.game and created_at>=','select count(*) into paid from public.meadow_market_economy_receipts e where e.user_id=u and e.kind=''game_reward'' and e.delivery->>''game''=r.game and e.created_at>=');
 execute f;
end $$;
