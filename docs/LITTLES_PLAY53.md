# Littles Play monetisation staging · Build 53

User-approved terms: A$4.99/month reference price; Plus removes advertisements and permits unlimited completed rounds. Free play has five completed rounds per game per local device day. Failures and abandoned attempts do not spend a round. The actual Google Play price is displayed before checkout. No trials, paid gem packs or rewarded/interstitial ads are included.

## Deployment state

- Google Play app draft created with the user's explicit confirmation of the Developer Program Policies and US export declarations. App ID `4972356804404556638`, developer `9100499290170678316`, package `com.meadowmarket.littles`.
- Acceptance9 is published internally on track `4700162780847854790`, using a dedicated list containing only the signed-in owner. Google shows the temporary unreviewed package name; there is no public production release. Internal opt-in: `https://play.google.com/apps/internaltest/4700162780847854790`.
- Product `ml_plus` and auto-renewing base plan `monthly` are active, initially Australia only at AUD4.99. Seven-day grace period, default 53-day account hold, no trial/intro offer, charge plan changes at the next billing date. Public in-game checkout remains off.
- The English store listing is saved with the approved icon, feature graphic, four phone screenshots and two screenshots for each tablet size. Images containing AI-created illustrations are labelled. Public review and the remaining app-content declarations are not complete.
- Separate AdMob app `ca-app-pub-6946008351204848~9683786343`; banner `ca-app-pub-6946008351204848/8881665550`. App-level rating G, video disabled, automatic refresh disabled. Store linkage/readiness review still outstanding.
- Signed acceptance bundle code 9 / 0.3.0: SHA256 `207c307f0d039abfd555d37ca15e6c12038a604a2a350233d073e373aca57685`.
- Signed Play candidate code 10 / 1.0.0: SHA256 `284118561e0880af33292ce22472d0305365cddeb8a49fb06b0ecc70593fa3c3`.
- Both bundles compiled, passed release lint and verified with jarsigner. Their upload certificate is intentionally self-signed, as Android upload keys normally are. Neither result proves on-device or store acceptance.
- Supabase project `ejavqlyozqhzqogflqzr`: billing migrations applied, `littles-play-store` v3 and notifications v2 active. Public checkout/ads flags remain **false**. No real receipts, test cohort or complimentary grants were created.
- The separate `projects/fairplay-meadow-markets/topics/littles-play-rtdn` topic exists without a subscription or new grants. Verifier app scope, topic publisher grant and authenticated push-subscription drafts are prepared and awaiting the user's action-time approval. Matching `LITTLES_PLAY_RTDN_AUDIENCE` / `LITTLES_PLAY_PUBSUB_EMAIL` remain unset; the receiver returns unavailable without them. Real license checkout, cancellation/refund/renewal delivery and native demo-ad acceptance remain outstanding.

## Subscription and owner contract

Product `ml_plus`, base plan `monthly`, package fixed above. Server calls Google's subscriptionsv2 API, binds SHA256(`meadow-littles:` + Auth UUID), validates product/plan/state/expiry, persists the hashed token before acknowledgement and atomically retires a linked prior receipt. Active, grace and cancelled-but-paid-through states retain access; held, paused, pending and expired states do not. Test purchases require a private unexpired tester lease. Raw purchase tokens are never stored in game saves, reflected in errors or logged.

