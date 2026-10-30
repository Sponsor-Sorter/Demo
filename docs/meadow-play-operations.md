# Meadow Markets Play operations

## Identity and distribution

Game name: Meadow Markets. Publisher: Fairplay Gaming. Package: com.meadowandmarket.game. Website and app load the same live game URL. A Google tester account grants installation access; a Meadow Markets username loads the cloud farm. These are separate logins.

Play Console app: https://play.google.com/console/u/0/developers/9100499290170678316/app/4972769310874407231/app-dashboard

Internal test join: https://play.google.com/apps/internaltest/4701019499198110666

Public beta prepared30October2026: Early access track4699801153255070807, Meadow Markets public beta, native1.7.0/code10 and live game201. Australia only initially, unlimited open invites, feedback meadowmarkets@sponsorsorter.com. Submitted16 changes; Console displayed Changes in review while automated checks were still running. Approval/public installation is not yet accepted. Keep the internal invitation link for existing authorized testers until the public beta is approved; then update the website download option and verify the public store entry before sharing it.

The reviewer account fairplay_review is ready and has a scoped audited demo grant (Premium,10,000gems,100,000gold,100tickets), without free-purchase tester access or purchased VIP XP. Its existing credential is stored in the Play app-access form only, not this repository. Normal gameplay progression remains. Do not reset it or delete its farm while review is pending.

All ten app-content declarations are actioned. IARC: AustralianGeneral, ESRBEveryone, PEGI3; intended audience remains13+. Data safety declares ten concrete data subtypes and includes report content for functionality/security. New fixed AI listing artwork is labelled as AI-created/edited. Public feature1024×500 and four real gameplay screenshots were saved. Signed-in review requires no email/OTP/location gate.

The upload key vault is C:/Users/jrbwi/.codex/private/meadow-markets-play/. It is outside Git with a user/machine-bound DPAPI password. Keep a secure recoverable backup. Never publish the key, its password file, Google service-account JSON or private tokens. Google holds the app-signing key; this local key is for uploads. The old direct APK signing key is different. Export/save farm access before switching distributions.

## Backend switches

Source: supabase/meadow-production-commerce.sql. Project: BargainBarge / ejavqlyozqhzqogflqzr. All tables/functions are Meadow-prefixed or in meadow_private. Other apps must remain unaffected.

commerce_config switches defaultfalse; store_products rows disabled. test_access is an explicit named cohort with expiry. Do not open free pack/ad preview routes to all users. Use the service-role-only support_grant RPC with an immutable request UUID, exact player ID and recorded reason for QA/family supplies. Never place a service-role key in the website, APK or a public support UI.

Receipt delivery is idempotent; retries reuse the same request/token. Never manually credit local state after Billing success. Check canonical receipt and settled state. A refunded account with a review hold must be reviewed before a further store delivery.

## Store catalogue (all seven created as inactive drafts)

| Product ID | Delivery | Type | Draft AUD reference price |
|---|---|---|---|
| mm_pocket_gems |100gems|Consumable|2.99|
| mm_gem_chest |550gems|Consumable|12.99|
| mm_starter_pack |150gems,1000gold and fixed supplies|Consumable|4.99|
| mm_builders_pack |300gems,3000gold|Consumable|9.99|
| mm_reward_tickets |5reward tickets|Consumable|1.99|
| mm_pantry_pack |Fixed pantry supplies|Consumable|3.99|
| mm_premium |Lifetime optional popup-ad removal|Non-consumable|9.99|

All seven fixed IDs and backwards-compatible buy options were verified in Console, with zero active options. Google converted the AUD reference prices across174regions. These are draft prices for review and balancing, not an activated offer. Review tax/region availability before activation. Use localized prices returned from Billing; never hardcode an AUD amount in player UI. Premium is a lifetime product, not a subscription. Purchasable random rewards are not offered; earned collection draws disclose their odds. The game's published privacy URL is saved in Play as a change ready for review.

Before enabling checkout, require a protected game account. Guest farms cannot be recovered on a new installation solely from the game username because they have not registered one, and receipt ownership is intentionally bound to the original game account. Do not turn real payments on until this entry guard and guest/reinstall acceptance are implemented and tested. Prepare a dedicated protected reviewer account for store access, without sharing an owner's farm or credentials.

## Provider secrets

Store verifier requires GOOGLE_PLAY_SERVICE_ACCOUNT, with only app-specific order/product access. RTDN requires GOOGLE_PLAY_RTDN_AUDIENCE and GOOGLE_PLAY_PUBSUB_EMAIL. Ad SSV requires MEADOW_REWARDED_SSV_UNIT (6866630905 is configured). Store these only in Supabase Edge secrets. Configure Google IAM/API roles narrowly and record the grant.

Pub/Sub endpoint: https://ejavqlyozqhzqogflqzr.supabase.co/functions/v1/meadow-market-play-notifications

Reward endpoint: https://ejavqlyozqhzqogflqzr.supabase.co/functions/v1/meadow-market-ad-reward

Never disable request authentication to get a callback test to pass. AdMob's signed setup test uses meadow-admob-setup / verification-only and returns transport success without wallet writes. RTDN validates Google JWT issuer/audience/email, re-fetches the purchase from Play and never trusts incoming benefit/account fields.

## Build

Use tools/meadow-android/scripts/build-play-signed.ps1 for signed Play AABs. Default builds use Google's TEST AdMob IDs. A later production build must explicitly provide MEADOW_ADMOB_APP_ID, MEADOW_REWARDED_AD_UNIT and MEADOW_INTERSTITIAL_AD_UNIT, increment versionCode, and verify the merged Play manifest/signature before upload. Direct debug remains a separate build flavor.

For Play, native updates use Play Store. Remote farm content follows the existing verified web update flow; native SDK/permission/bridge changes require a new Play version. Do not add a self-updating native APK installer to the Play flavor.

## Recovery and incidents

Keep the previous deployed commit and private upload vault. Disable commerce flags server-side if verification or reward delivery degrades; preserve purchases for idempotent retries. Do not roll back the database to undo a content bug. Maintenance backs up bounded batches and prunes30-day backups. Any restore must respect account identity, farm revision and immutable purchase/reward receipts. Preserve shared app identities during game-only deletion. See docs/MEADOW_BACKLOG.md for unresolved production gates.

## Build200 payment safety and AdMob review

AdMob account approval was confirmed30October. App-store linking/app review remains separate. Actual store/ads switches remainfalse and all products inactive. A European privacy message is saved as a draft with visible refusal/close options. Do not publish it until its default provider/purpose list is reviewed and narrowed to the actual SDK setup; actual consent/SSV/no-fill device acceptance remains pending.

Checkout and Restore now fail closed unless the backend confirms a ready Meadow Markets username account attached to a non-anonymous Auth identity. The Edge verifier checks the owner before Google lookup; SQL independently refuses new guest/incomplete-account deliveries. The approved free-test cohort remains separate. Browser fixtures and rollback-only database tests cover guest/incomplete/registered states. Real reinstall/new-device purchase recovery and license-test provider acceptance remain pending.
