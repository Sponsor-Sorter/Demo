-- Replace the legacy open profile policies with owner/admin access.
-- Public profile reads go through the explicit, non-sensitive directory view.

alter table public.users_extended_data enable row level security;

do $block$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users_extended_data'
  loop
    execute format('drop policy %I on public.users_extended_data', policy_row.policyname);
  end loop;
end;
$block$;

revoke all on table public.users_extended_data from public, anon, authenticated;
grant select, insert, update, delete on table public.users_extended_data to authenticated;

create policy profile_select_own_or_admin
  on public.users_extended_data for select to authenticated
  using (auth.uid() = user_id or public.is_current_user_admin());

create policy profile_insert_own
  on public.users_extended_data for insert to authenticated
  with check (auth.uid() = user_id);

create policy profile_update_own_or_admin
  on public.users_extended_data for update to authenticated
  using (auth.uid() = user_id or public.is_current_user_admin())
  with check (auth.uid() = user_id or public.is_current_user_admin());

create policy profile_delete_own_or_admin
  on public.users_extended_data for delete to authenticated
  using (auth.uid() = user_id or public.is_current_user_admin());

-- Keep account authorization and billing fields out of normal self-service writes.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'A profile can only be created for the signed-in account';
    end if;
    new.is_admin := false;
    new.banned := false;
    new.strike_count := 0;
    new.ban_until := null;
    new.wallet := 0;
    new.email_verified := false;
    new."planType" := 'free';
    new.stripe_customer_id := null;
    new.stripe_connect_account_id := null;
    new.notification_uuid := null;
    return new;
  end if;

  if old.user_id = auth.uid() and not public.is_current_user_admin() then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.is_admin is distinct from old.is_admin
      or new.banned is distinct from old.banned
      or new.strike_count is distinct from old.strike_count
      or new.ban_until is distinct from old.ban_until
      or new.wallet is distinct from old.wallet
      or new.email_verified is distinct from old.email_verified
      or new."planType" is distinct from old."planType"
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_connect_account_id is distinct from old.stripe_connect_account_id
      or new.notification_uuid is distinct from old.notification_uuid then
      raise exception 'Protected account fields can only be changed by trusted services';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_profile_privileged_fields on public.users_extended_data;
create trigger guard_profile_privileged_fields
  before insert or update on public.users_extended_data
  for each row execute function public.guard_profile_privileged_fields();

revoke all on function public.guard_profile_privileged_fields() from public, anon, authenticated;

-- This view is the only unauthenticated profile listing surface. Never add email,
-- payment details, moderation state, wallet balances, OAuth credentials, or 2FA data.
create or replace view public.public_user_directory
with (security_barrier = true)
as
select
  profile.id,
  profile.user_id,
  profile.username,
  profile.title,
  profile.company_name,
  profile.location,
  profile.about_yourself,
  profile."userType" as "userType",
  profile.platforms,
  profile.target_audience,
  profile.age_range,
  profile.preferred_content_format,
  profile.partnership_type,
  profile.minfollowers,
  profile.social_handles,
  profile.profile_pic,
  profile.created_at,
  profile.contenttype,
  profile.website_url,
  profile.youtube_connected,
  profile.instagram_connected,
  profile.twitch_connected,
  profile.facebook_connected,
  profile.tiktok_connected,
  profile.twitch_login,
  profile.tiktok_username,
  profile.facebook_page_name,
  profile.public_dashboard_enabled,
  profile.public_dashboard_slug,
  profile."planType",
  profile.email_verified
from public.users_extended_data as profile
where coalesce(profile.banned, false) = false;

grant select on public.public_user_directory to anon, authenticated;

-- Email-confirmation signup has no authenticated session yet. This narrow RPC
-- allows one pending profile for a real Auth user and ignores privileged fields.
create or replace function public.register_pending_profile(p_user_id uuid, p_profile jsonb)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  auth_email text;
  confirmed_at timestamptz;
begin
  select account.email, account.email_confirmed_at into auth_email, confirmed_at
  from auth.users as account
  where account.id = p_user_id;

  if auth_email is null
    or lower(auth_email) <> lower(coalesce(p_profile->>'email', '')) then
    raise exception 'Signup details do not match an Auth account';
  end if;

  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'A profile can only be created for the signed-in account';
  end if;
  if auth.uid() is null and confirmed_at is not null then
    raise exception 'Sign in before creating a profile for a verified account';
  end if;

  if exists (select 1 from public.users_extended_data where user_id = p_user_id) then
    return false;
  end if;

  insert into public.users_extended_data (
    user_id, username, email, title, bday, company_name, location,
    about_yourself, "userType", platforms, target_audience, age_range,
    preferred_content_format, partnership_type, minfollowers, payment_method,
    paypal_email, social_handles, profile_pic, contenttype, agreed_tos,
    referral_code, "planType", is_admin, banned, strike_count, wallet,
    email_verified, stripe_customer_id, stripe_connect_account_id
  ) values (
    p_user_id,
    left(p_profile->>'username', 80), auth_email, p_profile->>'title',
    nullif(p_profile->>'bday', '')::date, p_profile->>'company_name',
    p_profile->>'location', p_profile->>'about_yourself', p_profile->>'userType',
    case when jsonb_typeof(p_profile->'platforms') = 'array' then
      array(select jsonb_array_elements_text(p_profile->'platforms')) else '{}'::text[] end,
    p_profile->>'target_audience', p_profile->>'age_range',
    p_profile->>'preferred_content_format', p_profile->>'partnership_type',
    p_profile->>'minfollowers', p_profile->>'payment_method',
    p_profile->>'paypal_email', coalesce(p_profile->'social_handles', '{}'::json),
    p_profile->>'profile_pic', p_profile->>'contenttype',
    coalesce((p_profile->>'agreed_tos')::boolean, false),
    p_profile->>'referral_code', 'free', false, false, 0, 0, false, null, null
  );
  return true;
end;
$function$;

revoke all on function public.register_pending_profile(uuid, jsonb) from public;
grant execute on function public.register_pending_profile(uuid, jsonb) to anon, authenticated;
