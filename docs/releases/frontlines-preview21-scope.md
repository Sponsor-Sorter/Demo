# Frontlines preview 21 — creator fitting and touch interaction

## Changes

- All head-mounted parts use the same measured neck anchor. Facial structure no longer raises or lowers the complete head relative to the jacket.
- The collar and headwear fit the actual deformed neck/skull cross-sections. The old flat coat is replaced by an indexed, complete garment with sides and a back. Shoulder fittings, lapels, medals and collar embroidery follow the garment surfaces.
- Hair remains visible beneath compatible head coverings, with a fitted hatband and antialiased cutout edges. Studio lighting and mipmapped textures are retained; real-time hard shadows were rejected in visual review.
- Drag the preview to rotate and tilt; two fingers pan and pinch to zoom. Desktop right/middle drag pans and the wheel zooms. Reset View restores the composition. Saving always captures the canonical front portrait and restores the editing view afterward.
- Shared raw finger scrolling replaces the native scroll containers in account/network, creator, settings, match options, social and option lists. Vertical gestures over sliders scroll; horizontal gestures adjust. Tapping inputs still opens the keyboard. A scroll gesture cancels a pressed button and never activates it on release.
- Portrait render-cache version increments to 3. Existing recipes and account identities remain unchanged.
- Sparse CPU morph measurements replace per-edit graphics readback. Initial local warm edits measured about 27–30 ms on the current laptop, compared with about 110 ms before this optimization. This is not a phone or thermal endurance benchmark.

## Acceptance

Build 21 is a new candidate. Build 20 packages and its public paths stay immutable.

Fresh automated checks, exact-package Android observations and browser observations are recorded separately. Desktop Godot checks run from a source-identical staging project with its own user-data directory junction on D:, keeping fixture saves and storage pressure away from the desktop campaign. The only project-setting difference is that QA user-data location. This document does not assert AAA art parity, physical portrait rotation acceptance, verified email sign-up, a new cloud appearance round trip or an in-app update-install test.
