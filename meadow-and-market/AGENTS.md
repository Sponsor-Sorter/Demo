# Meadow Markets working standards

Read `../docs/MEADOW_ACTIVE_BACKLOG.md` for current work and `../docs/MEADOW_LAUNCH_STATUS.md` for the latest release. Older dated entries retain evidence; use the newest acceptance record when they conflict. The website route stays `/meadow-and-market/`; the player-facing game name is **Meadow Markets**.

## Preserve the game

- Retain existing farms, placements, upgrades, account access and purchases. The Samsung and browser use separate test farms. Play purchases and ad rewards are server verified; client callbacks cannot mint resources. Keep test-only grants separate from public commerce.
- Keep Meadow Market Littles and its preschool configuration intact. An adult port gets main-game-owned configuration, assets/progress and authoritative reward integration. Reusing source or audio is not evidence that the port is complete.
- Work in the current release checkout and preserve concurrent work in other checkouts. Review fresh main before publishing. Avoid another main push while a combined Pages deployment is uploading, unless a real fix requires it.

## Visual and interaction quality

- Gameplay uses full-screen illustrated backgrounds in portrait and landscape, with controls inside the artwork and safe-area support. Allocate most space to the main scrollable content; use compact headers and expandable secondary explanations.
- Match established HD farm artwork, farmer appearances and asset resolution. New building stages show a clear progression. Four rotations are four consistent physical views, with anchors and footprints matching the isometric grid. Every consumed tile must be valid grass and remain clear of original map landmarks.
- Keep existing crop soil footprints constant through plant growth. Preserve crop centering, deliberate long-hold pickup, drag/drop previews, tap placement and safe camera gestures.
- Use Farmer Jade, Farmer Rhys and Farmer Jay in guides; map sprites may use Jade/Rhys/Jay labels. Reuse matching approved recordings and generation metadata. Narrate main loops rather than every instruction; avoid substituting another voice or irrelevant clip.
- Preserve selection, disclosure and scroll state when acknowledging a change in the same panel/account. Clear an expired target explicitly rather than choosing a different item that could spend gems. Keep direct daily/weekly mission collection free of confirmation dialogs.

## Test and release efficiently

- The approved full-game local origin is `http://localhost:8771/meadow-and-market/`. Both the account service and farm-command gateway allow it. Other preview origins may be rejected; use the existing origin rather than widening production CORS for convenience.
- Use focused checks for the changed flow, then the existing publication CI. Label real-device, browser-viewport and simulated callback results accurately. Test the Samsung only when it is released and idle; preserve its farm and restore any temporary device settings.
- Use the private isolated demo-ad path for repeated native ad checks. Device registration alone is not proof that a particular impression is a non-revenue test. Keep real-money test orders out of the workflow.
- Changed runtime files need new query versions in `index.html` and the service worker. Update `release.json`, `currentBuild`, cache name and the exact offline entry together. Reuse unchanged artwork/audio fingerprints.
- Rebuild shared rules with `node tools/build-meadow-server-rules.cjs` from the repository root after changing its inputs. Review the generated diff; deploy only the intended Meadow function with JWT verification and verify read-back. A build-number-only rules fingerprint change must not alter farming arithmetic.
- Keep direct-APK and Google Play versioning/signing separate. Never describe prepared native source, an unsigned CI artifact or an internal release as public. Read production availability from the Play release status and verify the live web build and update flow.
- Record concrete results and remaining limits in the active backlog/release receipt. Keep credentials, provider tokens and private farm backups out of source and logs.
