# Crop mastery — build 128

Eight field crops now have independent, account-wide growing skills. Progress is stored in the normal farm save as `cropMastery.tiles`. A real harvest records the number of planted tiles, regardless of crop yield, watering, field upgrades or manual/helper collection. Fruit, flower nectar, purchases, restored inventory and mini-game rewards never count. Existing mixed acquisition totals are deliberately not converted into mastery.

| Rank | Planted tiles harvested | Automatic perks |
| --- | --- | --- |
| Learning the rows | 0 | Base prices and output |
| Seed saver | 20 | 5% cheaper seeds |
| Skilled grower | 80 | 5% cheaper seeds; +1 crop per tile |
| Meadow expert | 200 | 10% cheaper seeds; +1 crop per tile |
| Master grower | 500 | 10% cheaper seeds; +2 crops per tile |

Discounts apply to the complete field cost, rounded up to whole gold. Farmer Rhys uses the same discounted price and affordability check as manual planting. Yield bonuses stack with field tier and watering. A threshold-crossing harvest uses its existing rank; the new benefit applies from the following harvest. Planting previews use the candidate crop’s mastery, rather than the previous crop’s rank. Helper stock targets account for expected mastery output of growing crops.

Players can open the illustrated overview from Farm desk → What next?, the daily journal, a growing crop, the planting chooser or that crop’s almanac page. The overview shows eight mature crop sprites, progress and active perks. Each crop page explains all five ranks and links to where it grows. Artwork reuses the existing four-frame generated crop strips, clipped to the final 512px frame. Larger screens show four columns in a wider overview; portrait phones show two. Details and controls stay in the existing scrollable game popup.

Farmer Jade uses her established ElevenLabs Hope voice to explain the feature on first opening and through Listen. The normalized 31-second recording is in the offline cache. Two new journal goals reward reaching rank 3 with one crop, then four crops. The journal’s chapter count now derives from the actual definitions.

Verification covers every rank boundary for all eight crops, bounded/invalid inputs, no fabricated history, exact-once actual plot/helper harvests, rank-crossing output, whole-field seed rounding, matching manual/helper costs, the previous-crop preview regression and all eight artwork files. A local UI harvest recorded exactly one carrot tile, survived reload, and navigated correctly through the mastery overview, detail, almanac and planting chooser. The new guide decoded at 31.007 seconds. Public release and Samsung update are checked after publishing.

## Phone refinement — build 129

The Samsung confirmed build 128 and four tiles harvested by its helpers. Its landscape CSS viewport is narrower than the desktop breakpoint, which made the initial overview use two oversized columns. Build 129 explicitly uses four compact columns on short landscape screens, with smaller artwork and labels. Portrait retains two columns. Listen now sits in the heading with its full accessible name, saving a whole row. Static checks cover both regressions.
