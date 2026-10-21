# Meadow Markets — Eastbank journeys (build 135)

The original farm grid, map camera and existing game activities remain in place. The stone shed by Eastbank's upper road opens a separate illustrated village. Farm desk also links to the village and the followed restoration project.

## Connected progression

- Visitor post (level 4, own Eastbank): three restorations. Opens bakery and woodland gathering (woodland also requires level 7).
- Village bakery (level 6, completed post): three restorations. Stage 2 opens regular bakery orders, nursery and the jetty project.
- Café (level 9, completed bakery): three restorations. Stage 2 opens greenhouse growing and community hall restoration.
- Community hall (level 12): three restorations. Stage 2 opens the weekly fair and shared friend landmarks.
- Jetty (level 10, bakery stage 2): three restorations. Completion opens fishing and riverside customer orders.
- Five regular customers: orders pay more than basic selling, reputation increases every five deliveries, two minute order cooldown. Recipe unlocks filter eligible orders.
- Three farmer skill tracks, four lessons each: practice, player-level and gold requirements. Harvest/seed, future production speed, and animal comfort/output benefits apply across owned farms.
- Nursery: three spaces unlocked at levels 8/12/18. Two distinct adults of the same species, friendship 3, thirty minute parent rest. Baby requires three care actions and ten minutes, then a compatible free home. Ten new adult coats and ten matching baby assets.
- Fair: one crop, craft and animal entry each week; reward thresholds 100/250/400. Resets Monday 00:00 UTC. Animals stay on the farm.
- Exploration: three-cast fishing and twelve-pick timed woodland gathering. Receipts prevent duplicate collection; unfinished trips can resume within twenty minutes. Six discoveries can be sold through farm shops or riverside orders.
- Greenhouse: three benches, levels 10/15/20. Two crop seeds plus 35 gold per tray; five minute growing cycle. Larger greenhouse stages improve output.

## Artwork and narration

45 packaged WebP assets. Built-in OpenAI image generation; prompts and source records are in `assets/generated/journey/assets.json`, `generation-prompts.json` and `breed-prompts.json`.

Ten ElevenLabs recordings use the existing character voices: Hope (Farmer Jade), Noah (Farmer Rhys), Mike (Farmer Jay). Each feature plays its guide once and has a replay button. Activity introductions also replay instructions. Audio is normalized to -18 LUFS, -2 dB true peak, mono 44.1 kHz MP3 at 96 kbps. File records are in the existing audio manifest.

## Shared project security

Migration `20261021081312_meadow_markets_shared_village_projects.sql` is applied to the existing game database. Project status is visible only to owner/accepted friends. No direct client writes. Start validates the owner's saved player level and hall stage. Progress counts acknowledged water/feed/cheer visits from accepted friends after project creation. No client-submitted contribution counter or repeatable currency payout.

Rollback SQL checks passed: retry-safe starts, acknowledged progress, friend visibility, stranger isolation and denied direct writes. Fixtures were rolled back. Security advisor reports the expected guest-account policy notice: authenticated guest players retain the same owner/friend checks. See https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins .

## Checks

`node scripts/check-meadow.cjs` includes focused journey checks: all fifteen restoration stages, exact spending, repeat guards, reputation, twelve lessons, nursery capacity and parent identity, weekly claims, expedition receipts, greenhouse cycles, ten narration files and 45 art assets.

Browser checks: real saved-farm startup and desk entry; restoration through post/bakery/jetty; training; nursery; full woodland round and collection; fishing casts/results. Existing game regression suite passes.
