# Littles Play launch record · Build 53

User-approved terms: A$4.99/month reference price; Plus removes advertisements and permits unlimited completed rounds. Free play has five completed rounds per game per local device day. Failures and abandoned attempts do not spend a round. The actual Google Play price is displayed before checkout. No trials, paid gem packs or rewarded/interstitial ads are included.

## Deployment state

- Web Build53 is published at `https://sponsorsorter.com/meadow-market-littles/?release=53`, main commit `48f4e548743fb8fa37ac4183e576dfc447f6643f` (PR6). Both pre-merge game/native workflows and Pages deployment passed. Live reader/config/quota and legal-page bytes match the merged source. Browser verification preserved existing progress and confirmed the new grown-up settings and unavailable public checkout.
- Google Play app draft created with the user's explicit confirmation of the Developer Program Policies and US export declarations. App ID `4972356804404556638`, developer `9100499290170678316`, package `com.meadowmarket.littles`.
- Acceptance9 is published internally on track `4700162780847854790`, using a dedicated list containing only the signed-in owner. Google shows the temporary unreviewed package name; there is no public production release. Internal opt-in: `https://play.google.com/apps/internaltest/4700162780847854790`.
- Product `ml_plus` and auto-renewing base plan `monthly` are active, initially Australia only at AUD4.99. Seven-day grace period, default 53-day account hold, no trial/intro offer, charge plan changes at the next billing date. Public in-game checkout remains off.
- The English store listing is saved with the approved icon, feature graphic, four phone screenshots and two screenshots for each tablet size. Images containing AI-created illustrations are labelled. Public review and the remaining app-content declarations are not complete.
- Separate AdMob app `ca-app-pub-6946008351204848~9683786343`; banner `ca-app-pub-6946008351204848/8881665550`. App-level rating G, video disabled, automatic refresh disabled. Store linkage/readiness review still outstanding.
- Signed acceptance bundle code 9 / 0.3.0: SHA256 `207c307f0d039abfd555d37ca15e6c12038a604a2a350233d073e373aca57685`.
- Signed Play candidate code 10 / 1.0.0: SHA256 `284118561e0880af33292ce22472d0305365cddeb8a49fb06b0ecc70593fa3c3`.
- The existing signed code10 bundle was uploaded successfully and saved in unpublished production draft1 on track `4697396841843136775`, named `1.0.0 · Littles launch candidate`, with English first-release notes. Australia was saved as the initial production country, matching the only active subscription region. No new local build was needed. The draft has not been sent for review or rolled out; native payment/ad checks remain outstanding.
- Both bundles compiled, passed release lint and verified with jarsigner. Their upload certificate is intentionally self-signed, as Android upload keys normally are. Neither result proves on-device or store acceptance.
- Supabase project `ejavqlyozqhzqogflqzr`: billing migrations applied, `littles-play-store` v4 and notifications v3 active. Public checkout/ads flags remain **false**. No real purchase receipts were created. Disposable gift/test-cohort fixtures were removed after acceptance; the separate empty Google reviewer profile is prepared privately without Plus or shared credentials.
- With the user's explicit action-time approval, the existing Play verifier gained Littles-only app/quality read, financial/Purchases API and order/subscription-management access. No admin or publishing scope was added. Google Play has Publisher on only `projects/fairplay-meadow-markets/topics/littles-play-rtdn`; authenticated push uses the existing notifications identity, the exact Littles endpoint and matching audience. A real Google test notification reached the receiver with HTTP200; unauthenticated POST returns401. Real license checkout, cancellation/refund/renewal delivery and native demo-ad acceptance remain outstanding.

## Subscription and owner contract

Product `ml_plus`, base plan `monthly`, package fixed above. Server calls Google's subscriptionsv2 API, binds SHA256(`meadow-littles:` + Auth UUID), validates product/plan/state/expiry, persists the hashed token before acknowledgement and atomically retires a linked prior receipt. Active, grace and cancelled-but-paid-through states retain access; held, paused, pending and expired states do not. Test purchases require a private unexpired tester lease. Raw purchase tokens are never stored in game saves, reflected in errors or logged.

