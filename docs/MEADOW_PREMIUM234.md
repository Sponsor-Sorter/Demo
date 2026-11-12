# Meadow Markets Premium consumer234

11 November2026, Sydney. Candidate web234; publication and final browser acceptance are recorded below when complete. The word-find233 layout and Littles53 are preserved. No ad gate, product price, native binary or central grant capability is enabled by this change.

## Authoritative access

Migrations `20261111012408_meadow_complimentary_premium234` and `20261111014704_meadow_private_premium_status234` target the existing BargainBarge project `ejavqlyozqhzqogflqzr`. Effective Premium is delivered/unrevoked verified Play access OR private support/legacy-preview access OR an active central `meadow`/`premium` gift. Paid evidence uses the delivered benefit snapshot, with product fallback only for historical missing snapshots; acknowledgement retry does not remove a delivered purchase. Receipt ownership/kind must match. Refunds retain the original consumable reversal, farm-effect rollback and support-review hold.

Two already-enabled pre-store free-preview farms lacked Play/support rows. Their existing access was frozen in private `meadow_private.legacy_premium234`, backed by old server test receipts; it is explicitly not paid evidence. RLS is enabled and no client/service-role table grant interface exists. Future approved free-test Premium purchases retain explicit private support evidence. No existing player was issued a new central gift.

`public.meadow_market_premium_status()` is an authenticated invoker wrapper over private own-account work with existing control/profile/deletion guards. `public.meadow_market_premium_projection(p_user uuid)` is service-only and returns `paid`, `support`, `legacy_preview`, `complimentary`, `premium`, `contract: meadow-premium234`. It reads access and cannot issue it. Admin consumers must use effective `premium`; `paid` alone intentionally excludes support/gifts. The central issuance adapter remains disabled pending independent Admin acceptance.

The game refreshes Premium every60 seconds while visible/online, on resume, and during existing account/shop refresh. The lightweight endpoint does not scan receipt history or mutate a farm save. Old-account, older-request and cached round responses cannot overwrite current verified access. A transient connection failure preserves the last verified status; new ad requests still require online server/store checks.

## Validation

- `tools/meadow-premium234-check.sql`: rollback-only target/game isolation, future start, active/expired/revoked gifts, paid acknowledgement retry, positive/false benefit snapshots, historical fallback, second paid purchase, refund/retry coexistence, support/legacy preservation, unrelated wallet fields, ACLs and approved free-test purchase.
- `scripts/check-meadow-premium234.cjs`: actual client refresh code, grant/revoke, retained currency, network failure, rejected/unverified/cached responses, coalescing, response order, account switching and hidden/offline guards. Existing commerce, club navigation and refund checks pass.
- Local full regression reached all functional checks; its shared fake-cache Response clone failed during the long combined run. The standalone cache check then passed all1418 fingerprints/reuse checks. Final publication CI must pass before this candidate is called fully accepted.
- First branch CI42941568021 found the older billing fixture passed an unmarked wallet as verified access. Its inputs now carry the new verified marker/request order; the original open-shop paid/refund assertions are retained. Migration `20261111015052_meadow_test_premium_receipt_binding234` additionally prevents a reused free-test request from creating different support evidence.
- Gateway46 is JWT-verified; all eight deployed files read back exactly. Only the generated rules fingerprint changed to `5fd2677ecb919015c3ca8c4896f09bfee8054ebc3f39e01707f58b9a8fdc52f0`; farm arithmetic is unchanged.
- Security advisors add only the expected private/RLS/no-policy informational entry for the inaccessible frozen legacy table. Existing shared-project advisories remain separate.
- Corrected branch CI42942067189 passed both game checks and optimized Android compilation. The full CI cache/fingerprint check passed. Final source runtime is `e4d61cf63c92afc7e145abcbf01dd2d2f978a96f`; later receipt commits change documentation only.
- Source lookups are covered by existing purchase/support owner indexes, the frozen table primary key and the central `(app,target,entitlement) WHERE revoked_at IS NULL` index. The public-definer warning count returned to its original6 after the private-wrapper migration. The sole additional [RLS informational entry](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is intentional deny-all access to the private frozen legacy table.

## AdMob reporting mapping

Android package `com.meadowandmarket.game`; production app ID `ca-app-pub-6946008351204848~7779211148`; rewarded unit `ca-app-pub-6946008351204848/6866630905`; interstitial `ca-app-pub-6946008351204848/8491985021`. These non-secret IDs are from the existing Play flavour in `tools/meadow-android/android/app/build.gradle`. Web does not serve an AdMob SDK. No iOS AdMob mapping is configured here. Reporting authorization/mapping belongs to Fairplay Admin; no revenue is inferred from purchases or gems.

## Browser acceptance and publication

Acceptance uses the full game at the existing command-QA origin `127.0.0.1:8773`, with local-server-only isolated auth/save namespaces and legacy-session import disabled. Production source files are unchanged by that isolation; the shipped `farm-club.js` is the actual module under test. Only a newly created anonymous account tagged `command-ui210` receives the temporary ledger fixture. The earlier untagged guest at that origin was left untouched. All fixture transitions, cleanup and live-public source verification must be recorded before enabling Admin issuance.

Local real-browser active→expired→active→revoked transitions passed through the live database while Emporium remained open, with no refresh click or reload. The Premium button and ad-suppression note changed automatically. Evidence is in the external launch230 folder: `premium-active234.png`, `premium-expired234.png`, `premium-restored234.png`, `premium-revoked234.png`. A public deployment and cleanup are still pending at this candidate receipt.
