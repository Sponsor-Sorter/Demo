# Meadow Markets 232 — Bee Shelter Challenge

The adult port reuses Littles 52's real drawing/physics mechanic and approved illustrated assets. It is a separate, main-owned campaign under `meadow-and-market/`; no Littles source, difficulty, saves or callbacks changed.

Twenty distinct fixed-terrain puzzles form four groups: Foundations, Precision, Pressure and Mastery. Ink budgets are calibrated from each supported solution, with 32–56 bees and 10–16 seconds of survival. Three open arches needed visible central corbels to withstand the longer adult swarm; these are actual fixed terrain, not glue or hidden constraints. Ink becomes dynamic only after Release the swarm. Drawing time is unlimited.

The full-screen scene includes compact, safe-area-aware controls, undo with ink refund, clear, optional hints, pause/resume, puzzle selection and persistent win/retry choices. Keyboard drawing remains available. Each puzzle shows its actual terrain preview, completion stars and best score. Stars recognise survival, efficient ink and solving without a hint. Personal practice records are isolated by farm/device in a new versioned local namespace, with explicit storage-failure feedback. These scores are not submitted to global leaderboards and cannot award farm currency, goods or reward turns.

Fourteen existing Farmer Rhys recordings are reused byte-for-byte. Their generation metadata identifies Noah - YA Audiobooks Narrator at normal tempo. No new voice generation or replacement speech is used. Main-owned copies preserve the art/audio provenance and Matter.js 0.20.0 MIT licence. The main game's productive apiary remains independent.

## Acceptance

- The full local Meadow regression suite passed. New checks cover 200 complete seeded adult rounds, including 100 sampled drawings, plus unsupported failure on every map. All expected bees spawn; terrain stays static, ink stays physical, and disposal clears the world. Ink exhaustion, legal paths, undo refunds, account-isolated records, storage failure and approved-voice/offline closure pass.
- Additional browser acceptance is in progress. Initial complete rounds passed through the real main-game menu, keyboard drawing and native drag. An unsupported native-drawn line failed; undo restored all ink; pause/resume and next-puzzle progression passed. Small portrait and landscape layouts keep controls inside the artwork. Final full-campaign/public acceptance is appended below when complete; it is not implied by the physics checks.
- Web/runtime version is 232. All unchanged assets retain their fingerprints; 1,418 assets are fingerprinted after adding the new art, approved narration and provenance. The exact offline launch page and script/style URLs are in the new cache.
- Gateway 42 is deployed with JWT verification. All eight files read back exactly; the only server difference is generated build fingerprint `eac8c0d499199db9eaeabf01f9bb9f2c89364cab0ad71c5bf0bbeff3b6ef6da5`. Farming arithmetic, schema and permissions are unchanged.

CI, publication and final browser results remain pending at this preparation record. No new native build has been uploaded, and no physical-device acceptance is claimed for the bee game yet. Future rewards/rankings require authoritative solution verification rather than trusting this practice completion callback.
