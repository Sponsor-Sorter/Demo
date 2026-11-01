# Meadow Market Littles build 35 — Fairplay consumer release packet

**Status:** build 35 is published; Fairplay enforcement remains staged off. The client hookup is in the public build, but production has no successful authenticated Littles connection yet.

## Product and source

- Fairplay app identifier: `littles`
- Littles product build: `35` (`Littles-Farm-Games-35`). This is a Littles version; it does not use Meadow build 221/222 or Frontliners versioning.
- Source branch: `codex/littles-fairplay-consumer-222`
- Source commit: `faddca9` (rebased on `origin/main` at `e797c34`).
- Merged by commit `44da38d0c60bee22e460808b6fd00a8cb18fe9d5`; GitHub Pages run `41281716762` succeeded.
- Public release marker verified at `https://sponsorsorter.com/meadow-market-littles/release.json`: build 35, `app.js?v=35`.
- Main game files changed: `meadow-market-littles/index.html`, `release.json`, `sw.js`, `word-search.js`, and `littles-cloud.js`; supporting registration is in `app.js` and the regression check is `scripts/check-littles-state.cjs`.

## Preschool word search change

The round starts with three short words. Board letters are capped so a tall tablet cannot scale them to fill the screen: on the tested 390 × 844 phone the 5 × 5 board uses 56 px tiles; on the tested 1024 × 1366 tablet the 6 × 6 board uses 64 px tiles. Four- and six-word rounds use smaller caps. The touch path still highlights letters as they are dragged, shows the found picture and stars, and reaches the win/replay screen.

## Fairplay contract

- Supabase migrations applied to project `ejavqlyozqhzqogflqzr`:
  - `littles_fairplay_consumer`, database version `20261101060643`.
  - `littles_fairplay_member_bootstrap`, database version `20261101061148`.
- Edge Function `meadow-littles-fairplay` is `ACTIVE`, version `4`, `verify_jwt=true`, source digest `59eebf7cd8f20d11dc69e9537522596135f4e7060ec3507ba2dc58ef07cfc934`.
- Consumer capabilities advertised: moderation, warnings, appeals, maintenance status, and build-bounded notices. Littles has no authoritative public lobby or server match target; player reports are unsupported. Same-device and local-network games remain local.
- `meadow_littles_private.fairplay_control_config.enforced` is `false`.
- The live release marker is build 35, but its `app.js` still reports build 33 and the Fairplay client fallback reports build 34. There is no `littles` row in `fairplay_admin_game_integrations`; the last 24-hour log query showed only three unauthenticated 401 probes. No signed-in client connection has been accepted.

## Acceptance evidence

All database scenarios below ran in explicit transactions and were rolled back. A follow-up query confirmed zero synthetic users, profiles, saves, decisions, appeals, audit rows, runtime rows, events, or integration rows; enforcement remains off.

- Valid session passed; deleting its synthetic Auth session caused validation to fail.
- With enforcement temporarily true in a transaction, a banned account could not open or save cloud progress, and RLS returned zero save rows. A restricted account could still save private progress.
- Warning acknowledgement succeeded for its owner and failed for another account. Cross-account appeals failed; the owner’s repeated appeal was deduplicated. Expired and revoked bans were not active.
- Runtime maintenance and a notice appeared for build 35; the build 34 request excluded that notice. Safe heartbeat metadata was accepted idempotently; a synthetic email field was rejected.
- Missing-auth request to the deployed endpoint returned HTTP 401.
- Browser QA used Chrome 156 at phone and tablet dimensions with Supabase requests blocked, so it created no cloud account. The three displayed words were touch-dragged to completion; the win screen showed three stars and the replay pulse. No authenticated live account flow was run.
- `node scripts/check-littles.cjs`, four Deno contract tests, Deno type-check, JavaScript syntax checks, and `git diff --check` passed.

## Promotion order and rollback

1. Build 35 review, merge, checks and Pages deployment are complete.
2. The live `release.json` and matching word-search, cloud-client, and app assets were verified.
3. Align the build metadata in candidate build 36, then verify its signed-in account/recovery flow against the deployed endpoint. Only after that acceptance should enforcement be considered; keep same-device and local-network play available.
4. If the live consumer fails, leave `enforced=false` and restore the prior Pages release. Keep both additive migrations and the JWT-protected endpoint; do not reset unrelated production data.