Play Store resubscriptions use Google's expired external account identifier before acknowledgement, reject conflicting current/expired identities, and send the verified obfuscated account ID back during acknowledgement so future restore/renewal calls retain the binding. See [Google's lifecycle guide](https://developer.android.com/google/play/billing/lifecycle/subscriptions) and [acknowledgement request fields](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge).

`public.meadow_littles_plus_projection(p_user uuid)` is service-only, SECURITY INVOKER, contract `littles-plus-projection-v1`. It reports finance, not sign-in eligibility. `access_eligibility_verified=false`; `parent_account_bound` is historical binding only. Paid no-row is verified false. Gift helper failure is unknown/null. Effective finance is paid OR gift, with known paid=true preserved if gifts are unavailable.

Fairplay Admin owns the sole complimentary grant ledger. It is read through `fairplay_complimentary_entitled('littles', exact shared Auth UUID, 'littles_plus')`. No child-name mapping or second grant ledger exists. Revoking a gift never overwrites paid access. Admin's financial read adapter is connected; its gift-writing capability remains disabled pending actual consumer deployment/acceptance.

The consumer Edge resolver separately requires a live authenticated, unbanned session and a nonanonymous, confirmed parent email. RSA proofs bind issuer, package, parent UUID, product and expiry. Paid leases last at most 24 hours (bounded by paid-through); gift-only leases at most five minutes. The client checks signatures and claims and refreshes each minute, foreground and account change. A short network failure may retain only an unexpired same-account signed proof. Client save flags are never entitlements.

## Child and parent experience

Settings, accounts, shop and external legal links sit behind a literacy/maths grown-up gate. Google owns checkout; cancelling or pending payment never grants Plus. Restore retries verification without charging. The child-facing daily limit offers another game and has no purchase button. Successful-round hooks cover each game start/replay path, including returning through the together lobby; linked devices stay connected when a round closes.

The last confirmed public allowance policy persists across offline restarts; an explicitly confirmed public rollback also persists. Private tester flags cannot enable public limits in this cache. Paid access still requires an unexpired signed proof, not a cached rollout flag.

There is one clearly labelled home/game-selection banner only. The native adapter hides it while any game/dialog is open or the app is backgrounded. Child-directed/under-age treatment and G rating are configured before SDK initialisation. No mediation, rewarded, interstitial or app-open units. AD_ID and AdServices advertising permissions are removed. AdMob can still process IP-derived general location, technical identifiers, interactions and diagnostics: the privacy page describes this, rather than claiming no data collection. Device backup is disabled to avoid automatically transferring purchase proofs or child artwork.

`privacy.html`, `subscription-terms.html` and `delete-data.html` supply public documents and a prominent parent email deletion request to the established support address. No deletion request or email was sent during development. Store data-safety disclosures must reflect the actual SDK processing, anonymous cloud account, optional parent email, progress and optional local QR camera.

## Validation and evidence limits

- Existing game regression suite passed, including 800 complete bee simulations, art, pairing rules, progress recovery, word help, twelve picture variants and asset closure.
- New quota tests cover independent games, five successes, failed retries, duplicate finishes, next local day, Plus/expiry and disabled staging flags.
- Full-controller tests additionally cover offline restart after five completions, a confirmed public rollback and separation of private tester flags from the public policy cache.
- Proof tests use an ephemeral test key and reject tampering, wrong account/package/product, expired/future/overlong claims and nonboolean entitlements.
- Six backend lifecycle/rules tests and Deno checks passed, including Play Store resubscription identity/conflict handling. Transaction-only database tests in `supabase/tests/littles-play-contract.sql` cover client denial, parent/session checks, lifecycle ordering, immutable token owner, linked replacement/refund, service-role financial projection, private tester expiry and revoked sessions. All fixtures rolled back. Two temporary QA guests were explicitly removed; real account data was untouched.
- Live Edge HTTP checks: missing bearer401, unsupported origin403, valid anonymous status200 with no proof/Plus/checkout, guest purchase verification403. A service-role Auth-directory permission defect was found and fixed by removing Auth reads from the financial projection; no broad Auth grants were added.
- Local browser fixture: wrong parent answer denied; cancel/pending remain free; dynamic monthly price; approved fixture unlocks a sixth full puzzle round; refund restores free limit; account change clears Plus; banners never cover game/dialog; five full together rounds through the lobby then correctly blocked. These were isolated mocks, **not Google Play payment tests**.
- Phone layouts 390×844 and 540×960 plus tablet1280×720 verified; oversized audio controls and a two-pixel sideways overflow in the writing desk were fixed. Full bee and windmill rounds also completed through normal pointer/keyboard controls. Play candidate manifest has no AD_ID/AdServices permissions. Native dependency audit: zero known vulnerabilities after compatible transitive tooling updates.

Private keys, signing passwords, service credentials, mock QA server, tokens, AABs and payment-fixture screenshots are outside tracked source. Genuine game screenshots for the listing are tracked under `docs/littles-store`. No public financial flags should be enabled until real provider acceptance and store declarations are complete.

The connected Samsung originally had debug-signed `com.meadowmarket.littles` code 3. Its public signing certificate matched the locally built acceptance-debug APK; an in-place `adb install -r` succeeded to code 9 without uninstalling. This permits Google's documented debug-build license testing while preserving existing app data. Play-signed installation still needs separate verification; do not uninstall the existing package or change Meadow Markets' separate app or protected Android profiles.
