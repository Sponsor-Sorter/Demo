# Meadow Markets 205 — farm verification migration

## Published scope

Web/game205; farm-economy4. Native direct1.6.1/code9 and Play1.7.0/code10 are unchanged. The browser history now labels verified farm activity and purchase refunds correctly. No new narration is needed for this internal migration.

The private farm-action gateway now shares 25 reviewed game modules. Added strict server commands for:

- Village restoration, customer deliveries/cooldowns, career training and relationship milestones.
- Per-farm focus choice/ranks, artisan signatures/rewards, story and almanac claims.
- Weekly village orders, festivals, collection milestones and fair entries/ribbons.
- Nursery upgrades, breeding, timed baby care/settlement and greenhouse upgrades/growing.
- Planner choice/settings, daily farm journal claims/bonus, well replant settings and production recipe/caps.
- Map opening/travel, shared pantry and starter layouts using clear complete grass footprints. Eastbank/back pasture opening costs are charged once.
- Roster hiring/reassignment, server-selected family/hired worker tasks, saved completion leases, drink breaks, bounded return catch-up, lesson reservations and path checks.

Worker requests do not supply tasks, outputs, elapsed time, terrain or stamina. Family roles are preserved. Hired workers operate on their assigned map, use that map's focus/caps/well and share the pantry. A return completes at most three ready tasks per hired worker; new planting/production starts at the current server time. Moving a target or pausing its worker cancels stale work. Lesson reservations expire after two server minutes.

Mission events for command-protocol farms commit in the same transaction as the save and request receipt. Accepted retries do not repeat mission progress. Raw mission-event submissions by enrolled players are rejected. Existing protocol3 player events remain functional. The migration does not enroll anyone.

`farm-commands.js` is a staged, **unattached** client transport. It persists an immutable account-bound request before sending; an uncertain response reuses the same ID/body. It accepts only a valid canonical acknowledgment, stops on conflicts/account changes and fails before transmission when device storage is full. It has no snapshot fallback. It is deliberately not loaded into the live game until all UI mutations are routed through it.

## Acceptance

- 30 Deno reducer/gateway/progression/worker tests pass. Source drift check and deployed Edge typecheck pass.
- Node transport fixtures cover exact durable retry, input mutation, current-state replay, conflict review, permanent rejection, full storage, malformed replies and account switching.
- Full existing Node regression passed once; version guards ran with the correct Git safe-directory environment.
- Three rollback database fixtures pass: gateway/CAS/roles/replay/erasure, protocol3/protocol4 verified refunds, and atomic mission progress/raw-event rejection/rollback. No fixture data remains.
- A real isolated Auth → deployed Edge → SQL worker test passed: exact hiring cost, hire replay, placement, early-poll denial, clock-based completion, duplicate-poll denial, task injection rejection, one mission event and an old receipt returning the current farm. Its anonymous Auth identity and farm were removed; cohort count is zero.
- Security advisors: zero ERROR. Existing anonymous-sign-in/leaked-password warnings remain; private RLS-without-policy tables intentionally have no player grants.
- Google Play public beta still shows **in review**. Open invites remain configured; this is not public installation acceptance.
- Phone testing remains paused by the user. No ADB or phone controls were used.

Evidence: `D:/Chat Gpt/workspaces/meadow-production194-evidence/farm205/`.

## Still required before calling farming authoritative or enabling commerce

1. Route every UI mutation through commands and replace local worker scheduling with server leases, while preserving touch/animation/camera behavior. Attach the staged transport only after that inventory is complete.
2. Add a server-owned new-farm baseline and an explicit reviewed migration for legacy farms; never adopt arbitrary client gold/progress as a trusted starting balance.
3. Port remaining expedition/market-game rewards using issued verified rounds, shared village projects and accepted-friend help delivery. Finish harmless preference/guide metadata updates and account restore/reset semantics without reopening snapshot writes.
4. End-to-end browser canary for all flows, loss/retry, multiple devices, visits, save conversion and return work; then an explicit controlled rollout.
5. Google license purchase, pending/cancel/restore/refund and rewarded SSV acceptance on the actual Play-installed phone, UMP accept/refuse/reopen/no-fill, native performance/storage and physical iPad acceptance.
6. Play review approval and public invite installation; AdMob store linking/app review; then a separate audited activation decision.

All commerce flags remain false, all seven products inactive and no real players are enrolled. Internal server tests are not proof that the existing client has migrated or that a native/provider test passed.
