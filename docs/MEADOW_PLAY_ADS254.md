# Google Play advertising defaults — build 254

The Play version includes popup advertisements for a verified non-Premium account, including accounts whose old optional-ad preference is false. The shop explains this instead of presenting an ineffective off switch. Web and direct Android builds keep their existing opt-in setting. Saved preferences are not rewritten.

`MainActivity.java` registers both `MeadowStorePlugin` and `MeadowAdsPlugin` only inside the `BuildConfig.FLAVOR == play` branch. Their implementations are in `src/play`; the client requires the pair to identify Play. A native platform or an Ads capability alone does not enable this default.

The current account's verified Premium response is required before Play popup eligibility. Failed full status refreshes suspend that eligibility. Paid and complimentary Premium still remove popups; rewarded ads remain optional. Consent, server ad availability/incident controls, the accepted numeric pacing policy and its cache/account guards remain authoritative. Isolated demo tests, no-fill recovery and independent server-side reward verification are unchanged.

The backend's existing `production_ready` and `ads_enabled` flags were both true during the read-only check. This change does not write configuration, wallet preferences, purchases or entitlements. Google Play version 17 remains the existing submitted native binary; the remotely loaded game receives build 254 through its normal runtime update.

Focused validation runs the actual Store, Club and pacing modules with simulated SDK/RPC callbacks: 16 cases cover the Play/legacy default, web/direct/partial capabilities, Premium, missing verification, failed status, consent, Admin shutdown, account changes, stale policy, pacing, UI text, reward verification and no-fill. Existing Ad221, Premium234 and AdPolicy247 checks remain required. These simulations are not new physical ad-impression acceptance.

The required game build bump regenerates only the shared `RULES_HASH` line. The generated farming body and its arithmetic are byte-identical. The hash is response diagnostics; no client compares it for command acceptance. No gateway redeploy is required for this frontend advertising fix, subject to the shared release review.
