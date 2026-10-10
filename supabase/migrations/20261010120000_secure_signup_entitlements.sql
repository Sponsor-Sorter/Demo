alter table public.users_extended_data
  add column if not exists stripe_subscription_id text;

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
  select account.email, account.email_confirmed_at
    into auth_email, confirmed_at
  from auth.users as account
  where account.id = p_user_id;

  if auth_email is null or lower(auth_email) <> lower(coalesce(p_profile->>'email', '')) then
    raise exception 'Signup details do not match an Auth account';
  end if;
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'A profile can only be created for the signed-in account';
  end if;
  if auth.uid() is null and confirmed_at is not null then
    raise exception 'Sign in before creating a profile for a verified account';
  end if;
  if lower(coalesce(p_profile->>'userType', '')) <> 'besponsored'
    or lower(coalesce(p_profile->>'planType', 'free')) <> 'free' then
    raise exception 'Free registration is available to sponsee accounts only';
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
    p_user_id, left(p_profile->>'username', 80), auth_email, p_profile->>'title',
    nullif(p_profile->>'bday', '')::date, p_profile->>'company_name',
    p_profile->>'location', p_profile->>'about_yourself', 'besponsored',
    case when jsonb_typeof(p_profile->'platforms') = 'array' then
      array(select jsonb_array_elements_text(p_profile->'platforms')) else '{}'::text[] end,
    p_profile->>'target_audience', p_profile->>'age_range',
    p_profile->>'preferred_content_format', p_profile->>'partnership_type',
    p_profile->>'minfollowers', p_profile->>'payment_method',
    p_profile->>'paypal_email', coalesce((p_profile->'social_handles')::json, '{}'::json),
    p_profile->>'profile_pic', p_profile->>'contenttype',
    coalesce((p_profile->>'agreed_tos')::boolean, false),
    p_profile->>'referral_code', 'free', false, false, 0, 0, false, null, null
  );
  return true;
end;
$function$;

revoke all on function public.register_pending_profile(uuid, jsonb) from public;
grant execute on function public.register_pending_profile(uuid, jsonb) to anon, authenticated;

-- Called only by the paid-signup Edge Function after it verifies Checkout and
-- the active subscription directly with Stripe.
create or replace function public.register_paid_profile(
  p_user_id uuid,
  p_email text,
  p_profile jsonb,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  auth_email text;
begin
  if p_price_id is distinct from 'price_1SbWeEGpIACU7TxK1H3mXQfR'
    or p_customer_id is null
    or p_subscription_id is null
    or p_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_subscription_id !~ '^sub_[A-Za-z0-9]+$' then
    raise exception 'Invalid paid plan confirmation';
  end if;
  if lower(coalesce(p_profile->>'userType', '')) not in ('sponsor', 'besponsored') then
    raise exception 'Invalid account type';
  end if;
  select lower(account.email) into auth_email
  from auth.users as account where account.id = p_user_id;
  if auth_email is null or auth_email <> lower(p_email)
    or auth_email <> lower(coalesce(p_profile->>'email', '')) then
    raise exception 'Paid signup does not match the Auth account';
  end if;
  if exists (select 1 from public.users_extended_data where user_id = p_user_id) then
    update public.users_extended_data
      set "planType" = 'pro', stripe_customer_id = p_customer_id,
          stripe_subscription_id = p_subscription_id
      where user_id = p_user_id and lower(email) = auth_email and coalesce(banned, false) = false;
    if not found then raise exception 'Existing profile cannot be upgraded'; end if;
    return true;
  end if;

  insert into public.users_extended_data (
    user_id, username, email, title, bday, company_name, location,
    about_yourself, "userType", platforms, target_audience, age_range,
    preferred_content_format, partnership_type, minfollowers, payment_method,
    paypal_email, social_handles, profile_pic, contenttype, agreed_tos,
    referral_code, "planType", is_admin, banned, strike_count, wallet,
    email_verified, stripe_customer_id, stripe_connect_account_id,
    stripe_subscription_id
  ) values (
    p_user_id, left(p_profile->>'username', 80), auth_email, p_profile->>'title',
    nullif(p_profile->>'bday', '')::date, p_profile->>'company_name',
    p_profile->>'location', p_profile->>'about_yourself', p_profile->>'userType',
    case when jsonb_typeof(p_profile->'platforms') = 'array' then
      array(select jsonb_array_elements_text(p_profile->'platforms')) else '{}'::text[] end,
    p_profile->>'target_audience', p_profile->>'age_range',
    p_profile->>'preferred_content_format', p_profile->>'partnership_type',
    p_profile->>'minfollowers', p_profile->>'payment_method', p_profile->>'paypal_email',
    coalesce((p_profile->'social_handles')::json, '{}'::json), p_profile->>'profile_pic',
    p_profile->>'contenttype', coalesce((p_profile->>'agreed_tos')::boolean, false),
    p_profile->>'referral_code', 'pro', false, false, 0, 0, false, p_customer_id, null,
    p_subscription_id
  );
  return true;
end;
$function$;

revoke all on function public.register_paid_profile(uuid, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.register_paid_profile(uuid, text, jsonb, text, text, text) to service_role;
