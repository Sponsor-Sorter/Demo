# Android early-access release — 12 October 2026

## Distribution
The canonical QR destination is https://sponsorsorter.com/install.html. The page links directly to the public Expo-hosted signed APK, not the website wrapper. Release metadata is in app-assets/android-release.json. Do not replace this link with an unverified build.

Build 4: eacfea99-c4c3-41f2-9ae9-3a6f3da60072. Package com.sponsorsorter.app; version 1.0.0; versionCode 4; minimum Android 7.0. APK and signing-certificate SHA-256 are published in the metadata and installation page. apksigner verification passed; the certificate matches builds 1–3. adb install -r succeeded on the authorized Samsung SM_S908E with the existing login retained.

## Automatic updates verified
APK channel preview maps to the existing Expo project 4d907700-fcde-4efc-aa32-4d941db3cb98. Runtime 57947c994b19dfb702694fd7d3e49de67d7ff933.

Published OTA group eb0ad90a-a503-442f-a039-e2ead9e54458; Android update 01a12f34-150b-7ce1-b9f6-b5459e397977. Cold launching build 4 downloaded this compatible update. A subsequent full launch showed Settings → App updates → Release 01a12f34, without reinstalling or clearing account data. The manual check returned no newer compatible update. Screenshot and UI evidence are in the native workspace release directory.

Updates check on startup and foreground return (15-minute throttle), download over HTTPS and apply next cold launch. No forced reload interrupts uploads, payment or messages. Offline failures do not prevent use of the installed app. Native code/dependency/permission changes require a new signed APK and Android installation confirmation. Do not promise silent APK installation. Developer-held end-to-end OTA signing is not configured; EAS transport/runtime protection and APK signing are distinct.

## Sessions
Native sign-out uses scope local and checks returned errors. Two real disposable creator sessions were authenticated; signing one out locally preserved and successfully refreshed the other. Phone session retained. No single-session restriction added. Future team plans should use individually invited members with server-enforced roles, not shared passwords.

## Validation and limits
Native TypeScript and 32 existing regression checks passed before OTA publication; installer checks passed. Actual Samsung startup, Settings and OTA application verified. No claim that every Android model is tested. This is an early-access build, not a complete production/security certification. Existing payment, MFA, secure token storage and database-advisor findings remain in PHONE_APP_BUILD_STATUS.md in the native workspace. Moikailive and real funds were not modified.

## Future release procedure
Keep the original signing credentials. Test a fresh signed APK and OTA on a real device, record hashes/runtime/update IDs, update the manifest and installation page together, then publish only reviewed files. Publish JS-only updates to this runtime/channel until native dependencies change; do not force a native-incompatible bundle onto old APKs. Retain the prior build for rollback. Native source workspace: work/SponsorSorterApp; original app is preserved at C:/Users/jrbwi/sponsorsorter-app.
