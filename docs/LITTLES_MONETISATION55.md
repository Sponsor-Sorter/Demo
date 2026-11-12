# Littles monetisation preflight · 12 November 2026

Approved offer: A$4.99/month (Google Play displays the actual price), ad-free unlimited completed rounds. Free play permits five completed rounds per game per local day; failures and abandoned attempts do not count. Product ml_plus/monthly remains Australia-only, active, with no trial. Actual native payment, restore, renewal, cancel-paid-through and refund/revoke evidence is in LITTLES_NATIVE54.md.

## Ads configuration

AdMob app ca-app-pub-6946008351204848~9683786343; home banner ca-app-pub-6946008351204848/8881665550. The account is approved. Littles remains Requires review: the exact public Play URL returned no result while the app is in Google review. This is a provider dependency, not completed store linkage.

Verified app-specific G rating blocks PG/T/MA. Banner video and automatic refresh are disabled. High-engagement ads were turned off and read back as Off. There are no mediation groups, campaigns or full-screen ad units. Native requests retain child-directed/under-age treatment and G rating before SDK initialisation. AD_ID/AdServices permissions remain removed. The public app-ads.txt returned200 with the correct Google DIRECT seller entry. Google cannot yet crawl/verify it against a public Littles listing.

## Compact dock

The native dock uses measured app width rather than display width, fits phone navigation space, limits phone/tablet ad width, keeps the readable label separate and leaves the creative unobstructed. It reports measured height and discards stale width layouts. Three sizing tests cover narrow windows, navigation space, tablets and large text. Production lint passes after moving the unchanged launcher into its proper package folder and escaping the Windows SDK property.

The home list has its own100dvh scroll container. Body padding did not reserve space for ads. Commerce v2 subtracts the measured dock height from the actual list viewport, resets it for games/dialogs/background/Plus and rejects late visible callbacks. Regression tests exercise the actual native-event handlers with isolated adapters. This does not substitute for on-phone clearance verification.

Internal code11/0.4.0 bundle SHA256:943f4032107616fdee2cccd888ab8216f5a977fc03c4f0ec1b58cdb0c3ef73fc. It was published to the existing owner-only internal track. Google signed universal APK SHA256:870e4fda854e21d9b31f9b7b4e281d5e21961fe933b38c66ee2dc48339e7cdcf, with the existing Play signing certificate. USB installation was followed by Google's required Update from Play repair. The resulting device package is code11, installed/initiated by com.android.vending; the existing9-star fixture save survived. No installer check or protection setting was disabled.

Production code12/1.0.0 bundle SHA256:4624fb9f56432cd62d03eea6401ae6e49df7b2980b97bf7d9bb32977c3d74b85. The actual archive contains Littles' live AdMob app ID in its manifest and live banner ID in DEX. It has demo ads disabled. Native tests/acceptance use only Google's official adaptive demo unit9214589741.

## Launch sequence

After private device clearance checks, the existing service-only checkout_enabled and ads_enabled switches can be armed for launch. They do not grant Plus or bypass verification; purchases still require confirmed parent identity, matching Google ownership, durable server reconciliation and a valid signed proof. Google controls actual ad fill and serving limits.

After Play approval makes the app public, open AdMob → Apps → Meadow Market Littles → App settings → Add store, search the exact URL https://play.google.com/store/apps/details?id=com.meadowmarket.littles and link that result. Then complete app-ads.txt verification and allow Google's separate app-readiness review to reach Ready. Linking is unavailable before public listing; do not claim another store or fabricate a listing. Refund/renewal notification endpoints remain Store v6/Notifications v5. The reviewer demo grant and central complimentary ledger are preserved.

No recurring automation, new cloud credentials, additional ad network, real payment or child-data migration was introduced. Final publication/switch receipts are kept in the local acceptance evidence directory; this is the preflight record.
