# Meadow Markets web build 219

## Changes

- Samsung acceptance found that enabling placement rotation added a second controls column without reserving its width. The build tray now reserves its intrinsic controls width in expanded and minimized views, keeping Done and the collapse arrow inside the screen.
- Action failures now display a brown status notice inside the current modal. Previously the farm toast was behind the native dialog top layer, so a rejected well upgrade looked unresponsive. Normal farm notices retain their position below the farm title.
- The Eastbank Town road button hides while the compact top controls are expanded, preventing overlap with that row.
- Added an operator-only, read-only farm review tool. Its optional private repair proposal uses the existing strict move reducer, rechecks every final footprint and refuses changes to balances, inventory, item identity or upgrade level. It never writes to Supabase or enrolls a farm itself.

## Named Samsung canary

The user released the test Samsung for this acceptance pass. Its installed Google Play shell remains 1.7.1 (11). The named `test_phone` farm was privately backed up at revision 5170. Twelve old Eastbank flower/hive placements failed current grid checks. Canonical nearest-free-tile moves were rehearsed with a database rollback, then committed with exact revision/hash checks and converted as a documented reviewed legacy baseline at revision 5172, protocol 4. Six maps and all 318 objects, balances, inventory and upgrades were retained. This does not verify the history of its old test wealth and does not convert any other players.

## Validation and remaining gates

- All 318 final placements passed the review tool; repair gold and level deltas were zero. Database rollback and actual commit both passed preservation assertions.
- Samsung loaded web build 218 after conversion. Compact HUD expansion and horizontal build tray scrolling worked with actual Android touch input.
- Focused UI219 fixture covers modal notice visibility/replacement/expiry and the build control layout contract. Actual live build 219 device acceptance is recorded below when completed.
- Public purchases, live ads and automatic new-farm enrollment remain disabled. Google license purchase, restore/refund, consent/SSV, physical iPad acceptance and a disaster restore rehearsal remain release gates until separately evidenced.
