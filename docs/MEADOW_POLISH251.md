# Meadow Markets 251 — weekly prizes and Bee Shelter

Published and accepted on 18 November 2026. Source candidate `45a0049d` was merged as `f753f836`; see the final acceptance below.

The previous-week board now uses an own-account server projection of the same verified global dense rank and immutable claim key as the existing `claim_week` transaction. It shows an eligible prize with exact amounts, an already-collected message, or a no-score/outside-top-ten explanation. Friends ranks never establish eligibility. Missing, mismatched or unverified status fails closed. The granting transaction, wallet, receipt history and Premium rules are unchanged. The migration pins the installed wrapper hash and adds only the read-only private helper plus the board projection; its empty search path, account/deletion checks and restricted ACL are explicit.

Bee Shelter ignores secondary pointers, refunds only a cancelled unfinished stroke, and preserves committed ink on lost capture after release. Undo explains its refund immediately. Artwork loads atomically, has a bounded 12-second deadline, and offers an explicit retry without changing personal records. Existing HD art, approved Rhys recordings, twenty puzzles and practice-only scoring remain intact.

Focused actual-source UI checks pass, including late/mismatched eligibility, friends/global rank separation, touch cancellation, stroke preservation, asset failure/retry/timeout/decode failure and actual Undo handlers. Local PostgreSQL fixtures pass tied global ranks, ignored unverified scores, ineligible/already-claimed states, account isolation, unchanged wallet/receipt projection and denied anonymous/deleted access. These fixtures are not live rewards or physical-device evidence.

The generated farming module changes only `RULES_HASH`; no farming arithmetic changes. Runtime URLs, release number, offline entry and exact-byte manifest move together to 251. Littles, native package metadata, commerce flags and existing farms are preserved. Full CI, installed SQL/function readback, public-byte/update verification and coordinated Samsung acceptance are recorded below.

## 18 November 2026 — build 251 published and accepted

Web 251 is live from main `f753f836e4c1f00452afe4ab15e6cf5ab175ca4a`. Main game/Android CI `44268911899` and Pages `44268911901` succeeded; all 26 named public/protected files match that exact merge. The own-account weekly-prize projection is deployed and gateway 65 matches all eight reviewed files with JWT verification enabled.

The Samsung's installed Google Play 1.7.6/code 16 accepted the ordinary 250→251 runtime update. Settings confirms 251, and all 319 object IDs and protocol 4 are preserved. Its real previous-week board correctly shows no verified score without a Collect button. The official app opens Bee Shelter's campaign and Ridge cap with complete artwork/canvas. Isolated physical component tests already passed draft cancellation/refund, Undo and artwork failure/retry; eligible/claimed/global-versus-friends prize states also have source/SQL/component coverage. No live prize or new financial/provider test was made.

The desktop browser accepted 250→251 and retained its separate farm; its original pending action reconciled via the normal receipt retry. Approved Rhys audio and Bee artwork are unchanged. Two owned Samsung QA tabs, the own loopback server and ADB reverse are cleaned up. The phone returned to the official farm; window02 closed early at 08:58:09 UTC and contingency03 was canceled without activation. Main/Pages are released. Full acceptance metadata and screenshots: `D:/Chat Gpt/workspaces/meadow-production194-evidence/polish251/final-acceptance251.json`. These closeout notes remain local to avoid another whole-site deployment for documentation alone. Earlier pending entries below are historical.

Remaining work is longer cross-map/worker/load observation, coordinated reduction of the shared Pages artifact, and Android/development-dependency advisories. Weekly-prize eligibility feedback and these Bee Shelter edge cases are complete.
