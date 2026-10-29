# Meadow Markets Play operations

## Identity and distribution

Game name: Meadow Markets. Publisher: Fairplay Gaming. Package: com.meadowandmarket.game. Website and app load the same live game URL. A Google tester account grants installation access; a Meadow Markets username loads the cloud farm. These are separate logins.

Play Console app: https://play.google.com/console/u/0/developers/9100499290170678316/app/4972769310874407231/app-dashboard

Internal test join: https://play.google.com/apps/internaltest/4701019499198110666

The upload key vault is C:/Users/jrbwi/.codex/private/meadow-markets-play/. It is outside Git with a user/machine-bound DPAPI password. Keep a secure recoverable backup. Never publish the key, its password file, Google service-account JSON or private tokens. Google holds the app-signing key; this local key is for uploads. The old direct APK signing key is different. Export/save farm access before switching distributions.

## Backend switches

Source: supabase/meadow-production-commerce.sql. Project: BargainBarge / ejavqlyozqhzqogflqzr. All tables/functions are Meadow-prefixed or in meadow_private. Other apps must remain unaffected.

commerce_config switches defaultfalse; store_products rows disabled. test_access is an explicit named cohort with expiry. Do not open free pack/ad preview routes to all users. Use the service-role-only support_grant RPC with an immutable request UUID, exact player ID and recorded reason for QA/family supplies. Never place a service-role key in the website, APK or a public support UI.

Receipt delivery is idempotent; retries reuse the same request/token. Never manually credit local state after Billing success. Check canonical receipt and settled state. A refunded account with a review hold must be reviewed before a further store delivery.

## Store catalogue (draft productIDs)

| Product ID | Delivery | Type |
|---|---|---|
| mm_pocket_gems |100gems|Consumable|
| mm_gem_chest |550gems|Consumable|
| mm_starter_pack |150gems,1000gold and fixed supplies|Consumable|
| mm_builders_pack |300gems,3000gold|Consumable|
| mm_reward_tickets |5reward tickets|Consumable|
| mm_pantry_pack |Fixed pantry supplies|Consumable|
| mm_premium |Lifetime optional popup-ad removal|Non-consumable|

Use localized prices returned from Billing; never hardcode an AUD amount in player UI. Prices and tax/region availability still need Console setup. Premium is a lifetime product, not a subscription. Purchasable random rewards are not offered; earned collection draws disclose their odds.

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
