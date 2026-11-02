# Meadow Market Littles build 37

Build 37 fixes the Animal Care instruction sheet so a normal pointer or touch tap on “Let’s start” begins the selected care activity. The sheet now displays the selected animal, matching the animal in the game.

## Browser acceptance

- Build 36 live catalog: smoke tested multiple legacy games and newer activities, including Word Search, Paint by Number, Letter Balloon Pop, Write My Name, Harvest Four, Harvest Memory Match, Kindness Meadow, and Food & Fresh Water.
- Word Search: found all three words, saw the win screen and replayed with a different board and word set.
- Paint by Number: wrong paint was rejected; the correct bucket fill rendered cleanly without visible haze or fuzz.
- Letter Balloon Pop: wrong and correct letter feedback behaved as expected and the round advanced.
- Writing: traced a sample name through the completion screen.
- Multiplayer: verified turn changes and a four-in-a-row win; memory cards fit and mismatches turn back correctly.
- Animal Care on build 37 local browser: normal click started the Daisy grooming game; brushing and cleaning reached 100% and the completion screen awarded 1,000/1,000.
- Automated state and asset closure checks passed (`node scripts/check-littles.cjs`). Syntax checks and `git diff --check` passed.

The build 37 Animal Care fix was verified locally; live release verification is pending deployment.
