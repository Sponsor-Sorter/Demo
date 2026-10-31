# Meadow Markets Play 1.7.1 / native11

## Failure and fix

On31October2026 the human approved replacing the direct APK after a private cloud backup and successful test_phone login in Samsung Internet. Google Play installed native10; Android reports installer=com.android.vending. Google's purchase-verification preferences failed to save, but Continue completed the free installation. No Play data was cleared and no verification protection was disabled.

The first launch then crashed. The package-specific AndroidRuntime stack identifies MeadowUpdatesPlugin.trusted calling WebView.getUrl on the CapacitorPlugins thread. This is a real native launch failure, separate from Google's earlier settings notice. Store and ads had the same unsafe origin-check pattern.

Play1.7.1/code11 routes all three plugins through MeadowPlayPlugin.trustedPage. The activity queues the origin check and native action together onto its UI thread. Missing activity/bridge/WebView and pages outside the existing HTTPS Meadow path are rejected. Origin restrictions remain in place. Direct native9 and web runtime216 are unchanged.

The executable check-meadow-play-thread217.cjs compiles the actual guard with a WebView stub that throws on the wrong thread. It covers queued and already-UI execution, untrusted URLs and missing lifecycle objects. The test, production distribution checks and full Node regression passed. CI41162747296 (game/Android jobs) and Pages41162747574 succeeded for sourceab6b033537f5faf9482b10836d9511561877d888. The native assembly and actual Play update/recovery results must be recorded below before acceptance.

## Acceptance status

- Signed bundle: built successfully; actual Java compilation passed, JAR signature verified, signer SHA256 matches the existing upload certificate. Bundle SHA25622501249ae4a4b5f58dbd46a12a625c4df8f2fbc50b27baba4a8fcc0afe884e5;7617319bytes. The wrapper was stopped after Gradle completed because it did not exit; the completed bundle was copied and independently verified.
- Internal track: native11/1.7.1 published to the existing internal track, Console says Available to internal testers. No new device exclusions. Its sole warning is missing deobfuscation metadata; minification is disabled. Proof play-native11-published.jpg.
- In-place Play10→11 update: passed through the Samsung Play listing. Android confirms1.7.1/code11. No further uninstall or data clear occurred.
- Same test_phone farm: existing login restored it in native11. A subsequent Activity exit/relaunch returned to Eastbank with level64/VIP2 visible; cloud revision4585 independently confirms six maps and318 objects. The running native11 process had no AndroidRuntime errors. Evidence phone11-relaunch.png, phone11-cloud-farm.png and package version output. Compact preference persisted. This is launch/login/relaunch acceptance, not a full touch, rotation, offline or performance pass.
- Public beta: replaced native10 with the same tested native11 bundle through Add from library. Restarted the existing review to include the launch fix. Publishing overview lists1.7.1 under Changes in review. A later observation confirmed automated checks had completed and Google displayed Your changes are now in review. Australia, open access, unlimited testers and the prior listing/declarations remain included. This is not approval or a public install pass. Proof play-beta11-review.jpg.
- Real Google license Billing, restore/refund and ad acceptance: pending. Public commerce and ads remain disabled.

## Separate protected-farm canary

Only the existing approved test_browser farm was converted to protocol4, from exact revision4382 with a private source/hash backup and reducer review. No normal farm was converted. The temporary private allowlist admitted only Google's test pocket-gem and premium products, with test_accessfalse so free fixture grants could not count as Billing. It was explicitly expired at31October03:33:36UTC after native recovery, before handing the phone to Frontlines. A follow-up query confirms zero active provider-test farms; the audit row is retained. All public commerce flags and seven backend products remain disabled. The current browser canary displayed an unsupported-local-action warning; its flow acceptance remains open until traced and corrected. Do not downgrade or replace its canonical save.
