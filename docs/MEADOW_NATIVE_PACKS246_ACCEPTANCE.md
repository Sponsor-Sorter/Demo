# Meadow Markets — Samsung packs and transfers, build246

13 November 2026. This supersedes the243–246 pending acceptance notes.

## Shipped behavior

- Native animal filters retain the actual select element through background worker refresh. Samsung species/area selection passed after leaving each picker open through updates.
- Rotated barns/paddocks use alpha outlines for their32 views. Plots now use their isometric depth rather than the old fixed z10 override; actual browser computed-depth and Samsung crop-popup checks passed.
- Cross-farm animal drops resolve a compatible home from the clicked artwork before camera projection. The server validates the destination home and capacity, then moves/assigns the animal atomically. Full, incompatible, missing and ambiguous homes reject without changing the source; colliding destination IDs are renamed safely.
- Existing crop/egg boost credit travels with the object. Growing crops retain their planting clock. The ten pack tests include exact expiry, farm scope, refunds, offline shop arithmetic and clean new production cycles.

## Actual Samsung acceptance

SM-S908E; native Play1.7.6/code16, test_phone level70. The app accepted actual240→242→243→244→245→246 updates. Settings explicitly showed Game build246. Browser separately accepted245→246 and retained its level11 farm.

The approved-free Coop Charm delivery added exactly20gems (675→695) and three booster charges. Manual crop/egg activations consumed one charge each, with native panel state retained through updates. Final remaining charges: Welcome0 (three deliberately used in this QA), Coop2, Market2. No new Google checkout or real-money order was made; earlier Google purchase/refund history was retained.

An existing chicken moved Back Pasture→Willowbrook roaming, then returned by tapping the Back coop roof. The final server result assigned its original coop with7/7 residents and retained both its original egg clock and181611.25ms earned boost credit. That physical pass used gateway59; gateway60 adds only the separately tested ambiguous-home rejection guard.

One extra free1×1 plot was added for QA. Its lavender cycle moved Back→Willow with the original planting clock and76196.75ms earned boost credit. It had matured before placement, so it is not the mid-growth proof. A fresh corn cycle then moved Willow→Back at153seconds elapsed, before its330second maturity, preserving the planting timestamp; the screenshot shows the young destination crop and water-need icon. This extra plot remains neatly at Back9,6.

Final account totals:90animals,695gems. No save reset, uninstall, credential change or purchase-history removal. Native panels/build mode were closed and the Samsung released before documentation; automatic rotation1, user rotation0 and density600 were unchanged.

## Release and regression evidence

Web246 source28f7017e: main game/optimized Android CI43379924456 and Pages43379924295 succeeded; all nine changed public files byte-match the source. Earlier245 passed CI/publication but its native retest exposed the camera capture path; it is superseded. The remaining server restriction was found in native246 QA and fixed in the gateway.

Gateway60: JWT verification enabled; all eight read-back files match the reviewed source. Forty focused pack/action/worker tests passed before deployment, and all ten pack tests passed again with the ambiguous-home guard. The actual capture→placeAt→completeTransfer behavioral check covers raised artwork, obstacles, ordinary selection and pan/drag suppression. Source integration CI is recorded in the PR.

Private device screenshots and detailed verification JSON are in the external meadow-production194-evidence/performance237 and story238 evidence folders. No new artwork, audio, payment product or Play binary was needed for this follow-up. This is focused acceptance of packs/transfers and their regressions, not an exhaustive claim that every game/device/provider condition is covered.
