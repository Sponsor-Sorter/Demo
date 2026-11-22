# Littles build 92 candidate

An early UMP failure left the previous client unable to recover advertising readiness during that app session. An isolated test reproduces this failure. The installed build 91 reached its correct daily and weekly limit after fifteen normal completed rounds, but showed no advert offer and made no advert-status request. The phone's precise cause remains unproven between consent, native capability and module readiness.

Build 92 adds a separate **Check for an advert** action. It appears only for a supported, non-demo native app, a verified free parent account, exhausted ordinary rounds, valid storage and an enabled server policy. Checking never displays an advert or creates a credit. A successful check reveals the existing **Watch advert** button, which still requires its own explicit tap and all original SDK and server gates.

Startup retains its existing single privacy check. Timers, gameplay and opening a quota screen never repeat privacy forms. Explicit retries share one operation and have a sixty-second cooldown. Stale account responses and closed dialogs cannot reopen the offer. Previously earned, verified receipts can recover without another privacy form or advert.

The candidate includes shared Main `19168466c776d7a4148b66ce6788bcaca1ead591`, preserving Meadow 255. It changes no native build, provider settings, paid entitlements, quotas or saved game data. Approved farmer recordings are unchanged.

Validation: twelve new readiness and UI-flow cases, forty-seven reward/adapter/account-transport cases, and the existing commerce proof and banner-dock checks passed. The full game regression result is recorded separately in the candidate evidence.

The compact quota layout keeps both Watch and Choose another game visible without scrolling at 320×568 portrait and 568×320 landscape. Five isolated browser layout views passed, including the supported recovery state, actual-offer markup and server-disabled state on a 1024×768 tablet. Active buttons measured at least 44 pixels in both dimensions. These are inert visual fixtures, not evidence of an ad view or provider approval.

Public activation remains pending independent review and installed-app acceptance: actual availability recovery, own-unit test badge, SDK close timing, a genuine signed reward, one retained extra round, free abandonment and exactly one successful completion. Native 15 remains internal; its AdMob test mode must be turned off before a public native release. No Google support message was sent.
