# Meadow Markets221: isolated ad acceptance

31October2026. Public checkout/ad issuance remains off. Backend220 recovery evidence is in meadow-market-recovery220.md.

## Changes

- Private ad acceptance is scoped to one named registered protected farm per operator row, with recorded native version1.7.2 and expiry of at most24hours. No row is enrolled by migration. Legacy, anonymous, deleting, expired and refund-review accounts cannot use it. Other farms retain the existing public switches.
- This ad lane is independent of the Google license purchase lane. It does not enable checkout, grant free currency or change Premium. Ad starts retain the hourly/daily caps. Only the existing signature-verified AdMob callback can deliver the reward.
- The web client now checks account identity after status, consent, nonce and ad display. It serializes ads with purchase/restore operations and recovers its controls after no-fill/failure. Native earned callbacks still only request a server refresh.
- Approved ad testers reach the native SDK instead of the free game-preview dialog. Other approved free testers keep their existing preview.
- Play native12/1.7.2 uses this game's actual AdMob app/rewarded/interstitial IDs, matching the existing signed-reward endpoint. Direct APK behavior remains unchanged. AdMob Test apps confirms version1.7.2 Test modeON; that version's traffic is non-revenue. Do not remove its test designation to make an internal acceptance build billable. A later production native version requires a separate activation review.
- All users retain the existing conservative under-age-of-consent request flag and PG ad-content cap. This restricted configuration does not exercise personalized-ad consent acceptance. A consent-update error prevents an ad; farming is independent of consent.

## Evidence

- Focused JavaScript fixtures passed: native test routing, public-disabled/free-preview behavior, denied privacy, account switching during consent/nonce/show, duplicate requests, no-fill recovery, and no client reward grant.
- Rollback-only SQL fixture passed: private permissions, legacy denial, protected named access, unrelated-account denial, ten-start throttle, zero rewards on start, player reward-delivery denial, expiry, anonymous/review/deletion denial. This is not an actual ad-view test.
- Full Node regression and61 shared-server-rule tests passed. Regenerated server rules deployed in gateway33 with JWT verification required. Post-migration security advisors returned zeroERROR; the new deny-all private table has the expected INFO policy notice.
- Real provider purchase/cancel/pending/restore/refund, native rewarded view→signed SSV, no-fill and device performance remain pending. No test lane has been opened for the phone while it is held by Frontlines.

AdMob configuration proof stays at D:/Chat Gpt/workspaces/meadow-production194-evidence/farm205/admob-test-version172.jpg. Its app itself remains Requires review / limited serving until a supported public store listing can be linked. Google public beta1.7.1 review is preserved; internal1.7.2 acceptance is separate.

## Live closeout

Runtime88bff2f4182e0f7f8a10dfc0beb2ed3daf8b0445 pushed to origin/main. CI41189220801 game-checks and Android-build both succeeded; Pages41189221044 build/deploy succeeded. The running browser accepted the actual219→221 Install update prompt, returned to the same level15/VIP1 farm and Settings confirmed Game build221. The tester shop retained its free-purchase labels and610gems/one ticket; no purchase or ad view was performed. Screenshot: farm205/browser221-settings.jpg in the external evidence folder.

09:42UTC health:51farms,2protected with provenance,49 daily recovery archives,0 missing eligible archives,0 recent hash failures,0 overdue unsettled purchases,0 real purchases and0 active purchase/ad provider test entries. Public payments/ads/production and new-farm issuance remainoff. Guarded source mirror copied22 changed paths with0 conflicts.

## Play native12 published internally

The signed1.7.2/code12 release built successfully, JAR signature verified, and signer SHA256 matched the existing upload certificate. Bundle7,617,307bytes; SHA256 a8509bb6e5e46a9fc892017bd974987b4a29af219ec660f645587ab0df65b203. Google independently parsed the uploaded bundle as12/1.7.2, minAPI24/target36, with no supported-device changes. The sole warning is absent deobfuscation metadata; minification remains disabled.

Published to existing internal track4701019499198110666/release3. Console confirms Available to internal testers, released31October8:53PM local. Proof farm205/play-native12-published.jpg. This is not a physical install or provider acceptance result: the Samsung was not touched and remains with Frontlines. Google publicbeta1.7.1 still shows Changes in review after internal12 publication; no beta review restart or production rollout occurred. Proof farm205/play-beta11-preserved221.jpg.