Play Store resubscriptions use Google's expired external account identifier before acknowledgement, reject conflicting current/expired identities, and send the verified obfuscated account ID back during acknowledgement so future restore/renewal calls retain the binding. See [Google's lifecycle guide](https://developer.android.com/google/play/billing/lifecycle/subscriptions) and [acknowledgement request fields](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge).

`public.meadow_littles_plus_projection(p_user uuid)` is service-only, SECURITY INVOKER, contract `littles-plus-projection-v1`. It reports finance, not sign-in eligibility. `access_eligibility_verified=false`; `parent_account_bound` is historical binding only. Paid no-row is verified false. Gift helper failure is unknown/null. Effective finance is paid OR gift, with known paid=true preserved if gifts are unavailable.

Fairplay Admin owns the sole complimentary grant ledger. It is read through `fairplay_complimentary_entitled('littles', exact shared Auth UUID, 'littles_plus')`. No child-name mapping or second grant ledger exists. Revoking a gift never overwrites paid access. After independently reviewing the published consumer and acceptance evidence, the Admin owner reported enabling only the Littles gift-issuance adapter with owner/MFA/typed-confirmation/audit controls. This does not enable public checkout, ads or quota limits, and no real account gift was issued during the consumer tests.

The sealed [consumer acceptance record](littles-plus-consumer-qa53.json) contains actual deployed reader/Edge/SQL digests and active, revoked, expired and real-clock proof-expiry results. The ordinary confirmed-parent test had no private tester lease: central gifts still produced recognised Plus while public checkout and ads remained off. With public quota/ads off for everyone, there is currently no differentiated commercial benefit. A separate private-cohort test verified unlimited access with a five-completions fixture; its lease was removed before the ordinary-parent test. The exact live code ran against real Edge responses in an isolated Node VM, not a physical purchase/ad test. All seven scoped fixture-remnant counts were verified zero after cleanup.

The consumer Edge resolver separately requires a live authenticated, unbanned session and a nonanonymous, confirmed parent email. RSA proofs bind issuer, package, parent UUID, product and expiry. Paid leases last at most 24 hours (bounded by paid-through); gift-only leases at most five minutes. The client checks signatures and claims and refreshes each minute, foreground and account change. A short network failure may retain only an unexpired same-account signed proof. Client save flags are never entitlements.

## Child and parent experience

Settings, accounts, shop and external legal links sit behind a literacy/maths grown-up gate. Google owns checkout; cancelling or pending payment never grants Plus. Restore retries verification without charging. The child-facing daily limit offers another game and has no purchase button. Successful-round hooks cover each game start/replay path, including returning through the together lobby; linked devices stay connected when a round closes.

The last confirmed public allowance policy persists across offline restarts; an explicitly confirmed public rollback also persists. Private tester flags cannot enable public limits in this cache. Paid access still requires an unexpired signed proof, not a cached rollout flag.

There is one clearly labelled home/game-selection banner only. The native adapter hides it while any game/dialog is open or the app is backgrounded. Child-directed/under-age treatment and G rating are configured before SDK initialisation. No mediation, rewarded, interstitial or app-open units. AD_ID and AdServices advertising permissions are removed. AdMob can still process IP-derived general location, technical identifiers, interactions and diagnostics: the privacy page describes this, rather than claiming no data collection. Device backup is disabled to avoid automatically transferring purchase proofs or child artwork.

`privacy.html`, `subscription-terms.html` and `delete-data.html` supply public documents and a prominent parent email deletion request to the established support address. No deletion request or email was sent during development. Store data-safety disclosures must reflect the actual SDK processing, anonymous cloud account, optional parent email, progress and optional local QR camera.

## Play Console policy preparation · 11 November 2026

The dashboard now shows **8 of 12 setup tasks complete**. Privacy policy, ads, government, financial features, health, trader status, category/contact details and the illustrated store listing are saved. The app inherits the established developer account's trader status. The app-level Terms of Service link points to the live Littles subscription terms; the public page returned HTTP200 and contains the approved price.

The complete Data safety questionnaire is **saved as a draft**, through its store-listing preview. Google disables final Save until Target audience and content is complete; that section currently requires completed reviewer sign-in details. This is not a submitted or approved Data safety declaration.

The nine-type disclosure follows the shipped cloud/account flows and Google's [Mobile Ads SDK25.5.0 disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure), using the [Play data-type and service-provider definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en). All nine are declared non-ephemeral. Only email, purchases and voluntary parent appeals are optional; anonymous cloud identity/progress and SDK collection have no universal opt-out.

| Data type | Collected | Shared | Purposes |
| --- | --- | --- | --- |
| Email address | Optional | No | App functionality; account management |
| User IDs | Required | No | App functionality; account management; fraud/security |
| Purchase history | Optional | No | App functionality; account management; fraud/security |
| Approximate location | Required | Yes | Analytics; advertising; fraud/security |
| Diagnostics | Required | Yes | Analytics; advertising; fraud/security |
| App interactions | Required | Yes | Analytics; advertising; fraud/security |
| Other user-generated content | Optional | No | App functionality; fraud/security (parent moderation appeals) |
| Other actions | Required | No | App functionality (cloud game progress) |
| Device or other IDs | Required | Yes | Analytics; advertising; fraud/security |

Encrypted transport and the public account-deletion URL are declared. Account methods cover guest cloud accounts plus optional grown-up email verification/password sign-in, without OAuth or mandatory MFA. No independent security-review badge or separate partial-data deletion facility is claimed. Supabase operates as the app's service provider; account information is not an advertising identifier. Device-only drawings, name-tracing text and QR camera processing are excluded from off-device collection; cloud artwork metadata contains completion timestamps, not picture files.

The public domain's `app-ads.txt` returned HTTP200 with the expected direct Google seller entry for `pub-6946008351204848`. This verifies the public seller file, not AdMob store linkage or serving approval.

Production draft validation identified no selected country and a missing deobfuscation file. Australia was subsequently saved as the sole country. The deobfuscation notice is a warning: the uploaded release has `minifyEnabled false`, so there is no R8 mapping file to attach. The release remains a draft; these checks are not provider or on-device acceptance. Google reports code10 support for 19,580 Android devices; this catalog count is not a claim that those devices were tested.

Two owner confirmations remain pending: accepting the separate [IARC agreement](https://web.iarcservices.com/terms), and granting the empty reviewer account demo Plus before sharing only its login with Google Play reviewers. The IARC checkbox remains unchecked. Reviewer credentials remain private and unshared, with no Plus grant. No new legal agreement or credential sharing was performed while awaiting those answers.

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

Frontlines currently owns Samsung testing. Littles must not send phone input or write the old shared Frontlines Gradle home while that work runs. Browser/store forms and repository documentation can proceed independently. The remaining setup sections are reviewer access, IARC rating, target audience and finalising the saved Data safety draft. The IARC agreement and sharing the dedicated reviewer login require owner confirmation; neither is covered by the earlier Google app-creation declarations. No phone, Android Studio, ADB or Gradle operation was performed during the browser-only continuation.
