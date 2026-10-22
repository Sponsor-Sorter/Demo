# Meadow Markets build 160

## Player controls

In Build mode, tap an existing item to show Details, Move and Rotate beside it. Selecting does not pick it up. Move enables tap-to-place with the full occupied tile preview; a held drag still works. Rotate advances 90 degrees, swaps rectangular footprints and refuses occupied or non-grass tiles. Details opens the existing item window; inspecting a crop does not harvest it. Done cancels a pending move. Undo restores the previous position and facing without rolling back harvests or care.

Daily and weekly mission rewards collect immediately. A stable receipt and pending-request lock prevent repeated taps from duplicating a reward. This was first published independently in build 159.

## Artwork

576 individual directional WebP sprites are saved in `meadow-and-market/assets/generated/rotations/`. The registry includes all 100 collectible designs, four barn stages, starter coop, three hives, twelve well stages, three apple tree phases, production/market buildings, animal coat variants and the paddock shelter. Seven larger coop/paddock stages use a generated wood texture on fences constructed directly on the game grid, with a gate, rotated shelter and the actual resident animals. Coop straw uses its own generated texture. Superseded new pen atlases are held outside the published game in the development workspace's `qa-159/superseded-fenced-atlases` folder.

The birch bench and peach swing have individually regenerated opposite rear views. The waterwheel's opposite wall views hide the single wheel behind the building. Their original front and wheel-facing rear views remain.

Tool: built-in image generation, with transparent background requested. Generation contract: preserve the approved reference's object identity, painted farm palette, materials and detail; fixed orthographic camera 30 degrees down; ground axes at plus/minus 30 degrees; upright verticals; rotate the object rather than its flat image; four views front/right, front/left, rear/left and rear/right; full object inside the cell with transparent margins; no labels, scenery or added ground slab. Individual repair prompts additionally specify the physical face, beam diagonal and which components must be occluded. Point-rooted objects remain natural upright sprites. Source alpha-zero pixels can retain coloured RGB: inspect composited output, not discarded RGB, when judging transparency.

## Implementation and checks

Facing is stored as `rotation: 0..3` in the existing farm save, so transfers, backups, friend views and reloads retain it. Rotation and placement validate before committing changes. Native fences and orchard slots rotate in tile coordinates. Vertical building walls remain upright. SVG clip/pattern IDs are unique in placement ghosts. Map picker previews render as they become visible.

Automated checks cover direct mission claims and retries, four-turn geometry, rectangular footprints, blocked rotations, all 100 collection entries and all 576 frame files, build selection/details and existing game regression checks. The browser flow also exercises four rotations, Details, tap placement and Undo. Build 159 daily claims were checked live in the browser; a Samsung weekly claim delivered 25 gems without a confirmation and retained its save through the update.
