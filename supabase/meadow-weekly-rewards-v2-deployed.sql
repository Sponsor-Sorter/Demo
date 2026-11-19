-- REVIEW ONLY: NOT APPLIED. Scheduler uninstalled; automation disabled.
-- Frozen retry-source SHA25683ded63c88b4b2ed4d17ef69fcb1e92e194eca7b174e90a205ef4edd84812dc0 remains unchanged.
-- This exact deployment candidate adds ONLY fail-closed prospective rollout
-- configuration and three start-week filters to that retry implementation.
-- Proposed cadence: every15minutes UTC. Reward boundary: Monday00:00UTC.
-- No historical automatic catch-up. Original manual claims stay unchanged.
-- Exact unchanged issuer/pending bodies are included; unsafe v1 job is not.
begin;

do $compatibility$
declare needed record;
begin
 if current_user<>(select pg_get_userbyid(proowner) from pg_proc where oid='meadow_private.play_service_before_store(text,jsonb)'::regprocedure) then
  raise exception 'Use the existing Meadow function owner for this reviewed migration';
 end if;
 if encode(sha256(convert_to(pg_get_functiondef('meadow_private.play_service_before_store(text,jsonb)'::regprocedure),'UTF8')),'hex')<>'a8c87eeec29153df62d25b23471ceebf5aba09aeb73ad95ef06c722f7fbd547c'
  or encode(sha256(convert_to(pg_get_functiondef('public.meadow_market_play_service(text,jsonb)'::regprocedure),'UTF8')),'hex')<>'cc4c0b27266a5f7937b66984e59b02c0f94ea0b92d5b9736876ccdc0043d134c' then
  raise exception 'Reviewed manual claim/wrapper changed; recheck compatibility';
 end if;
 if to_regclass('meadow_private.weekly_prize_cursor_v2') is not null or to_regclass('meadow_private.weekly_prize_rollout_v2') is not null
  or to_regprocedure('meadow_private.issue_weekly_prize_v1(uuid,text,date,uuid)') is not null
  or to_regprocedure('meadow_private.pending_weekly_prizes_v1()') is not null
  or to_regprocedure('meadow_private.award_closed_weekly_prizes_v1(integer)') is not null
  or to_regprocedure('meadow_private.award_closed_weekly_prizes_v2(integer)') is not null then
  raise exception 'Unexpected existing automatic-award objects; do not overwrite them';
 end if;
 for needed in select * from (values
   ('public','meadow_market_profiles','user_id','uuid'),
   ('public','meadow_market_wallets','user_id','uuid'),
   ('public','meadow_market_wallets','gems','integer'),
   ('public','meadow_market_wallets','updated_at','timestamp with time zone'),
   ('public','meadow_market_play_runs','user_id','uuid'),
   ('public','meadow_market_play_runs','game','text'),
   ('public','meadow_market_play_runs','week','date'),
   ('public','meadow_market_play_runs','points','integer'),
   ('public','meadow_market_play_runs','verified','boolean'),
   ('public','meadow_market_economy_receipts','id','uuid'),
   ('public','meadow_market_economy_receipts','user_id','uuid'),
   ('public','meadow_market_economy_receipts','request_id','uuid'),
   ('public','meadow_market_economy_receipts','kind','text'),
   ('public','meadow_market_economy_receipts','claim_key','text'),
   ('public','meadow_market_economy_receipts','delivery','jsonb'),
   ('public','meadow_market_economy_receipts','created_at','timestamp with time zone'),
   ('public','fairplay_admin_runtime','app','text'),
   ('public','fairplay_admin_runtime','maintenance','boolean'),
   ('meadow_private','control_config','id','boolean'),
   ('meadow_private','control_config','enforced','boolean'),
   ('meadow_private','account_deletions','user_id','uuid')
 ) x(schema_name,table_name,column_name,data_type) loop
  if not exists(select 1 from information_schema.columns c where c.table_schema=needed.schema_name
   and c.table_name=needed.table_name and c.column_name=needed.column_name and c.data_type=needed.data_type) then
   raise exception 'Reviewed Meadow schema changed: %.%.%',needed.schema_name,needed.table_name,needed.column_name;
  end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.meadow_market_economy_receipts'::regclass and conname='meadow_market_economy_receipts_user_id_claim_key_key' and pg_get_constraintdef(oid)='UNIQUE (user_id, claim_key)')
  or not exists(select 1 from pg_constraint where conrelid='public.meadow_market_economy_receipts'::regclass and conname='meadow_market_economy_receipts_user_id_request_id_key' and pg_get_constraintdef(oid)='UNIQUE (user_id, request_id)')
  or not exists(select 1 from pg_constraint where conrelid='public.meadow_market_wallets'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (user_id)')
  or not exists(select 1 from pg_constraint where conrelid='meadow_private.farm_reward_deliveries'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (receipt_id)') then
  raise exception 'Reviewed receipt/wallet delivery uniqueness changed';
 end if;
 if to_regprocedure('meadow_private.control_state(uuid)') is null or to_regclass('cron.job') is null
  or to_regprocedure('cron.schedule(text,text,text)') is null or to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') is null then
  raise exception 'Required control/cron metadata unavailable; review before installing';
 end if;
 if exists(select 1 from cron.job where jobname in('meadow-market-weekly-awards-v1','meadow-market-weekly-awards-v2')) then
  raise exception 'Unexpected existing weekly cron job; do not replace it';
 end if;
end $compatibility$;

create function meadow_private.issue_weekly_prize_v1(p_user uuid,p_game text,p_week date,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC'
as $$
declare w public.meadow_market_wallets;r public.meadow_market_economy_receipts;
 wk date:=date_trunc('week',now())::date;rank_n integer;add_gems integer;reward_gold integer;ck text;
begin
 if encode(sha256(convert_to(pg_get_functiondef('meadow_private.play_service_before_store(text,jsonb)'::regprocedure),'UTF8')),'hex')
  <>'a8c87eeec29153df62d25b23471ceebf5aba09aeb73ad95ef06c722f7fbd547c' then
  raise exception 'Weekly claim contract changed; review automatic awards' using errcode='55000';
 end if;
 if p_user is null or not exists(select 1 from public.meadow_market_profiles where user_id=p_user) then
  raise exception 'Connect your Meadow Markets account first';
 end if;
 insert into public.meadow_market_wallets(user_id) values(p_user) on conflict do nothing;
 select * into w from public.meadow_market_wallets where user_id=p_user for update;
 select * into r from public.meadow_market_economy_receipts where user_id=p_user and request_id=p_request;
 if found then return jsonb_build_object('wallet',to_jsonb(w),'receipt',to_jsonb(r),'duplicate',true);end if;
 if p_week>=wk or p_week<>date_trunc('week',p_week)::date then raise exception 'This week has not finished';end if;
 with best as(select user_id,max(points) points from public.meadow_market_play_runs where verified and week=p_week and game=p_game group by user_id),
 ranks as(select user_id,dense_rank() over(order by points desc) place from best)
 select place into rank_n from ranks where user_id=p_user;
 if rank_n is null or rank_n>10 then raise exception 'Weekly rewards are for the global top ten';end if;
 add_gems:=case rank_n when 1 then 150 when 2 then 100 when 3 then 50 else 20 end;
 reward_gold:=case rank_n when 1 then 500 when 2 then 300 when 3 then 150 else 75 end;
 ck:='week:'||p_week||':'||p_game;
 if ck is not null and exists(select 1 from public.meadow_market_economy_receipts where user_id=p_user and claim_key=ck) then raise exception 'Reward already collected';end if;
 update public.meadow_market_wallets set gems=gems+add_gems,updated_at=now() where user_id=p_user returning * into w;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
 values(p_user,p_request,'claim_week',ck,jsonb_build_object('gold',reward_gold)) returning * into r;
 return jsonb_build_object('wallet',to_jsonb(w),'receipt',to_jsonb(r));
end $$;

create function meadow_private.pending_weekly_prizes_v1()
returns table(user_id uuid,game text,week date,place bigint)
language sql stable security definer set search_path='' set timezone='UTC'
as $$
 with best as (
  select r.user_id,r.game,r.week,max(r.points) points
  from public.meadow_market_play_runs r
  where r.verified and r.week<date_trunc('week',now())::date
   and r.week=date_trunc('week',r.week)::date
  group by r.user_id,r.game,r.week
 ), ranked as (
  select b.user_id,b.game,b.week,dense_rank() over(partition by b.game,b.week order by b.points desc) place
  from best b
 )
 select r.user_id,r.game,r.week,r.place
 from ranked r join public.meadow_market_profiles p on p.user_id=r.user_id
 where r.place between 1 and 10
  -- These are recipient gates AFTER global ranking. Excluded players do not
  -- promote other players; claim_week uses the same unfiltered global scores.
  and not exists(select 1 from meadow_private.account_deletions d where d.user_id=r.user_id)
  and (not coalesce((select enforced from meadow_private.control_config where id),true)
   or not coalesce((meadow_private.control_state(r.user_id)->>'banned')::boolean,false))
  and not exists(select 1 from public.meadow_market_economy_receipts e
   where e.user_id=r.user_id and e.claim_key='week:'||r.week||':'||r.game)
$$;

revoke all on function meadow_private.issue_weekly_prize_v1(uuid,text,date,uuid) from public,anon,authenticated,service_role;
revoke all on function meadow_private.pending_weekly_prizes_v1() from public,anon,authenticated,service_role;

-- No row is inserted here. No implicit activation timestamp or historical
-- start date is baked at migration creation/application.
create table meadow_private.weekly_prize_rollout_v2 (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 start_week date,
 activated_at timestamp with time zone,
 check(start_week is null or start_week=date_trunc('week',start_week)::date),
 check(not enabled or (start_week is not null and activated_at is not null)),
 check(start_week is null or activated_at is null or start_week>=date_trunc('week',activated_at at time zone 'UTC')::date)
);
alter table meadow_private.weekly_prize_rollout_v2 enable row level security;
revoke all on table meadow_private.weekly_prize_rollout_v2 from public,anon,authenticated,service_role;

create table meadow_private.weekly_prize_cursor_v2 (
 singleton boolean primary key default true check(singleton),
 last_week date,last_game text,last_user uuid,
 end_week date,end_game text,end_user uuid,
 cycle_no bigint not null default 0 check(cycle_no>=0),
 check((last_week is null and last_game is null and last_user is null)
    or (last_week is not null and last_game is not null and last_user is not null)),
 check((end_week is null and end_game is null and end_user is null)
    or (end_week is not null and end_game is not null and end_user is not null)),
 check(last_week is null or (end_week is not null and
   row(last_week,last_game,last_user)<=row(end_week,end_game,end_user)))
);
alter table meadow_private.weekly_prize_cursor_v2 enable row level security;
revoke all on table meadow_private.weekly_prize_cursor_v2 from public,anon,authenticated,service_role;
insert into meadow_private.weekly_prize_cursor_v2(singleton) values(true);

create function meadow_private.award_closed_weekly_prizes_v2(p_limit integer default 100)
returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC'
set lock_timeout='2s'
as $$
declare
 job_state meadow_private.weekly_prize_cursor_v2; item record; answer jsonb;
 rollout_enabled boolean;rollout_start date;rollout_activated_at timestamptz;
 attempted integer:=0;awarded integer:=0;already_claimed integer:=0;
 deferred integer:=0;failed integer:=0;warmed integer:=0;inserted integer;
 created_this boolean;cycle_complete boolean:=false;
begin
 if encode(sha256(convert_to(pg_get_functiondef('meadow_private.play_service_before_store(text,jsonb)'::regprocedure),'UTF8')),'hex')
  <>'a8c87eeec29153df62d25b23471ceebf5aba09aeb73ad95ef06c722f7fbd547c' then
  raise exception 'Weekly claim contract changed; review automatic awards' using errcode='55000';
 end if;
 if p_limit is null or p_limit not between 1 and 100 then
  raise exception 'Weekly award batch must be between 1 and 100' using errcode='22023';
 end if;
 -- Same job lock as v1. This also serializes cursor progress across v2 callers.
 if not pg_try_advisory_xact_lock(hashtextextended('meadow:automatic-weekly-prizes:v1',0)) then
  return jsonb_build_object('status','busy','awarded',0,'attempted',0);
 end if;
 if coalesce((select maintenance from public.fairplay_admin_runtime where app='meadow'),false) then
  return jsonb_build_object('status','maintenance','awarded',0,'attempted',0);
 end if;
 -- No configuration row is installed by this migration. Missing/disabled
 -- configuration cannot issue awards or advance scheduling state.
 select c.enabled,c.start_week,c.activated_at into rollout_enabled,rollout_start,rollout_activated_at
 from meadow_private.weekly_prize_rollout_v2 c where c.singleton for share;
 if not found or rollout_enabled is distinct from true then
  return jsonb_build_object('status','disabled','awarded',0,'attempted',0);
 end if;
 if rollout_start is null or rollout_activated_at is null
  or rollout_activated_at>clock_timestamp()
  or rollout_start<>date_trunc('week',rollout_start)::date
  or rollout_start<date_trunc('week',rollout_activated_at at time zone 'UTC')::date then
  raise exception 'Prospective start week requires explicit activation configuration' using errcode='22023';
 end if;
 select * into strict job_state from meadow_private.weekly_prize_cursor_v2 where singleton for update;

 if job_state.end_week is null or
  (job_state.last_week is not null and row(job_state.last_week,job_state.last_game,job_state.last_user)
   >=row(job_state.end_week,job_state.end_game,job_state.end_user)) then
  select p.week,p.game,p.user_id into item
   from meadow_private.pending_weekly_prizes_v1() p
   where p.week>=rollout_start
   order by p.week desc,p.game desc,p.user_id desc limit 1;
  if not found then
   update meadow_private.weekly_prize_cursor_v2 set last_week=null,last_game=null,last_user=null,
    end_week=null,end_game=null,end_user=null where singleton;
   return jsonb_build_object('status','complete','awarded',0,'attempted',0,
    'failed',0,'deferred',0,'already_claimed',0,'wallets_created',0,'cycle_complete',true);
  end if;
  -- End key bounds scheduling traversal only, never scores/eligibility/prizes.
  update meadow_private.weekly_prize_cursor_v2 set
   last_week=null,last_game=null,last_user=null,end_week=item.week,end_game=item.game,end_user=item.user_id,
   cycle_no=cycle_no+1 where singleton returning * into job_state;
 end if;

 -- At most one scheduling cycle per call. Later appended work cannot extend
 -- this cycle forever; a following call wraps and retries all still-pending keys.
 for item in
  select p.user_id,p.game,p.week
  from meadow_private.pending_weekly_prizes_v1() p
  where p.week>=rollout_start
   and (job_state.last_week is null or row(p.week,p.game,p.user_id)>
    row(job_state.last_week,job_state.last_game,job_state.last_user))
   and row(p.week,p.game,p.user_id)<=row(job_state.end_week,job_state.end_game,job_state.end_user)
  order by p.week,p.game,p.user_id limit p_limit
 loop
  attempted:=attempted+1;created_this:=false;
  begin
   -- Missing-wallet repair belongs to the same fair rotation. No fixed-prefix
   -- warm-up can monopolize all later work.
   if not exists(select 1 from public.meadow_market_wallets w where w.user_id=item.user_id) then
    insert into public.meadow_market_wallets(user_id) values(item.user_id) on conflict(user_id) do nothing;
    get diagnostics inserted=row_count;created_this:=inserted=1;
   end if;
   perform 1 from public.meadow_market_wallets w where w.user_id=item.user_id for update nowait;
   if not found then raise exception 'Weekly recipient wallet unavailable' using errcode='55000';end if;
   if exists(select 1 from public.meadow_market_economy_receipts e
    where e.user_id=item.user_id and e.claim_key='week:'||item.week||':'||item.game) then
    already_claimed:=already_claimed+1;
   elsif exists(select 1 from meadow_private.account_deletions d where d.user_id=item.user_id)
    or (coalesce((select enforced from meadow_private.control_config where id),true)
     and coalesce((meadow_private.control_state(item.user_id)->>'banned')::boolean,false)) then
    deferred:=deferred+1;
   else
    -- Original issuer still recomputes the current global dense rank.
    answer:=meadow_private.issue_weekly_prize_v1(item.user_id,item.game,item.week,gen_random_uuid());
    if answer->'receipt'->>'user_id' is distinct from item.user_id::text
     or answer->'receipt'->>'claim_key' is distinct from 'week:'||item.week||':'||item.game
     or answer->'receipt'->>'kind' is distinct from 'claim_week' then
     raise exception 'Weekly award receipt mismatch' using errcode='22023';
    end if;
    if coalesce((answer->>'duplicate')::boolean,false) then already_claimed:=already_claimed+1;
    else awarded:=awarded+1;end if;
   end if;
  exception when lock_not_available then
   -- Wallet creation/award changes in this subtransaction roll back together.
   created_this:=false;deferred:=deferred+1;
  when others then
   created_this:=false;failed:=failed+1;
  end;
  if created_this then warmed:=warmed+1;end if;
  -- Deliberately OUTSIDE recipient rollback, including failure/busy attempts.
  -- Outer transaction rollback still reverts cursor AND every award together.
  update meadow_private.weekly_prize_cursor_v2 set
   last_week=item.week,last_game=item.game,last_user=item.user_id
   where singleton returning * into job_state;
 end loop;

 if not exists(
  select 1 from meadow_private.pending_weekly_prizes_v1() p
  where p.week>=rollout_start
   and (job_state.last_week is null or row(p.week,p.game,p.user_id)>
    row(job_state.last_week,job_state.last_game,job_state.last_user))
   and row(p.week,p.game,p.user_id)<=row(job_state.end_week,job_state.end_game,job_state.end_user)
 ) then
  update meadow_private.weekly_prize_cursor_v2 set
   last_week=end_week,last_game=end_game,last_user=end_user
   where singleton returning * into job_state;
  cycle_complete:=true;
 end if;
 if failed>0 then raise warning 'Meadow automatic weekly prize v2 has % retryable failures',failed;end if;
 return jsonb_build_object('status','complete','awarded',awarded,'attempted',attempted,
  'already_claimed',already_claimed,'deferred',deferred,'failed',failed,
  'wallets_created',warmed,'cycle_complete',cycle_complete);
end $$;
revoke all on function meadow_private.award_closed_weekly_prizes_v2(integer)
 from public,anon,authenticated,service_role;
-- No scheduler, live call, public RPC, user grant, Auth/JWT change or backfill.

commit;

