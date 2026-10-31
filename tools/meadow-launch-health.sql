-- Operator-only, read-only launch health. No credentials, player names, email,
-- snapshots, provider tokens or recovery material leave the database.
select jsonb_build_object(
 'checked_at',clock_timestamp(),
 'commerce',(select jsonb_build_object('payments',payments_enabled,'ads',ads_enabled,'production_ready',production_ready) from meadow_private.commerce_config where id),
 'new_farms',(select new_farms from meadow_private.farm_start_config where singleton),
 'enabled_products',(select count(*) from meadow_private.store_products where enabled),
 'active_provider_tests',(select count(*) from meadow_private.play_license_acceptance where expires_at>clock_timestamp()),
 'farms',(select count(*) from public.meadow_market_saves),
 'protected_farms',(select count(*) from public.meadow_market_saves where save_protocol=4),
 'protected_without_provenance',(select count(*) from public.meadow_market_saves s where s.save_protocol=4 and (not exists(select 1 from meadow_private.farm_command_accounts a where a.user_id=s.user_id) or not exists(select 1 from meadow_private.farm_origins o where o.user_id=s.user_id))),
 'last_verified_action',(select max(created_at) from meadow_private.farm_command_receipts),
 'opt_in_errors_24h',(select count(*) from meadow_private.diagnostics where created_at>clock_timestamp()-interval '24 hours'),
 'unsettled_purchases_15m',(select count(*) from meadow_private.store_purchases where not settled and revoked_at is null and created_at<clock_timestamp()-interval '15 minutes'),
 'real_purchases',(select count(*) from meadow_private.store_purchases where not test_purchase),
 'backup_rows',(select count(*) from meadow_private.farm_backups)
) as meadow_launch_health;
