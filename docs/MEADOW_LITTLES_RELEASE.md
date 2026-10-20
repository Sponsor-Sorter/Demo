# Meadow Market Littles

Standalone children’s mini-game collection. Original Meadow Markets remains in `meadow-and-market/`, unchanged by this release.

## Publishing

- Public URL: https://sponsorsorter.com/meadow-market-littles/
- Same GitHub repository and GitHub Pages publication as Meadow Markets.
- Independent folder, `release.json`, service-worker cache, PWA identity and Android package `com.meadowmarket.littles`.
- Run `node scripts/check-littles.cjs`, then `node scripts/release-littles.cjs NEXT_BUILD "Release name"`, commit the game changes and push `main` through the existing regression hook.
- Website catalogue reads this game’s own release manifest.
- Web updates prompt between activities. Android wrapper loads this URL; wrapper changes require a newer APK built in `tools/meadow-littles-android/`.
- No changes to original game release number or assets are needed.

## Content

All 14 mini-games ported with their levels, scenes, Farmer Jade/Rhys/Jay instructions, voices, effects, timers, scoring, retries and results. Animal feeding/watering, brushing/petting/shearing and play tools work for five animal species. Market packing and weighing retain their full activities. Ten simple art scenes plus 27 existing detailed scenes and free drawing are included; detailed gallery is optional. Artwork opens fully visible, with enlarged tools and colour targets.

## Persistence

Separate localStorage `meadow-littles-save-v1`, art IndexedDB `meadow-littles-art-v1`, audio settings and Supabase session. Cloud saves contain progress and completion timestamps, not painting bitmap data. Drawings are saved on this device and can be downloaded. See `MEADOW_LITTLES_BACKEND.md` for isolated tables and ownership policies.

## Shop and ads

Gem packs, spending, reward-turn refills and ad-free subscription are explicitly free test simulations. They cannot establish verified paid entitlements. After every third completed mini-game exit, players without test ad-free status see an ad placement notice. No ad network, tracking SDK, payment service or actual subscription billing is active. Production billing/ads require a separate implementation and acceptance pass.
