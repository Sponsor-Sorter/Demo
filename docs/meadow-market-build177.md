# Meadow Markets build177

## Corrected coop production method

The176art passed three ground-anchor checks but still bent the building and fence: the renderer stretched the left/right image halves separately, and the untested fourth ground corner could drift. The new renderer removes that method for coops.

Twenty-four HD painted components were generated with the built-in image tool:16physical house views,4directional white hens, fence panel, upright post, soil and care props. Six house facings were corrected again so nesting boxes are hidden on the opposite wall. Prompt set and selected master names are in assets/generated/coops177/generation-manifest.json; full PNG masters remain in MeadowMarket/art-coops177 in the development workspace.

The flat yard uses the actual two tile axes. Every fence footing is inside its footprint, every post joins two panels, and all four ground corners match the consumed tile boundary. Upright buildings are shown as a single image with their original aspect, never split or distorted. Separate illustrated fence pieces follow the real ground edges.

## Chickens and preview consistency

Each bird has a foot anchor, a safe yard position outside the building, correct depth, four directional views and consistent world scale. Near fencing is drawn last; the house and birds sort by ground depth. Existing speckled/golden breed art is preserved. Coops retain their actual1/3/5/7capacity and1×1,2×1,3×2,4×3footprints; the176renderer incorrectly limited some resident previews to1/2/4/8. The detail popup now shows the exact placed coop/facing/residents, replacing the old fixed illustration.

## Verification

The dedicated check now verifies all FOUR ground corners against the real footprint, all16views, fully closed straight fence geometry, resident positions, capacity and breed preservation, alpha corners, unique patterns and unchanged paddocks. Browser review shows a prominent cyan occupied boundary and internal tiles, rather than hiding the grid behind the art. Cache and full regression checks run before publication. Phone acceptance is pending; the Samsung is currently held for another app's recovery/owner review and no phone mutations were made for this release.

Local playable browser check: upgraded the starter to a real2×1coop, retained its hen and capacity3, selected it in Build mode and rotated it to1×2on the visible farm grid. The popup preview shows the same regenerated house, yard and hen. The upgrade success message also now uses the correct next-stage name.
