# Meadow Markets backend 203

30 October 2026. Backend hardening; the live website remains build202. No native wrapper or game assets changed.

## Save integrity

The locked protocol3 commit now compares permanent gem benefits against the canonical server save before applying verified receipts. Clients cannot add, alter or copy automatic watering, well gem tiers or production queue slots. Existing benefits are preserved, including a unique item moved between maps. New paid benefits still arrive through server receipts. A fixture covers cross-map and same-map copies, first-save forgery, valid receipt delivery and legitimate moves.

Direct client writes and the legacy invoker protocol2 RPC are retired for all saves, including new accounts. Otherwise a forged legacy baseline could grandfather paid benefits before protocol3 enrollment. Current clients already use the locked receipt-aware RPC. Outdated clients receive the existing update-required error. Backend services retain their existing save access. An authenticated-role rollback fixture confirms both blocked routes, first-save validation and a successful current-protocol save.

This is **not full authoritative farming**. Ordinary harvest, care, shop, craft, build and helper outcomes still come from client snapshots. Their journal records are not independent proof of legitimate earnings. Keep real commerce disabled while those actions are migrated and accepted.

## Play notification service

The Edge handler now processes authenticated full one-time voided-purchase events. It finds the existing purchase by its token hash and uses the existing idempotent refund RPC; it never accepts an owner or benefit amount from a notification. Normal one-time events still recheck Google using the recorded product. Unclaimed purchases are not assigned or credited by notifications. Partial/multi-quantity and subscription events do not revoke unsupported products; this store only accepts quantity one and sells no subscription.

Malformed, wrong-game, ambiguous, unknown and oversized events are rejected. Invalid JWTs receive401; transient provider/database failures remain retryable503. Google issuer, RS256 signature, exact audience, verified email and dedicated push identity remain required. No purchase tokens or credentials are logged.

Deployed notification function version4. The Play Android Developer and Pub/Sub APIs are enabled in the dedicated fairplay-meadow-markets Cloud project. The verifier is an active Play user with only Meadow Markets app access: read app information/quality, view financial data, manage orders/subscriptions. No account-wide or publishing permissions were selected. The notification identity has no Play access or user-managed key.

Topic projects/fairplay-meadow-markets/topics/meadow-play-rtdn grants Google Play's system notification identity Pub/Sub Publisher on that topic only. meadow-play-rtdn-push uses the dedicated notification identity, authenticated push, exact endpoint audience, wrapped payloads,60second acknowledgement,10–600second backoff, seven-day default unacknowledged retention and no inactivity expiration. Both endpoint audience/email settings are installed in Edge secrets. Play's saved RTDN setting includes voided and all one-time product events. Cloud metrics recorded acknowledged push test traffic; an unsigned direct request returned401. This proves test transport, not an actual paid purchase/refund.

Google's generated JSON downloads were not delivered by the browser. Both unused generated keys were revoked with the user's specific approval. A single RSA2048 private key was instead created in a restricted local directory, and only its generic-subject X.509 public certificate was uploaded using Google's supported UI. The private credential was installed as GOOGLE_PLAY_SERVICE_ACCOUNT through a temporary private environment file, which was removed afterwards. No private key passed through browser forms, command arguments, output, source or Git. The registered certificate expires30October2027; rotate before that date. Google OAuth and the app's product-list API both returned200, exposing exactly the seven prepared product drafts. That confirms this credential and app access, not a purchase/refund acceptance.

## Acceptance and remaining gates

- Full local game regression suite passed. Five notification tests and two purchase/SSV signature tests passed; notification TypeScript check passed.
- The exact deployed Google purchase helper authenticated with the configured credential and rejected a deliberately invalid purchase token with provider400. No purchase or virtual goods were created. OAuth/product-list success is separate from real license purchase/refund acceptance.
- Deployed paid-entitlement, legacy-route and previous economy rollback fixtures passed, leaving no fixture account or award behind.
- Security advisor check returned no ERROR-level findings. Existing anonymous-sign-in and leaked-password-protection warnings remain; private service tables intentionally have no player policies.
- Live test_browser collected apples, reloaded and opened server Gold & basket history after route hardening. No credential or recovery key was read or changed.
- Phone testing remains paused by user. No phone control or installation acceptance is claimed.
- Public beta was still in review at this turn's check. No production release or public installation approval is claimed.
- GOOGLE_PLAY_SERVICE_ACCOUNT and both RTDN settings are configured. Real license purchase/restore/pending/refund, native consent/SSV/no-fill, full farm authority and physical performance/storage acceptance remain launch gates. All commerce flags and products stay disabled.

Private evidence: D:/Chat Gpt/workspaces/meadow-production194-evidence/store203. No private key or purchase token belongs in this repository.
