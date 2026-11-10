# Meadow Markets 231 — account-panel navigation

Saving an Emporium setting or collecting a mission rebuilt the panel and reset its scroll position. Supply choices, quantity and the VIP disclosure also reverted. The panel now captures these controls before an acknowledgement redraw and restores them only for the same tab and signed-in account. Account changes and switching to a different tab do not inherit the old panel's selection. A speed-up target that has finished is cleared rather than silently selecting another field; the player explicitly chooses a field or batch before the button enables.

Leaderboard requests now bind their game/scope/week to the request that was issued. An older response cannot replace the active result or its prize target. Changing filters clears the previous claim control, shows Loading scores and disables the refresh button until the current request finishes. Mission refresh has corresponding busy feedback and does not redraw a tab the player has left. Existing one-tap claims, server receipts, prices, farming arithmetic, portraits and approved audio remain in use. No new narration is needed for these existing controls.

## Verification

Focused executable tests cover same-account scroll/form/disclosure retention, an unavailable activity, account/tab isolation, out-of-order leaderboard responses, the exact displayed game/week prize target, error/retry and closed-panel responses. Existing mission receipt/double-click tests and the full Node regression suite pass. The full local checker initially found an absent sparse-checkout SQL fixture; the existing repository fixture was restored to the checkout and the complete rerun passed. No test assertion was weakened.

Actual browser acceptance on the approved localhost8771 origin used the existing fairplay_review farm. Cancelling a setting confirmation retained scrollTop1244, Milk, quantity12 and the expanded VIP disclosure; the setting remained off. Rapid game/player/week changes finished on Word Search/Friends/last week, with the correct2026-11-02 result. One direct harvest mission claim delivered5gems/50gold through the existing server flow, changed Collect to Collected and preserved scrollTop71.5. Refresh showed Refreshing and recovered; switching to Shop during refresh left Shop open. No real purchase or ad was used. Preview origins outside the existing CORS allowlists were rejected; no allowlist was expanded.

Web231 updates only the club module and release/cache metadata. All1392 artwork/audio fingerprints are retained. Gateway41 is deployed with JWT verification; all eight uploaded files read back exactly. Its sole difference from40 is the generated rules fingerprint for the web build number, not farming behavior. No schema, account privileges or other games changed.

## Native follow-up

The Google Play update intent now explicitly targets com.android.vending, removing the competing Galaxy Store chooser observed on the Samsung. Source is prepared as native1.7.5/code15 and covered by the distribution check. This is not an uploaded/distributed native15 or a physical15 acceptance claim. The already submitted signed1.7.4/code14 artifact is unchanged, and its review is not restarted.

Publication and final live acceptance are recorded after CI and Pages complete. Current launch facts and future work are separated in MEADOW_ACTIVE_BACKLOG.md; older chronological entries remain evidence, not current release gates.
