# Meadow Markets recovery220

31October2026. Backend/operator update; public game remains web219 and Play1.7.1/code11.

## Deployed recovery archives

Migration20261031084531 adds private daily coherent recovery bundles to the existing account-maintenance job. A bundle contains the authoritative save/protocol/revision, wallet and paid entitlement, collection wallet/ownership, origin and command cohort, and immutable-ledger counts/cursor. It excludes Auth credentials and provider tokens. SHA256 covers its stored JSONB representation.

Archives are private to database operators: RLS enabled, no table or snapshot-function privileges for PUBLIC, anon, authenticated or service_role. The scheduled maintenance preserves the existing legacy backups and erasure behavior, adds at most100 archives per run, keeps30days and cascades account deletion. Bundles are not overwritten later in the day. Immutable receipt ledgers remain separate and must be reconciled with a restore; a bundle alone cannot safely roll back a current paid farm.

Live verification:49 archives with49 valid hashes and49 wallets after the first maintenance cycle. The rollback fixture covers privilege denial, missing/deleting users, wallet coherence, immutable archived values, checksum and deletion cascade. Security advisors after deployment reported zeroERROR; the new private deny-all table appears as the expected INFO RLS-without-policy notice. Existing guest-own-data and shared-project Auth warnings were not changed.

## Actual isolated logical restore

Completed09:08:59UTC. Restored an actual archived named QA farm and its matching immutable receipt state into a fresh on-disk local PostgreSQL database. No production farm was overwritten and no production write occurred in the rehearsal.

| Evidence | Result |
|---|---|
| Database source / target | Hosted PostgreSQL17.11 / isolated PostgreSQL18.6, PGlite0.5.13 |
| Schema restored |42 table definitions,135 constraints,27 indexes,78 functions,13 triggers,21 policies, actual ACLs |
| Data restored |27 tables,19,486 rows; protocol4/revision5272; six maps/318 objects |
| Archive |Actual daily bundle SHA256 verified in PostgreSQL; receipt counts matched the archived watermarks |
| Wallet and farm |Deep comparison retained farm, gems, paid entitlement and collection state |
| Ownership |Actual restored RLS returned own wallet and denied another UUID |
| Snapshot forgery |Legacy snapshot write rejected with SQLSTATE40001 |
| Command recovery |Actual farm handler and SQL accepted one new command exactly once; an original accepted request replayed safely |
| Rewards |No old rewards redelivered; retry did not add another command receipt or change the wallet |

The handler used the actual TypeScript reducer and restored SQL functions. Its bearer identity was locally stubbed; this is not a hosted Auth, HTTP or deployed-Edge acceptance test. Source17 and target18 are different PostgreSQL major versions, so this also does not establish same-version platform disaster compatibility.

Sanitized report: D:/Chat Gpt/workspaces/meadow-production194-evidence/restore220/report220.json. Private source exports and the rehearsal database stay outside Git under the operator's private Meadow directory. Do not attach them to public issues or CI artifacts.

The operator runner is tools/rehearse-meadow-recovery220.cjs. It requires an explicitly supplied private schema export, matching QA data/ledger export, installed pinned PGlite module path, NEW database directory and report filename. Run with Node --experimental-transform-types. It refuses to replace an existing database and makes no network calls. It is an operator tool, never a player-facing restore endpoint.

## Limits and remaining launch gates

- This establishes logical game-data recovery from a real archive. It does not restore Supabase Auth passwords/sessions, Storage objects, cron setup, project secrets, deployed functions or the entire shared project. Full hosted-project/off-host backup recovery remains a separate operational gate.
- Google Pocket Gems and lifetime Premium buy options are now active for license acceptance. Backend public payments/ads/production stayoff, backend products disabled, provider allowlist empty. No Google purchase was performed by this update.
- Samsung touch/performance/provider checks wait for its current Frontlines test to release the phone. The user agreed to run the physical iPad checklist; result remains pending.
- Google public beta1.7.1 still shows Changes in review. AdMob account approval is complete, but the Meadow app itself still requires store linking/review and has limited serving.
