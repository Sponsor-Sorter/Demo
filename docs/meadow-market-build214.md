# Meadow Markets 214

Web214 includes211 and adds protected farm initialization, explicit beta provenance and reconnect/camera fixes. Native direct1.6.1/code9 and Play1.7.0/code10 are unchanged. Production commerce remains disabled.

## Changes

- Server-issued starter: fixed250gold, level1, the reviewed starter basket and nine objects placed on complete clear grass footprints. A request contains only `farm.initialize`; a client cannot supply starter wealth, objects or clocks. The same receipt can be retried after a lost reply without resetting an existing farm.
- Private new-farm rollout defaults off. Existing beta saves remain on their current protocol. A service-only conversion requires the exact reviewed revision/hash and a documented opening balance; historical beta values are explicitly not verified earnings. Account deletion cascades the provenance record.
- New-farm requests are durable and account-bound. Explicit rollout-disabled responses retain the existing save flow. Network uncertainty stops startup until the receipt can be checked. Protected farms load/normalize canonical state before becoming interactive.
- A pending command conflict during reconnect retains the account and offers recovery. Editing a modal/build placement no longer silently consumes another device's revision. Idle worker/check conflicts can load the current canonical state when the screen has not changed; player actions still require review.
- Browser Web Locks serialize commands for the same account across tabs. A waiting view adopts an existing uncertain request instead of overwriting its only durable copy. An older accepted replay cannot delete a newer request.
- Bridge crossings keep their cinematic camera transient until the online map change completes. A failed crossing restores the original camera.
- Reading woodland availability no longer creates local domain state. Fair books are normalized on the server. Existing Hope, Noah and Mike narration is reused; these infrastructure changes required no new clips.

## Verification

- Complete existing Node regression suite passed. Transport, canonical UI, startup, cross-map navigation, crossing camera and12-actor animation checks passed. Tests include immutable retries, competing tabs, stale-screen conflicts, quota/checkpoint failures, account boundaries and disabled rollout.
-60 Deno reducer/gateway/progression/worker/help/market/trip/lesson/origin tests passed. Function type checks and source/cache guards passed.
- Rollback database checks passed for startup/replay, fixed starter/provenance, stale and repeated conversion, preserved reviewed balances and denied player conversion access. Security advisors show the expected private-table deny-all configuration and existing guest-policy/password warnings; no broader app settings were changed.
- Actual isolated browser startup produced a protocol4 farm with250gold and nine objects; database provenance was `server_initial`. A well upgrade charged180gold, awarded its one-time10gold lesson, and displayed stage2 with80gold.
- After a clearly disposable high-level fixture seed, the browser opened Sunpetal Coast, visited Pip back on Willowbrook, collected produce, opened Eastbank and travelled into town.
- A full-screen woodland retry completed all twelve issued targets for100/100. Collection produced exactly5blackberries,2hazelnuts and3wildherbs with a single server result. The browser exposed a local `journey.trips` read warning, fixed by making the availability read pure.
- Two open farm views exposed the pending-request collision and cinematic camera timing issues. Their fixes have focused deterministic coverage. Do not describe that observation as a completed native or multi-device acceptance soak.
- The disposable session was signed out, closed and removed. Command cohort0, provenance0, fixtureAuth0; new-farm rolloutfalse. Existing tester/reviewer/player farms were neither converted nor reset.

Evidence: `D:/Chat Gpt/workspaces/meadow-production194-evidence/farm205/`, including `verified-well212.jpg`, `woodland-score212.jpg`, `regression214.log`, and the command/origin fixtures in this repository. A screenshot proves the screen it depicts, not every later source revision.

## Remaining launch gates

1. Finish broad canary acceptance and the remaining mutation/worker workflow review before enrolling real players or enabling the new-farm rollout. Review each beta opening balance explicitly.
2. Play-installed billing pending/cancel/purchase/restore/refund, rewarded SSV, UMP choices/no-fill, physical performance/storage and iPad acceptance. Phone use remains paused at the human's request.
3. Google Play public-beta approval/public installation and AdMob store-link/app review; then a separately audited production activation. Existing flags and all seven real products remain off.

Web214 live-update acceptance is recorded separately after deployment. The latest confirmed live browser at the beginning of this checkpoint was210;211 CI/Pages subsequently completed successfully.
