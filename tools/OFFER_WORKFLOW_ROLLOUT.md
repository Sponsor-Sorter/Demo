# Offer workflow rollout and recovery — 2026-10-11

## Validation before deployment

- `node tools/offer-drafts-local.test.cjs`: isolated PGlite PostgreSQL engine, synthetic accounts and objects only. Validates the actual migration SQL, RLS against intentionally broad legacy policies, participant/outsider/visitor permissions, immutable stored drafts, review permissions/idempotency, approval gate, agreed terms, platform URLs, comment authorship and archived evidence access.
- Install local validator if absent: `npm install --prefix .validation --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.3.14`.
- The local test models relevant live schema; it does not prove real video bytes upload, signed playback, remote service integration or concurrency under load.
- Run unit suite and read-only browser preview before release. After migration, inspect catalog/policies and run rollback-only fixture assertions. Protect real account Moikailive (62a9095d-d212-4dd5-842b-6b575b879be7).

## Recovery plan

1. Restore the previous frontend version e513e99 for the changed offer scripts/HTML and publish a forward revert. Never reset unrelated changes.
2. If a newly introduced trigger disrupts a legitimate workflow, use a reviewed follow-up migration to drop only the corresponding new trigger: require_offer_draft_approval, protect_private_offer_terms, validate_private_offer_content, protect_private_offer_comment_author, guard_private_offer_actor. Preserve the existing audit/log/dispatch triggers.
3. Revoke authenticated execution of submit_offer_video/review_offer_video to stop new draft mutations while investigating.
4. Preserve offer_submissions, its participant policies and the private offer-submissions bucket. Do not delete uploaded evidence or relax read access. Keep restrictive Storage policies: legacy broad policies would otherwise expose draft videos to unrelated authenticated users.
5. A frontend revert restores pre-existing broken refund/payment buttons; leave those actions disabled until verified server-side settlement is implemented. A rollback is not a payment fix.

## Known limitations / next work

- Automatic private-offer refunds and creator wallet credits remain unavailable pending a verified funding ledger, atomic settlement RPCs and payment webhooks. UI now refuses to report or mark these as successful. No money was moved.
- Client-created legacy offers are not proof of paid funding. Never credit wallets using their amount alone.
- Draft videos are limited to 50 MB, 50 submitted revisions; all parties can load private playback links valid for an hour. A recipient can share a signed URL until expiry. No persistent public video URL is created.
- TUS retries handle interrupted chunks while the page stays open; cross-reload resume/cleanup and server video inspection/transcoding remain future work.
- Draft decisions refresh on demand; server notifications and realtime review delivery remain future work.
- Current feature covers private offers (including group allocations represented as private offers), not global direct messages or a separate public-offer application chat.

- Additional private Storage hardening: invoices and sponsorship-proofs now enforce account-folder ownership despite legacy blanket authenticated policies. Existing invoices: 10 account-scoped files; one ownerless/unscoped legacy object is quarantined from client reads (not deleted; not owned by Moikailive). Map that object to a verified owner before restoring client access. Service-role maintenance remains available.
