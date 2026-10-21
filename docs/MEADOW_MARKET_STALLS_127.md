# Farmers Market stalls — build 127

The full-screen Farmers Market now accepts 23 goods in three illustrated categories:

- Fresh harvests: the original six crops.
- Kitchen pantry: bread, jam, cheese, honey, honey cake, apple preserves, goat cheese, butter, mushroom soup, strawberry tart and apple pie.
- Handmade gifts: yarn, soap, bouquets, alpaca scarves, wool blankets and homestead gift baskets.

The default shows goods currently in the shared basket. Browse all unlocked shows ideas with premium unit prices and links to the existing almanac's ingredient and source instructions. Recipe levels, kitchen/craft shed minimum levels and the honey level are respected. Existing generated transparent product assets are reused at their authored aspect ratios, including the six build 126 icons.

Each delivery retains the existing pack-or-weigh gameplay, full-screen market background, timing, result choices, pause and input guards. Packing distractors come from the same stall, excluding locked recipes. Goods are consumed only after success and only once. A batch cannot sell more than is still in the basket. Prices remain 50% above the usual sale price, or 65% with a packing bench; a cart increases the batch limit to six. Duplicate buildings do not stack. Malformed prices are rejected by settlement.

Two journal milestones count actual successful pantry/handmade deliveries after this update. They give 200/300 gold and 40/50 XP respectively, once six goods are sold. Old journal claims and market inventory are retained.

Farmer Jay introduces the stalls once, with a replay button. The new ElevenLabs narration uses the established Mike voice, is normalized to -18 LUFS / -2 dB peak, and is included in the game-only offline cache. The market header and gameplay feedback now float over artwork without opaque green strips. Portrait categories wrap cleanly; short landscape cards are compact and scroll inside the game.

Verification: existing market and full regression checks pass, including new artisan unlock, exact payout, failure preservation, duplicate claim and asset checks. A local UI delivery sold two butter for the quoted 78 gold, removed both goods and returned to the pantry stock view. The new narration decoded at 25.626 seconds. Public build and Samsung layout are checked after deployment.
