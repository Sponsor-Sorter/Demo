# Helper routines and bakery automation — build 93

- Each plot retains its crop when harvested. Rhys replants that same crop and charges the entire footprint's seeds once. New plots use the well's chosen fallback crop. Rhys also tills raw plots.
- Crop rows are walkable for helpers. Buildings remain solid. Helpers skip unreachable jobs and try another; a blocked first job cannot stall their entire work list. The idle gap is reduced from five to2.5seconds; well jobs/drink limits remain intact.
- Jade collects finished kitchen/craft batches. Rhys repeats the selected station recipe when idle. Bread/cake can make prerequisite flour first. No ingredients are consumed until the batch is queued, and ready batches are collected exactly once. Per-station Family help toggle can disable automatic work. Missing ingredients leave it idle without spending.
- Borderless sleeping and basket icons identify idle and ready stations. Working stations show no need icon. Station indicators share the map-space floating icon layer used by crops, so neighbouring buildings cannot hide them.
- Cow, sheep/goat, alpaca and chicken sizes differ in care scenes and share the ground-contact line. Chickens remain slightly larger than real-life proportions for touch interaction. Full-screen artwork remains behind all controls.
- Rhys's ElevenLabs Noah lesson is rhys-farm-routine. It explains crop memory, access, seeds, bakery indicators, repeat recipes and well stamina. First bakery/well entry introduces it, with replay buttons.

Tests exercise harvest/replant, whole-field cost, stale actions, free tilling, traversable crop rows, solid buildings, blocked-task fallback, a full flour-to-bread production loop, duplicate collect/start prevention, missing ingredients, helper toggles and status precedence.
