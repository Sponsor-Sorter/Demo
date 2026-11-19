-- PROPOSAL ONLY. First activation only. Not executed. Distinct Root action-time admission required.
-- Ordinary virtual weekly rewards: current OPEN UTC week at actual activation; all previously closed weeks excluded.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
do $activate$
declare j cron.job;activated timestamptz;start_date date;
begin
 if current_user<>'postgres' or current_database()<>'postgres' then raise exception 'Reviewed caller/database changed';end if;
 if (select encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') from pg_proc where oid='meadow_private.play_service_before_store(text,jsonb)'::regprocedure)<>'a8c87eeec29153df62d25b23471ceebf5aba09aeb73ad95ef06c722f7fbd547c' or (select encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') from pg_proc where oid='public.meadow_market_play_service(text,jsonb)'::regprocedure)<>'cc4c0b27266a5f7937b66984e59b02c0f94ea0b92d5b9736876ccdc0043d134c' then raise exception 'Manual/public contract changed';end if;
 if (select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') from pg_proc where oid='meadow_private.award_closed_weekly_prizes_v2(integer)'::regprocedure)<>'f14c06e915a14256680fc38b9a8a3d2f32d2ebb3fb08e30216a15523efbea208' then raise exception 'Reviewed automatic job source changed';end if;
 if coalesce(current_setting('cron.timezone',true),'') not in ('UTC','GMT') then raise exception 'Reviewed cron timezone changed';end if;
 perform pg_advisory_xact_lock(hashtextextended('meadow:automatic-weekly-prizes:v1',0));
 if (select count(*) from cron.job where jobname='meadow-market-weekly-awards-v2')<>1 or exists(select 1 from cron.job where jobname='meadow-market-weekly-awards-v1') then raise exception 'Unexpected named scheduler state';end if;
 select * into strict j from cron.job where jobname='meadow-market-weekly-awards-v2';
 if j.command<>'select meadow_private.award_closed_weekly_prizes_v2(100);' or j.schedule<>'*/15 * * * *' or j.database<>current_database() or j.username<>current_user or j.active then raise exception 'Inactive reviewed scheduler state changed';end if;
 if exists(select 1 from meadow_private.weekly_prize_rollout_v2) then raise exception 'First activation already recorded; never overwrite or backdate';end if;
 activated:=clock_timestamp();start_date:=date_trunc('week',activated at time zone 'UTC')::date;
 insert into meadow_private.weekly_prize_rollout_v2(singleton,enabled,start_week,activated_at) values(true,true,start_date,activated);
 perform cron.alter_job(j.jobid,active:=true);
end $activate$;
commit;
