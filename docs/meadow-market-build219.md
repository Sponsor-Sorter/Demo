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

## Live acceptance, 31 October

- Runtime b2a7234719036c799b99e28655c76515620b37a0 and generated-rule follow-up5bbc5936eb312f6e3ea4f5bb773b59637d20261e are published. The first CI run caught the stale generated-rule bundle after the UI source changed. It was regenerated and the gateway redeployed (version32, JWT required). Final CI41181859750 and Pages41181859693 both passed. No gameplay rule was changed by this UI patch.
- Browser218→219 accepted the actual Install update prompt. At516CSS pixels wide, selected-placement controls ended at506px in the expanded tray; all four controls fit. The minimized controls occupied10–111px. Done returned to normal play. The well upgrade refusal displayed inside its popup beneath the header; no gold was charged.
- Samsung Settings visibly confirmed219 on the existing Play1.7.1 shell. Portrait and both landscape orientations rendered with cutout insets. Rotation-transition screenshots were not treated as stable acceptance frames.
- With mobile data already off, Wi-Fi was temporarily disabled and the app force-stopped/relaunched. It displayed the explicit reconnect screen, without a new farm or a browser error. This is online-only startup behavior, not offline gameplay. Restoring Wi-Fi and tapping Try again reopened the same level65/VIP2 farm; server revision5272 retained protocol4, six maps and318objects.
- Auto-rotation1, user_rotation0, Wi-Fi2 and mobile_data0 were restored exactly. The phone was left at Home and released to Frontlines. No app data was cleared or other app changed. Long-hold drag/drop, native provider transactions and a controlled15minute performance soak remain unaccepted in this pass.
- Earlier preliminary Android counters were577,820KB totalPSS,724,764KB RSS and102/9,889janky frames (1.03%; legacy metric9.13%). They include mixed activity and are not a controlled WebView frame-time or memory-leak benchmark.
- Fresh Play Console review still reports Changes in review for1.7.1 public beta. No production rollout or public monetisation was enabled.

Private evidence: phone219-settings-landscape1.png, phone219-offline.png, phone219-reconnected.png, browser219-visible-upgrade-denial.jpg and browser219-build-controls.jpg in the external farm205 evidence folder. Private farm backups/proposals remain outside Git.
