# Meadow Markets174 — native app updates

Test Android app1.6.1/versionCode9 adds the native verified-update flow and the Keystore account vault introduced in source173. Native bootstrap8/1.6.0 is kept locally for an8→9 owner-confirmed updater test. Both use the existing app ID and the same signing certificate as the published1.5.1 APK. Certificates were inspected with Android SDK apksigner; no keys are committed.

The small online shell is4,831,077 bytes (previous published APK93,059,512 bytes). Its SHA256 is recorded in native-release.json and tested against the exact published file. Artwork/audio quality and resolution are unchanged; the game still delivers and caches the HD runtime assets. Native bundling previously duplicated178MB of web assets that the configured remote page did not use for startup. A local reconnect page handles initial network failure.

Checks before release: native compilation; four Java updater-rule tests; actual APK package/version extraction and old/new certificate comparison; exact APK digest/length check; existing web/account/cloud/paddock regression suite. Rejection rules cover untrusted URLs, redirects, unexpected lengths/hashes, wrong package, mismatched signer and non-newer versions. Only the Android system installer performs installation, with owner confirmation.

Device acceptance is a separate receipt: install bootstrap8 without clearing app data, confirm the existing farm and encrypted-token migration, load live174, and accept its9 update through the app. Do not record this as passed until the phone slot is available and the actual installer flow completes. Existing native7 installations need the new APK once to gain this updater.

No real billing, advertising or subscription charges are enabled. Remaining game backlog is automation/offline catch-up, heavy-farm performance, high-level pacing, stronger server validation and documentation reconciliation.
