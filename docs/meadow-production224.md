# Meadow Markets production submission

7 November 2026, Australia/Sydney.

## Submitted

Google Play Publishing overview visibly confirms **Changes in review** for **1.7.2 - Meadow Markets production**, Android version code **12**, target SDK **36**. The submission starts a full production rollout in **Australia** once approved. Managed publishing is off.

Six submitted changes cover the production release/country and Google's corresponding early-access transition: remove Australia from the beta, pause the beta track/open access and retain its unlimited-user setting. No other app was changed.

The initial validation error was an empty production-country selection. Saving Australia cleared it. The remaining nonblocking warning concerns a missing deobfuscation file; the existing Play build has minifyEnabled=false, so no R8 mapping file exists.

Google has received the release; it is not yet approved or publicly available in production. The confirmation screen says reviews are typically completed within seven days and may take longer.

## Game release and acceptance

Web build **224** is live from **a50d913c076e423f130016c3e635e19bd6636c51**. CI **42329286461** passed game checks and both Android build variants; Pages **42329285798** passed. Native 1.7.2 is the same bundle previously installed and tested through Google Play.

This update fixes a small-screen animal-header overlap. The older warm-ui.css first-child selector spanned the title across the Add animal cell. The scoped selector now keeps the title in its own column and adjusts its type size. It was checked on the fresh-start candidate farm at a measured 390×844 viewport. No new narration was needed.

Current-turn checks:

- Full client regression passed. All **63** shared server-rule/control tests passed.
- Actual live crop details and watering, horizontal Build scrolling, minimized placement controls, rotate/undo and animal Collect all were exercised on test_browser.
- Collect all delivered three eggs once and disabled after acknowledgement. A fresh-start animal's Feed action updated its needs correctly; Care all remained level-locked.
- Farmers Market and Market Requests loaded. An actual wheat/carrot village order completed, reputation changed from 20 to 36 and deliveries from one to two.
- The accepted QA friend's six-map farm opened. Requesting crop help correctly reported that the area was already cared for.
- Reload opened Settings **Game build 224** with the same level-17/VIP-1 account. A retained interrupted action was retried through its original-receipt UI; the retry control cleared and normal farming resumed.
- The owner instructed this turn to continue in the browser and keep the Samsung for Frontlines. No phone input or fresh physical-device acceptance is claimed. Prior native-12/iPad evidence remains in the historical acceptance documents.

Public payments/ads and backend store products remain disabled. No new provider test lease, paid order, revenue ad, shared Auth setting or general farm-command enrollment was enabled. Outstanding physical purchase/ad edge cases therefore remain deferred commercial-activation work rather than silently reported as passed.

## Recovery scope and incident

The owner explicitly stopped further backup work because the current population is predominantly test data. This supersedes the earlier request for a private database connection file; no password/file is needed from the owner for this submission.

A broad read-only logical-export attempt failed with an API timeout. The database restarted at 02:45 UTC and briefly rejected connections. The export path was stopped; subsequent SQL confirmed all 54 saves remained, no export query was running, and the live protected farm recovered through the saved-action retry flow. No restoration or production data replacement occurred.

A smaller direct-table game export subsequently completed to a private local file. It has not been claimed as a verified full hosted-project restore. Earlier isolated logical-restore evidence remains valid within its documented scope. Full shared-platform recovery, binary Storage objects and Edge secrets are not marked complete. Further backup work was stopped as instructed.

## Evidence and remaining work

Operator evidence: D:/Chat Gpt/workspaces/meadow-production194-evidence/production20261107. This includes google-production-submitted.png, animal-header224.png and client/server logs. Private exports, credentials and raw connection plans stay outside source control.

Next: Google's approval and public installation check. Commercial activation still requires the deferred native billing/ad/privacy cases and reviewed server-authority rollout. Phone checks wait for an explicit release. Preserve the other games and the existing test farms.
