# Harvest Fair stories and keepsakes — build 238

Two six-step story arcs introduce a dependable harvest and comfortable animal homes. Existing opening goal IDs and rewards are preserved; nine new goals join them. Campaign rewards use the authoritative, ordered, exact-once claim route. Existing later chapters remain available.

Three permanent cosmetic arrangements have four physical isometric views and validated tile footprints: Welcome Garden (2×1, personalised sign), Coop Charm (1×1) and Market Makeover (2×1). Each is one movable arrangement. They do not grant production bonuses, animal capacity or random contents. Google Play lists each at A$0.99; other regions use Google's converted prices. The seven original products retain their prices and benefits. Paid keepsakes do not change the 100-item earned collection.

New story narration uses the established cast: Hope for Farmer Jade, Noah — YA Audiobooks Narrator for Farmer Rhys, and Mike — Animation, Explainers & Gaming for Farmer Jay. Four clips used 1,399 ElevenLabs credits. Exact scripts, source settings and hashes are recorded in [audio provenance](../meadow-and-market/assets/audio/story238-generation.json). Matching existing main-loop lessons are reused. Artwork source hashes, dimensions and processing are recorded in [art provenance](../meadow-and-market/assets/generated/story238/provenance.json).

## Verification completed before publication

- Four new pure behavioural tests cover preserved goals, campaign ordering/reload/exact-once rewards, ownership and all four rotations, and sign validation. Existing progression, billing, commerce and command-coverage checks were also exercised.
- Rollback-only database fixtures cover three grants, duplicate tokens, account binding, duplicate ownership, restore status and refunds. Refunds remove only the revoked cosmetic and its placed copies while retaining purchase history. Existing earned catalogue remains 100. No fixture player data persists.
- Farm gateway version 49 has JWT verification enabled; all eight deployed files match the submitted package. Store gateway version 19 has JWT verification enabled and the three new non-consumable product IDs.
- A real browser claim advanced the campaign and persisted its reward. Arc two correctly required completion of arc one. The full-screen desktop layout has no inherited outer gutter; no browser errors were recorded during this flow.
- Google Play's ten-product catalogue confirms the three new purchase options Active at AUD 0.99. Play 1.7.6/code 16 is available to Internal testers. Its signed optimized AAB is 6,664,553 bytes, SHA-256 `9f808634b6bcf16b46d88a84bf3566c09936801230063e02b727860e6f798094`. All four native plugins and thirteen JavaScript bridge methods survive optimization.

## Release gates still being checked

The new backend offers remain disabled for ordinary accounts until actual Google Play $0 checkout, delivery/restore and phone layout checks pass. Approved free testers remain separate. Web publication, final CI, physical acceptance and Production submission will be recorded here after completion; none is implied by the Internal release.
