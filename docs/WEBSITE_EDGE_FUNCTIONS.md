# Sponsor Sorter Website and Edge Functions

Audit date: 17 October 2026 (Australia/Sydney). Website source baseline: `ba6f727fbea4cf39c2c1cf44500ca033f0826bde`, repository Sponsor-Sorter/Demo. Production: https://sponsorsorter.com/. Supabase project: `mqixtrnhotqqybaghgny`. This audit folder is standalone; it is not a migrated Git worktree. Original source and rollback are preserved.

## Website structure

Static HTML and browser JavaScript are published by GitHub Pages from main, root directory. Creator and sponsor dashboards load separate offer modules. The shared Supabase client supplies session authentication, table/RPC access, and Function invocation. Direct HTTP calls use the same project's `/functions/v1/` endpoints. OAuth callback names and Settings stats names are selected dynamically. Tests and public duplicate files must not be confused with reachable production screens.

## Call contracts and effects

Unless identified as public, calls require the signed-in user's bearer token. Gateway JWT validation does not establish offer ownership. Source paths below are relative to the pinned Website repository. `CALLSITES.json` and `CALLSITES.md` provide a reproducible static occurrence index, including dynamic call locations and nonproduction files. Not every repository occurrence is a reachable production call.

| Screen / source | Functions | Request and consumed response | Effects / test boundaries |
|---|---|---|---|
| Creator dashboard `js/sponseeLogic.js` | `get-youtube-stats` | POST, no body; success/stats/snippet/branding | Provider read; may refresh credentials; browser updates follower totals |
| Same | `get-twitch-stats` | POST, no body; success/channel or user/stats/stream | Provider read; follower-total write |
| Same | `get-instagram-stats` | POST `{period_days:7}`; ok/profile/recent_media/rollups/fetched_at | Credential/provider access; follower-total write |
| Same | `get-facebook-page-insights` | POST `{period_days:28}`; ok or success, page/insights | Provider access; follower-total write |
| Same | `get-tiktok-stats` | GET, no body; caller requires ok/profile | May refresh provider credentials; follower-total write |
| Settings detected stats `js/settings.js` | Five profile functions above | Baseline POST then GET on any failure; does not reject application failure under HTTP 200 | Candidate fixes methods, failure envelopes, absent auth, and deadline; no live Settings invocation performed |
| Creator/sponsor Content Performance `js/sponseeOffers.js`, `js/sponsorOffers.js` | `get-youtube-video-stats` | POST `{videoId}`; sponsor additionally targets creator/offer | Provider read; success saves stats snapshot and campaign observation |
| Same | `get-tiktok-video-stats`, `get-twitch-vod-stats` | POST content URL; sponsor supplies target context; see occurrence context for exact fields | Same snapshot/history effects; authorization must be checked server-side |
| Same | `get-instagram-media-from-url` | Creator POST `{url}`; sponsor `{url,userId,offerId}`; ok/found/media/insights | Snapshot/history writes; unknown metrics remain null in baseline |
| Same | `get-facebook-post-from-url` | Creator POST `{url}`; sponsor `{url,userId,for_user_id,offerId}`; ok or success, post or data/insights | Snapshot/history writes; cached results labelled |
| Public profile `viewprofile.html`, `js/publicDashboard.js` | `get-profile-live-stats` | SDK invoke `{username}`; rendered profile totals | Eligibility/opt-in and provider effects need verification; no arbitrary profile probes |
| OAuth callback `js/oauth-handler.js` | `youtube-oauth`, `instagram-oauth`, `twitch-oauth`, `tiktok-oauth`, `facebook-oauth` | Dynamic SDK invoke; exchanges callback authorization data | Credential linking/state changes; not exercised |
| Signup `js/famBotSignup.js` | `FamBotSignup` | SDK invoke submitted moderation data | Public signup moderation; no synthetic account creation in production |
| Moderation `js/FamBot.js` | `FamBot` | HTTP moderation request | Potential enforcement/notification effects; not exercised |
| Login `js/login.js` | `referral_rewards`, `sendNotificationEmail` | Authenticated HTTP requests | Rewards and email effects; do not use repeated logins as harmless probes |
| Offers/signup/settings `js/formSubmit.js`, `js/publicOffers.js`, `newoffer.html`, `groupoffer.html`, `js/settings.js` | `stripe-checkout` | Checkout payload varies by purchase flow; SDK or HTTP POST | Real financial/session state; not exercised |
| Payment success pages | `complete-sponsorship-checkout`, `complete-paid-signup` | SDK invoke checkout session ID | Payment/signup state changes; not exercised |
| Plan sync/settings `js/planSync.js`, `js/settings.js`, `js/settingsPage.js` | `stripe_subscription_info` | POST `{customer_id}`; plan details | Caller may update planType; not purely read-only |
| Settings | `claim_free_month` | POST reward/subscription request | Subscription mutation; not exercised |
| Invoice `js/invoices.js` | `generate_invoice_pdf` | POST `{offer_id}`; returns url/error | PDF/Storage effects; disposable authorized offer needed |
| Recap `js/recaps.js` | `generate_campaign_recap` | POST `{offer_id}`, optional act_as; returns URL | Report/Storage effects; no arbitrary impersonation |
| Affiliate `js/AffiliateDashboard.js`, Settings | `affiliate-get-referral-link`, `affiliate-get-stats`, `affiliate-apply`, `affiliate-mark-approved-paid` | SDK/dynamic HTTP calls; link/stats/application/payout envelopes | Dashboard reads may ensure records; payment/application actions not exercised |
| Wallet | `get_connect_onboarding_link` | GET status / POST onboarding | POST provider/account mutation; not exercised |
| Embedded admin scripts | `process-group-payouts`, `settle-sponsorship` | SDK invoke dry_run/order_id | Financial operations; repository occurrence is not Website test authorization |
| Report duplicate `public/js/userReports.js` | `notifyAdminNewReport` | HTTP report notification | Email/report mutation; reachability requires confirmation |

