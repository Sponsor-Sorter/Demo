# Frontlines preview27 — commander wardrobe

Candidate in validation. Not yet published.

## Commander appearance

Field Marshal is the first individually reviewed and human-approved replacement. Its native generated1254x1254 atlas adds cloth weave, stitching, ivory sash and engraved fastenings. The source wig/head remnants are removed, the coat depth uses the measured head centre without a double offset, and the textured standing collar follows the actual neck section. Original animation clips remain unchanged. Single-outfit source checks cover neck extremes,8 reaction states at4 times and cloth colours; native and browser acceptance are separately recorded.

The main-menu portrait is50% larger. Six existing garment choices remain selectable. Only Marshal uses the new garment model; the other five retain their legacy models. The remaining17 replacement geometry, texture and mask assets are excluded from published payloads and will be reviewed and approved one at a time. Inert durable-ID compatibility metadata remains. Private recipes remain intact even when their unreviewed outfit renders through a legacy fallback. No new gown/robe collection is advertised as shipped.

No AAA art parity is claimed. Native atlas dimensions, close-up image evidence and phone observations establish the actual scope of the upgrade. Reference PNG/prompt/provenance stay in art-source and are excluded from APK/PCK; the encoded runtime atlas is used by the actual outfit.

## Packaging without reducing terrain detail

The two original Earth JPEGs are now included as their original encoded bytes rather than expanded imported texture duplicates. The authoring images remain unchanged. Runtime decoding retains the exact 5400x2700 pixels and generates mipmaps; a direct imported-versus-runtime pixel comparison passed. Optional maps load their own textures without eagerly loading Earth fallback textures. Optional R1 map packs and their URLs remain unchanged.

The current Git repository publication route has a 100 MiB single-file constraint. This is not an Android graphics or texture-resolution limit. Future HD wardrobe collections can use versioned, verified downloadable packs with persistent offline caching, or a larger binary distribution route. Downloadable wardrobe packs are not implemented in this candidate; the existing downloadable content system currently supplies maps. Higher-resolution textures and more detailed source models will still need to be authored or supplied. Only equipped items should be rendered at full detail to control mobile memory and heating.

## Compatibility

Existing saved profiles are normalized with absent eyewear/neckwear defaulting to none. The backend appearance allowlist accepts both old and new recipes. Service10 changes only the appearance module; account verification, session handling, authoritative game rules and database policies are unchanged. Anonymous live compatibility checks passed and disposable QA records were removed. No new verified-email or ranked-game acceptance claim is made.

Source and export acceptance, hardware checks, publication and real OTA must have separate exact-hash receipts before any live-release claim.
