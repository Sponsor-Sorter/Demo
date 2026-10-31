# Meadow Markets build217

## Protected-farm fixes

- Club section introduction flags are device display preferences. Previously, opening a section not seen before (including Leaderboards on the reviewed test_browser farm) wrote club.introduced and triggered the canonical resource drift guard. These flags now survive acknowledgements and reloads without changing canonical balances, claims or receipt history. Forged receipt delivery is still rejected.
- Friend visits no longer increment Homestead story progress merely because a friend's snapshot loaded. The existing authenticated social service first records the visit. The social.visit command then uses database-owned visit proof to complete the first-visit goal and the original friendship lesson exactly once. Failed visits and responses arriving after an account switch cannot update the other account.
- An uncertain story acknowledgement keeps its original durable command; the already recorded visit is safe to retry. Existing lesson.claim proof and legacy saves remain compatible.
- Reuses the existing Farmer Jay/Rhys guidance; no new voice generation or media is needed.

## Verification

The full existing Node regression passed. Focused command preference and social adapter checks passed, including forged receipt rejection, account isolation, failed visits and uncertain delivery. The shared reducer/gateway/worker/progression/help/market/trip/lesson suite passed60tests; the farm Edge entrypoint type-check passed. The new SQL transaction fixture proves that a player cannot borrow another visitor's proof and that the existing friendship lesson still works; its temporary data is rolled back.

Migration20261031063554 and farm gateway version28 are deployed with JWT verification enabled. Shared rules fingerprint36c42c35e413. No normal-player enrollment, farm conversion, new-farm rollout, product activation or advertising activation is part of this release. Browser acceptance and CI/Pages results are recorded after publication below.

## Release limits

This closes specific command-client gaps, not the entire production checklist. Current native touch/orientation/offline/performance acceptance, real Google license purchase/restore/refund tests, UMP/SSV/no-fill tests, physical iPad acceptance, monitored server rollout and production submission remain separate gates. The Samsung is held for Frontlines until the human releases it. Public beta1.7.1 was still in review when checked31October.
