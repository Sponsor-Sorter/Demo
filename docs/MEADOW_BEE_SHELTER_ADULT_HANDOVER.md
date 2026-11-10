# Bee Shelter: adult-game handover for Meadow Market

The user requested this handover on 10 November 2026 so the main Meadow Market game can add an adult version. The adult mode is a proposed integration, not an implemented or deployed feature.

## Source and current status

- Checkout: `C:/Users/jrbwi/OneDrive/Documents/ChatGPT/mobile games/MeadowMarket/littles-writing-balloon-36`.
- Stable commit: `1f8a8b637a0e850993d59212c22394db3dfc282c`, already included in main.
- Stable playable game: https://sponsorsorter.com/meadow-market-littles/?release=51 .
- Current Littles branch: `codex/littles-bee-maps-52`. Maps 11–20 have passed full browser rounds and the regression suite (800 full physics rounds including sampled strokes). Build 52 deployment is pending as this handover is written; use the stable commit until the rollout report confirms it is live. See `docs/littles-bee-map-qa-52.json` for the new evidence.
- The main-game owner should keep the adult implementation, configuration and saves under `meadow-and-market/`. Littles remains preschool-focused and separately owned. Coordinate shared-core fixes rather than changing its difficulty while porting.

## Preserve the actual mechanic

Draw a black freehand shelter with limited ink, then release a physical swarm. Bees can shove or lift unsupported ink. The MAP stays immovable: caves, lips, overhangs, shelves, roof gaps and notches catch or wedge the drawing. Do not replace it with draggable barriers, hidden glue or automatically fixed drawings.

Drawing time is unlimited; the swarm starts only after the player presses the launch button. Survival means no bee touched the protected animal before the round ended. Preserve undo, clear, retry, a clear win screen and an exit. Keep the farm fiction gentle without injury animation.

## Files to reuse

All paths below are relative to the repository root.

| File | Purpose |
| --- | --- |
| `meadow-market-littles/bee-shelter-core.js` | Map definitions, drawing legality, simplification, Matter bodies, swarm, collision failure and cleanup. |
| `meadow-market-littles/bee-shelter.js` | Full-screen dialog, pointer/keyboard drawing, ink meter, hints, audio, pause, win/retry and completion callback. |
| `meadow-market-littles/bee-shelter.css` | Controls inside the illustrated scene, portrait/landscape layouts, reward animation and reduced motion. |
| `meadow-market-littles/vendor/matter-0.20.0.min.js` | Vendored Matter.js. Copy `matter-LICENSE.txt` with it and preserve its MIT notice. |
| `meadow-market-littles/assets/generated/bee-shelter/` | Background, bee, hive, terrain textures and gameplay preview. Original provenance is in `generation.json`. |
| `meadow-market-littles/assets/generated/sheep.webp` | Protected animal. |
| `meadow-market-littles/assets/generated/guides/rhys.webp` | Approved farmer portrait. |
| `meadow-market-littles/assets/audio/bee-rhys-*.mp3` and `bee51-rhys-*.mp3` | Approved Rhys prompts, instructions and encouragement. Corresponding generation JSON files record text, voice and speed. |
| `scripts/check-littles-bees.cjs` | Seeded full-round physics, fixed terrain, ink, cleanup and audio proof tests. |
| `docs/littles-bee-map-qa-51.json` | Stable-release test evidence and limits. |

The UI uses relative `assets/generated/` paths and `window.meadowAudio`. Explicitly adapt these to the main game. Do not use Littles saves or copy its star-award callback into the main economy. Reuse approved farmer recordings when their instructions fit; new instructions must use the approved cast, not browser speech or a replacement voice.

## Core API and integration details

Load Matter before the core. The core exposes `window.meadowBeeCore`:

