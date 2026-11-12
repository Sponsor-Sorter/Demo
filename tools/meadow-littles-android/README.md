# Meadow Market Littles Android

Independent package com.meadowmarket.littles. Opens https://sponsorsorter.com/meadow-market-littles/. Same Capacitor and Android toolchain as Meadow Markets; separate saves and installation.

Run `npm ci --ignore-scripts`, then `npm run android:debug`. Web updates use the game install-update prompt. Native changes require a new APK.

Google Play Billing uses `ml_plus` / `monthly`, with server verification and account binding. Never grant Plus from a saved `adFree` or `testPlus` field. Checkout and advertisements are controlled by separate, default-off server flags. The acceptance build uses Google demo ads; private license testing also requires an expiring server cohort. A local browser fixture is not Google license-test acceptance.

On Windows, `powershell -NoProfile -File scripts/build-play-signed.ps1 -Distribution acceptance` builds the signed test bundle (version code11). Use `-Distribution play` for the production candidate (code12). The script uses a separate, access-restricted Littles signing vault outside Git. Keep its upload key and password backup securely. `play-config.json` contains the separate Littles AdMob identifiers; these are public app configuration, not credentials. Override an unrelated inherited `GRADLE_USER_HOME` before building; use the standard user Gradle home or a Littles-owned cache.

The compact ad dock measures the app content width, caps phone/tablet banner widths, and reports its actual height to the game. It never clips or restyles Google's creative. `node scripts/build-android.cjs testAcceptanceDebugUnitTest` checks narrow windows, system-navigation space, tablets and large text.

See [the staged launch record](../../docs/LITTLES_PLAY53.md) for completed checks and outstanding provider setup. Do not enable commercial flags before real Play license and demo-ad acceptance.
