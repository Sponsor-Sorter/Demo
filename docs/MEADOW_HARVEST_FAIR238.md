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

## Final release acceptance — 12 November 2026

Web 239 supersedes 238 with scoped transparent touch highlighting, non-selectable game copy and singular step counters. Editable sign text remains selectable. PR CI 43170178621 and main CI 43171419023 passed for 238; PR CI 43175567375 and main CI 43176645007 passed for 239, including both optimized Android jobs. Pages 43171418205 and 43176645271 succeeded. All 42 changed public game files match merged `dfb8a25a245fc7789be1293c9d44ce2c2aec6380`. Browser and Samsung accepted both actual 237→238 and 238→239 update notices; Settings confirms 239.

All three actual Google Play orders used the explicitly labelled test card and “you will not be charged” checkout. Each is recorded as `test_purchase=true`, settled, and delivered exactly one owned arrangement. Cancellation added nothing. Restore/restart retained the non-consumable ownership without duplicate purchase records or gems. Google accepted the approved Coop Charm test refund with HTTP 204; its real notification automatically revoked ownership. The other two packs remain owned. All three purchase-history records remain; one is marked revoked. The test wallet stayed at 635 gems, and the cosmetic refund created no purchase-review hold.

The three backend products are now enabled: ten enabled products in total. The temporary provider acceptance lease was removed; the original approved free-test access remains. Public payment/advertising flags and the seven older products were preserved.

The Samsung updated in place through Google Play from native 15 to 16, retained its farm and VIP status, and continued progressing from level 69 to 70 through normal helper work. New pack screens fit portrait and landscape. Holding the new copy no longer selects it or shows the blue highlight; the physical preview rotates correctly. Browser tester acceptance additionally covers free-test delivery, saved personalised sign text, map placement and a 90-degree map rotation. Shared rules/placement fixtures cover all three packs and four orientations. No new native map placement was confirmed during this focused acceptance.

Farm gateway 50 now matches all eight submitted files with JWT verification enabled; its follow-up changes only the game-source fingerprint/build marker. Store gateway 19 remains the verified delivery implementation. All four story introduction/ending states match their portrait, Listen label, approved character and clip metadata.

Play 1.7.6/code 16 was submitted to Production and Google explicitly shows **Changes in review**. This is not a claim that code 16 is publicly available. Public native 14 remains the last confirmed Production version until Google approves the submitted rollout. The new purchases require a compatible Google Play app; browser users can view them and continue the free story.

Original Samsung rotation settings were restored (`accelerometer_rotation=1`, `user_rotation=0`), and the phone was released to Littles. These are focused release checks; the complete twelve-step campaign was verified with authoritative tests rather than an exhaustive manual replay on every device.

Artwork was generated with the built-in image tool. [Retained production briefs](<D:/Chat Gpt/workspaces/meadow-production194-evidence/story238/asset-briefs.md>) describe the three assets and their final workspace paths. [Live-file evidence](<D:/Chat Gpt/workspaces/meadow-production194-evidence/story238/live-files239.json>) and [Google review screenshot](<D:/Chat Gpt/workspaces/meadow-production194-evidence/story238/play-code16-in-review.jpg>) are retained outside the published source. Post-release receipt edits are kept locally to avoid another documentation-only upload of the entire shared site.
