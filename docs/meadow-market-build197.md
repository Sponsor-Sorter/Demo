# Meadow Markets web197 / Play internal1.7.0 (10)

## Release scope

The website and Android wrapper both load https://sponsorsorter.com/meadow-and-market/. They use the same game-only Supabase account and cloud save; device guest sessions remain separate. Settings → Download & install the app now links the actual Play internal test. The direct APK remains in a collapsed compatibility section, with a warning about its different signing key. Never uninstall the old app or discard a guest farm automatically.

The account welcome screen has Create farm account, Sign in and Play as guest. Registration needs only a username/password. Sign-in and creation link directly to each other, preserve the typed username, reset scroll position, support password managers, and retain Show password and recovery controls. Passwords and recovery keys were not entered or read during this release's browser checks.

Account privacy opens immediately, has one handler and one identified dialog, readable44px inputs and46px actions. It no longer opens duplicate dialogs while awaiting authentication. Existing farm switching and backup guards remain.

## Production foundations

- Separate direct/Play Android flavors. Play contains no APK installer permission or downloader; native updates open Google Play. Direct version9 remains1.6.1. Play version10 is1.7.0, targetAPI36, signed with the private upload key.
- Play Billing8.3.0 bridge and server purchase verification. Pending/cancelled purchases do not credit. Global token uniqueness, account SHA binding, immutable benefits/receipts, restore, refund revocation and repeat-refund holds are implemented.
- Backend-only support grants let approved testers/friends receive supplies without public free purchase endpoints. Only test_browser/test_phone currently have the named free test cohort. Normal players no longer get client test-gold controls.
- Optional AdMob integration: consent before requests, restricted requests for the13+ audience, optional rewarded ads and capped natural-break interstitials. Native callbacks never credit gems. Google ECDSA SSV and one-use backend reward nonces deliver rewards independently.
- Game-only deletion request/cancellation, seven-day purge,30-day private backup retention, stale-session tombstone protection and opt-in sanitized error reports. Shared auth identities/other apps are not deleted.
- Named maintenance cron runs every15minutes; first maintenance backed up39 farms, deleted0.

All real payment/ad switches and product enable flags remain OFF. Source/transactional tests and provider callback transport are not substitutes for real license-purchase, refund, consent and device acceptance.

## Provider state verified30October2026

- Play developer9100499290170678316, app4972769310874407231.
- Display/listing name: **Meadow Markets**. Google's unreviewed internal package-name label is automatic until initial setup/review; do not rename the package or create a duplicate app.
- Internal track4701019499198110666 active. Version10 accepted and published to internal testing. The owner's invited Google email is on its selected private list.
- Join: https://play.google.com/apps/internaltest/4701019499198110666
- English listing name/description saved as a draft; store visual assets and declarations are still incomplete.
- AdMob Android app: ca-app-pub-6946008351204848~7779211148.
- Rewarded: ca-app-pub-6946008351204848/6866630905,5gems, ad pods disabled.
- Interstitial: ca-app-pub-6946008351204848/8491985021, at most1impression/user/10minutes.
- AdMob signed setup callback verified and saved. The signed setup probe returns200 without granting any reward. Actual reward paths still require matching configured unit/reward, valid nonce, owning account and unique transaction.
- app-ads.txt adds the verified publisher line without replacing any existing publishers.
- AdMob still reports missing payment information/review. Internal10 uses Google's official TEST ad IDs; real AdMob IDs are documented for the later production native build.

## Acceptance evidence

External artifacts: D:/Chat Gpt/workspaces/meadow-production194-evidence/.

- Full game regression suite passed, including existing account/save/worker/reward/cache checks and new production guards.
- Deno Google purchase rules + realP256 signature/tamper tests passed; all3Edge functions typecheck.
- Transactional SQL tests passed and rolled back: free-path denial, token replay/cross-account rejection, grants, ads, refunds and deletion isolation.
- Signed Play bundle metadata verified10/1.7.0/API36; no REQUEST_INSTALL_PACKAGES; jarsigner verified.
- Google accepted bundle10; internal release is available to the selected tester list. Callback verification success captured from AdMob.
- Browser local197 checked390×640 and844×390: signup/signin, password manager fields, guest/account choices, actual Play link, privacy count1 and readable controls, no horizontal overflow. No credentials or deletion actions submitted.
- Physical Samsung not tested: user's last instruction reserves it for Frontlines. Physical iPad, storage pressure and native performance/long-session tests remain pending.

## Remaining production gates

1. Ordinary crop/animal/build/production/shop/worker snapshot deltas are still legacy. Move these to server-authoritative commands; the protocol3journal does not prove normal earnings.
2. Complete Play listing assets, data safety/content rating/13+ declarations, app access, privacy/deletion URLs and review.
3. Create/price the7fixed Play products; configure a least-privilege Play verification service account and Pub/Sub authenticated refund notifications. No service key goes in client/repository/chat.
4. Finish AdMob payout/review/privacy-message/app-store linkage; build with actual ad IDs after appropriate test-device configuration. Verify a real reward nonce roundtrip, no-fill/cancel/consent/Premium behavior.
5. License-test purchase, pending/cancel, restore on another device, consume/ack retry and refund delivery. Keep flags off until these pass and the farm-authority gate closes.
6. Review auth-principal cleanup for identities exclusive to this game, transaction/security retention and support procedure. Never delete a shared identity as a shortcut.

No public production rollout or real charge/ad impression occurred in this release.
