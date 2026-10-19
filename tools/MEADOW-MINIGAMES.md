# Build 73 farm adventures

Open **Play** in the farm HUD. Six games are available: Egg rescue, Milking time, Sheep roundup, Goat hide-and-seek, Find the wandering cows, Busy bee bouquets.

- Instructions and replayable ElevenLabs farmer narration precede the timer.
- Eggs fall from the six nesting beds. Twelve catches win; three broken eggs lose.
- Milking requires eight presses in the golden meter zone; presses have a 450 ms cooldown.
- Search games require six unique animals; found animals cannot score twice.
- Flowers require twelve correct glowing targets.
- Every loss offers **Retry** and **No thanks**. Every win also offers other games.
- The first three wins per game per UTC day give goods, 25 coins and 8 XP. Further wins still update the record. No loss consumes farm goods.
- Backgrounding pauses the timer; Resume is deliberate. Closing cancels animation and narration. Existing helper simulation pauses while a game dialog is open.
- Save records and rewards belong to the active farm account and use its existing cloud save.

Separate QA accounts are `test_phone` and `test_browser`. Credentials are kept out of source control. Their existing farm IDs remain distinct; account conversion did not merge their inventories. Existing six-character test passwords can sign in, while new account creation still requires eight characters.

Regression coverage: `node scripts/check-meadow.cjs` includes mini-game assets, reward caps, win/loss, retry, background/pause timing, egg break limits, and cleanup. Browser playthroughs completed all six games and the egg failure path. Physical Samsung testing is recorded separately in the release report.

Build 74: full-screen mini-game HUDs and illustrated backgrounds; compact result overlays retain the frozen scene until Retry, No thanks, or Other games is chosen. The helper launcher sits beneath the game name. Water is the first crop-panel action for all plot sizes.
