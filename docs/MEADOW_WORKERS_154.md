# Meadow Markets build 154 — workers and automatic watering

## Player flow

- Roster HUD icon unlocks at level 11. Nine named workers unlock at levels 11, 13, 16, 20, 24, 28, 32, 36 and 40.
- One-time gold hiring costs: 650, 950, 1,400, 2,200, 3,200, 4,500, 6,000, 8,000 and 10,000. No recurring wage.
- Compact roster contains owned workers' portraits, assigned farm, and a live task/status line. Unassigned workers are explicit.
- Hold a portrait for 650ms and drag: the portrait becomes an eight-frame character sprite, and the ground diamond highlights. Release on clear walking grass to place. Quick sideways gestures scroll the cards. Portrait tap followed by grass tap is an alternative.
- Moving an already assigned worker to another farm requires explicit confirmation naming both farms. Moving within the current farm updates the actor's placement revision and cancels its previous path. Employment, position, assignment and shift stamina are saved in the existing account farm JSON.
- Jade, Rhys and Jay travel with the player. Hired workers remain assigned to their map and run alongside the family when it is viewed.

## Automation

- Watering was absent from the family task selector. Each family's well now offers an automatic-watering licence for **20 gems**. Farmer Jay and hired workers can water after that purchase. Each planted tile still costs **1 gold**, once per crop cycle; no spending if already watered, ready to harvest, or gold is insufficient.
- Gem debit and licence receipt use the existing authenticated Meadow Markets wallet service. Owner-well validation, deterministic claim key, request idempotency and duplicate protection remain on the server. No real-money charge or live ad network is enabled.
- Hired workers till, plant the previous/selected crop, water if licensed, harvest, pick apples, collect honey, care for animals and collect their produce, run enabled production recipes and refill enabled shelf plans. Flowers remain blooming for pollination.
- Task fairness uses each target's last-helper time. Existing planting stock caps, seed reserves, unlocked-crop checks, production caps and ingredient rules remain in use.
- Unviewed owned maps run a bounded timed work loop while the game is foregrounded. It uses saved walkable terrain from the actual map, reachability checks, a minimum 12-second phase, task revalidation and the assigned farm's well shift/break benefits. It never changes `state.active` or renders the other map to perform work.
- **No claim of closed-app/offline harvesting.** Work pauses when the app is hidden or closed. Returning does not mint missed helper jobs. Ordinary elapsed crop growth and shop sales continue under their existing rules.
- Production now resolves inventory and focus bonuses from the station's owning farm, rather than assuming the viewed farm owns it.

## Art and guidance

- Approved Jade/Rhys/Jay eight-direction walk/action/drink sheets are reused as worker variants, with different names; build 155 preserves the original skin and clothing colours. These are variants of approved farmer art, not nine newly generated animation sets. Whole-image hue shifts were removed after the Samsung check because they also tinted skin.
- Roster has a transparent scalable clipboard/team icon and the same halo/help treatment as other HUD icons.
- New ElevenLabs Farmer Rhys narration uses the established Noah voice, explains hiring, sprite placement, live status, map assignment, watering costs and pauses, and is cached with the game.

## Verification

- `scripts/check-meadow-roster.cjs`: level gates, one-time hiring, saved assignments, reassignment confirmation, clear grass, live/unassigned status, background work, blocked paths, well breaks, hidden-app pause, exact-once watering/harvesting, replant seed cost and off-map station inventory.
- Existing full `scripts/check-meadow.cjs` suite retained; helper-terrain fixture now supplies the existing visit context.
- Live isolated guest test: free gem pack, 20-gem debit, retry returns the same receipt, duplicate licence and another/nonexistent well rejected. Temporary QA game profile removed afterwards.
- Supabase migration `meadow_family_well_watering` installed in BargainBarge project `ejavqlyozqhzqogflqzr`; no new tables or broader grants. Anonymous unauthenticated RPC execution remains denied. Security advisor shows existing project findings, with no new watering-specific exposure.
- Actual browser flow: locked roster is hidden at level 8; insufficient gems routes to the free test shop; returning and purchasing shows “Automatic watering · owned”.

Release and Samsung UI evidence are recorded in the task's `MeadowMarket/qa-154` folder.
