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

  if amount is null or amount <= 0 then
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
  where payout.sponsee_id = use_wallet_funds.user_id
    and payout.status = 'pending';

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