Finder currently reads `public_user_directory` directly through Supabase queries, with search filters and pagination. No direct `creator-lookup` Website caller was found in the baseline. Direct table/RPC operations are separate from Edge calls: follower totals upsert `user_social_followers`; content performance saves `stats_snapshot` and calls `record_campaign_observation`.

## Live observations

User signed into Fitstyle and explicitly authorized testing. Normal creator dashboard reload on 17 October 2026 around 13:33 AEDT (02:33 UTC):

| Function / flow | Browser-visible outcome | Evidence limits |
|---|---|---|
| YouTube profile | Channel rendered; 27 subscribers, 19,728 views, 33 videos | UI-level pass; exact HTTP/JSON/provider effects not captured |
| Twitch profile | Account rendered; 5 followers, Offline | UI-level pass; exact HTTP/JSON/provider effects not captured |
| Facebook profile | Page rendered; 2 followers/likes; no 28-day insights notice | UI-level partial data; zeros alone do not prove measured activity |
| TikTok profile | Failure, warning `token_refresh_unavailable` at 02:33:30.493Z | Current failure after v27 compatibility fix; owner investigation requested |
| Instagram profile | Not linked or error; metrics unavailable | Exact server status/cause not exposed in current UI; owner investigation requested |

Dashboard is authenticated, but no tokens or credentials were extracted. No payments, messages, offer status changes, deletion, or OAuth relinking were triggered. Normal dashboard initialization can perform automatic refresh and follower snapshot writes; these effects were not independently read back. Existing offers were not treated as disposable simply because their title contains Sandbox. Fitstyle must not be deleted.

## Confirmed defects and remediation

### TikTok OAuth writer diagnosis

