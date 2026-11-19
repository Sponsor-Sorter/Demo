-- REVIEW ONLY: NOT EXECUTED. Requires separate owner authorization.
-- Operational rollback: stop new automatic awards, preserve all existing data.
begin;
do $disable$
declare j record;
begin
 if current_user<>(select pg_get_userbyid(proowner) from pg_proc
  where oid='meadow_private.play_service_before_store(text,jsonb)'::regprocedure) then
  raise exception 'Use the existing Meadow function owner';
 end if;
 for j in select jobid,command,database,username from cron.job
  where jobname='meadow-market-weekly-awards-v2' loop
  if btrim(j.command)<>'select meadow_private.award_closed_weekly_prizes_v2(100);'
   or j.database<>current_database() or j.username<>current_user then
   raise exception 'Unexpected named job; stop for review';
  end if;
  perform cron.alter_job(j.jobid,active:=false);
 end loop;
 -- Same lock as the reviewed worker. Wait for an in-flight transaction; do not
 -- cancel a process, reverse a committed award or delete receipt history.
 perform pg_advisory_xact_lock(hashtextextended('meadow:automatic-weekly-prizes:v1',0));
 if to_regclass('meadow_private.weekly_prize_rollout_v2') is not null then
  update meadow_private.weekly_prize_rollout_v2 set enabled=false where singleton;
 end if;
end $disable$;
commit;
-- No DROP/TRUNCATE/DELETE/unschedule/refund/clawback or other-app changes.

