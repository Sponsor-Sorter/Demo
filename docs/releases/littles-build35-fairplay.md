# Meadow Market Littles build 35 — Fairplay consumer release packet

**Status:** reviewed candidate; production web release still pending. Fairplay enforcement remains staged off.

## Product and source

- Fairplay app identifier: `littles`
- Littles product build: `35` (`Littles-Farm-Games-35`). This is a Littles version; it does not use Meadow build 221/222 or Frontliners versioning.
- Source branch: `codex/littles-fairplay-consumer-222`
- Source commit: `faddca9` (rebased on `origin/main` at `e797c34`).
- Public page to verify after merge: `https://sponsorsorter.com/meadow-market-littles/`
- Main game files changed: `meadow-market-littles/index.html`, `release.json`, `sw.js`, `word-search.js`, and `littles-cloud.js`; supporting registration is in `app.js` and the regression check is `scripts/check-littles-state.cjs`.

## Preschool word search change

The round starts with three short words. Board letters are capped so a tall tablet cannot scale them to fill the screen: on the tested 390 × 844 phone the 5 × 5 board uses 56 px tiles; on the tested 1024 × 1366 tablet the 6 × 6 board uses 64 px tiles. Four- and six-word rounds use smaller caps. The touch path still highlights letters as they are dragged, shows the found picture and stars, and reaches the win/replay screen.

## Fairplay contract

- Supabase migrations applied to project `ejavqlyozqhzqogflqzr`:
  - `littles_fairplay_consumer`, database version `20261101060643`.
  - `littles_fairplay_member_bootstrap`, database version `20261101061148`.
- Edge Function `meadow-littles-fairplay` is `ACTIVE`, version `4`, `verify_jwt=true`, source digest `59eebf7cd8f20d11dc69e9537522596135f4e7060ec3507ba2dc58ef07cfc934`.
- Consumer capabilities advertised: moderation, warnings, appeals, maintenance status, and build-bounded notices. Littles has no authoritative public lobby or server match target; player reports are unsupported. Same-device and local-network games remain local.
- `meadow_littles_private.fairplay_control_config.enforced` is `false`. The public client is still build 33 and has not yet connected to this consumer. Current Littles integration rows: zero.

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

1. Review and merge the Littles PR; wait for the Littles checks and GitHub Pages deployment.
2. Verify the live `release.json` is build 35 and the live HTML serves the matching cache-busted word-search, cloud-client, and app assets.
3. Verify the signed-in build 35 flow against the deployed endpoint. Only then set `enforced=true` and confirm banned cloud reads/writes are denied in production. Leave same-device and local-network play available.
4. If the live consumer fails, set `enforced=false` and restore the prior Pages release. Keep both additive migrations and the JWT-protected endpoint; do not reset unrelated production data.
