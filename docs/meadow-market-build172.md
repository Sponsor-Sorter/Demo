# Meadow Markets172: illustrated paddocks

The rotation regression replaced the original illustrated enclosures with procedural SVG fences and an independently composited shelter. All four paddock upgrades now use full1536×1024 transparent illustrated sprites. Four approved front views are retained; twelve additional physical views were generated with the built-in image_gen tool, using each approved stage as its identity/style reference. Six views received targeted prop-position corrections after review. No image-generation CLI was used.

The paddock's actual ground corners are calibrated to its existing3×2,4×3,5×4 or6×5 occupied tile rectangle. Odd rotations swap width/depth; the camera and vertical posts remain upright. A source-art foreground fence layer occludes live resident sprites, while gates/troughs/shelters are part of the same illustrated enclosure. Coops keep their existing renderer.

Runtime sprites and exact prompts: `meadow-and-market/assets/generated/paddocks172/`. Master PNGs are retained in the development workspace's `MeadowMarket/art-paddocks172/`. `paddock-art-data.js` contains per-view floor anchors. `paddock-review.html` reviews all sixteen projected views with residents and occupied-ground guides.

Regression coverage: sixteen HD sprites, four distinct facings per upgrade, finite projection matrices, retained resident overlays, unique foreground clip IDs, no procedural wood-material fallback for paddocks, independent coop rendering. The existing placement/rotation/save rules are retained.

This release addresses paddock artwork first. Account hardening, long-session automation/performance, progression pacing, stronger online result validation, native APK updating and current documentation remain the next backlog work. Real purchases/advertising stay disabled in free test mode.
