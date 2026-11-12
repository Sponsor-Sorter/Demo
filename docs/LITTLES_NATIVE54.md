# Native billing and ads acceptance · 12 November 2026

The human authorised physical billing/ad tests, replacement of the Littles test copy and Play submission after fixes. Tests used the existing USB-connected Samsung SM-S908E, Android14, user0. Internal code9/0.3.0 was installed by com.android.vending under the requested jrb account and is not debuggable. Production code10/1.0.0 uses the same billing adapter with demo ads disabled. No real charge was made.

## Fixed failures

The original USB-installed copy used the device's first Google account for billing, differing from the selected Play account. Google returned “item could not be found.” After owner verification and explicit replacement approval, installation through Google Play under jrb resolved this. No other app/profile was reset. The original save/session and one drawing remain backed up in the protected local vault; the drawing was not restored into the Play copy.

A server error then interrupted purchase confirmation and acknowledgement. meadow_littles_play_record returns void, so PostgREST correctly responds HTTP204. The RPC helper incorrectly parsed that empty response as JSON. The correction accepts204 only for this write; reads still require a body and fail closed. Durable recording still precedes acknowledgement. Actual renewals and RTDN subsequently succeeded.

The account dialog retained guest controls after parent sign-in. It now rebuilds when authenticated identity/verification changes, retaining the explicit device/cloud progress choice. A component test invokes actual button callbacks and verifies immediate sign-in/sign-out controls without replacing either save.

## Actual native/provider results

| Check | Observed result |
| --- | --- |
| Product | ml_plus/monthly, AUD4.99, P1M from native Billing8.3 |
| Correct account | Native payment methods explicitly showed jrb and Google test cards |
| Cancel checkout | Back/No thanks returned Free with no receipt |
| Empty restore | “No active Plus subscription was found” |
| Decline | Always-declines instrument declined; Free retained |
| Approved purchase | No-charge test purchase; native “Plus is active. Thank you!” |
| Paid restore | Native “Plus restored.” after server fix |
| ACK/renewal | Multiple real five-minute renewals advanced paid-through |
| Unlimited/ad-free | Six complete picture-slide rounds using normal accessible taps, all normal wins, no ads |
| Restart | Paid access and9 QA stars retained; banner absent |
| Manage link | Opened the correct native Littles Google subscription |
| Cancel paid-through | At01:34 UTC Google CANCELED, expiry01:38:02.409; signed status still paid/Plus true with valid RSA signature |
| Refund/revoke | Latest third-subscription test renewal refunded with Remove entitlement; at01:35:14 paid/Plus false, before prior paid-through |
| Device revocation | Cold restart restored labelled Advertisement/Test Ad banner |
| RTDN health |01:27–01:37 UTC:6 notifications200,25 store200,19 preflight204, no503 |

The earlier USB acceptance copy also completed five free rounds, blocked the sixth, retained that limit after restart, and hid the demo banner in games/dialogs/background. No live ad was clicked. Release9 used the Google demo unit under a private expiring fixture lease. AdMob approval is a separate gate. This auto-renew plan offered approve/decline/chargeback cards, not a slow-pending card: pending no-grant is rules-tested, not claimed as a native pending-card test.

## Backend and checks

- Store v6 bundle SHA256 d935c758f9ab527f4bdc55e6e19658ae3b6e4338b1265aed2a48fb1fed4816b0.
- Notifications v5 bundle SHA256 6d5878d4fcdc5182eb0d3ea2ee2e33ae9606f67d32bc1f4e4bce7f38c3b3aa76.
- Both deployed five-file packets were fetched back and matched byte-for-byte. Existing session/Google OIDC checks and gateway settings were preserved.
- Deno9 tests plus4 reconciliation substeps and both Edge type checks passed. Actual service tests cover204 save then ACK, missing read body denied, failed write preventing ACK, and acknowledged restore avoiding duplicate ACK.
- Provider diagnostics retain only operation, HTTP status and a bounded reason enum. Tests reject raw URLs, tokens and messages.
- Complete Littles regression and updated account recovery checks passed. Isolated component tests supplement actual native payment tests.

Private fixtures, captures, tokens, phone tooling and vault backups are excluded from Git. The Google reviewer account/grant is intact. All three test subscriptions are expired or revoked; no test renewal remains active. Orientation is restored to free; audio settings remain32/65/20/80. Previously launched Studio/mirror processes were stopped. Automatic review blocked removal of downloaded mirror files, which remain outside source.

## Coordinated Admin controls

Preserve the separately deployed Fairplay endpoint's53 markers, live-session guard migration20261111235603 and service-only observation migration20261112000716. Admin's SQL/ACL/RLS qualification is separate from native payments. No security access, complimentary grant or other game's data was changed for payment testing.

## Rollout boundary

The server correction is live. This record precedes final source merge and Play submission; consult the publishing receipt for submission status. AdMob production store linkage/readiness is outstanding. Demo-ad qualification does not claim live-ad approval. Web remains build53 with a cache-busted account-dialog hotfix; native candidate remains code10/1.0.0.