Website connection request also omitted `user.info.basic`. TikTok's official [Get User Info documentation](https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info) associates open_id with this scope and requires the fields query parameter. Local Website fix now requests `user.info.basic,user.info.profile,user.info.stats,video.list`. The new test executes the actual launchTikTokOAuth function against a fake popup, verifies endpoint/scopes/redirect/state, and makes no OAuth request. Integrated regression result is now **54 passed, zero failed**, including 13 Settings tests. Backend owner is implementing required fields/identity persistence checks; no backend source replacement was deployed by Website. Scope change is local only; no consent or permission grant was performed. Keep reconnect on hold until the coordinated frontend/backend fixes are live.

Backend owner independently confirmed from redacted audit history: identity fields were present before disconnect at 02:44:47Z; reconnection at 02:50:36Z saved connected=true and future expiry but left both identity fields blank. Current stats handler rejects missing tiktok_user_id before calling TikTok. This is a persisted OAuth identity omission, not a reason to ask for repeated reconnection.

Website callback `js/oauth-handler.js` maps tiktok to `tiktok-oauth`, invokes `{code,redirect_uri}` with session bearer, and does not write identity columns itself. It currently checks SDK transport failure only before showing Connected; an application-level failure under HTTP 200 would be missed.

Deployed `tiktok-oauth` source retrieval returned UNAVAILABLE. A recovered candidate was located at `C:/Users/jrbwi/Documents/Codex/2026-10-16/task-9/integration-package/desktop-recovered-candidates-2026-10-16/source/tiktok-oauth.txt`, SHA256 `97439167336D51ECF75A2081E65990F68A2ACAA78E4118C0E33743B67967BD73`. This is **not a verified deployed match**. Its lines 102–107 save tokens and connected=true first, without identity; lines 111–121 perform optional best-effort identity lookup and ignore lookup/update failure; lines 170–173 return ok:true even with null tiktok_user_id. That design is consistent with the observed failure. Candidate path/hash and exact code findings were handed to the Supabase owner for safe handler repair. No credentials were extracted, row patched, or OAuth restarted by Website owner.

### Retest after user reauthorization — 17 October, 13:52 AEDT

User confirmed reconnections complete and authorized testing. Exactly one normal dashboard reload was performed. Independent `function_edge_logs` aggregate from `02:52:15Z` to `02:52:50Z` shows one request per endpoint, excluding OPTIONS:

| Function | Version | Method/status | UI outcome |
|---|---|---|---|
| get-tiktok-stats | 27 | GET 503 | Unavailable; console `account_identity_unavailable` at 02:52:29.985Z |
| get-instagram-stats | 20 | POST 502 | Unavailable; no detailed browser error |
| get-facebook-page-insights | 9 | POST 502 | Unavailable; console `provider_unavailable` at 02:52:30.875Z |
| get-youtube-stats | 19 | POST 200 | 27 subscribers, 19,728 views, 33 videos |
| get-twitch-stats | 16 | POST 200 | sponsorsorter (@sponsorsorter), 0 followers, Offline; account differs from prior test |
| affiliate-get-referral-link | 6 | GET 200 | Referral section loaded |

Supabase owner reports migration `20261017024607_install_tiktok_refresh_lease_and_redact_audit_secrets` installed the six refresh RPCs, with a rollback-only lease check and no leftover rows. This is owner-reported migration verification. Current TikTok failure has changed from refresh unavailable to account identity unavailable; the deployed handler requires a stored TikTok identity before provider reads. Backend owner was asked to inspect OAuth persistence and Meta credential/page consistency. Do not assume a successful OAuth redirect proves working downstream stats. No further reload was made. Raw response JSON and automatic database/provider side effects remain unverified. These results supersede the earlier Facebook UI success for current account state.

