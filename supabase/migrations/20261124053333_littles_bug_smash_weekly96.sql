-- Add only bug_smash to the CURRENT deployed weekly allowlist.
-- Source and grants inspected read-only 2026-11-24T05:26:55Z; no quality/ad/entitlement changes.
-- Abort on source drift. The public quality wrapper is deliberately untouched.
BEGIN;
DO $bug96$
DECLARE
 source_definition text;
 source_body text;
 new_body text;
BEGIN
 SELECT pg_get_functiondef(p.oid),p.prosrc INTO STRICT source_definition,source_body
 FROM pg_proc p WHERE p.oid='meadow_littles_private.weekly(text,jsonb)'::regprocedure;
 IF encode(sha256(convert_to(source_definition,'UTF8')),'hex')<>'e1efa90dc55f7ea9b3c052a66ee152dd8fc6933c93cdd63d8c740be108131a23'
 OR encode(sha256(convert_to(source_body,'UTF8')),'hex')<>'6f25923fdc6451ddd7d50d9bd394c037953c1f46b00335028fc61f0fdd65060b' THEN
  RAISE EXCEPTION 'BUG96_WEEKLY_SOURCE_DRIFT';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='meadow_littles_private.weekly(text,jsonb)'::regprocedure
  AND p.proowner::regrole::text='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']
  AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}') THEN RAISE EXCEPTION 'BUG96_WEEKLY_ACCESS_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.meadow_littles_weekly(text,jsonb)'::regprocedure
  AND encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')='e1880a0dbe3d6ec48c1b03e943a9ec630e93d5339f083335deba79455431c3dd'
  AND p.proowner::regrole::text='postgres' AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=""']
  AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'BUG96_WRAPPER_DRIFT';END IF;
 IF (length(source_definition)-length(replace(source_definition,$needle$'bee_shelter','harvest_slice','meadow_kitchen'$needle$,'')))<>length($needle$'bee_shelter','harvest_slice','meadow_kitchen'$needle$)
 THEN RAISE EXCEPTION 'BUG96_ALLOWLIST_ANCHOR';END IF;
 EXECUTE replace(source_definition,$needle$'bee_shelter','harvest_slice','meadow_kitchen'$needle$,$new$'bee_shelter','harvest_slice','bug_smash','meadow_kitchen'$new$);
 SELECT p.prosrc INTO STRICT new_body FROM pg_proc p WHERE p.oid='meadow_littles_private.weekly(text,jsonb)'::regprocedure;
 IF replace(new_body,$new$'bee_shelter','harvest_slice','bug_smash','meadow_kitchen'$new$,$needle$'bee_shelter','harvest_slice','meadow_kitchen'$needle$) IS DISTINCT FROM source_body
 OR encode(sha256(convert_to(new_body,'UTF8')),'hex')<>'e4c125b55d6533e20f8b69eddd842daba2bb791d9b8d561991803e16f5872a84' THEN RAISE EXCEPTION 'BUG96_UNEXPECTED_DELTA';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='meadow_littles_private.weekly(text,jsonb)'::regprocedure
  AND p.proowner::regrole::text='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']
  AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}') THEN RAISE EXCEPTION 'BUG96_WEEKLY_ACCESS_CHANGED';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.meadow_littles_weekly(text,jsonb)'::regprocedure
  AND encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')='e1880a0dbe3d6ec48c1b03e943a9ec630e93d5339f083335deba79455431c3dd'
  AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'BUG96_WRAPPER_CHANGED';END IF;
END $bug96$;
COMMIT;
