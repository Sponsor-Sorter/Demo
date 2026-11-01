# Meadow Market Littles build 36 — Fairplay client acceptance candidate

**Status:** candidate only; do not enable Fairplay enforcement from this packet. Build 35 is live. Its Fairplay client hookup is present in source, but no successful authenticated connection has been observed in production.

## Current production state

- Public release marker: `Littles-Farm-Games-35`, verified at `https://sponsorsorter.com/meadow-market-littles/release.json` after the Pages deployment.
- Fairplay migrations on project `ejavqlyozqhzqogflqzr`: `20261101060643` (`littles_fairplay_consumer`) and `20261101061148` (`littles_fairplay_member_bootstrap`).
- Edge Function `meadow-littles-fairplay`: `ACTIVE`, version 4, `verify_jwt=true`, source digest `59eebf7cd8f20d11dc69e9537522596135f4e7060ec3507ba2dc58ef07cfc934`.
- `meadow_littles_private.fairplay_control_config.enforced=false`, last updated `2026-11-01 06:06:43 UTC`.
- `fairplay_admin_game_integrations` has no `littles` row. The last 24-hour function-log query found three `meadow-littles-fairplay` requests, all unauthenticated `401` probes. This is not evidence of a connected child account or a successful client flow.
- Public build 35 has a version mismatch: `release.json` and HTML say 35, but `app.js` identifies itself as 33 and the Fairplay client's local fallback identifies as 34. This can cause stale build UI/update prompts and is corrected in candidate build 36.
- Supabase's public Auth settings report anonymous users and email enabled, with email confirmation required. The public settings response does not expose whether manual identity linking is enabled; the account recovery flow therefore still needs a real signed-in acceptance check before enforcement.

## Candidate changes

- Synchronize the release marker, app build, Fairplay client fallback, Edge build and consumer version to 36. The server Edge changes in this branch are not deployed.
- Cache-bust `littles-cloud.js` and update its offline cache entry.
- Add a regression check that the release marker, app build and Fairplay fallback stay aligned.
- Add an isolated recovery contract test that covers anonymous guest linkage, email verification, password setup/reset, existing-account sign-in and explicit progress restoration on a second device. It uses a mock Auth/Cloud service and does not create a production account or write a production save.
- The build 35 Word Finder source and its compact three-word default are unchanged in this branch.

## Acceptance and rollout gates

`node scripts/check-littles.cjs`, four Deno Edge contract tests and Deno type-check passed. Chrome 156 browser acceptance used the local build 36 with Supabase and the Supabase JS CDN blocked, so it created no account: at a 526 × 688 viewport, the 5 × 5 board used 56 px tiles and three words were finger-dragged to the three-star win screen, with both “Play again” and “No thank you” present. At 1024 × 1366, the iPad layout used a 6 × 6 board with 64 px tiles. The build 35 phone test at 390 × 844 is recorded above; build 36 does not alter Word Finder code. The mock recovery contract passed guest linkage, verification, password setup/reset, same-account sign-in, and an explicit cloud restore without changing any production row. This evidence does not prove Supabase email delivery, the project's manual-linking setting, or a signed-in production save round trip.

Keep `enforced=false` until a real, authorized grown-up account completes guest linking, email confirmation, password setup/recovery, second-device sign-in and explicit cloud restore against the candidate. Do not create a synthetic production user or mutate a production save to stage this test. Deploy the matching Edge Function only with the accepted build, then verify the `littles-36` integration heartbeat and the signed-in flow. If any gate fails, leave enforcement off; local and local-network games must remain available.
