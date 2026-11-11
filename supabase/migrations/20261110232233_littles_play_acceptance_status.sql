-- Private, expiring provider acceptance never opens the public flags.
create or replace function meadow_littles_private.play_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := meadow_littles_private.require_actor(); parent_ready boolean; test_allowed boolean; account_hash text; paid_until timestamptz; config meadow_littles_private.play_config;
begin
 select not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null into parent_ready from auth.users u where u.id=actor;
 test_allowed:=coalesce(parent_ready,false) and exists(select 1 from meadow_littles_private.play_testers t where t.user_id=actor and t.expires_at>now());
 account_hash:=encode(sha256(convert_to('meadow-littles:'||actor::text,'UTF8')),'hex');
 if parent_ready then
  insert into meadow_littles_private.play_accounts(user_id,account_hash) values(actor,account_hash) on conflict(user_id) do nothing;
 end if;
 select max(s.expires_at) into paid_until from meadow_littles_private.play_subscriptions s
 where s.user_id=actor and s.state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED') and s.expires_at>now() and (not s.is_test or test_allowed);
 select * into config from meadow_littles_private.play_config where singleton;
 return jsonb_build_object('user_id',actor,'parent_ready',coalesce(parent_ready,false),'account_id',case when parent_ready then account_hash else null end,
 'paid_active',coalesce(parent_ready and paid_until>now(),false),'paid_until',paid_until,
 'checkout_enabled',config.checkout_enabled or test_allowed,'ads_enabled',config.ads_enabled or test_allowed,'provider_test',test_allowed,'checkout_test_only',test_allowed and not config.checkout_enabled,'ads_test_only',test_allowed and not config.ads_enabled,'free_daily_rounds',5,'product','ml_plus','base_plan','monthly');
end $$;
