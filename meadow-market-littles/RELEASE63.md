# Hands-on farm classics

Five existing games now have complete, untimed farm sequences, retaining their original game IDs, records and rewards:

- Egg rescue: move a basket to catch eggs, carry it to a nest, brush straw over the eggs. The egg sources follow the nests in the full-screen coop artwork.
- Milking time: rub Daisy’s muddy patches clean, pull the milking handle, carry the full pail to the cart. A generated empty dairy interior replaces the baked-in cow and pail so the approved Daisy sprite can animate in the scene.
- Busy bee bouquets: guide a bee to four flowers, pick three flowers, deliver the bouquet to Jade.
- Garden memory: flip stable square seed cards, water the seedlings, harvest the grown food. Begins with three pairs and grows to at most six pairs.
- Market basket sort: drag food into matching picture baskets, load the baskets, push the loaded cart to market.

Misses, wrong baskets and abandoned rounds remain free. Stationary or off-target rubbing makes no progress. Phase changes require a new deliberate gesture. Primary-pointer capture, cancellation, pause, visibility and resize cleanup run through the existing game lifecycle; completion uses the existing allowance and reward path once.

Twenty independently generated ElevenLabs instructions/results use the existing approved Jay/Mike and Jade/Hope voices. Multilingual v2, speed0.92, stability0.5, similarity0.75 and speaker boost; loudness normalization only. Text, source/output hashes and provenance are in `assets/audio/classic63-generation.json`. Existing produce-name recordings are reused. The background edit’s reference and prompt are in `assets/generated/classic63/generation.json`.

Release procedure: the private server config returns a public quality build and an account-specific preview build through the existing own-account weekly RPC. Only the public build is cached for offline play; preview membership is never returned or persisted. Public quality starts at62, while designated QA accounts can test63 in the official installed app. After native full-round acceptance, publish quality63 and clear the cohort. This switch changes no purchases, ad policy or administrative permissions.

Validation before staging:360 complete model rounds across24 seeds and three levels; gesture/retry/cancellation/duplicate guards; five complete browser touch rounds;25 phone/tablet starting layouts with square cards,44px minimum targets and safe HUD/footer placement; the complete Littles check suite. The ordinary-account HTTP check remains on62 while the preview account receives63. Native acceptance and public readback are recorded separately after deployment; this source file does not assert those pending steps are complete.

Content64 follow-up: the matched-seed celebration now holds1.6seconds before the automatic watering instruction. The six reused Jade food-name recordings run up to about1.04seconds, so the word finishes clearly. No new recording, game rule, entitlement or reward change. A regression assertion guards the narration pause.
