# Littles complimentary proof horizon — isolated review candidate

Preparation only, based on main `7e125c6a29337025c7015bfefe5e5dfbba636602`. No migration/function deployment, grant, code issuance/redemption, gate, provider, phone or public rollout action is included. Updaterb3/PR52 and its accepted packets remain frozen separately.

## Problem and change

The deployed `littles-play-store` version7 signs complimentary proofs with `exp = refresh time + 300 seconds`. Refreshing a five-minute gift near its end can therefore leave a valid cached proof beyond the actual gift end. Read-only deployed/source comparison and the normal live gift handoff are recorded separately; no live acceptance is inferred from source review alone.

The existing service-only finance projection gains a finite `complimentary_proof_until` and an explicit server-derived `complimentary_permanent`. It uses the same active, unrevoked, already-started Littles/target/entitlement grant filter. The maximum of active grant horizons preserves overlapping sources; each timed horizon stops at its real end, while a genuinely indefinite row supplies an ordinary five-minute lease. The existing `(app,target,entitlement) WHERE revoked_at IS NULL` index supports this query. No index, policy, role, grant or function signature changes are needed; CREATE OR REPLACE preserves the current postgres/service_role execution ACL, security-invoker behavior and empty search path. The function still has no Auth-directory access.

A pure policy used by the Edge handler rejects missing/invalid/expired timed horizons. It recognizes only an explicit trusted permanent flag, so permanent access can keep a short renewable proof even without a finite grant end. The live aggregate inspection found one active permanent reviewer grant; this source is preserved. No support/preview permanent class was returned by that aggregate. No account identities were exported.

Paid proofs retain their independent paid-through/one-day cap. Complimentary proofs retain the five-minute ceiling and timed-grant end. The final proof uses the later valid independently capped source horizon, preserving paid OR complimentary access when either source ends. A future/expired/revoked/other-account grant cannot supply that horizon. Integer-second proof expiry is floored, never rounded up, so no extra second is added. Existing JWT claim names, account/package/product binding, receipt/grant handling, normal-parent checks, CORS and reconciliation are unchanged.

## Validation

The existing Deno billing command includes the new renewal/boundary/OR/permanent tests in `rules_test.ts`; all18 tests (plus4 reconciliation steps) passed. Cases include repeated refreshes during one300second gift, expired/missing/malformed metadata, actual permanent-reviewer shape, overlapping finite horizons, valid paid after gift expiry, valid gift after paid expiry and subsecond ends. Existing provider diagnostics, subscription ownership and acknowledgement tests remain included. Both store/notification function type checks passed.

Eleven synthetic SQL VALUES cases executed read-only validate the actual aggregate/filter expression: delayed refresh, actual end, overlapping windows, indefinite grant, all exclusion predicates and fractional expiry. These are tests, not a clock change or live gift/DDL acceptance. The new PL/pgSQL replacement itself has not been applied or executed. Deno tests follow [Supabase’s existing testing guidance](https://supabase.com/docs/guides/functions/unit-test); no Docker/runtime stack or new dependency was installed.

## Review and deployment order

Root must review the exact frozen source and packet first. Only after separate authorization: apply the small projection migration, read it back and confirm its ACL/security flags plus the permanent-reviewer and finite-QA horizons; then deploy the Edge function with its current gateway/secret configuration unchanged. Confirm actual normal-auth status/proof renewal is bounded by the same receipt, and fresh status plus cached-proof rejection after the real gift end. Deploying the handler before the projection deliberately fails closed for unproven timed sources and must be avoided. No second grant, receipt-only unlock, reissue or clock rewind is authorized by this candidate.

Root owns the one-use300second QA code, ordinary Auth session and private receipt/proof handoff. Current live observations, including any bounds failure, must be preserved. Actual gift acceptance and subsequent native updater testing/publication remain separate from local fix preparation.
