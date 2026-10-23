# Meadow Markets Android test app

The Android wrapper opens the current game at https://sponsorsorter.com/meadow-and-market/. Farm content updates prompt inside the game. From1.6.0 onward, native updates are checked separately against native-release.json and offered in Settings or when the game is idle.

## Build

Requires Node 22, JDK 21 and an Android SDK matching android/variables.gradle. Set ANDROID_HOME or ANDROID_SDK_ROOT; Windows also detects the standard Android Studio SDK and JDK.

Run npm ci, then npm run android:debug in this folder. The APK is android/app/build/outputs/apk/debug/app-debug.apk.

The APK contains a small reconnect page and app icon. The live game downloads the same full-resolution artwork/audio as the browser and reuses its verified service-worker cache. The former duplicated media bundle is removed; this reduces the test APK from93MB to about4.8MB. First launch needs internet. Existing cached content can still load through the game service worker; this is not a new guarantee of fully offline accounts or multiplayer.

Debug signing uses the local Android debug keystore. Keep the same signing key to update an existing installation. Keystores and machine-specific SDK paths are not stored here.

Online saves and accepted-friend visits use the game's existing Supabase integration and ownership policies. No service keys belong in this project.

## Native updates and account storage

MeadowUpdates accepts only the fixed HTTPS Meadow manifest and APK paths, rejects redirects, bounds manifest/download sizes, verifies exact SHA256/byte count, checks package ID and a strictly newer versionCode, and compares the APK signer to the installed app. Android's installer performs its own package verification and asks the owner to install. Unknown-app installation permission is owner-controlled; the app cannot silently grant it. The request-install permission/flow is for the current sideload test distribution; a future Google Play build needs the store's update flow instead.

MeadowVault uses Android Keystore AES-GCM for game/guest tokens. Legacy WebView copies migrate only after a verified write; unreadable/locked vaults fail closed. Ciphertext is excluded from backup/device transfer because its key is bound to the device. This does not protect against JavaScript compromised inside the trusted game origin. Browser and old1.5.1 APK storage stay browser-compatible until that native APK is updated.

Local verification: run `android/gradlew.bat -p android testDebugUnitTest assembleDebug` with JDK21. MeadowUpdateRulesTest covers URL tricks, malformed manifests, truncation/hash mismatch, wrong package, old/wrong version and signer mismatch. Native installer/rotation/token-migration acceptance still requires the test phone.
