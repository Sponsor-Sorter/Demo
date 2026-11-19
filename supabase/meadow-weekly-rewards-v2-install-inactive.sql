-- PROPOSAL ONLY. Not executed. Requires distinct Root action-time admission after OFF-state readback.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
do $install$
declare jid bigint;
begin
 if current_user<>'postgres' or current_database()<>'postgres' then raise exception 'Reviewed caller/database changed';end if;
 if (select encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') from pg_proc where oid='meadow_private.play_service_before_store(text,jsonb)'::regprocedure)<>'a8c87eeec29153df62d25b23471ceebf5aba09aeb73ad95ef06c722f7fbd547c' or (select encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') from pg_proc where oid='public.meadow_market_play_service(text,jsonb)'::regprocedure)<>'cc4c0b27266a5f7937b66984e59b02c0f94ea0b92d5b9736876ccdc0043d134c' then raise exception 'Manual/public contract changed';end if;
 if (select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') from pg_proc where oid='meadow_private.award_closed_weekly_prizes_v2(integer)'::regprocedure)<>'f14c06e915a14256680fc38b9a8a3d2f32d2ebb3fb08e30216a15523efbea208' then raise exception 'Reviewed automatic job source changed';end if;
 if coalesce(current_setting('cron.timezone',true),'') not in ('UTC','GMT') then raise exception 'Reviewed cron timezone changed';end if;
 if exists(select 1 from meadow_private.weekly_prize_rollout_v2) then raise exception 'First installation expects no rollout configuration';end if;
 if exists(select 1 from cron.job where jobname in('meadow-market-weekly-awards-v1','meadow-market-weekly-awards-v2')) then raise exception 'Named job already exists; do not replace it';end if;
 jid:=cron.schedule('meadow-market-weekly-awards-v2','*/15 * * * *','select meadow_private.award_closed_weekly_prizes_v2(100);');
 perform cron.alter_job(jid,active:=false);
end $install$;
commit;
