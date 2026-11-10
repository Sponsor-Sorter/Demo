-- Reviewed 1.7.4 provides explicit Google demo-unit isolation and a capability
-- handshake. Keep the short-lived operator allowlist private and versioned.
set local lock_timeout='3s';
alter table meadow_private.ad_provider_acceptance
 drop constraint ad_provider_acceptance_native_version_check,
 add constraint ad_provider_acceptance_native_version_check
 check(native_version in ('1.7.2','1.7.3','1.7.4'));
