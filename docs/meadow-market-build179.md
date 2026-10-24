# Meadow Markets179 — revision-safe cloud saves

The server now owns a monotonically increasing revision for each Meadow farm. The new authenticated, security-invoker commit RPC locks only the caller's existing save row, compares the expected revision, and returns a conflict without replacing a newer save. Existing own/accepted-friend read policies remain. No other app tables or auth settings changed.

Repeated requests carry an immutable body and UUID receipt. A lost response is retried using the same receipt before newer work is sent; duplicate receipts do not award, increment or overwrite again. Reusing a receipt with different data fails. Aborted requests do not update the current account UI. Server clock/revision order takes precedence over device seen timestamps. Both explicit save choices retain backups and use the latest received revision.

Rollout: existing legacy rows remain protocol1until a new client commits. Once protocol2is used, direct legacy uploads without the correct revision are rejected, and the protocol cannot be downgraded. Older cached clients keep their local farm and need the live game update to resume syncing. The protection is not claimed for an account that has never opened the revision-aware client.

Verification: tools/meadow-save-revisions-check.sql ran on BargainBarge in one rolled-back transaction using temporary fixture users. First write, duplicate receipt, stale/delayed writes, altered retry bodies, legacy bypass, invalid/missing amounts/shape, server-owned revision, other-owner access and missing identity all passed. No persistent QA users or farm rows remain. Client fixtures cover competing devices, clock skew, immutable retries, lost responses, aborts and conflict UI barriers.

The security advisor before/after reports the existing guest-account policies; no commit-endpoint finding was introduced. Guest users intentionally have authenticated sessions and own-row checks.

Remaining limits: broad snapshot bounds do not prove a client's gold or inventory was earned. Gold/inventory authority and signed game-score sessions remain separate backlog work. Native8→9installer acceptance is still pending the phone slot. Real payments, advertising and subscriptions remain free test mode.
