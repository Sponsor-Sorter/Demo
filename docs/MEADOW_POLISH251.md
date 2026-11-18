# Meadow Markets 251 — weekly prizes and Bee Shelter

Candidate on `codex/meadow-polish251`, based on main `c69b2d75`. Publication and physical acceptance are pending.

The previous-week board now uses an own-account server projection of the same verified global dense rank and immutable claim key as the existing `claim_week` transaction. It shows an eligible prize with exact amounts, an already-collected message, or a no-score/outside-top-ten explanation. Friends ranks never establish eligibility. Missing, mismatched or unverified status fails closed. The granting transaction, wallet, receipt history and Premium rules are unchanged. The migration pins the installed wrapper hash and adds only the read-only private helper plus the board projection; its empty search path, account/deletion checks and restricted ACL are explicit.

Bee Shelter ignores secondary pointers, refunds only a cancelled unfinished stroke, and preserves committed ink on lost capture after release. Undo explains its refund immediately. Artwork loads atomically, has a bounded 12-second deadline, and offers an explicit retry without changing personal records. Existing HD art, approved Rhys recordings, twenty puzzles and practice-only scoring remain intact.

Focused actual-source UI checks pass, including late/mismatched eligibility, friends/global rank separation, touch cancellation, stroke preservation, asset failure/retry/timeout/decode failure and actual Undo handlers. Local PostgreSQL fixtures pass tied global ranks, ignored unverified scores, ineligible/already-claimed states, account isolation, unchanged wallet/receipt projection and denied anonymous/deleted access. These fixtures are not live rewards or physical-device evidence.

The generated farming module changes only `RULES_HASH`; no farming arithmetic changes. Runtime URLs, release number, offline entry and exact-byte manifest move together to 251. Littles, native package metadata, commerce flags and existing farms are preserved. Full CI, installed SQL/function readback, public-byte/update verification and the coordinated Samsung session will be recorded at closeout.
