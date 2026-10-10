-- Trusted database functions may update protected fields; ordinary profile edits remain guarded.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
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


-- Ensure a signed-in user can only spend from their own wallet.
-- The argument remains the profile row ID for compatibility with existing callers.
create or replace function public.use_wallet_funds(user_id uuid, amount numeric)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_owner_id uuid;
  v_current_balance numeric;
  v_pending_payouts numeric;
  v_available_balance numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if amount is null or amount <= 0 or amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Amount must be greater than zero';
  end if;

  select profile.user_id, coalesce(profile.wallet, 0)
    into v_owner_id, v_current_balance
  from public.users_extended_data as profile
  where profile.id = use_wallet_funds.user_id
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'Not authorized to spend from this wallet';
  end if;

  select coalesce(sum(payout.payout_amount), 0)
    into v_pending_payouts
  from public.payouts as payout
  where payout.sponsee_id = v_owner_id
    and payout.status in ('pending', 'requested', 'approved', 'processing');

  v_available_balance := v_current_balance - v_pending_payouts;

  if v_available_balance < amount then
    return false;
  end if;

  update public.users_extended_data as profile
  set wallet = coalesce(profile.wallet, 0) - amount
  where profile.id = use_wallet_funds.user_id
    and profile.user_id = auth.uid();

  return found;
end;
$function$;

revoke all on function public.use_wallet_funds(uuid, numeric) from public, anon;
grant execute on function public.use_wallet_funds(uuid, numeric) to authenticated;
