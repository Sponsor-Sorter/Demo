# Littles optional extra rounds — candidate91/native15

The optional offer appears only after the selected game's five daily completed rounds and weekly bonus rounds have been used. It offers one extra completed round, or another game. Failed or abandoned play does not spend a credit. Verified paid or complimentary Plus remains unlimited and ad-free. No automatic, startup or transition advert is added.

## Frozen Android artifact

- Package: `com.meadowmarket.littles`, Play version15 /1.0.2.
- Artifact: `tools/meadow-littles-android/android/app/build/outputs/bundle/playRelease/app-play-release.aab`.
- SHA256: `82f91de2afb2ccabbc0db2119b7b75e8fa89def82ceb35523e6e19a91c871486`.
- Signed with the existing protected Littles upload key. Debug and signed Play builds compiled; actual launcher definitions and required native classes passed the package checker. Native JUnit passed (three BannerLayout tests and one existing example); full `lintPlayRelease` passed. The AAB upload-signer SHA256 is `CF:07:A2:E5:6A:9D:04:1B:29:84:C0:7F:33:B8:17:60:AD:BB:08:82:58:6F:23:8D:75:0B:1C:69:43:4B:5A:BC`. Install only through a Play internal-track update over the existing Play-signed app; do not uninstall, sideload a differently signed build, clear app data, or change device settings.
- The accepted14 installed-state receipt is `D:/Chat Gpt/workspaces/littles89-qa/ROOT-NATIVE90-FINAL-PUBLIC-ACCEPTANCE.json`. No retained14 AAB/upload-signer receipt was located, so a manual14-to15 upload-certificate comparison is **not** claimed. After packet admission, upload only into the existing Littles app and require Play's package/upload-key validation to accept version15 with unchanged certificate configuration. Stop on any mismatch; no key/signing-setting change is authorized or needed.

## Default-off delivery

The new migration and two Edge Functions are isolated from existing saves, Plus, weekly fair and config tables. The migration creates a default-off private config, a challenge ledger, authenticated live-session RPC and service-only signed-receipt recorder. No existing rows are rewritten. The optional provider requires a verified parent, freshly verified non-Plus projection, native15, UMP consent and a matching unit. An unsupported native14 simply retains existing behavior.

- Migration: `20261122114713_littles_rewarded_rounds91.sql`.
- Authenticated consumer: `littles-ad-rounds` (`verify_jwt: true`).
- Google signed callback: `littles-ad-round-reward` (`verify_jwt: false`); it independently verifies pinned Google ECDSA keys, exact unit/reward, unique transaction and server-created opaque challenge.
- SSV URL to configure after deployment: `https://ejavqlyozqhzqogflqzr.supabase.co/functions/v1/littles-ad-round-reward`.
- Google's setup test uses user_id `littles-admob-setup`, custom_data `verification-only`. Only a valid Google signature reaches the no-credit probe branch.
- New unit: `ca-app-pub-6946008351204848/6193791997`, rewarded interstitial, amount1 `extra_round`, playable/interactive ads off. High-engagement ads were already off. The source exposes it only via an explicit opt-in intro.
- One request is bound to the actual account, selected game and a first-party random installation UUID. Only the opaque challenge goes to Google. No parent login, name, AAID, Android ID or hardware identifier is added.
- A client reward callback is insufficient. A unique, verified server receipt is required. Early dismiss/no fill gives no credit. Duplicate callbacks/claims cannot add another. Pending verification is recovered without a second advert; only successful game completion spends the local credit. New daily free rounds and Plus take priority. An interrupted request blocks a new offer only until its10minute nonce deadline. Its potential late signed receipt remains recoverable for24hours after that deadline. Recovery examines every pending request for the game, so an old unverified request cannot starve a newer earned receipt. Two separately completed adverts can legitimately result in two distinct credits if one receipt arrives late; neither transaction can grant twice.
- Existing base ads availability is mandatory for both public and private requests. The new private cohort only bypasses the new feature's public enabled/serving-ready gates; it cannot override the existing ads shutdown switch. Already-earned claims remain deliverable after shutdown.
- Resource cap:10 preparations per hour/account, idempotent request lookup. This is separate from the existing daily/weekly game allowance.

## AdMob status and policy evidence

On22November the exact existing public Play listing was linked to AdMob and verification succeeded. Google started an app-readiness review and warned that serving remains limited until complete. This is separate from Play publication. Do not claim public fill/Ready from the store-link success.

Official Families policy: <https://support.google.com/googleplay/android-developer/answer/9893335?hl=en> requires interfering/opt-in adverts to be closable after five seconds. Reward earn time is a separate matter. Official format guidance <https://support.google.com/admob/answer/9884467?hl=en> states that rewarded-interstitial units serve skippable adverts and viewers can stop early, forfeiting the reward. Native API: <https://developers.google.com/admob/android/rewarded-interstitial>. SSV: <https://developers.google.com/admob/android/ssv>.

`format_reviewed` is a default-off review gate, not an SDK-discovered close-time guarantee. `requiredCloseMs:5000` records the acceptance requirement. Do not invent an application close overlay or a guarantee from G/child flags, reward earn time or one creative. The user declined contacting Google support.

## Preserving acceptance window

