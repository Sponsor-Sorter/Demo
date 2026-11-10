# Meadow Markets native 1.7.4 and web 230

## Reason for the follow-up

The owner released the Samsung for Meadow testing on 10 November. Google Play updated the existing app from 1.7.2/code12 to 1.7.3/code13 without uninstalling it. Launch restored the same protected test_phone farm at level68/VIP2, with all maps and placed items. Portrait and both landscape orientations rendered with the appropriate cutout inset and immersive system bars. The shop scrolled and Settings reported web229. No launch exception was observed.

One provider view still lacked a visible Test Ad label despite the existing account-wide device registration. No advertiser/install link was clicked. Testing through that normal unit was stopped; the view's signed SSV delivered one reward,625→630gems and6→7tickets. This is not proof of a non-revenue impression or a passed early-dismissal test. Its grant is expired, and the earned wallet is preserved.

## Isolated acceptance path

Native1.7.4/code14 adds a capability handshake and explicit testOnly flag. A private acceptance lease selects Google's official demo rewarded/interstitial units. Demo requests carry no game account identifier or server reward nonce; completion adds no gameplay currency and starts no settlement poll. Public customers continue using the existing production units and signed SSV reward path. Normal approved testers retain the free in-game preview path.

The backend separates ads_enabled from isolated_ads_enabled. During a private acceptance lease, ads_enabled isfalse so cached older clients refuse provider ads; only the updated client understands the isolated flag. That client also requires the native capability before loading anything. An older native build is told to update rather than falling through to a production unit. Lease expiry restores normal public eligibility and the original free tester cohort. No grants, RLS or other games changed.

The test account alone sees a manual popup-placement control. It still respects the player's popup preference and freshly fetched Premium entitlement. Both demo buttons explain that they add no game rewards. Small guidance changes use existing controls; no new voice recording is needed.

Google's official demo unit documentation: https://developers.google.com/admob/android/test-ads . The units are5224354917 for rewarded and1033173712 for interstitial, both under3940256099942544.

## Verification and release

Actual Java-plugin callback tests verify the exact demo units, omitted SSV identity, labelled test completion and retained normal owner/nonce binding. Client tests cover old-native refusal, missing-isolated-flag refusal, demo operation with public ads off, no nonce/poll/currency for demos, account switching, Premium/default-off suppression, retry and unchanged normal server reward verification. Billing/restore/refund contracts pass. All62 farm/server tests pass. The updated cache test checks the exact230 offline launch URL and1392 unchanged asset fingerprints.

Gateway40 is deployed with JWT verification and all eight uploaded files verified. Its only code change is the generated rules fingerprint for the web build number; farm arithmetic is unchanged. Three private acceptance migrations add the reviewed native versions and separated status flags. Rollback-only database assertions passed lease activation, legacy-client denial, expiry, public eligibility and preservation of tester access.

## Final acceptance — 10 November 2026

Native 1.7.4/code14 compiled, passed R8 and vital lint, and was independently signature/DEX checked. The signed bundle is 6,751,251 bytes; SHA256 `566cb8641294be6e884b15e2cd8dcfd31ed612bd9a4221d9172071965a883b0d`. All four native plugins and thirteen annotated JS methods survived optimization. Final main-source CI42765854339 passed both game-checks and android-build; Pages42765854164 passed. Implementation28a96ba and merged main246e33d preserve concurrent Littles51.

Google Play delivered13→14 in place to the authorized Samsung. Package inspection confirms1.7.4/code14, and Settings confirms web230. The same level68/VIP2 test_phone farm returned. Browser accepted the actual229→230 update dialog and reopened its existing saved farm. Physical13 portrait and both landscape checks, Build tray minimize/expand/scroll and short-swipe placement preservation passed earlier in this session. Do not describe the default-fit camera swipe as a pinch/pan acceptance test.

During a private14 lease, actual rewarded and interstitial creatives visibly showed Test Ad. Completion, SDK-close and Home→Recents→resume returned to the shop; subsequent demo loads worked. Back pressed while the rewarded video was still unskippable did not dismiss it; a pre-reward dismissal is covered by executable Java/client callback contracts, not claimed as a physical success. Both dismiss callback outcomes and unavailable/retry paths pass those contracts. No advertiser/install control was clicked.

The device displayed Optional popup ads are off for the default-off path. With the preference explicitly enabled, the interstitial demo loaded. A temporary, guarded Premium fixture on this test account produced Premium is active. Popup ads are blocked, with no ad activity. This is UI suppression acceptance, not a new Google purchase test. The fixture was immediately restored; historical actual Google purchase/Premium/refund checks remain separately recorded in native227. Restore on native14 returned No unfinished purchases on this Play account.

Wi-Fi was briefly disabled with a finally-block restoration. An ad attempt showed Connect online for purchases and ad rewards. You can keep exploring your farm. Reconnecting allowed another labelled demo. Genuine provider no-fill and other geographical consent variants were not forced; automated rejection/consent contracts cover those branches. Scoped native logs showed no fatal exception, ANR, uncaught ReferenceError or TypeError during this run.

Final wallet630gems/7tickets/Premiumfalse/popupsfalse matches the pre-demo baseline. Demo-created reward nonces0; active purchase/ad acceptance leases0. Wi-Fi is enabled; original accelerometer_rotation1/user_rotation0 remain. No real-money order was placed. Aggregate live health at06:27UTC: no opted-in errors in24h, overdue unsettled purchases0, real purchases0, registered legacy reviews0, protected farms without provenance0, recovery hash failures0 and missing daily recovery archives0.

## Production submission

The same verified14 artifact was promoted to Production as 1.7.4 (14) - Android performance, 100% of existing targeted countries, preserving Australia scope and managed publishing off. Device coverage is unchanged. Google estimates3.37MB for a new install, down3.76MB, and2.47MB for an update. Publishing overview shows Changes in review; quick checks are running and will forward the submission after passing. Public1.7.2/code12 remains current until approval/publication. This is a submitted update, not a claim that14 is publicly available.

Final Console refresh confirms the quick checks have completed and explicitly states Your changes are now in review. We may find additional issues when reviewing your app. No submission action remains pending. Production approval/publication and a public14 install remain Google's next stage.

External evidence: `D:/Chat Gpt/workspaces/meadow-production194-evidence/launch230/`. Relevant captures include installed174, settings174, actual-demo174, popup-visible174, premium-suppression174, offline-ad174, browser-web230 and play-production174-submission. Remaining nonblocking observation: the native update link can show a Play/Galaxy Store chooser. Retain the upstream deprecated-cutout advisory until Play analyzes14; no unverified claim that it disappeared.
