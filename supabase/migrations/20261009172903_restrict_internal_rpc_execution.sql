-- These functions are internal helpers or trigger entry points, not public RPCs.
-- Trigger execution does not require callers to have direct EXECUTE permission.
revoke all on function public.create_policy_if_not_exists(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.increment_wallet(uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.set_owner()
  from public, anon, authenticated;
revoke all on function public.handle_new_user_role()
  from public, anon, authenticated;
revoke all on function public.aff_auto_log_signup()
  from public, anon, authenticated;
revoke all on function public.fn_affiliate_conversion_from_referral()
  from public, anon, authenticated;
revoke all on function public.increment_referral_signups()
  from public, anon, authenticated;

-- Affiliate review RPCs remain available to signed-in admins only; their
-- SECURITY DEFINER bodies already verify the caller through is_current_user_admin().
revoke execute on function public.approve_affiliate(uuid, numeric, text) from public, anon;
revoke execute on function public.reject_affiliate(uuid) from public, anon;
