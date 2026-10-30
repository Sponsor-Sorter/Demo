create extension if not exists pg_net with schema extensions;
-- This project's new network queue is used only by the private maintenance job.
revoke all on all tables in schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
create function meadow_private.invoke_auth_cleanup() returns bigint language plpgsql security definer set search_path='' as $$
declare secret text; request_id bigint;
begin
 if not exists(select 1 from meadow_private.auth_retirements where retry_after<=now() and (lease_until is null or lease_until<now())) then return null; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='meadow_account_cleanup_token';
 if secret is null or length(secret)<32 then return null; end if;
 select net.http_post(
  url:='https://ejavqlyozqhzqogflqzr.supabase.co/functions/v1/meadow-market-account-cleanup',
  headers:=jsonb_build_object('Content-Type','application/json','x-meadow-cleanup-token',secret),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 ) into request_id;
 return request_id;
end $$;
revoke all on function meadow_private.invoke_auth_cleanup() from public,anon,authenticated,service_role;
select cron.schedule('meadow-market-auth-retirement','18,33,48,3 * * * *','select meadow_private.invoke_auth_cleanup();');
