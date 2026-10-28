# Meadow Markets build 183 — game-flow and free-shop audit

Date: 28 October 2026 (Australia/Sydney).

## Fixes

- Legacy farms with a placed market stall but no `shop` object no longer throw in the notification counter.
- Map hotspots open their destination without a redundant navigation notice over the animal toolbar. Actual collection and care notices remain.
- Completed rounds count once for optional test popup ads, including replayed games, Word Search and market games. A due popup waits for the player to return to the farm; it cannot interrupt another dialog or a hidden page. Premium and opting out clear the pending break. Recent local round IDs are capped at 100.
- A full/unavailable browser storage write no longer interrupts the save function before cloud scheduling and HUD updates. The device-save status is truthful, repeated errors stay quiet, and successful local saving clears the warning gate. This does not promise persistence if both local storage and the network are unavailable.

## Verification performed

- All 74 top-level runtime JavaScript files parsed; the full existing regression suite passed, including new storage-full, advertising, legacy-stall and navigation assertions.
- Actual browser checkout of all seven free pack types: starter bundle, pocket gems, gem chest, builder bundle, reward tickets, pantry bundle, Premium. No real money charged.
- Browser rewarded preview completed: wallet 85 to 90 gems, tickets 0 to 1. Subsequent packs reached 1,190 gems and six tickets. Premium and these wallet values remained after reload.
- Test-ad opt-in persisted; Premium displayed its ad-removal entitlement. Popup scheduling/Premium/hidden-dialog rules exercised with executable fixtures.
- Two genuine guest farms connected through invitation and acceptance. Accepted friend visited the other farm, fed Pip, and the owner saw both visit and feed in the visitor log, with Help delivered. No invitation sent to any unrelated player.
- Actual 390x640 portrait and 844x390 landscape layout checks. Animal filters, collection, care chooser, full-screen grooming entry/exit and tools loaded. Dragging the hand to Pip advanced care to 8%.
- Farm desk task led directly to the crop popup; Water was first and successfully watered the field.
- Landscape Build catalogue swipe changed scrollLeft from 0 to 437, without placing or picking up an item. Done returned to normal play.
- No captured warning/error logs at the checked preview checkpoints. Browser viewport restored after tests.
- Database audit found RLS enabled on all 14 Meadow Markets public tables. A transaction using the audit guest identity exercised all seven test SKUs, exact duplicate-request handling, ad opt-in/reward and invalid-SKU rejection; it was rolled back. No schema/configuration changes and no persistent fake server test results.

## Release boundaries

The owner asked which monetization option is better. Recommendation: preserve free test purchases and simulated advertisements during the audit; next integrate and test Play Billing with licence testers and AdMob test ads. Real advertiser traffic and actual payments are **not enabled** by this build. Play account approval does not create billing products or connect an ad SDK. The Android wrapper still has no Billing or AdMob integration; native version stays 1.6.1/code 9.

This is an audit of the current implementation, not a guarantee of zero bugs. Required before unrestricted paid production:

1. Replace the remaining client-authoritative farm economy, mission events and game-score assertions with server-validated actions/rounds where competitive integrity matters. Snapshot bounds, RLS, revision control and exact-once receipts do not prove gameplay.
2. Complete actual Play-distributed AAB/signing/update and purchase restore/refund/subscription tests. The existing sideload APK updater is a different distribution channel.
3. Physical Android and iPad/Safari regression, suspend/resume, QR camera permissions, touch/orientation and populated-farm frame-time profiling. This pass used browser viewport checks, not a phone acceptance test.
4. Registered username/password and recovery round trip with the owner entering credentials. Anonymous entry, real friend visits and save/receipt reload were tested here; credential changes were not performed.

The previous build 182 actual Littles host/join match and replay test remains recorded in its release note. It was not repeated in this pass because the shared multiplayer modules were unchanged.

## Source and evidence

Independent current release checkout: `D:/Chat Gpt/workspaces/meadow-audit183`, branch `codex/meadow-audit183`, based on shared main `2fdae40`. The earlier shared-object checkout had a missing borrowed Git object; no release should be prepared from that checkout without repair.

Local test evidence: `D:/Chat Gpt/workspaces/meadow-audit183-evidence/`; source-test log: `D:/Chat Gpt/workspaces/meadow-audit183-checks-final.log`. Only the published Meadow files may be copied back to the canonical shared website checkout; preserve unrelated/divergent work.
