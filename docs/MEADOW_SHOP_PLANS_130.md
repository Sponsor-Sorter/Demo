# Farm shop shelf plans — build 130

The farm shop now opens as an illustrated full-screen scene, using the existing market background. Stock, shelf plans and upgrades are at the top. Shelf goods update incrementally as customers buy or helpers replenish them. Naming, production-building links and detailed instructions are expandable below the shelves. Manual stocking and plan editing use compact two-part popups with the existing stall artwork.

Each farm shop can save a list of goods, shelf targets and shared-basket reserves. Shop stages keep their existing capacities, prices and customer intervals and gain one/two/three/four plan choices. A target is the desired stock of that good, not a separate shelf capacity: all choices share the shop’s space. A plan may be disabled without deleting its choices. Enabling a plan requires at least one valid good.

Farmer Jay now considers the physical market stall alongside his normal honey and animal-care jobs. He walks to it, restocks during his normal action cycle, consumes a well work job and takes normal drink breaks. Plans run only while helpers are working in that farm area. Existing stocked goods continue selling offline; helpers do not remotely restock farms or work through paused/hidden sessions.

Refills move existing goods only. They respect shelf capacity, each target and the highest enabled reserve for that good across all physical farm shops. Choices rotate after successful visits so one large target cannot monopolize every newly freed space. Manual stocking deliberately remains under the player’s control and can use reserved goods. Removed stalls cannot restock or impose an inactive shop reserve.

The helper settles already-earned sales before restocking. Empty shelves get a fresh sale timestamp, preventing newly moved goods from selling to customers from before they were stocked. Repeated work calls do nothing when a target is filled or a reserve prevents further stocking. Successful helper stocking is counted separately for the new journal goal.

Farmer Jay’s established ElevenLabs Mike voice introduces the new shop after a stall has been built, with replay controls in both screens. The old introductory shop guide remains available before building a stall; it no longer interrupts the new lesson afterward. The new normalized recording is 30.851 seconds and is included in the offline cache.

Two journal goals cover enabling a valid shelf plan and having Farmer Jay restock forty goods. Goal totals are now 31. Existing shop stock, sales, names, tiers and other journal claims are retained.

Focused checks cover reserves across farms, tier limits, invalid and duplicate choices, shelf capacity, round-robin choice order, exact stock movement, repeated actions, fresh customer timers, actual Jay task/work routing, duplicate stalls and full-screen wiring. The local UI checks use the real build, shop, plan and well controls; deployment and Samsung checks follow publication.

The local play-through built a stall, enabled a milk target of four with a reserve of sixteen, and enabled Farmer Jay through the family well. He stocked two milk, a customer bought one for sixteen gold, and all sixteen reserved milk remained in the basket. The new guide decoded at 30.851 seconds. Main shop controls and plan editing were inspected in the real game.

Five new item icons replace basic symbols for milk, eggs, raw wool, goat milk and flower nectar throughout the shared item registry. Built-in image_gen produced each separately in the established painted style. Runtime WebP files are 512×512, preserve alpha, have fully transparent borders and consistent padding, and total approximately 266 KB. The source prompts and file metadata are saved in `assets/generated/shop-goods/assets.json`; original generated PNGs remain in the generation library. Tests verify each packed image’s dimensions and alpha flag.
