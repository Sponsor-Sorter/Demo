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
