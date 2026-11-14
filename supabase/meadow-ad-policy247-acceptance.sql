-- Source for joint BEGIN/ROLLBACK acceptance after reviewed migrations.
-- No fabricated JWT/session, SET ROLE, policy write, wallet change or user row.
-- Run on the explicitly empty-policy scaffolding, not a populated live policy.
begin;
set local statement_timeout='15s';
do $$
declare adapter oid:='public.meadow_market_commerce_status()'::regprocedure;
 helper oid:='meadow_private.numeric_ad_policy247()'::regprocedure;
 reader oid:=to_regprocedure('fairplay_admin_private.meadow_ad_policy_read_v1()');
 definition text;
begin
 if reader is null then raise exception 'Joint acceptance requires the reviewed central reader scaffolding';end if;
 if has_function_privilege('anon',adapter,'execute') or has_function_privilege('service_role',adapter,'execute')
 or not has_function_privilege('authenticated',adapter,'execute') then raise exception 'Meadow public adapter ACL changed';end if;
 if has_function_privilege('anon',helper,'execute') or has_function_privilege('authenticated',helper,'execute')
 or has_function_privilege('service_role',helper,'execute') then raise exception 'Private helper exposed';end if;
 if has_function_privilege('anon',reader,'execute') or has_function_privilege('authenticated',reader,'execute') then raise exception 'Central private reader exposed';end if;
 if exists(select 1 from pg_proc where oid in(adapter,helper,reader) and pronargs<>0) then raise exception 'Policy authority acquired caller parameters';end if;
 if not exists(select 1 from pg_proc where oid=adapter and prosecdef and pg_get_userbyid(proowner)='postgres' and proconfig@>array['search_path=""']) then raise exception 'Meadow public definer contract changed';end if;
 if not exists(select 1 from pg_proc where oid=helper and not prosecdef and proconfig@>array['search_path=""']) then raise exception 'Private helper must be invoker with empty path';end if;
 select pg_get_functiondef(adapter) into definition;
 if position('meadow_private.commerce_status239()' in definition)=0 or position('meadow_private.pack_grants240(auth.uid())' in definition)=0
 or position('meadow_private.commerce_status239()' in definition)>position('meadow_private.numeric_ad_policy247()' in definition) then raise exception 'Own-account/pack path was not preserved before policy projection';end if;
 if meadow_private.numeric_ad_policy247() is not null then raise exception 'Expected empty accepted-policy scaffolding';end if;
end $$;
select p.oid::regprocedure::text as function_name,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig,p.proacl,
 encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition_sha256
from pg_proc p where p.oid in('public.meadow_market_commerce_status()'::regprocedure,'meadow_private.numeric_ad_policy247()'::regprocedure,
 'fairplay_admin_private.meadow_ad_policy_read_v1()'::regprocedure);
rollback;
-- Root owns genuine normal game-API checks for its approved disposable actor:
-- compare the existing own-account product/pack/gate fields and wallet access;
-- assert numeric_ad_policy:null with zero accepted records. A separate-account
-- request must remain bound to its own authenticated account. No SQL role or
-- JWT edits may substitute for that acceptance.
