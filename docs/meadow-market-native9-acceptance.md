# Samsung native updater acceptance —24 October2026

## Result

The installed Meadow Markets wrapper updated from version1.6.0/code8 to1.6.1/code9 through the actual in-game update flow. This was not an ADB APK installation.

1. Opened the idle Samsung's existing game; level59/VIP2 farm was present and Settings showed web build181.
2. Settings → Download & install the app → Check Android app update found1.6.1.
3. Android's per-app installation permission was initially disabled. The owner explicitly approved enabling it for Meadow Markets; the switch was verified enabled.
4. The game downloaded and verified the published APK, then opened Android's package installer. The installer identified Meadow Markets and asked to update it.
5. Google Play Protect requested a scan. Phone input paused when the idle guard detected recent activity. The owner completed that step and reported the phone ready.
6. Android reported App installed. Package inspection confirmed code9/version1.6.1.
7. Open relaunched the game. The existing populated level59/VIP2 farm returned and helpers resumed their normal work. Gold continued changing through normal automated spending/harvesting; no exact unchanged-gold claim is made.
8. Compact bottom controls expanded, Build opened, and a sideways swipe scrolled the actual build cards from the collection/garden entries to coop/cow/sheep entries without placing an item.

9. Our animal family opened with90 owned animals across farms. Care all quoted820gold for82 animals needing care; after activating it the need-care count fell to0 and visible animals showed100% food, cleanliness and happiness.

10. Collect all reduced87 ready animals to1 newly ready animal; collected animals displayed their next-production countdowns.

Evidence in the development QA folder: `qa-159/native9-installer.webp`, `native9-installed.webp`, `native9-farm-restored.webp`, `native9-build-scroll.webp`, `native9-care-all.webp`, `native9-collect-all.webp`.

## Limits

This is acceptance of one real8→9 sideload update on the test Samsung, with owner-controlled permission and Android consent. It does not prove every future APK, store update path, device or rotation. The wrapper remains a free test distribution. Its game content updates separately from native version codes.
