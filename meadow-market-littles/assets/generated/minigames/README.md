# Farm adventure scene assets

Generated with the built-in image generation tool, 19 October 2026. All three originals are 1536 × 1024; shipped WebP exports retain that resolution at quality 88.

Prompts:

- **coop.webp:** Cozy polished painterly 3D Meadow Markets chicken coop interior, straight on; six straw nesting boxes with hens across the upper third, clear wooden floor below for falling eggs, warm afternoon light. No text, UI, people or falling eggs.
- **dairy.webp:** Cozy painterly 3D dairy barn, friendly brown and white cow broadside on the left, clearly visible udder, empty metal pail underneath, wooden beams, hay, dairy shelves, sunny warm light. No text, UI or people.
- **meadow.webp:** Sunny painterly 3D hidden-animal meadow without animals or people; stream, fences, shrubs, flowers, hay, old wagon, apple trees and rocks, visible gaps and hiding places. No text or UI.

The authored 3:2 artwork covers the entire viewport. Egg nests and dairy details project through the same cover transform, and hidden-animal targets use viewport coordinates. Portrait shows fewer nesting beds rather than creating offscreen eggs. Animals use the existing generated transparent sheep, goat and cow sprites. Foreground foliage copies the corresponding region of the same background, keeping occlusion aligned. Eggs, catch baskets, broken shells, milk streams and fill indicators are animated code-native shapes.

New ElevenLabs narration uses the existing character voices: Jay / Mike, Jade / Hope, Rhys / Noah. Six `minigame-*.mp3` recordings give the exact instructions shown before each round. Existing generated sound effects accompany actions.

## Build 77: distinct search areas

- **goat-search.webp:** Generated HD 1536 × 1024 cozy painterly 3D goat hillside search map, no animals, people, UI or text; terraced grass, limestone boulders, wooden footbridges, wildflower shrubs, rustic stone shelter, split-rail fences, logs and clover, broad green play space and warm sunlight.
- **cow-search.webp:** Generated HD 1536 × 1024 distinct dairy clover pasture search map, no animals, people, UI or text; clover fields, white painted fences, red dairy barn far back, willow trees, haystacks, water trough, flowering hedges, dirt lane edges, broad green centre, warm morning light.

Both exports retain their source resolution at WebP quality 88. Sheep retains meadow.webp. Each round samples six separated positions inside the actual measured HUD/caption safe area. Rotation recomputes safe positions and pauses play. Progress, time, percentage and Pause now live inside one top HUD.

Additional ElevenLabs recordings: `rhys-upgrade-howto`, `rhys-new-choices` and `minigame-milk-anywhere`, using the established Noah and Hope voices. Normalized to -18 LUFS, -2 dB peak, 44.1 kHz, 96 kbps MP3.

## Build 80: memory and sorting

- memory.webp: generated 1536×1024 warm painterly 3D garden greenhouse and potting worktable, broad clear centre, plants and flowers around edges, no people, text, cards or UI. Full viewport artwork for Garden memory.
- sorting.webp: generated 1536×1024 sunny farm market shed with a broad clear pale wooden counter, produce crates and herbs around edges, green fields beyond, no people, text or UI. Full viewport artwork for Market basket sort.
- produce/*.webp: six generated harvested produce groups on a transparent 1536×1024 atlas, exact 3×2 cells: apple, carrots, tomatoes, corn, pumpkin and strawberries. Exported from each 512×512 cell to 256×256 transparent WebP. Existing growing-plant assets are not used for harvested groceries.
- Each game has its own ElevenLabs instruction recording: Jade/Hope for memory, Jay/Mike for sorting, with replay and mute support. Existing generated tap, care, harvest and reward sounds accompany actions. No extra narration was added to the original six mini-games.

Memory has six shuffled pairs, 75 seconds, matched-card protection and a pause-safe mismatch delay. Sorting has a balanced shuffled delivery, 15 correct baskets in 50 seconds, a two-second wrong-basket penalty and duplicate-tap protection. Both use the standard top HUD, full-screen scenes, compact persistent results, daily capped farm rewards and an introduction before each new round.
