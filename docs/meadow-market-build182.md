# Build182 — family play and focused farm games

28 October 2026. Release source: `D:/Chat Gpt/workspaces/meadow-family182`, branch `codex/meadow-family182`. The original C-drive release checkout remains at build181; do not publish from it without reconciling this release. C: exhausted its free space during setup; the D: checkout preserves the shared website's latest main commit.

## Player changes

- Retired Sheep Roundup, Goat Hide-and-seek, Find the Wandering Cows, Busy Bee Bouquets and Tractor Restoration from the farm catalogue and its leaderboard choices. Existing records/assets are retained. Next Adventure only cycles through the remaining farm games.
- Farm Play has four clear cards: family play, Word Search, Egg Rescue and Milking Time. A new1536×1024 illustrated letter-grid cover is displayed in the Word Search card. Menu artwork fills the screen; cards use two columns on larger screens and a scrollable single column on narrow screens.
- The Littles card opens its actual13two-player games within a full-screen farm overlay. It loads the same `together-core.js`, `together-lan.js?v=7`, `together.js?v=14`, QR renderer and artwork as Littles. No copied rule engine or parallel signalling service.
- Host/join uses the existing `MLLAN1` session protocol, host-only WebRTC candidates, no STUN/TURN or Internet room directory, a two-way QR/code exchange and matching game/shape. Initial loading still needs the shared web assets. Router guest isolation/VPNs can prevent local connections. Pasted codes remain an alternative to camera scanning.
- Dismissing the family overlay keeps the connected iframe alive during this running farm session. Reopening reuses its local link. Reloading/closing the app destroys the connection and requires pairing again. Child frame messages require both the same origin and the correct frame source.
- The family entry does not load Littles' accounts/cloud-save app, change farm identity, award farm currency, or persist a pairing room. Farm audio effects and recorded Littles instructions are reused without starting a second music loop.
- Removed food/water refill games from the care chooser. Feed and group feeding remain immediate care actions. Grooming, shearing and playtime remain available.

## Evidence

- Existing Meadow checks: full suite passed, including asset fingerprints, save/account fixtures and updated mini-game catalogue assertions.
- Existing Littles Together checks passed: seven competitive games, six cooperative games, role/turn rules, validated snapshots, local transport and connection reuse.
- New family adapter checks passed: same shared modules/protocol, message origin/source rejection, iframe/link reuse, no second account app, refill routing and cover asset.
- Browser: preview build182 hosted a real WebRTC room. The **live published Littles app** joined through its normal pairing form. Seven alternating moves completed a Harvest Four win; both displayed Player1 wins and Round1 complete. Replay started without a new code. Closing the farm family overlay returned to the four-card menu; reopening resumed the connected game without re-pairing.
- Browser care chooser shows only Grooming and Playtime.
- Test artifacts: `D:/Chat Gpt/workspaces/meadow-family182-qa/`.
- Camera QR scanning on physical Android/iPad was not exercised. The test used the supported code-paste route between two browser tabs on the same machine, not two physical devices.

## Word-search artwork provenance

Built-in image generation. Source: `C:/Users/jrbwi/.codex/generated_images/01a14d21-2830-7df1-b07c-5a1aa0ce4e3d/exec-5d3b8d8e-8ef5-45fe-9bb2-8018a538c3ba.png`. Final: `meadow-and-market/assets/generated/minigames/word-search-cover182.webp`,1536×1024,230924bytes.

Prompt: Create a polished HD landscape game menu thumbnail for Meadow Markets' WORD SEARCH mini-game. Warm hand-painted farm-game illustration matching a premium cozy mobile farming simulator, rich clean detailed artwork, softly rendered wood and cream parchment, inviting golden light, crisp at small thumbnail size. Landscape3:2composition: a large cream parchment letter-search board lying almost face-on at a slight playful angle on a warm wooden farm desk, with bold dark brown capital letters in a neat8by6grid. Make the central horizontal row clearly read W H E A T in five adjacent cells and circle those five letters together with a translucent golden-yellow capsule. Another row clearly reads A P P L E in five adjacent cells and highlight those five with a restrained coral stroke. Other cells are random uppercase letters. A wooden pencil and large brass magnifying glass frame the right edge without hiding the letter grid. A small red apple and wheat sprigs at the lower corners tie it to the farm. Board occupies most of picture; letter puzzle recognizable instantly even in a small card. No people, no landscape scene, no logos, no UI button, no extraneous headline, no photorealism, no watermark. Opaque full artwork background, clean edges.

This release does not resolve the separate economic authority/production gates in the build181 browser audit. Payments and ads remain free test mode.
