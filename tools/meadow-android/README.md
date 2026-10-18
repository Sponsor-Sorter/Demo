# Meadow Markets Android test app

The Android wrapper opens the current game at https://sponsorsorter.com/meadow-and-market/. Game updates prompt the player to reload into the published build. Native wrapper updates use a newer APK.

## Build

Requires Node 22, JDK 21 and an Android SDK matching android/variables.gradle. Set ANDROID_HOME or ANDROID_SDK_ROOT; Windows also detects the standard Android Studio SDK and JDK.

Run npm ci, then npm run android:debug in this folder. The APK is android/app/build/outputs/apk/debug/app-debug.apk.

The build copies only the game service worker's runtime manifest from ../../meadow-and-market into the native package. Generated master sheets, old source artwork and APK files are excluded. Runtime artwork remains at its original pixel dimensions.

Debug signing uses the local Android debug keystore. Keep the same signing key to update an existing installation. Keystores and machine-specific SDK paths are not stored here.

Online saves and accepted-friend visits use the game's existing Supabase integration and ownership policies. No service keys belong in this project.
