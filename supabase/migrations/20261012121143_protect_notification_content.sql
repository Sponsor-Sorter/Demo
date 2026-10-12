-- Readers may mark their notifications read; notification contents and recipients
-- are authored by the sending workflow and must not be rewritten by recipients.
create or replace function public.protect_notification_content()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.role() in ('authenticated', 'anon')
     and (to_jsonb(new) - 'read') is distinct from (to_jsonb(old) - 'read') then
    raise exception 'Notification content and recipients cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_notification_content() from public, anon, authenticated;
drop trigger if exists protect_notification_content on public.user_notifications;
create trigger protect_notification_content before update on public.user_notifications
for each row execute function public.protect_notification_content();
