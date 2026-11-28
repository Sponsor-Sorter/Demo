# A Meadow Christmas — build 267

Christmas runs **1 December 2026 00:00 UTC through 31 December 2026 23:59:59 UTC**. Before opening, players can preview the event. After closing, earned and purchased decorations remain placeable. The green farm maps and their placement geometry are retained.

- Four connected chapters led by Farmer Jade, Farmer Rhys and Farmer Jay. Milestones: 1, 6, 12 and 24 deliveries.
- Three rotating farm-goods baskets each day. Each consumes the listed shared-pantry goods and awards 100 gold, 8 XP and three Christmas seals.
- One free present on each December day, with published contents and a larger 25 December gift. No streak loss, paid catch-up or random paid gifts.
- Four earned decorations: Christmas tree, village gift stack, holly lantern and candlelight wreath.
- Two fixed gem bundles: snow globe (35 gems, 400 gold, eight wheat, four apples), pavilion (65 gems, 900 gold, twelve wheat, eight eggs). Existing verified gem purchases fund the balance; this update adds no new cash SKU or subscription.
- Six HD transparent buildables and a full-screen illustrated event courtyard. Five occupy 1×1 tiles; the pavilion occupies 2×2. Pieces deliberately have repeating, symmetric decoration and retain the same physical shape across all four rotations. They use the existing grass, occupancy, placement and transfer rules.
- Three new ElevenLabs recordings use the approved Hope / Noah / Mike voices. Main introduction plays once; Listen replays the guide for the current section. Other effects reuse the existing approved reward/tap audio.

## Authority and compatibility

The browser never grants event goods. `christmas.*` actions run through the existing authenticated, revision-controlled farm-command gateway with the server clock. Gift dates, order contents, chapter eligibility, seal costs and reward amounts come from repository-owned rules. Duplicate claims reject atomically, including within a batch. Progress belongs to the account across maps.

Gem bundles use a Meadow-only private function with an invoker public wrapper, `auth.uid()` ownership, the existing control guard, wallet row locking and a request-bound economy receipt. Duplicate requests return the original purchase without another spend. A replay accepted during December can be read again after the deadline; new January purchases reject. Seasonal catalogue entries are `purchaseOnly` and excluded from the existing random/daily collection view. Existing verified receipt application delivers the supplies once.

No new native binary is required. The Play17 shell receives the normal web update. Old farms, purchases, mini-game scoring and worker arithmetic remain unchanged.

## Validation before publication

Local isolated tests cover opening/closing boundaries, forged payloads, daily and Christmas Day gifts, missed days, changing orders, exact pantry deduction, stale orders, replay rejection, chapter order, seal redemption, January placement, verified premium ownership, map switching and rejected batches. The actual SQL migration is executed in an in-memory Postgres engine with only auth/control boundaries and time stubbed. It covers exact spend and contents, VIP XP, duplicate requests, crossed request IDs, insufficient gems, account separation and availability boundaries. No production QA account is created.

Existing story, pack-boost, command transport, command UI and game-only cache checks are retained. Full CI, responsive rendered acceptance, live function read-back and actual hosted build checks are publication gates. This implementation note alone is not a claim that deployment or native acceptance has completed.

The isolated browser render passed at 1280×720, 393×852 and 852×393. Daily gift → delivery → chapter gift → owned decoration, the gem confirmation/owned transition (isolated callback), all 31 calendar days, approved-voice routing and November claim/purchase locks were checked. The landscape layout was tightened until its main actions fit without scrolling. No console errors were observed. The fixture used no production account and is not a physical Samsung test. Its exact server and temporary tabs were closed and the viewport reset afterward.

Artwork prompts: `MEADOW_CHRISTMAS267_ART_PROMPTS.json`. Voice scripts, selected voices, output hashes and measured levels: `meadow-and-market/assets/audio/christmas267-generation.json`.
