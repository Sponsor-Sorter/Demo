# Meadow247 ad-policy consumer — isolated candidate

14November2026. Branch `codex/meadow-ad-policy247`, based on fresh main `c79b12d4933f7b781d3eb0094aa778aab6679cac`. This receipt covers prepared source and focused acceptance; it does not claim deployment, policy activation, a live impression or native/public rollout.

## Shared boundary

Fairplay owns the central accepted-policy schema/action/editor/backend and Admin packaging. Meadow owns the optional own-account projection and client. The agreed identifier is `meadow-ad-policy-v1`, fixed app `meadow`, first compatible web build247. Root's source contract is `FairplayAdmin/docs/MEADOW_AD_POLICY_IMPLEMENTATION_V1.md`.

The only controls are integers `popup_every_completed_games`3–20 and `popup_min_interval_seconds`180–3600. Defaults remain3/180. Rewards, products, account auth, Premium/support/gifts, consent, provider units and all existing boolean commerce gates are unchanged.

Root's fixed LF/final-LF canonical vector is pinned in `tools/fixtures/meadow-ad-policy247.json`; SHA-256 is `6becd55da3e44a6a2a3a5f6da28bcc97e15a7bf051ffb98b530f0537f453f0d3`. UTC timestamps are exact three-fraction ISO strings. Root migration reviewed at SHA-256 `66e13857e22fa5184acdfbf75762acd3fa2643f3dde7b8178f5940815006f3de`; its reported hosted transaction preflight is Root-owned evidence, not a Meadow deployment claim.

## Backend source

- CLI-created `supabase/migrations/20261114030020_meadow_numeric_ad_policy247.sql` guards the current public function's owner and existing source before replacement.
- The existing postgres-owned, empty-search-path public definer calls **`commerce_status239()` and `pack_grants240(auth.uid())` first**, preserving own-account, moderation, all ten products and pack-benefit fields.
- It only appends `numeric_ad_policy`, obtained from an invoker helper restricted to the DB owner. The helper calls the fixed no-argument `fairplay_admin_private.meadow_ad_policy_read_v1()`; no browser gains private schema/table/function access.
- Exact `to_regprocedure` absence yields null. Unexpected reader/ACL errors are not silently converted to an accepted policy. The existing RPC failure path suppresses new ads. No app/actor/build authority is taken from browser arguments.
- `supabase/meadow-ad-policy247-acceptance.sql` contains catalog/ACL/empty-reader assertions in BEGIN/ROLLBACK for joint acceptance. It changes no JWT/session/role and performs no user, wallet or policy write. Root owns genuine normal game-API checks through its approved disposable actor after reviewed deployment.

Read-only preflight inspected the actual existing function owner/ACL/body; no live migration or policy write was performed by this candidate preparation.

## Client behavior

- `ad-policy.js` validates exact fields, bounds, compatible build, canonical digest, accepted status and effective/expiry times. Null, rejected/unknown/incompatible policies use shipped default pacing; only a successful current own-account commerce read can make the ad path fresh.
- Cache lifetime is bounded by both wall and monotonic clocks,300seconds from **request start**, and earlier policy expiry. Suspended-clock and long-response cases are covered. Foreground/resume invalidates earlier work and refreshes commerce; old-account or older-request completions cannot apply.
- Last accepted version/hash supplies an account-session anti-rollback floor. Null/default reads do not resurrect an earlier accepted version.
- `store.js` composes the policy read with existing commerce refresh. A queued popup captures count/gap requirements and can only become stricter across later refreshes. Provider/kill routing, account, Premium, opt-out and policy freshness are rechecked after consent, immediately before the attempt.
- `farm-club.js` retains the cumulative completed-round count,100-result deduplication history and last attempted popup time. It uses the shared safe game-close boundary. Hidden/modal screens defer; Premium and opt-out cancel pending breaks. Attempt time is consumed before provider loading, including no-fill failures.
- `adPendingPolicy` is an account-bound **UI preference** added to `farm-command-ui.js`; it is stripped from the authoritative domain fingerprint. It cannot insert applied receipts, set wallet resources or grant rewards. Canonical refreshes preserve the preference safely.
- Explicit rewarded choice remains separate, including for Premium. Only the existing server nonce/signed callback can credit gems/tickets. Scoped free previews and isolated provider tests remain separate; no real provider traffic was used here.
- The existing shop note reports current pacing values. No new artwork/audio or native plugin is required for this backend/pacing change.

## Build/cache preparation

Candidate247 updates `currentBuild`, release metadata, exact offline entry, changed script query versions, service-worker cache and changed-runtime hashes together. New `ad-policy.js` loads before `store.js`. All existing HD media fingerprints are reused unchanged. The generated server rules diff is exactly its fingerprint line; no farming arithmetic/module output changed.

No Android source, dependency lock, workflow, archived release, download URL, other-game runtime or Admin file is part of this Meadow branch. The separate performance and dev-dependency review work is parked on its own branch.

## Focused checks

Passed locally:

-14policy cases: shared vector, schema/bounds, accepted/unknown/future/expired/build/hash/version handling, both clocks, request latency, cache/resume/account ordering, stricter pending eligibility, UI-only authority and runtime/cache closure.
-Actual `farm-club` + `store` controller fixtures: default/candidate pacing, completed-result deduplication, modal/hidden/account transitions, consent denial, offline/failed commerce, opt-out/Premium, provider-route/kill changes during consent, canonical-state replacement, no-fill cooldown, refreshed stricter queue surviving null/default, resume read and unchanged reward authority.
-Existing `check-meadow-ads221.cjs`, `check-meadow-commerce225.cjs`, `check-meadow-premium234.cjs` and `check-meadow-command-ui210.cjs`.
-Existing Deno purchase/account-binding and signed-AdMob-callback tests:2passed.
-Version check with local safe-directory configuration, and shared server-rule source match.

The policy check is registered through the existing `scripts/check-meadow.cjs`, leaving the workflow unchanged. All provider calls in these tests are controlled callbacks. These results do not substitute for the reviewed SQL/ACL/real own-account API acceptance or full publication CI.

## Remaining joint gates

1. Reciprocal source review and hosted rollback checks for the exact central/Meadow SQL, then central empty-reader scaffolding and additive adapter deployment/read-back. Preserve existing gates and zero accepted policies.
2. Root's genuine approved disposable-account API/default/null and account-isolation checks; no fabricated session or policy action.
3. Full existing CI on the reviewed source; coordinate a fresh main/Pages window before a consumer rollout. The build-only gateway fingerprint needs scoped source/read-back review if deployed with247.
4. Compatible consumer acceptance and separate applied/default diagnostics before Fairplay exposes its editor. Admin packaging/Windows verification remains Root-owned and subject to its existing controller safety stop.

No phone/Windows UI, live ad, purchase, gift, production-setting change, Docker, backup or restore occurred during this source preparation.
