# Save-safety QA handoff

Build173 at immutable commit 389ebacaf53a6bc9a951bc44ffda856a545f4007 is deployed. File SHA256 identities are in meadow-save-qa173.json.

Recheck in a clean checkout with Node22: node scripts/check-meadow-conflict-barrier.cjs; node scripts/check-meadow-cloud.cjs; node scripts/check-meadow-backups.cjs; node scripts/check-meadow-camera-sync.cjs; node scripts/check-meadow-auth-owner.cjs. All passed with the full check-meadow.cjs suite. Use mocks only; no real player login/save writes are needed.

Aborting an active HTTP request cannot undo an already committed server write. Database compare-and-set revisions remain separate work.