Before device inputs, obtain Root's finite Samsung window. The existing Fairplay Samsung registration and Frontlines test receipt are prior context only; require an explicit **Test Ad** badge for Littles' actual6193791997 request. Do not click live creatives. Do not read/register an AAID or Android ID.

1. Record installed package/version, own test actor and normal progress. Preserve the held cloud-save choice; no account reset, save selection or allowance injection.
2. Update existing app via Play internal track. Use ordinary parent/account/UI paths only.
3. Give only QA13 actor `130d552c-3e94-4ec4-8e6b-62548f1d9dff` a bounded private ad cohort. Public `enabled/serving_ready` remain false. Review the format and actual request before loading.
4. Naturally finish the selected game's free and weekly bonus rounds (up to15), then verify the neutral opt-in choices and approved Rhys/Noah audio. Inspect compact-phone layout and measured touch targets.
5. On an explicitly labelled test creative, prove the SDK's dismissal is usable within five seconds and no reward/verified row is added. No custom close UI. Verify No thanks during load prevents a late ad.
6. Explicitly watch another test creative to completion. Correlate the actual actor/game/challenge with one Google-verified transaction; confirm one extra round, no duplicate credit, retry/abandon retains it, full completion spends it once, then the game is capped again.
7. Check restart retention and unrelated-game allowance. Plus/complimentary suppression and account isolation have deterministic fixture coverage; do not change the phone's entitlement or login just to fabricate these cases.
8. Finish with ordinary public app access/restart. Clear the temporary private cohort. Enable public rewards only after actual acceptance and AdMob readiness; publish native production15 only after the installed-app test passes.

## Validation scope

Node tests exercise the actual reward core/adapter/Access integration (24 cases), including stale capabilities, cancellation, wrong installation/actor/game, server-only grants, duplicate taps, consumed-receipt replay, interrupted recovery without starving newer receipts and free/weekly/ad priority. Deno tests generate real ephemeral P-256 signatures and reject query tampering, duplicates, bad unit/reward and unrecorded callbacks. In-memory PostgreSQL executes the actual migration with fixture auth/projections to verify RLS/ACLs, live-session gate, default-off eligibility, private-cohort denial under the base ads shutdown, idempotency and receipt binding. The full existing Littles suite passed, including63 asynchronous regression cases and all synchronous game/state/asset checks. These are deterministic fixtures, not proof of live ad fill or production family suitability.

Commands passed before freezing:

```text
node scripts/check-littles.cjs
node --test scripts/check-littles-rewarded-rounds.cjs scripts/check-littles-rewarded-adapter.cjs
npm ci --ignore-scripts --prefix tools/littles-rewarded-tests
npm test --prefix tools/littles-rewarded-tests
deno test supabase/functions/littles-ad-round-reward/verify_test.ts
deno check supabase/functions/littles-ad-rounds/index.ts supabase/functions/littles-ad-round-reward/index.ts
node scripts/build-android.cjs assemblePlayDebug
powershell ./scripts/build-play-signed.ps1 -Distribution play
node scripts/build-android.cjs testAcceptanceDebugUnitTest
node scripts/build-android.cjs lintPlayRelease
```

The last four commands run from `tools/meadow-littles-android` with the existing user Gradle cache and public Littles AdMob app/banner/rewarded IDs. Only the signing script reads the existing protected local signing files; no signing secret belongs in this packet. No Android Studio launch, Docker, emulator or phone install was used for compilation.

Browser-only synthetic fixture outside the repository checked actual commerce dialog behavior: five completed free rounds → explicit offer → one verified fixture credit → play → one completion → capped again. Both choices fit a780×360 viewport after a compact layout repair; tablet1024×768 also inspected. Screenshots are in `D:/Chat Gpt/workspaces/littles-rewarded91-qa`. It never requested a real advert or touched a hosted account.

New narration uses exactly approved Farmer Rhys / Noah - YA Audiobooks Narrator, Eleven Multilingual v2, speed0.9, independent Generation1 downloads. Text/source hashes are in `assets/audio/ad91-generation.json`; no pitch/time processing or robotic browser speech was used.

Public activation and installed-phone acceptance are still pending. The AdMob store link and placement setup are the only completed provider-side changes so far.

## Temporary config steps after admission

Use only the new config row; do not alter existing commerce config, entitlements, save choices or progress. Confirm the current private set is empty before applying the time-bound QA13 cohort. The format review flag records the official skippable-format review. It does not claim the phone test has passed.

```sql
select enabled,serving_ready,format_reviewed,private_users,private_until,unit_id
from meadow_littles_private.ad_round_config where singleton;

update meadow_littles_private.ad_round_config
set format_reviewed=true,private_users=array['130d552c-3e94-4ec4-8e6b-62548f1d9dff'::uuid],
    private_until=now()+interval '45 minutes'
where singleton and not enabled and not serving_ready and cardinality(private_users)=0;

-- Close the private window after acceptance or if any required check fails.
update meadow_littles_private.ad_round_config
set private_users='{}'::uuid[],private_until=null
where singleton and not enabled and not serving_ready;
```

Public enablement is a separate post-acceptance operation. Do not infer it from a private pass, the provider's store verification, or this document. App-readiness approval must be checked separately. Pending earned requests may still be claimed after the gate is cleared; clearing a test gate never removes a legitimately earned round.
