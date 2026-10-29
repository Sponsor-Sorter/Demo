# Meadow Markets maintenance

## Current implementation

- Runtime: `meadow-and-market/`. Browser and Android load this same live game.
- Android wrapper: `tools/meadow-android/`; public native manifest is `meadow-and-market/native-release.json`. Web build numbers and native version codes are separate.
- Server: game-prefixed objects in the shared BargainBarge Supabase project. Touch only Meadow Markets tables/functions and migrations.
- Remaining work: `docs/MEADOW_BACKLOG.md`. Build notes are historical receipts, not proof that later work is complete.

## Save guarantees and limits

Build179 introduced server revisions and immutable write receipts. The commit RPC prevents stale snapshots overwriting a newer revision and retries the same write without applying it twice. Once an account opts into protocol2, an older cached writer cannot silently downgrade it. Ownership policies isolate accounts.

Build184 issues one-use online rounds for eggs, milk, Word Search and market rankings, validates action timing or selected word paths, fixes payout amounts/daily limits on the server, and retries the same receipt after lost replies. Rewarded test previews require a server-timed session. Legacy scores cannot claim ranked prizes. Personal records remain. This still does not make farm gold, inventory, non-game mission events or story rewards server authoritative; client action transcripts also cannot prove human input. Free test purchases and placeholder ads remain in test mode.

## Workers

Visible helpers animate in the viewed farm. Assigned hired workers also service other farms while the game is open, respecting walking space and their own well. Build180 adds a bounded return pass of up to three ready actions per assigned worker. Replanted crops use the real return time. It is not a closed-app background service or unlimited offline production.

## Release procedure

1. Preserve other agents' edits. Fetch and merge current `origin/main` before pushing; never force-push this shared website.
2. Bump changed runtime module queries in both index and service-worker FILES. Increment game build, release manifest and cache name together. Asset changes require rebuilding the asset fingerprint manifest.
3. Run focused checks while developing. The pre-push hook requires `node scripts/check-meadow.cjs` and `node scripts/check-meadow-versions.cjs --committed`.
4. Push the reviewed commit, wait for Pages deployment, then confirm the actual live script version and an ordinary UI action. A changed query string alone is not version evidence.
5. Sync only committed, published Meadow paths into the canonical website checkout with the guarded sync helper. Preserve any divergent local file and resolve it separately.

Use the Samsung idle guard before every phone input/install. Do not change device-wide settings to manufacture a test fixture. Native installer success requires a real download, Android consent, install and relaunch receipt; compiling an APK is not that receipt.
