# Meadow Market Littles

Standalone farm game collection for children aged roughly3–6. Updated14 November2026. Original Meadow Markets has its own folder, identity and release.

## Publishing

- Public URL: https://sponsorsorter.com/meadow-market-littles/
- Same GitHub repository and GitHub Pages publication as Meadow Markets.
- Independent folder, `release.json`, service-worker cache, PWA identity and Android package `com.meadowmarket.littles`.
- Prepare an isolated `codex/` branch, update the release/cache and run `node scripts/check-littles.cjs`. Use a pull request, passing game/billing/Android CI and a coordinated shared publishing window. After Pages succeeds, compare public bytes with the exact merge commit and verify the installed phone app.
- Website catalogue reads this game’s own release manifest.
- Web updates prompt between activities. Android wrapper loads this URL; wrapper changes require a newer APK built in `tools/meadow-littles-android/`.
- No changes to original game release number or assets are needed.

## Content

The collection includes farm activities, learning games, word finding, letter/name tracing, balloon letters, animal care, painting, picture puzzles, bee shelters, Harvest Slice, linked play and illustrated farm adventures. Controls stay inside the full-screen farm scene. New instructions use only the approved Jade/Hope, Rhys/Noah and Jay/Mike recordings. Device speech synthesis and unapproved narration are blocked.

The first five classic rebuilds are public at mechanics63: egg catching/carrying/nesting, washing and milking Daisy, bee pollination/bouquets, seed memory/watering/harvesting, and sorting/loading/pushing a market cart. Content65 adds the illustrated trophy matching the other approved home controls. Content66 prepares six more rebuilds behind the existing private mechanics gate; public activation requires complete installed-app rounds, audio checks and bug fixes. See the acceptance note for this content build.

## Persistence

Separate localStorage `meadow-littles-save-v1`, art IndexedDB `meadow-littles-art-v1`, audio settings and Supabase session. Cloud saves contain progress and completion timestamps, not painting bitmap data. Drawings are saved on this device and can be downloaded. See `MEADOW_LITTLES_BACKEND.md` for isolated tables and ownership policies.

## Plus, ads and rewards

Plus uses the native Google Play product `ml_plus`/`monthly`, reference price A$4.99/month; Google shows the actual price. It removes ads and gives unlimited completed rounds. Free play allows five completed rounds per game per device-local day. Failed or abandoned attempts do not count. Only verified server entitlements grant paid Plus; save-file gems or `adFree` do not establish a purchase. Actual purchase/restore/reconciliation tests are recorded in `LITTLES_NATIVE54.md`; the launcher correction is in `LITTLES_PLAY_LAUNCH56.md`.

The Weekly Farm Fair is public:3/8/15 completed rounds earn bronze/silver/gold trophies and2/3/5 additional completed rounds for every game for that UTC week. Bonuses are used after the normal free allowance; Plus never spends them. Only the first five completions per game per UTC day earn ranking points for everyone. Sharing is off by default, parent-controlled and uses generated farm nicknames.

Production native ads use the configured child-directed G-rated AdMob home banner. Games and dialogs hide the measured banner dock; acceptance builds use Google’s demo unit. Account approval and production integration are complete, but app-store linkage/AdMob review depends on the public Play listing. On the latest authenticated check, corrected Play14/1.0.1 remains in Google review with managed publishing off. These provider statuses must be rechecked before claiming a public store launch or unrestricted ad serving. No store submission or monetisation setting changes are part of the content66 game work.
