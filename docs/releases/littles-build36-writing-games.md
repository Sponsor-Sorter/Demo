# Meadow Market Littles build 36 — writing and letter balloons

**Status:** browser acceptance passed locally; public deployment pending.

Build 36 adds three activities to the existing Littles library:

- **Rainbow Letter Tracing:** traces the alphabet in capitals and lowercase, painting the path in rainbow colours.
- **Write My Name:** a grown-up enters a first name, the child traces each letter, and the final page displays the child's strokes. The name is held only for the current game and is not saved or sent.
- **Letter Balloon Pop:** Farmer Jade speaks a letter prompt and the child taps that letter's animated balloon. Each round has six balloons; targets do not repeat within a session.

The writing desk and parchment stay full-screen, with controls inside the desk. The tracing guide and touch mask use the same size calculation.

## Checks completed

- `node scripts/check-littles.cjs` passed, including game catalog, asset closure, offline cache, save, art, multiplayer and account-recovery checks.
- JavaScript syntax checks passed for the app, cloud client, service worker and writing activity.
- Browser smoke test opened and completed all ten added farm activities. Windmill assembly accepted the centre and three sails and reached its breeze step. Reframed the pond activity as one-to-one duck and lily-pad counting.
- Browser-tested the name activity through its final page, including the child's rainbow letter; tested wrong and correct balloon choices and round advancement.
- Browser-tested the drawing guide at 1280 × 720. Large lettering fits the parchment and pointer target matches the visible dotted guide.
- No Android package was rebuilt; this is a browser/PWA release only. Fairplay enforcement remains off.

## Public receipt

To be completed after the GitHub Pages deployment and public build verification.
