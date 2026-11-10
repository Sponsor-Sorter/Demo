-- Keep private acceptance pinned to the reviewed Play builds. This remains
-- operator evidence, not client attestation or proof of non-revenue traffic.
set local lock_timeout='3s';
alter table meadow_private.ad_provider_acceptance
 drop constraint ad_provider_acceptance_native_version_check,
 add constraint ad_provider_acceptance_native_version_check
 check(native_version in ('1.7.2','1.7.3'));
