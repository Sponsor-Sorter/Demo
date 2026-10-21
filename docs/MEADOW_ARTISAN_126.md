# Artisan production — build 126

Six new generated transparent inventory assets are 512×512 WebP images. New recipes:

| Product | Level | Building | Input | Output | Base time |
| --- | --- | --- | --- | --- | --- |
| Churned farm butter | 8 | Kitchen | 2 milk | 2 | 70s |
| Creamy mushroom soup | 10 | Kitchen | 3 mushrooms, 1 milk | 2 | 95s |
| Strawberry tart | 12 | Kitchen | 1 jam, 1 butter, 1 flour | 2 | 110s |
| Orchard apple pie | 14 | Kitchen | 4 apples, 2 flour, 1 butter | 2 | 125s |
| Meadow wool blanket | 16 | Craft shed | 2 yarn, 1 fleece | 1 | 140s |
| Homestead gift basket | 18 | Craft shed | 1 bouquet, 1 soap, 1 apple preserves | 1 | 150s |

Helper automation prepares missing crafted ingredients recursively within the same station, preserves the chosen finished recipe, accounts for incoming batches across owned farms, and continues respecting final-product caps. Missing raw supplies or ingredients made in another building pause that chain. Existing building speed bonuses and queue capacities apply.

Five level-gated vendor requests and three artisan journal milestones use these goods. Existing orders remain intact. Products enter the existing almanac, shop stock and shared inventory through the normal recipe registry. Recipe names open almanac instructions. A new Farmer Jay recording introduces the recipes and automation.

The gem shop now starts with packs, a concise free-testing notice, and purchase buttons. VIP detail is expandable beneath the pack grid. The existing game-only supply service accepts the six new item IDs at the existing two-gem-per-item test price; rollback checks cover receipt delivery, exact cost, idempotency and unknown-ID rejection.

Focused production checks cover jam → butter → flour → tart preparation, no duplicate prerequisites, unlock gates, exact-once collection, station boundaries, final stock caps, product processing margins, and asset presence.