- `levels`: configurations containing `name`, `friend`, `terrain`, `hives`, `hint`, `help`, `shape`, `ink`, `bees`, `seconds`. The Build 52 draft also has optional `cue`, selecting a matching existing spoken instruction.
- `create(levelIndex, random = Math.random)`: creates a simulation; pass seeded randomness in tests.
- Simulation methods: `addStroke(points)`, `undo()`, `launch()`, `step(dt)`, `dispose()`.
- Simulation state: `state`, `elapsed`, `contacts`, plus bodies for rendering/testing. States: `draw`, `swarm`, `retry`, `win`, `closed`.
- Drawing helpers: `rules.legalPoint`, `legalSegment`, `append`, `simplify`, `distance`.
- Logical board: 600 by 600, ink width 12. The canvas renders at 2x resolution and maps input through its actual bounding rectangle.

`addStroke` is a low-level body builder, not input validation. The UI must apply legal-point/segment and remaining-ink checks first. Never accept client-reported stroke length or a success callback alone as proof for server rewards.

Levels are closed over by the current factory. Reassigning the exported `levels` array does NOT retarget `create`. For adult configurations, extract a validated level-list factory while preserving the existing Littles entry point/tests, or make a main-owned core/configuration module. Do not mutate Littles levels globally at runtime to create adult difficulty.

Preserve the 120 Hz fixed physics steps, capped time accumulator, hidden-tab pause, pointer capture/cancel handling, superseded asset-load guard, audio cancellation and one completion per round. Dispose all bodies/listeners on close. Arrow keys move an accessible pencil, Shift moves further, and Space starts/ends one continuous stroke.

## Adult-mode proposal: Meadow Bee Shelter Challenge

This section is a design proposal, not tested balance or approved economy values.

1. Teach a ledge, hooked corner and wedged door with generous ink and optional guides.
2. Add planning puzzles with less ink, offset gaps, two hive directions and fewer obvious support points. Keep terrain readable rather than cluttering the scene.
3. Introduce longer survival or more swarm pressure one change at a time. Every map needs a proven valid solution before release.
4. Optionally save best ink usage and completion without hints. Keep practice and replay easy to reach.

The preschool baseline is 850 ink, 24 bees and eight seconds. Calibrate adult budgets from actual solution length and playtests; do not change Littles defaults. Do not make difficulty by shrinking touch targets. Keep adult maps, completions, best scores and any daily challenge ID in a separate versioned save namespace.

Use a distinct preview showing the animal, drawn shelter, fixed terrain and hive. Keep the full-screen farm scene with controls inside it. The existing main-game apiary is a productive honey system: this puzzle should not silently alter colony care or honey production.

The main-game owner must route any farm rewards through the existing authoritative command/economy rules. The Littles standalone completion callback is not an adult reward integration. Initial practice can work without economy rewards while that pathway is designed and tested. Do not award coins or gems directly from the client callback.

## Acceptance before an adult rollout

- Play complete browser rounds: actual drawing, every swarm release, win/retry, restart, next puzzle and reward at most once. Include native pointer input, not just direct core simulations.
- Test every map over multiple seeded swarms with a legal supported solution. Ensure all bees spawn, terrain stays static and irrelevant ink can fail. Also test imperfect UI-drawn shapes; rounded corners affect physics.
- Check exact ink exhaustion, fast illegal crossings, undo refunds, clear, simultaneous fingers and no drawing after launch.
- Check close/reopen, hidden-tab pause, cancelled input, asset failure/retry, repeated disposal and no stale audio or callbacks after exit.
- Check portrait, landscape and tablet-sized layouts; label browser emulation separately from physical-device results.
- Add runtimes, art and audio to the main service worker; version script/style URLs and the release manifest. Preserve Matter licensing and provenance.
- Run main-game regressions and reward/backend tests. Publish after full-round QA, then match public release/files and complete a public round. This handover alone is not evidence of an adult release.

## Verified baseline

Build 51: all ten maps won through full browser rounds. Native-pointer, phone/tablet viewport, retry, undo and clear checks passed. The regression suite included 300 complete supported physics rounds. Game checks, Android build and Pages passed; 22 changed public files matched and a native-pointer round won live. No physical-device, independent child or Dot review is claimed. Build 52 additions now have their own QA in `docs/littles-bee-map-qa-52.json`; public rollout status is reported separately.
