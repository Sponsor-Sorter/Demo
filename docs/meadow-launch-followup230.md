# Meadow Markets launch follow-up — 10 November 2026

The public website remains build229. Google Play production is1.7.2/code12, active in Australia. This follow-up prepares native1.7.3/code13; it does not describe that candidate as a published production release.

## Completed backend work

Seven registered legacy farms were individually reviewed against the current authoritative rules. Private pre-change snapshots include the exact revision and SHA256. The planner checked every non-resident footprint against owned grass and other objects, including all rotations, and validated the result through the actual server reducer. Housed animals move with their homes. It rejected any change outside object coordinates.

All seven conversions first passed a rollback-only database transaction, then the identical guarded transaction was applied. Per-farm repairs were25,0,2,2,2,2and13 object coordinates. No object, upgrade, crop, inventory, wealth, owned land or account was removed. Strict revision/hash checks rejected stale input; opening balances were rechecked by the database and recorded as reviewed-beta provenance. This records historical beta wealth as a reviewed baseline, not verified historical earnings. Private identities, snapshots and relocation manifests remain outside Git. Free tester access is unchanged.

The converted reviewer farm signed in through the live browser with its existing99,575gold, level5 and two maps. Farm travel, crop interaction, helpers and Build selection worked; subsequent legitimate server actions advanced it to level6. The selected well exposed Details, Move, Rotate and Sell. A live screenshot is retained in the private launch230 evidence folder.

Migration20261110022501 adds three Meadow-only foreign-key indexes. It changed no grants, policies or player rows. Existing deny-all private RLS and intentional guest/friend access were retained.

The read-only operator health query now groups opted-in error reports by build/module/category and counts registered legacy farms still needing review. At02:36UTC:56farms,10protected,0missing provenance,7enabled products,0overdue unsettled orders,0real orders,0active provider leases,0opt-in errors in24hours and0recent recovery hash failures. Existing database-local archives remain unchanged; no new full-database backup work was requested or undertaken. Recent24-hour Meadow API logs returned successful statuses only, with very low traffic. These observations cannot establish load capacity or universal crash freedom.

## Native candidate

The candidate uses AndroidX EdgeToEdge.enable with the existing CSS inset bridge, immersive transient bars and free rotation. R8 optimization/resource shrinking are enabled with narrow Capacitor reflection/annotation rules. CI now builds an optimized Play bundle with a disposable CI-only signing identity as well as debug distributions. Production signing continues to use the existing private upload key.

The production advertising SDK is updated from24.8.0to25.5.0. The current Play deprecated-cutout finding originates in Google's ad overlay, not the farm map code. Do not claim that warning is closed until the candidate is analyzed by Play. The13+ audience, restricted advertising requests, PG content rating and consent-first behavior are retained. Production npm runtime dependencies have no audit findings. Focused billing/distribution, Java ad callback and ad UI contracts passed.

The Samsung was observed with another game open; no input was sent to it. Physical optimized-release launch, rotation, plugin access, interrupted/early-dismissed test ads and Premium suppression remain pending exclusive phone access. Callback fixtures cover no-fill/retry and early dismissal but are not real-network acceptance. Require a visible Test Ad label before exercising any SDK ad; never click advertiser links. No fresh provider order or revenue ad was used in this follow-up.

## Release status

The signed optimized build passed release compilation and vital lint. Bundle SHA256:0f15165cb8fb292800c665936b0fbd81cc31458e6d97ef5ccae4edccfdafbc8a. Its6,751,235-byte upload is11.4%smaller than the prior7,617,307-byte bundle despite the newer SDK. Play estimates a3.37MB new install, down3.76MB, with2.46MB updates; supported phones/tablets are unchanged. These delivery figures are not a measured frame-rate or memory improvement.

Inspection of the actual optimized DEX confirmed all four native plugin class names, runtime CapacitorPlugin annotations and twelve PluginMethod annotations survived R8: Ads consent/privacy/show, Store products/purchase/restore, Updates allowInstalls/check/install and Vault get/remove/set. The bundle includes its ReTrace mapping and the existing upload signature verifies.

Google Play accepted 13/1.7.3 with no release blockers and published it to Internal testing at 02:53 UTC. The track shows Active / Available to internal testers. This is not a public production rollout. Both game and Android jobs in CI 42744981751 passed, including the new optimized release build. Private verification output is launch230/r8-verification.json; release proof is launch230/play-internal173.png.

Keep public1.7.2 available while validating the optimized candidate on the Samsung. No web cache/version increment is necessary for native-only changes. No fresh physical test is claimed while another game's device turn remains active.
