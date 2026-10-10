-- Runs as the caller: existing admin RLS and profile guards remain in force.
create or replace function public.decide_admin_payout(p_payout_id uuid, p_decision text, p_reason text default null)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_payout public.payouts%rowtype;
  v_profile public.users_extended_data%rowtype;
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not exists (
    select 1 from public.users_extended_data where user_id = v_admin and is_admin is true
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_decision not in ('paid', 'rejected') or p_decision is null then
    raise exception 'Invalid payout decision';
  end if;
  if p_decision = 'rejected' and (nullif(btrim(p_reason), '') is null or length(p_reason) > 2000) then
    raise exception 'A rejection reason of up to 2000 characters is required';
  end if;
  select * into v_payout from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'Payout not found'; end if;
  if v_payout.status = p_decision then
    return jsonb_build_object('status', p_decision, 'already_processed', true);
  end if;
  if v_payout.status is distinct from 'pending' then
    raise exception 'Only pending payouts can be processed';
  end if;
  if v_payout.payout_amount is null or v_payout.payout_amount <= 0
    or v_payout.payout_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Invalid payout amount';
  end if;
  select * into v_profile from public.users_extended_data where user_id = v_payout.sponsee_id for update;
  if not found then raise exception 'Payout account not found'; end if;
  if (v_profile."userType" = 'sponsor' and v_payout.payout_user_role is distinct from 'sponsor')
    or (v_profile."userType" = 'besponsored' and v_payout.payout_user_role is distinct from 'sponsee')
    or v_profile."userType" is null or v_profile."userType" not in ('sponsor', 'besponsored') then
    raise exception 'Payout account role does not match';
  end if;
  if p_decision = 'paid' and (v_profile."userType" = 'sponsor' or v_payout.offer_id is null) then
    if v_profile.wallet is null or v_profile.wallet < v_payout.payout_amount
      or v_profile.wallet::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Insufficient wallet balance';
    end if;
    update public.users_extended_data set wallet = wallet - v_payout.payout_amount where user_id = v_profile.user_id;
  end if;
  update public.payouts set status = p_decision,
    paid_at = case when p_decision = 'paid' then now() else null end,
    paid_by_admin_id = v_admin,
    notes = case when p_decision = 'rejected' then btrim(p_reason) else notes end
  where id = p_payout_id;
  insert into public.admin_activity_log(action, performed_by, target_id, target_type, message)
  values (case when p_decision = 'paid' then 'Mark Payout Paid' else 'Reject Payout' end,
    v_admin, p_payout_id::text, 'payout', case when p_decision = 'rejected' then btrim(p_reason) else 'External payment recorded; no funds sent by this action.' end);
  if v_profile.notification_uuid is not null then
    insert into public.user_notifications(notification_uuid, email, type, title, message, read, created_at)
    values(v_profile.notification_uuid, v_profile.email, 'admin',
      case when p_decision = 'paid' then 'Withdrawal Payment Recorded' else 'Withdrawal Rejected' end,
      case when p_decision = 'paid' then 'An administrator recorded your withdrawal as paid. Contact support if the external payment has not arrived.'
      else 'Your withdrawal was rejected. Reason: ' || btrim(p_reason) end, false, now());
  end if;
  return jsonb_build_object('status', p_decision, 'already_processed', false,
    'sponsee_id', v_payout.sponsee_id, 'payout_amount', v_payout.payout_amount);
end;
$function$;
revoke all on function public.decide_admin_payout(uuid, text, text) from public, anon;
grant execute on function public.decide_admin_payout(uuid, text, text) to authenticated;
