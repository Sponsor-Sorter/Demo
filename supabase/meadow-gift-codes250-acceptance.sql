-- Read-only installed-helper verification. No claim, role/session fabrication,
-- gift issuance, account mutation or catalogue activation.
select p.oid::regprocedure::text as signature,
 pg_get_userbyid(p.proowner) as owner,p.provolatile,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
 not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where a.grantee=0 and a.privilege_type='EXECUTE') as public_denied
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='fairplay_gifts_private'
 and p.proname in ('meadow_eligible_v1','meadow_currency_v1')
order by p.proname;

-- Expected: currency v, eligibility s; both postgres-owned, invoker, empty
-- search_path, anon/authenticated/service_role false, public_denied true.
select fairplay_gifts_private.meadow_eligible_v1(null,'currency') as null_user_eligible;
-- Expected false. This does not establish genuine-session claim acceptance.
