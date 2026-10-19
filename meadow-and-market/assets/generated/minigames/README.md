# Farm adventure scene assets

Generated with the built-in image generation tool, 19 October 2026. All three originals are 1536 × 1024; shipped WebP exports retain that resolution at quality 88.

Prompts:

- **coop.webp:** Cozy polished painterly 3D Meadow Markets chicken coop interior, straight on; six straw nesting boxes with hens across the upper third, clear wooden floor below for falling eggs, warm afternoon light. No text, UI, people or falling eggs.
- **dairy.webp:** Cozy painterly 3D dairy barn, friendly brown and white cow broadside on the left, clearly visible udder, empty metal pail underneath, wooden beams, hay, dairy shelves, sunny warm light. No text, UI or people.
- **meadow.webp:** Sunny painterly 3D hidden-animal meadow without animals or people; stream, fences, shrubs, flowers, hay, old wagon, apple trees and rocks, visible gaps and hiding places. No text or UI.

The authored 3:2 artwork covers the entire viewport. Egg nests and dairy details project through the same cover transform, and hidden-animal targets use viewport coordinates. Portrait shows fewer nesting beds rather than creating offscreen eggs. Animals use the existing generated transparent sheep, goat and cow sprites. Foreground foliage copies the corresponding region of the same background, keeping occlusion aligned. Eggs, catch baskets, broken shells, milk streams and fill indicators are animated code-native shapes.

New ElevenLabs narration uses the existing character voices: Jay / Mike, Jade / Hope, Rhys / Noah. Six `minigame-*.mp3` recordings give the exact instructions shown before each round. Existing generated sound effects accompany actions.
