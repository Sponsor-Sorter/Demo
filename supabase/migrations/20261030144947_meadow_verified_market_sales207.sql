-- A successful verified delivery can sell exactly one basket batch. The
-- record survives changes to the bounded client save/receipt display history.
create table meadow_private.market_sale_rounds(
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 round_id uuid not null references meadow_private.reward_rounds(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,round_id)
);
alter table meadow_private.market_sale_rounds enable row level security;
revoke all on meadow_private.market_sale_rounds from public,anon,authenticated,service_role;

do $migration$
declare body text; marker text;
begin
 body:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);
 marker:='''owned_collections'',coalesce';
 if position(marker in body)=0 then raise exception 'Review command reader before adding verified market rounds';end if;
 body:=replace(body,marker,$read$
 'market_rounds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'game',r.game,'goal',r.goal,'map',r.map,'verified',p.verified,'won',p.won,'expires_at',floor(extract(epoch from r.expires_at)*1000)))
  from meadow_private.reward_rounds r join public.meadow_market_play_runs p on p.id=r.id and p.user_id=r.user_id
  where r.user_id=p_user and r.closed and p.verified and p.won
   and r.game in ('market_pack','market_weigh') and r.expires_at>=clock_timestamp()
   and r.id::text in(select c->'data'->>'round' from jsonb_array_elements(p_body->'commands') c where c->>'type'='market.sell')
   and not exists(select 1 from meadow_private.market_sale_rounds used where used.user_id=p_user and used.round_id=r.id)), '[]'::jsonb),
$read$||marker);
 execute body;
 body:=pg_get_functiondef('meadow_private.commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure);
 marker:=' answer:=meadow_private.commit_economy_save((p_body->>''expected_revision'')::bigint,p_save_data,p_request_id);';
 if position(marker in body)=0 then raise exception 'Review command committer before adding market redemption';end if;
 body:=replace(body,marker,marker||$sale$
 if answer->>'ok'='true' then
  if jsonb_typeof(coalesce(p_summary->'market_sales','[]'::jsonb)) is distinct from 'array'
   or jsonb_array_length(coalesce(p_summary->'market_sales','[]'::jsonb))>32 then
   raise exception 'Invalid market redemption' using errcode='22023';
  end if;
  -- Recheck proof ownership/state at commit. Any failure rolls back both the
  -- gold/stock changes and all helper/mission acknowledgments in this batch.
  if exists(select 1 from jsonb_array_elements(coalesce(p_summary->'market_sales','[]'::jsonb)) claim
   where not exists(select 1 from meadow_private.reward_rounds r join public.meadow_market_play_runs p on p.id=r.id and p.user_id=r.user_id
    where r.id::text=claim->>'id' and r.user_id=p_user and r.map=claim->>'map' and r.closed
     and p.verified and p.won and r.game in ('market_pack','market_weigh') and r.expires_at>=clock_timestamp())
    or exists(select 1 from meadow_private.market_sale_rounds used where used.user_id=p_user and used.round_id::text=claim->>'id')) then
   raise exception 'Market round is unavailable or already used' using errcode='22023';
  end if;
  insert into meadow_private.market_sale_rounds(user_id,round_id)
   select p_user,(claim->>'id')::uuid from jsonb_array_elements(coalesce(p_summary->'market_sales','[]'::jsonb)) claim;
 end if;
$sale$);
 execute body;
end $migration$;
