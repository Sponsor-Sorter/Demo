# Meadow Markets build 184

## Delivered

- One-use server-issued rounds for Egg Rescue, Milking Time, Word Search and both market scoreboards. Authenticated ownership, bounded goals/levels, server timing, action cadence/golden-zone checks and committed word-board/path checks precede a verified score.
- First three daily wins for eggs, milk and Word Search pay fixed server receipts. Retried submissions return the original receipt. The client keeps an immutable outbox and applies gold, goods and XP once to the originating farm. Offline entry is practice, without ranked rewards.
- Ranked weekly prizes and play/win missions count verified rounds. Existing personal records remain. A free winning round cannot also receive a reward-ticket payout. Rewarded test previews require a server-timed session, keep their three-per-day limit and cannot be claimed through the old instant endpoint.
- Eleven story chapters retain every one of the original 35 goal IDs and progress. One chapter is shown at a time, completed goals fold away, and the next step opens the relevant farm section or collects a ready reward. The approved farmer portraits and existing recorded growing/building/market tips are reused.
- Account recovery reserves the hashed key before changing Auth, prevents concurrent reset/replacement, releases it on a rejected password update and consumes it only after Auth succeeds. Connection-loss guidance explains that the new password may already work. Global sign-out success/failure is reported truthfully; existing access tokens may remain valid until expiry.

## Checks

- Existing full Node regression suite passed, including cloud revisions, saves, account isolation, friends, controls, artwork and native release metadata.
- Added executable client tests for offline practice, immutable result retries, interrupted cloud saving, exactly-once gold/XP/items and account boundaries.
- Six isolated Edge tests cover success, Auth failure, competing recovery, uncertain finalization, sign-out failure and origin rejection. No real password is changed by these tests.
- Live database assertions run inside rolled-back transactions: one-use receipts, game daily cap, false timing hits, unauthorized/replayed claims, rewarded-ad gating, private permissions, recovery reservation/release/consumption. Word Search tests check a real generated twenty-word board, malformed paths, start retries and foreign-owner rejection. Fixtures move test clocks only inside the rolled-back transaction.
- Browser preview: actual milking loss/retry followed by an eight-bucket win accepted by the server; the result showed “Reward verified and saved to your farm!” and no captured warning/error logs. Story opened through Farm Desk with the approved Jade portrait and all chapter choices.

## Boundaries

All purchases and ads remain free test systems. There is no live Billing or AdMob SDK in this release. A round transcript cannot prove human input or prevent a custom bot. Farm inventory/gold snapshots, story milestones and non-game mission events are still client-authoritative; market stock consumption still uses the existing guarded local settlement/save flow. Full economic authority and production purchase verification remain separate work.

Recovery SQL and mocked Edge failures are tested. An actual registered-account password reset still needs the owner to enter and submit the new credential; the computer-use policy requires that handoff. Never claim that the mocked test is a real-user recovery round trip.

The Android wrapper stays at 1.6.1/code9 because it loads this live web runtime. Physical-device acceptance and live deployment evidence are recorded after publishing, separately from compilation.
