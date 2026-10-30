-- Managed pg_net objects are owned by supabase_admin. Do not assume REVOKE by
-- postgres changed their ACLs. The outbound queue must never contain our key.
create or replace function meadow_private.invoke_auth_cleanup() returns bigint language plpgsql security definer set search_path='' as $$
declare secret text; request_id bigint; stamp text; nonce text; signature text;
begin
 if not exists(select 1 from meadow_private.auth_retirements where retry_after<=now() and (lease_until is null or lease_until<now())) then return null; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='meadow_account_cleanup_token';
 if secret is null or length(secret)<32 then return null; end if;
 stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;
 nonce:=gen_random_uuid()::text;
 signature:=encode(extensions.hmac(convert_to('meadow-cleanup-v1'||chr(10)||stamp||chr(10)||nonce,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
 select net.http_post(
  url:='https://ejavqlyozqhzqogflqzr.supabase.co/functions/v1/meadow-market-account-cleanup',
  headers:=jsonb_build_object('Content-Type','application/json','x-meadow-cleanup-time',stamp,'x-meadow-cleanup-nonce',nonce,'x-meadow-cleanup-signature',signature),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 ) into request_id;
 return request_id;
end $$;
revoke all on function meadow_private.invoke_auth_cleanup() from public,anon,authenticated,service_role;
