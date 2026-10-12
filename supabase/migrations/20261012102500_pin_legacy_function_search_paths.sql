-- Reviewed legacy functions resolve unqualified relations in public. Put
-- pg_catalog first and pg_temp last so caller-created objects cannot shadow them.
do $migration$
declare target record;
begin
  for target in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'set_owner', 'log_comment_action', 'set_updated_at_affapps',
      'create_policy_if_not_exists', 'increment_wallet_balance',
      'increment_referral_signups', 'affiliate_money_totals', 'delete_user_logo',
      'increment_wallet', 'fn_set_updated_at', 'handle_new_user_role',
      'count_actions', 'check_signup_limit', 'signup_stats_by_day',
      'offer_stats_by_day', 'review_stats_by_day', 'check_login_limit',
      'check_offer_limit', 'check_comment_limit', 'check_report_limit', 'auto_ban_user'
    ])
  loop
    execute pg_catalog.format(
      'alter function %s set search_path = pg_catalog, public, pg_temp',
      target.signature
    );
  end loop;
end;
$migration$;

-- Wallet mutation is a server operation, never a client RPC.
revoke all on function public.increment_wallet_balance(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.increment_wallet_balance(uuid, numeric)
  to service_role;
