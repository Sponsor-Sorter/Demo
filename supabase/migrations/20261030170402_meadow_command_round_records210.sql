-- Only verified round rows drive the command farm's mini-game progression.
-- A covering partial index keeps per-owner summaries off the global rankings.
create index if not exists meadow_verified_round_owner_game on public.meadow_market_play_runs(user_id,game) include(level,points,won) where verified;
do $migration$
declare body text; marker text;
begin
 body:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);
 marker:='''owned_collections'',coalesce';
 if position(marker in body)=0 then raise exception 'Review command reader before adding verified game records';end if;
 body:=replace(body,marker,$records$
 'round_records',coalesce((select jsonb_agg(jsonb_build_object('game',x.game,'level',least(1000,greatest(x.legacy_level,coalesce(x.won_level,0)+1)),'wins',x.wins,'bestScore',x.best_score)) from
  (select p.game,p.legacy_level,max(r.level) filter(where r.won) as won_level,count(r.id) filter(where r.won) as wins,coalesce(max(r.points),0) as best_score
   from meadow_private.round_progress p left join public.meadow_market_play_runs r on r.user_id=p.user_id and r.game=p.game and r.verified
   where p.user_id=p_user and p.game in ('eggs','milk','word_search','market_pack','market_weigh') group by p.game,p.legacy_level) x),'[]'::jsonb),
$records$||marker);
 execute body;
end $migration$;
