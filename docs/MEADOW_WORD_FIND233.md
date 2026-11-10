# Meadow Markets 233 — larger mobile word find

The old square board competed with a tall word list, separate progress row, instructions and footer. On a 740×360 landscape viewport it used only 226×226 pixels, leaving substantial blank space. At 360×740 it used 338×334 pixels, while the word list alone occupied 215 pixels of height.

The playing layout now gives the letter board all remaining width and height. Cells adapt to the available rectangle; the 16×16 board and all twenty words remain unchanged. Progress, elapsed time, Farmer Rhys guidance, puzzle options and Close share one 44px control row. Portrait keeps words in a compact horizontal strip; landscape fits that strip into the same header row. Words can expand into a scrollable drawer and collapse back without restarting. New puzzle/theme actions live in the compact options menu. Found-word feedback no longer covers the middle of the grid.

## Acceptance before publication

- Final browser layout: 740×360 → 732×304 grid; 360×740 → 352×644; 320×568 → 312×472. Small-phone header controls remain within the viewport with 44px minimum height. Portrait and landscape resets preserve the current words and found count.
- Actual native-pointer horizontal/vertical selection, forward and reverse diagonal selection and rotation passed. A complete twenty-word round finished through the visible controls and the existing server returned “Reward verified and saved to your farm.” Final one-row landscape validation also passed with native diagonal selection and progress retained through menu, word drawer and rotation checks. No console errors were captured.
- The existing word-search regression passes 125 generated complete boards across all 25 themes. Changed-runtime version checks, exact offline launch entry, asset-cache reuse/fingerprints and generated server-rule checks pass. No new low-impact layout test duplicates the implementation; actual browser geometry and interaction evidence cover this change.
- The existing approved `rhys-word-search189` guide is retained. Its Noah recording explains twenty words, eight directions and dragging, without referring to the old word-list location. No new art or audio was generated. All 1,418 asset fingerprints are retained.
- Gateway 43 is deployed with JWT verification and all eight files read back exactly. Its only change is build fingerprint `bbaa1cb29b08159508734ead3d5df479b3ca6b4629bebadd416e3c497ccd53e9`. This release includes no schema, permission, reward arithmetic or native-binary change.

Evidence under `D:/Chat Gpt/workspaces/meadow-production194-evidence/launch230/`: `word-before-portrait233.png`, `word-before-landscape233.png`, `word-after-portrait233.png`, `word-after-landscape233.png`, `word-small-phone233.png`.

Runtime scripts/styles are explicitly versioned (`word-search.js?v=234`, `word-search.css?v=3`) within web build 233. These module versions also prevent the initial local draft from being mistaken for the final source. Publication and final CI/public acceptance are recorded below once complete. No physical-device acceptance is claimed; these are browser viewport and native-pointer checks.

## Hosting recovery

Both jobs in game/Android CI 42919603468 passed on runtime `ec716ca8c26b15da5ece46f933aed9e3bfe9e48a`. The Pages build/upload succeeded, but deployment 42919602746 timed out after ten minutes while syncing the existing 5,066,831,062-byte multi-game package. A failed-job-only retry reused the cancelled revision; its status polling returned an empty value until another timeout. The same-size 232 package previously deployed successfully, so this is not evidence of a word-grid failure or permission to remove other games' downloads.

A fresh documentation-only revision is being issued to obtain a new Pages deployment identity while preserving the exact six tested runtime files. Successful game/Android checks are retained; public verification still requires all six files to match `ec716ca` and an actual 232→233 update. Public 232 remains in service until that verification passes. No other games or published downloads have been removed.

## Live acceptance

Fresh Pages run 42923711591 succeeded on `f2d107c4f90006cdedb76f6365c546bacaa17a91`. All six public runtime files match tested code `ec716ca` exactly after text newline normalization. The existing public browser loaded `?release=233`, retained its farm, and Settings explicitly reported Game build 233. This used a normal public-page navigation; an automatic Install update prompt was not exercised in this background-browser check.

The public phone-sized board measured 352×644 at 360×740. Native-pointer selection of WHEELBARROW counted correctly. Rotation to 740×360 retained 1/20 progress and measured a 732×304 board. Browser viewport overrides were reset, the live word game was left open as the deliverable, and the temporary preview and hosting-log tabs were closed. The Samsung remained in Hollow Crown and was not interrupted. Public Play 1.7.4/code 14 is unchanged; this is a web-content update, not a new native binary.

Public evidence: `word-public233.json`, `word-live-portrait233.png` and `word-live-landscape233.png` in the acceptance evidence directory above. Final evidence notes are committed separately from the hosted runtime to avoid another unnecessary 5 GB Pages upload. Future hosting work should reduce that package while preserving other games' runtime/download URLs; the two cancelled attempts are not successful publication evidence.
