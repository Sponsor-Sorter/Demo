# Meadow Markets build 189 — guided farm loops and interaction audit

## Shipped changes

- Resumable farm tour with Farmer Jade, Farmer Rhys and Farmer Jay. Its 18 topics cover soil, planting, watering, harvesting, building, movement, upgrades, animal homes/care, kitchen/crafts, direct requests, farmers market, shop shelves, travel, the family well, hired workers and friends. Level gates omit topics that are not available yet. Next topic skips ahead without awarding completion rewards.
- A single gold ring identifies the actual clickable target. It follows camera movement and responsive layout, moves into a modal's top layer for planting/watering/upgrade actions, and never consumes a click. Reduced-motion settings remove its pulse. Compact controls unfold when a guide needs a hidden action.
- Helpers reserve the lesson's crop work briefly so they cannot take the player's practice task. Reservations are map-qualified, expire after two minutes and do not pause other farm maps. Minimizing the lesson releases the broad crop reservation.
- The compact-mode offer waits while a guide or its gold target is visible.
- Five map regions traced against the existing Willowbrook artwork: house, barn, original chicken yard, orchard and wooden bridge. Inline world-coordinate polygons replace the conflicting historical CSS geometry at runtime. A SHA256 assertion requires retracing if the map image changes. Grass, road and river samples remain outside the hitboxes.
- Browser tap/selection tint disabled on the map; a visible gold keyboard-focus outline remains.
- Eleven story chapters now replay relevant existing recordings, rather than a generic clip selected only by farmer. Main-loop replays use the original cast. Added the three previously unlisted Jay recordings to the audio manifest.
- Four new ElevenLabs clips only: Jade's private recovery guide; Rhys's saved-activity, travel and word-search guides. Exact saved voice names were selected and the downloaded filenames retain voice provenance. Word-search introductions/help no longer use a device voice. Individual word pronunciation remains explicitly a device pronunciation aid.
- Recovery and saved-activity guidance is opt-in through Listen. Small actions use text or existing effects. Closing a narration's dialog stops its voice.
- Singular animal/activity counts corrected. No schema, purchase-price, account credential or native-wrapper change.

## Cast and delivery

Farmer Jade: Hope - upbeat and clear. Farmer Rhys: Noah - YA Audiobooks Narrator. Farmer Jay: Mike - Animation, Explainers & Gaming. Existing topic recordings are reused, including Jay's established voice. A similarly named Mike library variant was not substituted.

Four clips used 1,571 existing ElevenLabs credits. Files are mono 44.1kHz MP3 at 96kbps, loudness processed with a -18 LUFS target and -2.5dB true-peak target; measured levels/provenance and exact scripts are in assets/audio/guidance189-generation.json. The offline cache includes each clip and verifies its hash. Existing audio bytes are unchanged.

## Acceptance performed before publication

- Full Node regression suite; changed runtime module/cache version checks; top-level JS syntax checks.
- Added guidance189 checks for all 18 tour topics, level gates, the original cast, 11 story mappings, all referenced files, clip fingerprints, crop reservations and map polygon samples.
- Actual fresh browser guest: welcome → guided tilling → tilled bed → crop chooser → plant carrots → watering popup → Water. Normal actions advanced the tour and awarded existing lesson rewards once. Gold rings targeted both the real field and the Plant all button inside the modal. Test state was not injected.
- Small phone portrait 390×640 and landscape 844×390 layouts: card, replay/next controls, gold target and no horizontal page overflow. Original Jade/Rhys artwork and decoded clip IDs/durations observed. No captured warning/error logs at those checkpoints.
- The prior build188 real owner recovery and distinct browser/Samsung farm-update checks remain accepted; see build187/build188 and the external acceptance record.

Final live189 browser/Samsung update and playback receipts are recorded in D:/Chat Gpt/workspaces/meadow189-evidence/ACCEPTANCE.md after deployment. A new APK is not required for this web-content update; wrapper remains 1.6.1/code9.

## Remaining production gates

The farm economy journal and account reward receipts are implemented, but ordinary farming/building/shop/care actions still accept legacy client deltas. Full authoritative commands remain required before real-money production. Native heavy-farm frame-time profiling and physical storage-pressure testing are not replaced by fixture or browser acceptance. Play Billing/AdMob remain intentionally unintegrated and all purchases/ads stay in free test mode. Do not claim the entire production backlog is complete.
