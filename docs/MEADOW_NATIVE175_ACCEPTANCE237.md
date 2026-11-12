# Play 1.7.5 / code 15 acceptance

12 November 2026. The owner requested Internal testing and Samsung acceptance. Production was not promoted.

## Distribution

- Uploaded the signed 6,664,523-byte AAB to `com.meadowandmarket.game`, Internal track `4701019499198110666`, release 6. SHA-256: `80ed937b76e6a2e8ed8c063c2723ba1a223194888521bd563af56c483a8f5a31`.
- Console confirms **Active / Available to internal testers**, `1.7.5 (15) - Performance and Play links`. Preview reported no lost supported devices, a 3.35 MB new-install download and 613 KB update estimate; these differ from complete AAB size.
- Samsung SM-S908E updated in place through Play from 14/1.7.4 to 15/1.7.5. Package metadata confirms code 15 and installer `com.android.vending`. No uninstall, data clear or sideload.
- Existing game/Android CI and actual optimized-bundle inspection passed, retaining all four plugins/thirteen annotated methods. Web remains build 237.

## Actual phone checks

- Existing level 69 / VIP 2 farm reopened in Homestead Back Pasture, retaining buildings, plantings and workers. Animal family displayed 90 owned animals across areas. Settings reports game build 237.
- Pan gestures did not pick up objects. Build tray expanded/minimized and scrolled horizontally. Flower selection exposed Details/Move/Rotate/Sell; Move showed its highlighted footprint and Done cancelled without placement/sale.
- Emporium and Missions loaded. One already-earned harvest mission collected without confirmation, changed 630 to 635 gems and showed Collected. The result survived rotation and cold restart; final wallet was 635 gems / 7 tickets. Its 50-gold delivery was observed; ordinary worker seed spending continued, so gold was not treated as constant.
- Portrait/landscape layouts worked for farm, Missions and Animals. Orientation was exercised through Android settings, not a new physical sensor test. Rotation animation frames were excluded from settled-layout evidence.
- The game's Google Play button opened `com.android.vending` directly on Meadow Markets, without a chooser.
- Offline cold restart showed the native reconnect page. Wi-Fi restoration and Try again reopened the same farm. This verifies offline recovery, not offline gameplay.
- No Meadow crash was observed; the captured AndroidRuntime window had no matching fatal exception. Android window graphics capture: 2,096 frames, 16 deadline-missed/janky frames (0.76%; legacy counter 14.03%), p50 20 ms / p95 26 ms. Startup/rotation/reconnect are included; this is not a controlled before/after game-FPS benchmark.

Littles resumed testing during the check. Meadow stopped input, obtained explicit owner permission to coordinate and completed recovery during an exclusive handover. Original settings were verified restored for user 0: `accelerometer_rotation=1`, `user_rotation=0`; Wi-Fi enabled and `airplane_mode_on=1`. Meadow was left open on its farm and the phone explicitly released back to Littles, with no subsequent input.

## Browser and limits

Browser control recovered. The separate browser farm, Emporium/wallet, Settings build 237 and empty captured error log passed interactive checks. The Compact-mode offer was dismissed with Keep the full controls.

Purchases/refunds/ad impressions, physical pinch/storage-pressure, every mini-game and the full device/load matrix were not repeated. No commerce/control gates, credentials or financial history changed. Minor future copy cleanup: mission guidance still says “Progress starts with this update”; reset details could use a disclosure.

Evidence: `D:/Chat Gpt/workspaces/meadow-production194-evidence/performance237/`. Key files: `play-code15-available.png`, `native15-settings.png`, `native15-build-scroll.png`, `native15-mission-confirmed.png`, `native15-animals-portrait-settled.png`, `native15-play-target.png`, `native15-offline-cold-start.png`, `native15-final-reconnect.png`, `native15-final-wallet.png`, `native15-accepted-farm.png`, and Android metadata/graphics records. Notes remain on the source branch to avoid another whole-site deployment for documentation alone.
