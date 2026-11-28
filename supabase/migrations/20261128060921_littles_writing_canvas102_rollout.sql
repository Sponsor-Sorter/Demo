-- Only renderer2 clients may unlock the new tracing canvas. Cached writing101
-- clients receive the existing quality99 activities until their normal update.
DO $writing102$
DECLARE before_wrapper text;before_weekly text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='meadow_littles_private.quality_status()'::regprocedure
 AND encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')='319e1f232b35fea1018704f718db5035c541a7ed102002edd9ee7c654ab2ce2e'
 AND p.proowner::regrole::text='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']
 AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}') THEN RAISE EXCEPTION 'WRITING102_QUALITY_SOURCE_DRIFT';END IF;
 SELECT pg_get_functiondef('public.meadow_littles_weekly(text,jsonb)'::regprocedure) INTO STRICT before_wrapper;
 SELECT pg_get_functiondef('meadow_littles_private.weekly(text,jsonb)'::regprocedure) INTO STRICT before_weekly;
 EXECUTE $renderer$
CREATE OR REPLACE FUNCTION meadow_littles_private.quality_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid:=meadow_littles_private.require_actor();answer jsonb;
BEGIN
 PERFORM meadow_littles_private.guard_read(actor);
 SELECT jsonb_build_object(
  'public_quality_build',least(c.quality_build,99),
  'quality_build',least(greatest(c.quality_build,CASE WHEN actor=ANY(c.quality_preview_users) THEN c.quality_preview_build ELSE c.quality_build END),99),
  'public_quality_build_v2',c.quality_build,
  'quality_build_v2',greatest(c.quality_build,CASE WHEN actor=ANY(c.quality_preview_users) THEN c.quality_preview_build ELSE c.quality_build END)
 ) INTO answer FROM meadow_littles_private.weekly_config c WHERE singleton;
 RETURN coalesce(answer,jsonb_build_object('public_quality_build',62,'quality_build',62,'public_quality_build_v2',62,'quality_build_v2',62));
END
$function$;
 $renderer$;
 IF before_wrapper IS DISTINCT FROM pg_get_functiondef('public.meadow_littles_weekly(text,jsonb)'::regprocedure)
 OR before_weekly IS DISTINCT FROM pg_get_functiondef('meadow_littles_private.weekly(text,jsonb)'::regprocedure)
 THEN RAISE EXCEPTION 'WRITING102_UNRELATED_API_CHANGED';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='meadow_littles_private.quality_status()'::regprocedure
 AND p.proowner::regrole::text='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']
 AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}') THEN RAISE EXCEPTION 'WRITING102_ACCESS_CHANGED';END IF;
END $writing102$;
