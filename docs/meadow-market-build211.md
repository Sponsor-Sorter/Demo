# Meadow Markets 211

## Changes

- Completed friendship landmarks now persist independently of friendship removal and visitor-log retention. Only acknowledged help completes them. Command saves receive owner-only completion proof from the database.
- Farmer animation frames share a cached scene instead of rebuilding the full object/roster lookup for every actor every frame.
- Cross-map animal, planner and farm-desk shortcuts wait for the accepted map load and reacquire the current object before opening details.
- Protected online farms retain backup export, with account-recovery guidance replacing unavailable snapshot import and reset controls. The replacement function also rejects these actions before touching storage.

## Verification

- 57 Deno reducer/gateway/progression/worker/help/market/trip/lesson tests passed.
- Complete existing Node regression suite passed; navigation, protected-backup, 12-actor frame and worker-motion checks passed.
- Rollback SQL fixture passed: acknowledged completion, removal of friends/logs, next-project locking, owner isolation and denied player write access. All fixture records rolled back.
- Rules hash: 6275b3239cc6; 28 reviewed game modules. Farm gateway deployed with JWT verification retained. Permanent-landmark migration: 20261030180000.
- Security advisors introduced no new issue: existing owner policies intentionally permit guest identities; private tables intentionally have no client policies. Shared-project write privileges remain revoked.
- Browser Settings confirmed the previously pushed web210 is now deployed. Web211 update acceptance is pending publication.

## Remaining

Command cohort remains empty. Server-owned new-farm initialization, explicitly reviewed beta conversion and broader canary acceptance still gate real-player rollout. Historical beta balances are not verified acquisition history. Native Play purchase/restore/refund, consent/rewarded ads, physical performance/storage and iPad acceptance remain outstanding; phone testing is paused at the user's instruction. Production purchases/ads remain off.