1. TikTok v26 returned success:true but omitted ok:true, and profile fields were in different locations. Supabase owner deployed additive v27; current source readback confirms ok:true and nested profile aliases. Website still fails with token_refresh_unavailable. Compatibility is fixed at source; complete live success remains unverified.
2. Settings accepts HTTP200 `{success:false}` / `{ok:false}` as stats success and tries a second method on any HTTP/network failure. Standalone candidate `candidate/js/settings.js` rejects failure envelopes, uses TikTok GET and other profile POST contracts, supplies 7/28-day periods, refuses missing auth, and bounds fetch plus JSON decoding to 12 seconds. Tests extract the actual edited function. Candidate is not published or integrated into a Git checkout.
3. Dashboard generic Instagram/TikTok error labels obscure actionable failures. TikTok console warning exposed the refresh issue; Instagram cause still needs server evidence. Do not relabel unverified missing data as a successful result.

## Verification and remaining coverage

### Independent live HTTP evidence

Read-only `query_logs` aggregation, window `2026-10-17T02:32:00Z` through `02:34:00Z`, `function_edge_logs`, grouped by pathname/version/method/status:

| Function | Version | Method | HTTP result / count |
|---|---|---|---|
| get-youtube-stats | 19 | POST | 200 x2 |
| get-twitch-stats | 16 | POST | 200 x2 |
| get-facebook-page-insights | 9 | POST | 200 x2 |
| get-instagram-stats | 20 | POST | 503 x2 |
| get-tiktok-stats | 27 | GET | 503 x2 |
| affiliate-get-referral-link | 6 | GET | 200 x2 |

These project-window aggregates support the observed UI flow but are not individual authenticated request tracing. OPTIONS results are excluded. Exact response JSON and DB/provider effects remain unverified. Unrelated project calls are not attributed to Website. No JWTs, IP addresses, credentials or email addresses were selected/saved.

TikTok source shows `token_refresh_unavailable` can arise from missing/invalid refresh input or dependency configuration, failed refresh exchange, or lease/persistence coordination. Relevant environment names include `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; no environment values were retrieved. Presence alone would not establish correctness. Instagram v20 has 503 branches for auth service failure and unavailable credential lookup; precise runtime cause is not yet distinguished. Backend owner is investigating both.

Candidate verification: 12 tests passed, zero failed; `node --check candidate/js/settings.js` passed. Full local output is `tests/RESULTS.txt`. Remote main readback still ba6f727 on this audit. An independent shallow clone attempt into `release` stalled and was interrupted; that partial directory is not a valid release checkout and was not used or deleted. A subsequent filtered clone into `review-checkout` completed at ba6f727. The Settings fix is integrated there, both dashboard imports have a new cache version, and `tools/settings-detected-stats.test.mjs` tests the integrated source. Integrated Settings + existing social caller regression tests: **53 passed, zero failed**, output `tests/INTEGRATED_RESULTS.txt`. Original shared Git and worktrees were not modified. No Website publication was performed.

Additional TikTok diagnostic: read-only `information_schema.routines` inspection found none of the six exact public RPC names used by deployed refresh coordination: `acquire_tiktok_refresh_lease`, `begin_tiktok_refresh_exchange`, `mark_tiktok_refresh_uncertain`, `persist_tiktok_refresh_token`, `reconcile_tiktok_refresh_token`, `release_tiktok_refresh_lease`. Routine visibility must be considered; backend owner was asked to verify catalog/permissions and durable dependencies. No SQL/schema mutation was made. Do not bypass refresh fencing to hide the failure.

Run `node --test tests/settings-stats.test.mjs` from this audit folder. These are injected-fetch contract tests and do not invoke live Supabase. Earlier baseline 41 social tests cover Instagram/Facebook caller hardening, not TikTok live success. Current candidate changes only Settings detected-stats helper. No Website release has been made by this audit.

Remaining: investigate TikTok refresh dependencies and Instagram credential/provider errors with backend owner; review exact contracts for every dynamic call and public duplicate reachability; execute controlled content/report/signup flows with defined test data; rebase candidate on current remote main before release, check import cache version and run relevant regression tests. Current documentation is a mapped audit baseline, not a claim that every function is verified.

References checked: Supabase changelog index (17 October 2026); https://supabase.com/docs/guides/functions/error-handling. No new Supabase SDK API or schema introduced.
