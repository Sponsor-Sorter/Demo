# Production build: five authorised workstreams

Updated 11 October 2026. This file describes work in progress, not a production-readiness claim.

## Payment integrity — in progress, NOT deployed

- Added local migration `20261011084600_atomic_wallet_offer.sql`: immutable server-owned terms, integer-cent pricing, 10% fee calculated on the server, participant-only order reads, atomic wallet debit and offer creation, request deduplication, service-only Stripe binding and fulfillment.
- Added local `complete-sponsorship-checkout` and dedicated signed `sponsorship-payment-webhook` functions. Completion checks authenticated buyer and Stripe paid/complete state. Database checks exact bound session, amount, currency and unique payment intent before creating one offer.
- Changed local private proposal and return pages to use these functions. Browser storage and success query parameters no longer establish payment. Legacy spotlight return assignment was removed because it did not verify payment; verified spotlight fulfillment remains required.
- Tests: 68 JavaScript tests pass. Isolated PGlite order checks pass with the actual actor trigger: ownership, amount validation, insufficient available balance, insert-failure rollback, duplicate requests, participant-only reads, server-only binding, payment mismatch and replay.
- Still required: signed-webhook tests, concurrent requests, provider sandbox test, configured webhook secret/endpoint, expired checkout recovery, refund state machine, settlement and payout ledger. Do not deploy checkout in isolation or enable real transfers.
- Existing legacy offers were not backfilled as verified funding. Existing wallets can contain test credits; internal wallet debit is not evidence of a Stripe cash deposit.
- Stripe connector offers Sponsor Sorter sandbox and Sponsor Sorter test mode. Account-selection question pending. Existing deployed function uses its existing environment; do not substitute live/test secrets blindly.

## Reusable packages — pending

Creator-owned package CRUD; public safe projection gated by profile visibility; explicit price, currency, deliverables, revisions, turnaround, availability and usage rights. Proposal must snapshot terms so later package edits cannot change an agreement.

## Lasting reports — pending

Inspect existing offer_engagement_analytics first. Store timestamped supported-platform snapshots, participant-only commercial reports, honest unavailable/stale states, retention of past values after refresh failures. No fabricated ROI or universal real-time promise.

## Durable matching preferences — pending

Private account-owned preferences and saved/dismissed partners, editable controls, cross-device persistence, undo, RLS isolation. Existing matching and local shortlist remain live.

## Complete workflow validation — pending

Both disposable roles: proposal, funding, acceptance, draft upload, revisions, approval, agreed platform publication, completion, reporting, refund and payout recovery. Moikailive must never be mutated. No real payment, transfer or payout during tests.

## Release gate

Apply reviewed additive migrations only after local tests; check Supabase advisors. Deploy all dependent functions and configure webhooks before publishing callers. Browser-check both roles and narrow/desktop layouts. Push only tested work; document exact release and remaining limitations in HANDOVER.md and CHANGELOG.md.

## Latest status (supersedes earlier pending sections)

- 70 JavaScript tests and isolated order, preferences and history database scripts pass.
- User selected Sponsor Sorter sandbox acct_1RSqPq2eA1800fRN, test mode. Provider payment testing remains incomplete.
- Durable matching preferences and creator packages are implemented locally; migrations remain unapplied.
- Campaign history migration 20261011090944 is applied live and verified; broad cache policies replaced by participant access. Reporting UI remains local.
- Browser package editor rendered, but the read-only fixture refused saving. Real write verification remains outstanding.
- Table audit covers 58 public tables; no tables or records deleted. Deployed function source inspection returned UNAVAILABLE.
- No frontend release published in this work; a74c4f5 remains latest confirmed published release.

## Groups and moderation follow-up

- Local migration 20261011101816 restricts pending invite inserts to the actual recipient with member role, adds atomic/idempotent accept_group_invitation, and normalizes new report identity/status with reason/detail limits.
- Both group invitation frontend paths use the RPC. Report modal validates type, assigns target through DOM value, limits detail length, and no longer posts report content to an unauthenticated notification endpoint.
- Local PGlite ownership, escalation, acceptance/replay, report identity/status and invalid-reason checks pass. Existing 70 tests pass; changed JavaScript syntax checks pass.
- Live apply_migration failed twice with Invalid or expired requestState. Verification found zero new report triggers. Treat this migration and dependent frontend as NOT deployed; do not publish callers before migration succeeds.
- Remaining: invitation identity/status update guards, membership privacy, owner membership consistency, deletion transactions, group-offer funding/settlement and browser workflow checks. No Moikailive changes.

## Published group/report fix — 9847a9c

- Backend applied successfully via signed-in Supabase SQL editor in one explicit transaction; verified accept_group_invitation(uuid) and four normalize_new_report triggers. Connector migration-history entry was not created; reconcile before future CLI deployment.
- Commit 9847a9c pushed to main; Pages run 38133310942 started. Other workstreams remain local/unpublished.

