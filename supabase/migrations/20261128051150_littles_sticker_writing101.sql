-- Add one game to the current weekly allowlist. Preserve all access/award rules.
DO $writing101$
DECLARE before_definition text;before_body text;after_body text;
BEGIN
 SELECT pg_get_functiondef(p.oid),p.prosrc INTO STRICT before_definition,before_body
 FROM pg_proc p WHERE p.oid='meadow_littles_private.weekly(text,jsonb)'::regprocedure;
 IF encode(sha256(convert_to(before_definition,'UTF8')),'hex')<>'27bb0ebf1bcf0100ef6f6de163afd7529ef56dfab0b6cb7b90c1b2968ad48005'
 OR encode(sha256(convert_to(before_body,'UTF8')),'hex')<>'e4c125b55d6533e20f8b69eddd842daba2bb791d9b8d561991803e16f5872a84'
 THEN RAISE EXCEPTION 'WRITING101_WEEKLY_SOURCE_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='meadow_littles_private.weekly(text,jsonb)'::regprocedure
 AND p.proowner::regrole::text='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']
 AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}') THEN RAISE EXCEPTION 'WRITING101_WEEKLY_ACCESS_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.meadow_littles_weekly(text,jsonb)'::regprocedure
 AND encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')='e1880a0dbe3d6ec48c1b03e943a9ec630e93d5339f083335deba79455431c3dd'
 AND p.proowner::regrole::text='postgres' AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=""']
 AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'WRITING101_WRAPPER_DRIFT';END IF;
 IF (length(before_definition)-length(replace(before_definition,$old$'letter_tracing','name_tracing','balloon_letters'$old$,'')))<>length($old$'letter_tracing','name_tracing','balloon_letters'$old$)
 THEN RAISE EXCEPTION 'WRITING101_ALLOWLIST_ANCHOR';END IF;
 EXECUTE replace(before_definition,$old$'letter_tracing','name_tracing','balloon_letters'$old$,$new$'letter_tracing','name_tracing','sticker_words','balloon_letters'$new$);
 SELECT prosrc INTO STRICT after_body FROM pg_proc WHERE oid='meadow_littles_private.weekly(text,jsonb)'::regprocedure;
 IF replace(after_body,$new$'letter_tracing','name_tracing','sticker_words','balloon_letters'$new$,$old$'letter_tracing','name_tracing','balloon_letters'$old$) IS DISTINCT FROM before_body
 OR encode(sha256(convert_to(after_body,'UTF8')),'hex')<>'07963ab0773a44c5fae4ebe20192412fdd790a8a9cee8204c43c2a20176277be'
 THEN RAISE EXCEPTION 'WRITING101_UNEXPECTED_DELTA';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='meadow_littles_private.weekly(text,jsonb)'::regprocedure
 AND p.proowner::regrole::text='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']
 AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}') THEN RAISE EXCEPTION 'WRITING101_ACCESS_CHANGED';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.meadow_littles_weekly(text,jsonb)'::regprocedure
 AND encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')='e1880a0dbe3d6ec48c1b03e943a9ec630e93d5339f083335deba79455431c3dd'
 AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'WRITING101_WRAPPER_CHANGED';END IF;
END $writing101$;
