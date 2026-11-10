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

Native14 compilation, web publication and physical demo acceptance are recorded as they finish. Do not promote the native candidate before these checks pass. Keep the Samsung's original rotation settings (accelerometer1/user_rotation0), farm and optional-popup preference intact when finished.
