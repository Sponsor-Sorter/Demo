# Meadow Markets backend204

31 October 2026 (Sydney). Client remains web202 / Play1.7.0/code10.

## Deployed, staged farming commands

`meadow-market-farm-actions` validates the Auth identity and accepts only request UUID, expected revision and up to32 commands. Owner, time, prices, output and snapshots are not client inputs. A generated static bundle shares20 reviewed game modules, actual grass outlines, footprints and upgrade costs. CI rejects source drift. No eval, downloaded game code or DOM shim.

Supported: till/plant/water/harvest; apples/flowers/honey; animal care, collect all, care all, rename; production queues/collection; shop stocking/take/plans/name/upgrades; vendor delivery; meadow expansion; place/move/rotate/upgrade/sell. Decoration ownership comes from server rows.

Private RPCs use the DB clock, wallet-then-save locks, CAS, immutable command IDs/body hashes and existing paid-upgrade/receipt protection. Retries return the current farm plus the original accepted revision without reapplying an action. Protocol4 rejects ordinary snapshots and spoofed transaction markers. Private tables have RLS/no player grants and game-erasure cascades. No tokens or snapshots are logged.

**No real players are enrolled. Ordinary clients still use protocol3. Full authoritative farming is unfinished.** Do not enroll until ALL mutations have command equivalents and client wiring: foreground/background/offline workers and hiring/stamina; travel/new farms; journey projects/customers/training/fair/nursery/greenhouse; story/almanac/mastery/focus/local journal claims; farm-life/planner; friend-help delivery; undo/storage. Reward-bearing mission events must originate from verified actions. Preserve retry/account/offline barriers; never infer intent from arbitrary snapshot differences or allow an enrolled snapshot fallback. Supply server-owned new-player baselines and audit/grandfather legacy saves explicitly. There is no public enrollment RPC.

## Acceptance

-15 deterministic Deno tests pass, covering rule arithmetic, timing, animal homes, flowers/apples, trusted vendor rewards, placements, forged data, atomic batches, gateway ownership, retry and permanent-error handling.
- Remote rollback fixture passes protocol4/role/marker checks, ownership, CAS, retries, grants and erasure. No fixture data retained.
- An actual anonymous Auth→Edge→SQL QA farm harvested252gold, then replanted/watered to248gold, two receipts/revision3. Exact retry and an old retry after a newer save did not duplicate rewards/overwrite progress. Early harvest, changed retry, snapshot injection and direct private RPC were rejected. All temporary QA identities/farms/cohort rows removed; cohort is empty. Permanent invalid DB requests subsequently changed from503 to explicit422, covered by the gateway fixture.
- Existing full Node suite passed once; shared-source check and Deno typecheck pass. Security advisors: zeroERROR findings; existing anonymous-policy/leaked-password warnings remain. Private service tables intentionally have no player policies.
- Browser202 animal Collect all changed one ready animal to zero and disabled repeat collection. Save/reload evidence recorded separately. Phone testing remains paused by the user.

Evidence: `D:/Chat Gpt/workspaces/meadow-production194-evidence/farm204/`.

## AdMob / Play

AdMob currently contains only Meadow Markets; its game privacy URL was checked. Selected partners reduced from198 common partners to Google Advertising Products755 only. Automatic additions remain off, creative consent checks on, optional legitimate interests default off. Consent syncing, special device-scanning opt-in and extra consent mode remain off. Review again when adding sources/apps.

Published **Meadow Markets · Privacy choices**, English, Meadow Markets only. Consent, Do not consent, Manage options and Close (do not consent) available. Google says up to an hour to deploy. This publishes consent, not ads or a legal certification. Actual UMP accept/refuse/reopen/no-fill and rewarded SSV/device acceptance remain. No US message configured; current beta Australia-only.

Play still shows1.7.0 public beta/game201 in review. Do not resubmit or claim public installation acceptance. Payments, ads and production-ready flags remainfalse; all products inactive. License purchase/restore/pending/refund, physical Play-install/save retention and full farm authority remain activation gates. Play10 still uses official TEST ad IDs.
