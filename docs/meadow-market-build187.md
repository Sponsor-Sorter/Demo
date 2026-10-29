# Meadow Markets build187 — reward level guidance acceptance

Build186's journal and atomic receipt delivery remain in place. Review found that projecting server-delivered XP skipped the existing farmer unlock voice/notice path. Both ordinary XP and acknowledged server rewards now use the same level announcement, including every intermediate level in a receipt batch. No extra gold/XP is awarded by that announcement.

The real owner-entered recovery check also completed: a subsequent ordinary sign-in using the new owner-selected test password restored test_browser's existing level5/VIP1 farm. A metadata-only query confirmed no active recovery key. The agent did not read the key or submit the credential change. Recovery keys are single use; save a fresh key after resetting.

See build186 for the private database migrations, regression scope and outstanding migration from legacy farm deltas to authoritative commands. Free testing purchases/ads remain enabled; this release does not enable paid production.
