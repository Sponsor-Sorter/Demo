# Meadow Markets launch operations

## Before opening production

Run tools/meadow-launch-health.sql through the operator's private Supabase connection. It contains only aggregate health, never player snapshots or provider tokens. Capture the results with the release commit, web build, native version, rules hash and UTC time. Check Play's package-specific crash/ANR and pre-launch reports separately; opt-in JavaScript diagnostics are not universal crash reporting.

- protected_without_provenance must be0. An unexpected value blocks enrollment and checkout; inspect that account privately.
- Public commerce stays off until provider acceptance. Active provider test entries must match the exact approved account, products and expiry. Close them after testing.
- Investigate any purchase unsettled longer than15minutes. Retry its existing provider verification/settlement; never mint a replacement grant or create another charge.
- Compare errors against unique opted-in devices and the previous build. A zero count is not proof of zero crashes because reporting is opt-in.
- Check private player reports and the support inbox each operating day. Resolve purchase/recovery issues against the original account and receipt, preserving audit records.
- Recovery archives now include the authoritative farm, wallets, paid entitlement, collection ownership, provenance and receipt watermarks. Inspect recovery_missing_today after scheduled maintenance has caught up (100 farms per run); recovery_hash_failures_recent must be0. These database-local archives are not an independent disaster backup. Keep a private off-host database backup and its matching immutable ledgers.

## Release and rollback

1. Record the previous immutable source commit, signed native bundle, rules hash and working browser build. Keep game and backend changes backward compatible with the current Play shell.
2. Run focused behaviour checks, the full CI workflow and actual live browser acceptance. Keep native purchase/device outcomes separate from fixtures.
3. Back up a named existing farm privately before any reviewed conversion, with its exact revision and SHA256. Conversion must reject stale revision/hash and retain a reviewed-beta opening balance; old test wealth is not verified earning history.
4. Enable new-farm issuance separately from existing-farm conversion. Do not mass-convert old players or downgrade a protocol4 farm to get around a warning. Review legacy farms individually.
5. After a serious regression, turn off new checkout/ad issuance and stop further enrollment. Keep already-paid receipt delivery, restore, signed refund notifications and existing protected saves operational.
6. Revert a broken web change as a NEW higher build containing the reviewed previous behaviour; never decrease update/cache build numbers. For a native fault, publish a corrected higher version code. Preserve package ID and signing lineage.
7. A disaster restore must use private database backup plus receipt/revision reconciliation. Never upload an old player-exported snapshot over the current authoritative save. The220 logical farm restore passed in a new local PostgreSQL database, including ownership, command replay and reward non-duplication; see meadow-market-recovery220.md. Hosted Auth, Storage, Edge configuration and a full Supabase project restore remain outside that evidence.

## Remaining launch evidence

Server rollout, actual Google license purchase/pending/restore/refund, ad privacy and rewarded-ad SSV/no-fill, current Samsung touch/orientation/offline/heavy-farm profile, physical iPad, and recovery must each have a dated result. Logical farm recovery has dated220 evidence; full hosted-project recovery is separate. Google public beta review and production release are separate. No single CI badge closes these gates.
