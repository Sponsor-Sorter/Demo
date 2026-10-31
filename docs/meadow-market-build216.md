# Meadow Markets build216

## Purchase acceptance controls

The private play_license_acceptance table permits a named registered protocol4 farm with recorded provenance to test only mm_pocket_gems and/or mm_premium for at most seven days. RLS is deny-all, table grants are revoked even from service_role, and no client-facing enrollment function exists. The existing approved test_browser was temporarily admitted, then its provider access was expired at31October03:33UTC after native recovery. Active provider allowlist0; public access remains closed. See meadow-market-native11-acceptance.md.

That account's status explicitly selects provider_test and disables the free test_access shortcut. The native purchase button therefore reaches Google Billing, showing Google test beside its localized price. Google independently needs to recognize the signed-in license tester; the payment sheet must visibly say it is a test and use Google's test payment instrument before confirmation. A test-track invitation alone does not make a transaction free.

Both the verifier and SQL reject a real purchase in this isolated lane, even if global commerce later opens. Product scope, expiry, registered identity, farm provenance, account deletion and refund holds are checked server-side. Existing receipt replay remains available after a temporary license expires. Actual Google cancel/pending/purchase/restore/refund tests remain pending.

A second guard prevents farms under refund review from opening a payment sheet at all, and explains that purchases need a support review. Previously delivery would refuse the purchase but the entry status could still open checkout after global activation.

## Verification and deployment

The full existing Node regression passed. The focused client fixture proves that provider tests call native Billing instead of returning a free grant, and that a refund hold never opens checkout. Two provider validation/signature tests passed, including rejection of non-license Google responses. Fifty-nine shared gameplay/gateway/worker/progression/market/trip/lesson tests passed. The SQL rollback fixture covers legacy denial, protected registered eligibility, exact allowed products, real-payment denial, one-time100gem delivery, replay after expiry, anonymous accounts, refund/deletion holds and public flags failing to bypass the test-only lane. These synthetic SQL tokens are not Google purchase evidence.

Both216migrations and the store/farm Edge functions are deployed. JWT verification remains enabled. Rules hash e58a7c1463a3; its only generated change is the source fingerprint for the build number. No gameplay rule or media asset changed. All1392 existing media fingerprints are reused. Security advisors contain no ERROR; existing anonymous-sign-in/password-protection warnings remain, and the private deny-all tables intentionally have no policies.

Public commerce payments/ads/production flags arefalse, all seven backend products are disabled, command cohort1 (only the backed-up test_browser) and new-farm rolloutfalse. No normal player was converted. The Google license tester list is saved for the one invited test account. No Google product option has been activated by this release.

## Phone and remaining gates

The Samsung accepted the internal invitation and now opens the Play listing. The current direct APK cannot be replaced there in place; Play offers only uninstall/reinstall. The level64/VIP2 farm was backed up privately and its existing login successfully reopened it in Samsung Internet. The human approved replacement. Play installed native10, but its first launch exposed a WebView-thread crash. Play1.7.1/code11 is now installed through Play, fixes that launch failure and restores/reopens the level64/VIP2 phone farm. See meadow-market-native11-acceptance.md for exact evidence and remaining gates.

Runtime41a1504286df52f2ed8a285a3f2284876ee89470 passed CI41159740185 (game-checks and android-build) and Pages41159739607 (build/report/deploy). The live browser displayed215→216 Install update; it was accepted, the existing level14/VIP1 farm returned, and Settings confirmed Game build216. Evidence live-update-prompt216.jpg and live-settings216.jpg. The authoritative workspace mirror synchronized18committed files with0conflicts; no other game's paths were changed.

Build215's actual214→215 remote update was accepted in both live browser and Samsung, with Settings confirming215. Samsung216 is not yet accepted. Play public beta still shows native1.7.0/code10/game201 in review. AdMob exact-package search cannot find the store listing; the app remains Requires review/Add store with limited serving. The search was cancelled without changing its app record. Native Billing, restore/refund/RTDN, UMP/SSV/no-fill and device performance/offline/rotation acceptance remain separate open gates. Physical iPad acceptance remains open. See meadow-native-launch-acceptance215.md.