## Group follow-up a8a6363

- Invitation identity and status-transition guard applied live through SQL editor and verified (one trigger). Local isolated join/guard/report tests and payout lookup/insert/close failure tests pass; 70 worktree tests pass.
- Removed automatic payout attempts during group page loading. Manual settlement now stops on lookup, queue and close errors; remains non-atomic and needs server/provider implementation.
- Frontend commit a8a6363 pushed to main; deployment verification follows. No Moikailive data changed.

## Sandbox verification — 11 October 2026, 15:25 UTC

- Sponsor Sorter sandbox acct_1RSqPq2eA1800fRN is connected. Existing live STRIPE_SECRET_KEY was preserved; dedicated SPONSORSHIP_STRIPE_SECRET_KEY and SPONSORSHIP_STRIPE_WEBHOOK_SECRET configure the new sandbox webhook only.
- Dedicated sponsorship-payment-webhook is deployed and registered for checkout completion/failure/expiration, refunds and disputes. Checkout callers and completion endpoint remain unpublished; do not release them with a sandbox key to production buyers.
- Hosted sandbox checkout paid USD 1.10. Order 653b1764-7cc3-461c-bedc-d0e506fa64a1, session cs_test_a1bIstQrNPIL2fgwzgnGWQNWTMRWlq76oG2AXxgnGoKKnvytMM9A1JTV1I, payment pi_3UPORk2eA1800fRN0TZ64syr.
- Actual signed webhook exposed two legacy trigger failures: log_offer_action and audit_changes relied on caller search_path. Applied migrations 20261011153000 and 20261011153100 qualify audit tables and fix search_path without removing logging.
- Stripe event evt_1UPORm2eA1800fRNB9EEvDV5 replayed twice: both HTTP 200 Confirmed, exactly one offer 4c7a0772-e17f-4a35-84ef-e1de4f3413bd. SQL diagnostic was rolled back; real fulfillment occurred through Stripe delivery.
- Full sandbox refund re_3UPORk2eA1800fRN0P1UJVFv succeeded; signed refund webhook recorded refunded_cents=110 and payment_review_required=true. This refunded offer is unsuitable for settlement testing; use a new sandbox order for the complete workflow.
- Applied 20261011153500: sandbox-backed offers cannot enter the legacy payout queue or be marked paid by that system. Regression checks pass for both guards and normal non-sandbox queue insertion.
- Order regression now includes both live audit triggers. Ownership, atomic rollback, amount checks, replay, refunds, disputes and sandbox queue guards pass.
- Earlier migrations for orders, creator packages, matching preferences, group membership privacy and payment recovery are now applied live. Durable settlement ledger file 20261011151437 remains EMPTY and unapplied; implement before claiming payout readiness.
- Remaining: end-to-end draft/video/revision/publication test using both roles; provider settlement/reconciliation; atomic group acceptance/settlement; final packages/preferences browser write checks; production payment credential separation and dependent deployment; tested frontend publication. Moikailive untouched.
- Evidence: .validation/stripe-webhook-recovered.jpg (local only). No secrets are in this document.

## 12 October 2026 — Settlement and group hardening (in progress)

- Added and applied settlement ledger migration 20261011151437. Server-only claims require administrator authorization, verified Stripe funding, both participants' completed publication, no refund/dispute/review hold, and a separately mapped recipient. Immutable destination/amount/mode snapshots and unique transfer IDs prevent duplicate allocation.
- Deployed settle-sponsorship with a HARD sandbox-only gate. Automatic review rejected the initial live-transfer-capable endpoint; live transfers remain disabled pending explicit approval after verification. No real transfer performed. Existing legacy payout function untouched.
- Isolated provider tests cover payment/recipient verification, existing transfer reuse, database reconciliation failure/retry, recipient restrictions, refunds and unauthorized claims. Database tests cover completion/recipient requirements, replay, transfer mismatch and duplicate recording. Actual sandbox transfer still pending.
- Applied atomic_group_offer_responses: accepted response and correctly identified creator agreement are transactional/idempotent; fixed cent allocations use a frozen participant list. Browser response writes revoked; completion derives from both participants' verified publication state.
- Live rollback test exposed a legacy member-role constraint excluding owner; applied align_group_owner_roles. Group owners have admin access even without a membership row; arbitrary-user role probing is rejected. Rolled-back acceptance against the actual schema passed. Moikailive untouched.
- Removed legacy browser payout creation from group finalization: group listing fees do not fund the full promised budget. Settlement is explicitly blocked until budget funding is verified. Rebuilding full group funding remains required; do not describe this temporary fail-closed state as complete functionality.
- Existing native Expo app located at C:/Users/jrbwi/sponsorsorter-app, with assets, Android project, EAS project configuration and multiple old feature screens. App audit/build follows the website release. iOS distribution and QR installation route remain to be verified.
