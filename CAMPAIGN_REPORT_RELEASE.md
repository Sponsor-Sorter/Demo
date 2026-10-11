# Campaign reporting release — 12 October 2026

## Published scope
- Both private sponsorship dashboards expose Performance history for live and completed campaigns.
- Participant-only saved observations survive later refresh failures; missing metrics stay unknown.
- Reports disclose observation timestamps, browser provenance, possible staleness and the absence of background refresh.
- CSV export excludes private provider payloads and escapes spreadsheet formulas.
- Platform host checks reject lookalike domains, credentials and non-HTTPS URLs.
- Existing live migration 20261011090944 backs reporting; no financial or real-user data changed.

## Validation
- 78 application tests passed in the full working tree.
- Three independent report regression tests passed.
- Isolated campaign-history database tests passed, including participant isolation, immutable history and cadence.
- Sponsor and creator report views checked in a read-only browser fixture. Sponsor document width equalled viewport width (1265px).
- No claim of new narrow-screen verification in this release.

## Payment work remains local
- Deno 2.9.7 installed under ignored .validation/tools; three payment functions type-check.
- Real Stripe SDK signature test passes: valid, tampered, stale and retryable delivery cases.
- Checkout redirect updated locally; webhook transport errors corrected locally.
- Purchase database tests pass for ownership, cents, rollback, insufficient funds, binding and replay.
- Orders/packages schema and payment handlers are NOT deployed. Never publish their frontend callers separately.
- Sandbox acct_1RSqPq2eA1800fRN selected. Created provider-only session cs_test_a1quk5PXolTVdF2P5qaaw7u6BNOxRaERUSaEIMjEhu4RXl1QbUPa7D8GyL; no payment completed, no order linked. Browser did not load a usable checkout. This is not an end-to-end payment pass.
- Still required: configured signed webhook and sandbox credentials, actual paid checkout + reconciliation, expiration/recovery, concurrent retries, refunds/disputes, verified funding ledger and creator settlement/Connect transfer recovery.
- Legacy wallet balances are not evidence of cash funding. Keep automatic money movement disabled.
- Preserve Moikailive. Remaining local preferences/packages changes are separate unfinished work.

## Continue
Read PRODUCTION_BUILD_STATUS.md and SUPABASE_TABLE_AUDIT.md, then inspect git status; several workstreams remain uncommitted. Reconcile migrations applied through Supabase SQL UI before CLI migration deployment. Use Supabase and Stripe skills; browser tests use computer-use. No real payments or transfers occurred.

### Follow-up: stored markup protection
Both offer dashboards now escape sponsorship text and profile labels before HTML rendering. This prevents markup in titles/descriptions/instructions from executing. The focused regression covers hostile markup and attribute quotes; this is not a claim that every legacy template has been audited.
