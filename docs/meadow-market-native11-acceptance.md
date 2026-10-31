# Meadow Markets Play 1.7.1 / native11

## Failure and fix

On31October2026 the human approved replacing the direct APK after a private cloud backup and successful test_phone login in Samsung Internet. Google Play installed native10; Android reports installer=com.android.vending. Google's purchase-verification preferences failed to save, but Continue completed the free installation. No Play data was cleared and no verification protection was disabled.

The first launch then crashed. The package-specific AndroidRuntime stack identifies MeadowUpdatesPlugin.trusted calling WebView.getUrl on the CapacitorPlugins thread. This is a real native launch failure, separate from Google's earlier settings notice. Store and ads had the same unsafe origin-check pattern.

Play1.7.1/code11 routes all three plugins through MeadowPlayPlugin.trustedPage. The activity queues the origin check and native action together onto its UI thread. Missing activity/bridge/WebView and pages outside the existing HTTPS Meadow path are rejected. Origin restrictions remain in place. Direct native9 and web runtime216 are unchanged.

The executable check-meadow-play-thread217.cjs compiles the actual guard with a WebView stub that throws on the wrong thread. It covers queued and already-UI execution, untrusted URLs and missing lifecycle objects. The test and production distribution checks passed. The native assembly and actual Play update/recovery results must be recorded below before acceptance.

## Acceptance status

- Signed bundle: building.
- Internal track: draft prepared; not yet uploaded or released.
- In-place Play10→11 update: pending.
- Same test_phone farm, level64/VIP2: cloud backup and browser login proven before removal; native restore pending.
- Real Google license Billing, restore/refund and ad acceptance: pending. Public commerce and ads remain disabled.

## Separate protected-farm canary

Only the existing approved test_browser farm was converted to protocol4, from exact revision4382 with a private source/hash backup and reducer review. No normal farm was converted. An expiring private allowlist permits only Google's test pocket-gem and premium products until31October2026 04:40UTC; test_access isfalse for that lane so free fixture grants cannot count as Billing tests. All public commerce flags and seven backend products remain disabled. The current browser canary displayed an unsupported-local-action warning; its flow acceptance remains open until traced and corrected. Do not downgrade or replace its canonical save.
