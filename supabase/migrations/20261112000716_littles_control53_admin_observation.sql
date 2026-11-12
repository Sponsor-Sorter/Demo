create function public.meadow_littles_control_readiness53() returns jsonb
language plpgsql security definer set search_path='' as $probe$
declare expected jsonb:=$manifest$[{"md5":"8b98a30be5c647ded92005c97c1503e9","anon":false,"args":"p_user uuid","name":"can_read","schema":"meadow_littles_private","service":false,"authenticated":true},{"md5":"221695e008f9f5861fd5491a1baa364a","anon":false,"args":"p_user uuid","name":"guard_read","schema":"meadow_littles_private","service":false,"authenticated":false},{"md5":"0308d8f34d4ca80e9c66751df0bb664b","anon":false,"args":"p_user uuid","name":"guard_save","schema":"meadow_littles_private","service":false,"authenticated":false},{"md5":"64fa7ca5aa90aaae9248cf555a75fcf4","anon":false,"args":"p_display_name text","name":"open","schema":"meadow_littles_private","service":false,"authenticated":true},{"md5":"9ef87469d8d6ab3f1275df5a66f480d6","anon":false,"args":"","name":"require_actor","schema":"meadow_littles_private","service":false,"authenticated":false},{"md5":"da40189ff57d6778fc349053d99736a8","anon":false,"args":"p_request_id uuid, p_expected_revision bigint, p_cloud_version integer, p_save_data jsonb, p_expected_user_id uuid","name":"save","schema":"meadow_littles_private","service":false,"authenticated":true},{"md5":"33eb94830db66bdf2e7f2efccc38e87b","anon":false,"args":"p_display_name text","name":"meadow_littles_open","schema":"public","service":true,"authenticated":true},{"md5":"2584515e5c985151d3f8a9b14a8e43de","anon":false,"args":"","name":"meadow_littles_register_member","schema":"public","service":false,"authenticated":true},{"md5":"ab1ab04e6912982726e6d121629ac1d1","anon":false,"args":"p_request_id uuid, p_expected_revision bigint, p_cloud_version integer, p_save_data jsonb, p_expected_user_id uuid","name":"meadow_littles_save","schema":"public","service":true,"authenticated":true},{"md5":"cd567fc9bbd6e821fa3b91f4bb928995","anon":false,"args":"","name":"meadow_littles_validate_session","schema":"public","service":false,"authenticated":true}]$manifest$::jsonb;
 e jsonb;p oid;checks jsonb:='[]';ok boolean;all_ok boolean:=true;enforced boolean;policy_ok boolean;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 for e in select value from jsonb_array_elements(expected) loop
  select f.oid into p from pg_proc f join pg_namespace n on n.oid=f.pronamespace
   where n.nspname=e->>'schema' and f.proname=e->>'name' and pg_get_function_identity_arguments(f.oid)=e->>'args';
  ok:=p is not null and md5(replace(pg_get_functiondef(p),chr(13),''))=e->>'md5'
   and has_function_privilege('anon',p,'execute')=(e->>'anon')::boolean
   and has_function_privilege('authenticated',p,'execute')=(e->>'authenticated')::boolean
   and has_function_privilege('service_role',p,'execute')=(e->>'service')::boolean;
  all_ok:=all_ok and coalesce(ok,false);
  checks:=checks||jsonb_build_array(jsonb_build_object('function',(e->>'schema')||'.'||(e->>'name'),'accepted_source_and_acl',coalesce(ok,false)));
 end loop;
 select exists(select 1 from pg_policies where schemaname='public' and tablename='meadow_littles_saves' and policyname='meadow_littles_fairplay_read' and permissive='RESTRICTIVE' and qual like '%can_read%') into policy_ok;
 all_ok:=all_ok and policy_ok;
 checks:=checks||jsonb_build_array(jsonb_build_object('function','restrictive_save_read_policy','accepted_source_and_acl',policy_ok));
 select c.enforced into enforced from meadow_littles_private.fairplay_control_config c where id=true;
 return jsonb_build_object('app','littles','probe_version',53,'consumer_version','littles-53','protocol_version',1,
 'source','Current installed database definitions, ACLs and settings','checked_at',clock_timestamp(),
 'installed_catalog_accepted',all_ok,'enforcement_enabled',coalesce(enforced,false),'enforced_consumer',all_ok and coalesce(enforced,false),
 'declared_features',jsonb_build_array('moderation','warnings','appeals','maintenance','notices'),
 'ads_policy_consumer',false,'checks',checks,
 'health_limit','SQL controls only; this does not measure Edge availability or client activity. Local games remain available. No public lobby/report capability is claimed.');
end $probe$;
revoke all on function public.meadow_littles_control_readiness53() from public,anon,authenticated;
grant execute on function public.meadow_littles_control_readiness53() to service_role;

