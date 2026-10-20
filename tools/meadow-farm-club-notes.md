# Meadow Markets: farm club and collection release

## Test economy

The emporium grants fixed test packs for free. There is no payment SDK, checkout, live ad network, charge or advertising revenue. Premium is a Supabase account entitlement that suppresses optional popup previews. Rewarded previews are opt-in and capped at three per UTC day. Popup previews are disabled by default.

VIP uses thresholds 0, 100, 300, 800, 1,600 and 3,000. Test gem packs grant one point per gem received; gem exchanges and collection purchases grant one point per gem spent. Ordinary mission/ad/VIP gifts do not grant purchase points. Daily VIP gifts grant two gems and 50 gold per VIP level, plus a reward ticket from VIP 3. A unique account/day receipt prevents repeated claims after levelling up.

## Competition

Ten original games, tractor restoration and both market games submit scores. Winning score = 100 per completed objective + 1,000 per difficulty level + floor(10 × seconds remaining). Losses retain objective points. Each board uses the player's best result for that game and UTC week. Tied scores share rank. Friend boards include the player and accepted friends only.

Global weekly rewards: first 150 gems/500 gold; second 100/300; third 50/150; fourth through tenth 20/75. Claims become available after Monday 00:00 UTC and are protected by account/game/week receipts. Scores are client-reported test results; this is not a verified real-money competition.

## Collections

100 independently generated, distinct transparent sprites across ten themes. Each has explicit integer tile dimensions, rarity, description, visual effect and image paths. Map sprites are 512×512, with 256×256 gallery thumbnails. Transparent padding preserves a consistent ground baseline; the contact sheet verifies cropping across the full set.

Three starter seeds, a daily seed, game achievements and five-level milestones unlock draws. Initial rarity weights: common 50, rare 30, epic 15, legendary 5. Every draw is an unowned item; exhausted rarity weights are redistributed across remaining groups and displayed before drawing. A full collection never consumes another seed. Six exact-item offers rotate daily and four rare-or-better offers rotate weekly. All currencies remain test currencies.

Winning tractor restoration unlocks a claim for the vintage tractor decoration and two seeds. One owned copy may be placed at a time across all farms. Moving or putting it away preserves ownership. Flat paths, the garden bridge, picnic blanket, dance platform and similar terrain decorations permit helper foot traffic.

Barn stages now occupy 3×2, 4×3, 4×3 and 5×4; capacity, upgrades and housing remain unchanged. Their authored images scale with the smaller footprints.

## Persistence and verification

All new tables/functions use the `meadow_market_` prefix or the private `meadow_private` schema in the existing BargainBarge Supabase project. Private implementation functions check the authenticated game profile and use a fixed empty search path; public wrappers are invokers. Wallet/receipt reads are owner-only. Draws, purchases and claims are atomic and idempotent. The existing serialized farm-save barrier is retained.

Gold, supplied goods and speed deliveries are applied to the existing farm-save model; gems, tickets, Premium, VIP and collectible ownership are held by Supabase. Production billing, signed purchase/ad callbacks, authoritative farm consumables and stronger competitive result verification remain separate launch work. No real payment/ad integration should be enabled by changing a client flag.

Source SQL: `meadow-play-services.sql` and `meadow-collections.sql`. Art prompts: `meadow-art112-prompts.json` and `../meadow-and-market/collections.json`. Local generation used built-in image_gen; no CLI image-generation fallback was used.
