# Sponsor Sorter handover

## 2026-10-11 — Private offer reads and public profile sharing

- Applied Supabase migration restrict_private_offer_reads (tracked SQL 20261010200217): removed six SELECT-true development/homepage policies and revoked anon SELECT on private_offers/private_offer_reviews. Existing participant/admin read policies and deliberately projected public views remain.
- tools/private-offer-reads.test.sql passed against live DB inside BEGIN/ROLLBACK: anonymous raw grants absent; unrelated member denied; sponsor, creator and admin can read fixture offer/review; all three public projections queryable. Temporary fixtures explicitly exclude Moikailive; no lasting account/financial changes.
- Stats now reads only public_offers/public_user_profiles/public_profile_reviews. Removed private earnings, referral and campaign leaderboards rather than widening access. Public counts use exact HEAD requests; failure states never show fabricated zero totals or operational health.
- Rebuilt /u/index.html with shared animated original grid/header, aligned responsive cards, contained tables, visitor Copy link/native Share, manual clipboard fallback and bare ?u= sharing URLs. Copy tested in real browser. Account controls copy saved enabled links, not unsaved slug input; disabled profiles cannot copy through settings. Shared header assets now resolve correctly from nested /u/.
- Public deal/history text escaped, social/media URLs constrained, malformed slug decoding guarded, existing metadata updated rather than duplicated; profile action directs to recipient-specific offer form. Existing social statistics and public review/deal features retained.
- npm test: 32 passing. Browser real public test profile fitstyle at 320/375/768/1440: centred and no document overflow; Stats at 320 also passes. No Moikailive fixture edits or real Stripe payments.
- Remaining critical work: private offer INSERT is still overly permissive; review author UPDATE/INSERT and comment parent ownership need server-enforced validation. Payment return pages still require verified Stripe sessions, server-owned drafts, webhook fulfillment and atomic idempotency. These are not fixed by restricting reads.
- Public profile follow-ups: public summary RPC's active/completed counts overlap under legacy flags; public recent/history RPCs match legacy usernames and need stable identity matching, bounded limits and counterparty disclosure review. get-profile-live-stats must be audited for opt-in authorization and payload projection. Static GitHub Pages metadata cannot provide reliable personalized social cards; requires server/edge HTML rendering or generated profile pages. Current client metadata is not a guaranteed crawler preview.
- Found a legacy service credential embedded in the private_offers UPDATE notification trigger definition. Do not copy/log its value. Rotate/migrate to managed secrets after identifying dependent services; no credential rotation performed here. Existing Supabase advisor warnings remain; three sanitized public views intentionally preserved. Legacy unused js/homepage.js still queries private tables and must be retired/reworked before reuse.


## 2026-10-11 — Wallet validation and duplicate checkout handler

- Applied reject_invalid_wallet_reservations to Supabase: wallet spending rejects nonfinite/negative balances and nonfinite/nonpositive active reservation rows. Existing ownership check, profile row lock and restricted grants retained. No invalid balances or active reservations found by aggregate queries.
- New tools/wallet-invalid-reservations.test.sql passed rollback integration assertions for normal spending, reserved funds, five invalid payout values, four invalid wallet values, NOT NULL rejection and direct wallet tampering. Explicitly excludes Moikailive. No fixture changes committed; no Stripe funds moved.
- Removed duplicate active payment-success.html handler (both could create the same private offer). Remaining module now imports its own escape helper; spotlight slot output is numeric-only and failed assignment does not claim purchase confirmation. Fixed legacy public/ footer links.
- npm test: 29 passing including single-handler/malicious-slot regression. Browser missing-session return state checked. Full paid offer fulfillment still needs authenticated server-side Stripe verification plus idempotency; this fix alone does not provide it. Premium assignment also needs that verification.
- Supabase advisor findings remain: 3 privileged views, 23 mutable search paths, 11 anonymous and 15 authenticated privileged RPC warnings, OTP/leaked-password/Postgres-version warnings. No blanket permissions changes made.

## 2026-10-11 — Secondary page consistency and safety pass

See [PAGE_SAFETY_AUDIT.md](./PAGE_SAFETY_AUDIT.md) for changed pages, browser coverage, 28 passing tests and unresolved payment/database security findings. No production data/schema mutations.

**Updated:** 2026-10-10  
**Workspace:** `C:\Users\jrbwi\Documents\Codex\2026-10-10\i-ve-created-a-sponsor-sorter\work\Demo`  
**Branch:** `codex/stylesheet-modules`  
**Remote:** `origin` → `https://github.com/Sponsor-Sorter/Demo.git`

## State

### Public preview rebuild and dashboard totals — 2026-10-10

- `guest.html`, `guest.css`, `js/guest.js` replace the two legacy dashboards with one self-contained interactive product tour. URLs `?role=sponsor` and `?role=sponsee` still work; no role shows a picker. No Supabase client, remote geolocation, analytics requests or Chart.js dependency. Demo changes stay in memory and reset on reload/reset; sample campaign values are not earnings claims.
- Functional demo: create offer → review applicant → accept → advance stages → history; creator apply/withdraw, comments, details/images, role switching, filters, dialogs, account prompts. Native dialog provides keyboard focus containment/Escape close. All user-entered titles/briefs/comments are escaped or text nodes.
- Shared `js/campaignSummary.js` makes member completed value numeric/finite and excludes pending, accepted, rejected/cancelled campaigns. Sponsor completed count now matches its label; acceptance-rate wording explains its numerator. These values are agreed campaign amounts, not verified receipts.
- 27 tests pass (`npm test`, including `tools/workspace.test.cjs`). 20 actual-viewport cases at 320/375/768/1440 passed: picker, both preview roles, both member dashboards. All page widths matched requested viewport widths; zero page overflow. Member status tabs fit, expected fixture completed value $350.00. Full local demo workflow and literal HTML-like comment rendering checked. No real account changes/payments/OAuth submissions.
- Browser preview via existing `tools/workspace-review-server.cjs` on 8126; guest page itself needs only static serving. Moikailive remains untouched. Earlier backend/security/payment follow-ups remain open; this release is not proof of full production readiness.

### Finder / member workspace redesign — 2026-10-10

- New readable presentation modules: `workspace-experience.css`, `js/workspaceExperience.js`; loaded only by Finder and the sponsor/creator dashboards. Existing IDs and handler nodes retained. Navigation, metrics, active offers and public offers now precede long profile sections. Guidance is expandable; tables scroll locally.
- Added labelled filters, clear filters/search, range validation, result announcements and pressed search toggles. Fixed sponsorLogic legacy client import and offer pagination/missing-value presentation.
- Browser: 20 fictional layout checks at 320/375/768/1440, zero page overflow. Both role dashboards retain all status tabs; creator details expansion, sponsor Pending filtering, Finder modes/reset and keyboard section navigation checked. Existing 24 automated tests pass. These do not prove live payment/OAuth completion.
- Reproduce: `node tools/workspace-review-server.cjs` then `http://127.0.0.1:8126/finder.html`; append `?role=creator` for creator Finder. Dashboard pathname selects fixture role. Synthetic records only; query mutations refuse writes. This mock does not reproduce every external API, realtime behavior or permission rule.
- Moikailive and associated records were not modified. No backend schema/function changes in this release. Outstanding payment, webhook, RLS and live flow work below remains applicable.
- Tools used: shell/Git/Prettier and unified-computer-use browser controls; Supabase skill consulted for shared-client wiring. No additional plugins installed.

### Public information page consistency — 2026-10-10

- Added scoped, formatted `public-pages.css` and `js/publicPageLayout.js` to contact, privacy, terms, legacy tos and reset-password pages. Reuses original artwork/animated grid and shared glossy tabs. Existing navigation nodes/IDs/listeners are moved intact; header becomes one row of four links.
- Standardized centered containers, panel borders, readable legal contents links, contact card stacking, recovery form width and wrapping footer. Added persistent labels to contact inputs. Fixed duplicate Login links on signed-out legal pages; terms now imports the current shared Supabase client and uses the existing privacy-page role/logout logic.
- Browser checks: all five pages at 320/375/768/1440 (20 cases), zero horizontal page overflow and one navigation row. Screenshots visually checked on desktop contact and phone privacy. No contact submission, password reset, login or account mutation performed; signed-in role/logout handlers not exercised against real accounts. No database changes in this UI batch. Remaining pages and the existing payout function audit are still pending.

### Protected real account — user instruction

`Moikailive` is the one genuine signup, confirmed in Supabase as a sponsee (`besponsored`). Exclude this account and all related records from fixture selection, test mutations, cleanup and payouts. Other records are described by the owner as test data; that does not imply Stripe is in test mode or authorize real-money transfers. Use dedicated test fixtures and rollback transactions. Do not store the real account's contact details in test artifacts.

### Payout accounting update — 2026-10-10

- Added/deployed `decide_admin_payout(uuid,text,text)`, SECURITY INVOKER, explicit admin check and authenticated-only execution. Locks payout and profile, permits pending transitions only, returns replay result without duplicate debit/audit/notification, rejects role mismatches/nonfinite amounts/insufficient funds. Wallet withdrawals for BOTH account roles debit the wallet; campaign-associated creator payouts retain their existing distinct accounting path. Audit and available in-app notification are part of the same transaction.
- Admin approval/rejection now call this RPC. Approval is labelled **Record External Payment** and explicitly does not send funds. This avoids presenting a bookkeeping update as a provider payment. New JS cache version payout2.
- Fixed `use_wallet_funds` reservations to match payouts by Auth user ID, not profile row ID, and include pending/requested/approved/processing states. Rejects NaN/infinite amounts. Changed profile guard to SECURITY INVOKER so it distinguishes trusted database execution roles from ordinary user edits: verified ordinary direct wallet edits remain denied while the authorized spending RPC works.
- Production-database rollback integration assertions passed in `tools/payout-transaction.test.sql` and `tools/wallet-reservations.test.sql`. No test wallet, payout, audit or notification changes committed; no provider transfer attempted. These simulate authenticated database claims, not browser login or concurrent connections. Node suite: 24 tests passed.
- Actual Stripe payment sending is STILL pending. Existing `pay_stripe_payout` source retrieval failed through MCP and both old/new CLI download methods (Docker unavailable / bundle decoding / incorrect response content type). Supabase browser opened to the existing function settings, redirects to sign-in. User asked to sign in; credentials must not be pasted into chat. Once signed in inspect Code, preserve/review existing behavior and build/test idempotent provider execution + reconciliation before enabling a Send action.
- Security advisors rerun: pre-existing public views/privileged RPCs, mutable search paths and Auth/Postgres settings still need review. No new SECURITY DEFINER payout RPC introduced. See Supabase database linter remediation: https://supabase.com/docs/guides/database/database-linter
- Migration files were generated with installed CLI and applied via execute_sql; committed source is reproducible but remote migration-history reconciliation remains necessary (do not blindly replay all old migrations).

### Payment verification update — 2026-10-10

- Deployed `stripe-checkout` v45 and `complete-paid-signup` v2. Signup now overwrites the actual Stripe success/cancel parameters with approved destinations. Previously caller URLs could survive validation. Other checkout flows reject unapproved return origins; private checkout validates the bearer token against Supabase Auth instead of checking only header presence; anonymous Auth users are denied. Added amount bounds and generic error responses. Completion explicitly accepts only paid/no-payment-required Stripe states.
- `npm test`: 22 passing tests (3 admin helpers, 19 payment handler checks). Payment tests execute real TypeScript handlers with isolated Stripe/Auth/database doubles. These are NOT completed sandbox transactions.
- `node tools/payment-live-smoke.cjs`: four production rejection checks passed: unapproved origin 403, invalid signup email 400, forged private token 401, malformed completion 400. No charges, Checkout sessions, accounts, emails or payouts created.
- Stripe connector exposes two accounts with `livemode:false`, including Sponsor Sorter sandbox. Sandbox webhook list is empty. Production Supabase function inventory still contains no subscription webhook. Live webhook configuration has not been inspected; do not infer live account state from the sandbox.
- Remaining financial release gates: completed isolated sandbox signup/payment, subscription webhook signature/idempotency/lifecycle tests, transactionally locked/idempotent payout accounting, actual payout-provider reconciliation, authenticated admin and participant integration tests. One-time offer amount/ownership still needs authoritative database validation; a valid user token alone does not establish offer ownership. Existing payout wallet/record writes remain separate and must not be treated as production verified.
- Run tests on Node 22.14+ (uses built-in experimental TypeScript stripping). Live smoke requires network and reads the public anon key from the client file without logging it.

Frontend published to origin/main and verified live at https://sponsorsorter.com (a463ffb). Related Supabase restrictions and four Edge Functions are already deployed. See the release verification section below for the final publication result.

## Work completed

- Tightened `users_extended_data` grants and RLS, guarded privileged profile fields, and created a limited public profile directory. Applied migrations `lock_down_profile_data`, `secure_pending_profile_signup`, `minimize_profile_table_grants`, `reduce_profile_rpc_surface`, `secure_affiliate_admin_view`, and `secure_signup_entitlements` to Supabase.
- Limited the public pending-profile RPC to Free sponsee signups. Added a service-role-only paid profile RPC with a fixed Pro price check and stored Stripe subscription ID.
- Deployed Edge Functions: `get_stripe_customer_id` v17, `stripe-checkout` v44, and `complete-paid-signup` v1. Paid signup verifies the Stripe Checkout session, active subscription, exact Pro price, and matching Auth email before provisioning the profile.
- Hardened and deployed `sendNotificationEmail` v26 with gateway JWT verification and handler-side Auth validation. It sends only the authenticated user's own stored, unexpired 2FA code and ignores caller-controlled subject/body. Removed client-triggered group-email delivery; group notifications remain in-app while a recipient-authorized email workflow is designed.
- Updated local signup code to use the verified paid-signup endpoint and to redirect to Stripe's hosted Checkout URL. Redirected the legacy `/public/signup.html` route to the canonical signup flow.
- Moved public profile reads to the safe directory view in multiple pages/scripts. Existing homepage, admin, OAuth, and responsive CSS work is also pending in this checkout.

## Verification

- Deno 2.9.7 installed through user-scoped WinGet. `deno check --no-lock --node-modules-dir=auto` passed for the three Edge Function sources after updating Stripe SDK/API version.
- `deno check` passed for the hardened `sendNotificationEmail` function; `node --check` passed for its changed JS callers and `git diff --check` passed. Deployment returned ACTIVE v26 with `verify_jwt=true`; live anonymous and malformed-JWT requests both returned HTTP 401. No authenticated 2FA email was sent as a live smoke test.
- `node --check` passed for the changed signup JS and inline module; `git diff --check` passed with CRLF-aware whitespace handling.
- SQL privilege query confirmed anonymous callers cannot execute the paid profile RPC; only `service_role` can. Confirmed anonymous table SELECT and authenticated TRUNCATE remain denied.
- Created one live-mode Checkout smoke session using an `example.com` address. The hosted Stripe page loaded and showed **Sponsor Sorter Pro, US$10/month**, the test email, and the configured cancel destination. `complete-paid-signup` rejected the open/unpaid session with HTTP 403. No payment was submitted. Do not reuse or publish the session URL; it expires automatically.
- Full payment completion, notifications, and responsive layouts were not end-to-end tested. Outbound shell networking was initially restricted; the real Checkout smoke session was created after authorized escalation.

## Must finish before production release

1. Smoke-test the deployed `sendNotificationEmail` using a controlled 2FA setup/login; confirm valid own-account code delivery and rejection for missing JWT, wrong recipient, invalid code, and expired code. Group invite emails are disabled for safety; in-app notifications remain until a server-authorized flow is built.
2. Applied live migration `secure_exposed_application_tables`: RLS enabled on all five previously exposed tables; roadmap public reads/admin writes; abuse log admin-only; offer analytics participant reads/server writes; guest telemetry insert-only for guests/admin reads; group decision participant reads/admin insert. Anonymous update/delete and authenticated TRUNCATE are revoked. Verified unauthenticated-identity role tests return zero private rows while all 105 roadmap entries remain readable. Guest analytics Edge Function source could not be retrieved (connector unavailable), so guest INSERT remains intentionally available with no SELECT/UPDATE/DELETE.
3. Security Advisor also reported 3 default SECURITY DEFINER public views, 11 SECURITY DEFINER RPCs executable by anon, 15 executable by authenticated, plus mutable search paths on 23 functions. Audit each by intended caller and data before revoking. Auth settings report OTP expiry over one hour, leaked-password protection disabled, and a Postgres patch upgrade available.
4. Add and configure Stripe webhook handling for subscription lifecycle (renewal, failed payment, cancellation). There is no deployed Stripe webhook in the current function inventory. A success-page call alone is not reliable subscription fulfillment.
5. Test the entire signup path with a Stripe test-mode price/key and test card. Do not complete a live payment as a smoke test.
6. Test sign-in, free sponsee registration, paid sponsor registration, profile/finder pages, notifications, and admin workflows after the RLS change.
7. Review responsive screenshots for the pending visual changes at desktop, tablet, and mobile sizes.
8. Once those pass, commit and push to `main` to publish. Current `main` is an ancestor of `codex/stylesheet-modules`; no branch merge or push has been performed.

## Local tools

Deno is installed at `C:\Users\jrbwi\AppData\Local\Microsoft\WinGet\Packages\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\deno.exe`. Restarting the terminal may be needed for the `deno` PATH alias.

## Latest browser checks
- Homepage navigation now uses one row for Home/Finder/Signup/Login, verified at 390px.
- Home, login, signup have no horizontal overflow at 390px after fixing conflicting mobile rules. Desktop home/login/signup fit at 1440px.
- Roadmap renders data without console errors and has no editing controls for anonymous users; escaped text prevents stored HTML execution.
- Finder redirects to login when signed out; protected roles still require an authenticated test session. Frontend remains unpublished.


## Release packaging

- Changed JavaScript files passed node --check; CRLF-aware git diff --check passed. No secret Stripe keys or private-key blocks were found in the source scan.
- Local secure_exposed_application_tables migration is ordered after its is_current_user_admin dependency (20261010121000); it was already applied remotely by the connector under its migration name. Reconcile remote migration history before running CLI db push; do not blindly reapply policies.

## Release verification

- Release 84caaa4 pushed to origin/main; GitHub Pages published the updated homepage and modular styles at https://sponsorsorter.com.
- Browser initially reused the old cached stylesheet; root HTML stylesheet links now include a release version to refresh existing visitors.
- Public pages checked at mobile and desktop sizes. Authenticated dashboards, successful paid checkout, subscription webhooks and remaining security advisor findings are still outstanding; this is a frontend release, not certification that every feature is production-ready.


- Final release a463ffb GitHub Pages deployment succeeded. Live browser checks: 390px viewport / 387px document width and 1440px viewport / 1425px document width; all four homepage navigation links share the same row at both widths. Screenshot saved in the parent workspace as live-frontend.jpg.

## Admin workspace rebuild (2026-10-10)

- Files: dashboardAdmin.html, admin.css, js/adminWorkspace.js (navigation/presentation), js/adminLogic.js (authenticated loaders/actions), js/AffiliateAdmin.js (lazy initializer). All are formatted with pinned Prettier 3.6.2.
- Admin CSS is standalone to prevent the old global main/nav/mobile rules from leaking into it. Original dark palette, Cinzel branding, grid header and blue/purple accents retained.
- New overview counts are exact HEAD queries; operational tables remain capped by existing API limits (generally 1,000; payouts latest 100). Analytics is explicitly a sample of up to 1,000 records, not a claim about daily logins.
- Report resolution now updates status=resolved instead of deleting evidence. Read-only live schema inspection confirmed all four report status columns are unconstrained text. No schema changes were made for this rebuild.
- Grouped navigation, status queues, recent audit activity, section search, refresh, direct section hashes, lazy loading, persistent filters, empty/error states and accessible table regions/dialogs added.
- Account updates check returned rows/errors and prevent self-ban/self-revocation. Broadcast notifications request confirmation and report sent/failed/skipped counts. CSV exports use the filtered loaded results and neutralize formula prefixes.
- Privacy deletion is disabled because the legacy browser implementation skipped tables/keys and ignored failures. Available-record export corrects offer UUID filters, handles query errors and removes credential-like fields; it is NOT a complete GDPR export.
- Existing payout approval/rejection and partner payment workflows were preserved but NOT financially exercised. The legacy sponsor payout approval still performs wallet/record writes separately: replace with a locked, idempotent server transaction before relying on it for live money. Broader admin mutations need authenticated integration tests and audit-log atomicity.
- Reproducible local layout preview: node tools/admin-review-server.cjs, then http://127.0.0.1:8125/dashboardAdmin.html. Uses fictional records, replaces Supabase imports at the local server only, rejects every mutation. Query role=member tests access denial; fail=payouts tests partial read errors. This server is not part of production auth.
- Browser results: 60 layout checks (12 destinations at five widths) passed; no console errors. Role filter, reset/banned filters, empty result, section search, safe modal HTML and non-admin denial checked. Signed-in real admin validation remains pending.
- Live read-only SQL checks under an authenticated admin role passed for overview and queue tables; schema checks confirmed the fields used by the new loaders. No backend data was changed.
- Helper regression tests passed: node --test tools/admin.test.cjs (3 tests: text/URL safety, CSV formula protection and self-access safeguards).
- Admin UI release e93574b deployed successfully through GitHub Pages. Public admin HTML and standalone CSS verified live; live browser request correctly redirected the signed-out session to login.html. Desktop/mobile preview screenshots are saved in the parent workspace as admin-redesign-desktop.jpg and admin-redesign-mobile.jpg (fictional data).

## Homepage rebuild — 2026-10-10

Root index.html now uses standalone homepage.css and no JavaScript/backend queries. Content explains the product, both account roles, campaign steps, costs and FAQs. Guest links explicitly use demo data. Pricing reflects existing signup: creator Free, creator/sponsor Pro US$10/month; existing published platform-fee policy retained at 10% sponsor-paid up front. Payment completion/webhook gaps listed above remain unresolved and are not implied to be validated by this release.

Validation: real browser widths 320/375/540/768/800/1024/1440/1920; no horizontal overflow, header remains one row. FAQ click/Enter and workflow anchor passed, every local HTML/asset link exists, no console errors. No paid transactions or backend changes in this release.

Rollback homepage only: git restore --source=backup/homepage-before-redesign-20261010 -- index.html, commit and publish. Saved branch points to 20c0bf5. Do not reset the whole repo: keep admin and security fixes. The old js/homepage.js and shared styles remain available for rollback. Screenshot: ../.. /homepage-redesign-desktop.jpg (parent task directory).

## Login and shared header release — 2026-10-10

New files: login.css, signup-layout.css, connection-header.css, js/connectionHeader.js. Login imports homepage.css for shared public typography/buttons. Header module is included by 37 root pages and adds decorative SVG paths plus its stylesheet; no user data or auth calls. Reduced motion disables light-trail animation. Modern home/login/signup and admin headers use full-width navigation; legacy authenticated bars retain their existing structures and still need consolidation. Help has pre-existing phone overflow.

Login HTML retains all login/2FA/TOTP/backup IDs. js/login.js changes are presentation-only: skip absent carousels, reset dialog focus trap/Escape/return. No Supabase API, policies or auth architecture changed. Removed unused old-password recovery input and login ad loader. Signup now validates visible steps and matching passwords; final native validation opens earlier invalid panels. Tested fictional inputs only, no registration/reset email/payment sent. Admin helper tests: 3 passed. Syntax/whitespace checks passed.

Admin preview: http://127.0.0.1:8125/dashboardAdmin.html uses fictional data and rejects mutations; live admin requires authentication. Parent screenshot admin-dashboard-preview.jpg. User asked to retain the blue grid everywhere and animate lights travelling along connections; implemented as decorative SVG routes layered over the existing image.

## Original grid artwork refinement

Shared header now uses the untouched handslogo2.jpg at native 2222×888 scale, positioned -80px/bottom as the old navbar artwork was. Its SVG uses exactly the same pixel coordinates/crop and contains 51 small timed light trails traced from image lines; no replacement grid is drawn. Route reference: tools/header-grid-routes.json. Modern banner heights 200px desktop, 150px public phone. Reduced motion hides trails entirely. Checked four main pages at 320/768/1440 with no overflow; no backend or account actions.

## Public/workspace polish checkpoint

New standalone Help: help.html/help.css/js/helpCentre.js, 14 searchable topics, no backend queries. Root home/help canonical and Open Graph metadata, sitemap.xml and robots.txt added as discoverability groundwork. No external promotion performed.

Dashboard/Finder/guest now load workspace-layout.css and js/workspaceLayout.js with workspace-page body class. Module moves existing direct legacy nav children into one nav; preserves IDs/listeners/account controls. CSS scopes common widths, card details, history-table scrolling, ratings wrapping, privacy-control sizing and mobile profiles. Populated guest sponsor and sponsee checked at 320/375/768/1440 with zero document overflow; details expansion and role switching passed. Real authenticated dashboard actions remain untested. Finder's auth redirected to login in available browser, so signed-in Finder validation is still required. New Help search/disclosures, metadata/static target checks and script syntax passed.

Brand/tab cache version grid3 across 37 pages. Text up to 72px and icon up to 88px; glossy CSS hover/focus/selected effects return original visual direction. Original grid/native artwork and light trails retained. Revenue readiness still blocked by previously listed successful paid-signup, subscription lifecycle and atomic-payout validations. Do not market the whole system as production verified based on layout checks.


## 2026-10-11 — Completed campaign performance retention

- Both dashboards retain Content Performance access after completion/reviews; creators can find archived completed offers through Completed. Sponsors no longer lose reviewed campaigns.
- Reopening performance requests current platform metrics. Cached blocks show their last successful check; refresh attempts are explicitly labelled. Platform authorization, expired/deleted content and API availability still limit freshness. No unattended polling was introduced.
- Fixed nested cached metrics reading and successful-check timestamps when metrics stay unchanged. Failed cache bookkeeping no longer hides readable saved results.
- Validation: 35 unit tests pass; JavaScript syntax checks pass; sponsor preview Completed filter and Content Performance empty-content state checked in browser. Real linked-platform updates remain to be verified with authenticated test campaigns.
- Outstanding original workflow request: private video drafts/review UI and database policies have NOT been implemented. Audit identified unsafe client-owned offer transitions, non-atomic funding/refunds and creator wallet credit blocked by existing profile protection; do not claim end-to-end workflow/payout readiness. Preserve real account Moikailive.


## 2026-10-11 — Private video drafts and workflow safeguards

- Added private 50 MB MP4/WebM/MOV draft uploads in offer Comments, version history, one-hour renewable playback access, sponsor approval/change requests and feedback. Latest submitted draft approval is enforced by the database before publishing.
- Added participant-only draft metadata/Storage policies that remain restrictive despite legacy blanket Storage grants. Registered assets cannot be overwritten/deleted by clients. Draft/review RPCs lock the parent offer and are idempotent.
- Offer comments now render text safely, derive sender identity on the server and check parent-offer participation.
- Publishing validates links/dates for all agreed platforms, including Snapchat. Sponsor confirmation preserves publication dates; confirmed links cannot be replaced by clients. Agreed parties/price/platforms/payout fields are protected. Client stage progression and confirmation roles are now checked in Postgres; browser requests cannot mark payment complete.
- Replaced destructive rejected-offer removal with archiving. Refund and wallet-release UI now refuses false success; verified funding/atomic settlement/webhook implementation remains outstanding and automatic private-offer refunds/credits are unavailable.
- Closed blanket authenticated access to private invoices/proofs. One ownerless/unscoped legacy invoice object is quarantined from client access, retained for ownership reconciliation; not owned by Moikailive. No real account or money was changed.
- Four migrations applied: 20261010204209_private_offer_draft_review, 20261010205323_support_snapchat_content_links, 20261010205903_restrict_legacy_private_storage, 20261010210228_enforce_private_offer_actors.
- Validation: isolated PGlite tests use synthetic data and validate actual migrations against deliberately broad legacy policies. Live rollback-only permission/replay tests pass. Browser preview verifies creator upload controls, sponsor-only decision controls, required change feedback and safe failure states. Actual upload/playback is awaiting a usable authenticated test browser session; do not claim it tested. See tools/OFFER_WORKFLOW_ROLLOUT.md for recovery/limitations.

## 2026-10-11 — login delivery recovered and draft upload verification
- Email verification failed because Resend rejected the unverified sponsorsorter.com sender (HTTP 403). Added the domain and four DNS records in Squarespace; Resend verified all records. Owner confirmed email/login recovery. No authentication bypass.
- Live fitstyle upload test found a generic upload interruption. Release cd4dd51 uses standard private Storage SDK uploads for files up to 6 MiB, keeps TUS for larger files, and reports safe HTTP-specific errors without exposing response bodies or credentials.
- Automated suite: 40 passing. Real upload/playback and sponsor review validation is in progress; do not claim those passed yet.
- Test sample: public-domain MDN flower MP4 (1,128,375 bytes); synthetic FFmpeg test pattern (7,934,570 bytes) prepared for chunked upload. Files are ignored under .validation/media; no personal content.

### Live draft checks
- fitstyle session confirmed in connected browser. Existing accepted Johnny → fitstyle test offer: Story and Feed Combo Deal, 6822398c-cf44-40f5-8848-d98022687517.
- Submitted public-domain sample as version 1, pending. Loaded participant-only signed URL and played to 5.055 seconds with readyState 4 and no media error. Test notes explicitly prohibit publication/payment. No offer stages, wallet balances or payment records changed.
- Direct resumable upload returned a transport failure without an HTTP response. Release 8b2a8f6 falls back to non-overwriting SDK upload only for that case; HTTP authorization/size denials never trigger fallback. 41 tests pass.
- Browser cannot yet prove native TUS chunks succeed; test the 7.9 MB sample after deployment, then sponsor review with Johnny account.

### Live upload follow-up
- Release 8b2a8f6 deployed successfully (GitHub Pages run 38097862384).
- The synthetic 7,934,570-byte MP4 uploaded successfully as version 2 (pending) using the connection fallback. Native resumable transport remains unverified in this browser; do not describe this as a successful chunk-resume test.
- Small clip actual playback passed. Sponsor review still needs switching to Johnny in the connected browser. Both records are clearly marked QA TEST ONLY; preserve evidence, do not publish/pay on them.

- Large clip private playback also passed: duration 5 seconds, currentTime 5, readyState 4, no media error. Screenshot saved outside the repo as large-video-playback-proof.png.

## 2026-10-11 — Header routes, live draft review and onboarding

- Header e6e54a0 deployed successfully: 44 animated signals choose traced orthogonal grid routes with turns in all directions, fade/reappear and change routes each cycle; hidden-tab pause and reduced-motion support retained.
- Live Johnny sponsor test: latest synthetic video draft approved; empty change request correctly rejected. Sponsor private video played to its 5-second end without a media error. Creator small (1.1 MB) and large (7.9 MB) upload/playback previously passed. No funds moved or campaign completion recorded. Native resumable transport remains unproven; large upload succeeded with SDK fallback.
- Onboarding: fixed off-screen 300px offset; responsive centred keyboard-focusable tour with Escape/Tab support; corrected role detection (sponsee must not match sponsor substring), current notification selector, clearer role-specific profile/brief/draft guidance, completion saved without forced Finder redirect, and help preferences preserved. Restart no longer clears persisted completion before starting.
- npm test: 43 passing. Browser fixture tour contained at 1280x720 and 375x812; Next advances. Broader signup/first-login onboarding redesign remains a follow-up; this release repairs the existing guided tour.

## 2026-10-11 — Signup review and persistent getting-started guides

- Signup final panel now shows username/email/role/plan and next action using safe textContent. Correct Free/Pro submit labels, selected-role aria-pressed, password-manager autocomplete and clearer Review & Create step label. No account, payment or auth backend changes.
- Both member dashboards have a collapsible role-specific Getting started guide with profile, discovery, platform connection, draft approval and performance guidance plus a restart-tour button. Uses existing links/settings; no fabricated completion percentages or persisted task states.
- npm test: 44 passing, including switching sponsor Pro → creator Free → sponsor Pro and literal rendering of hostile profile text. Browser fixture: both guides render, signup validation keeps incomplete role fields visible, both plan summaries/labels correct. No real signup, agreement acceptance or checkout submitted. Viewport override did not apply to the signup tab (remained 1280px); new mobile browser validation remains outstanding, despite fluid CSS and 640/480px breakpoints.

## 2026-10-11 — Mobile signup role forms

- Real 375px browser test exposed 792px document overflow on the role/plan step: inactive absolute-positioned panels remained off-screen; creator handle rows also overflowed. Signup-scoped CSS now hides inactive panels, uses normal flow/automatic height, contains nested fields, lays sponsor platform choices in two columns and creator handles in one column. Removed legacy platform line-break grid cells and fixed broken external Instagram image with existing local artwork (Facebook now local too).
- At 375px, sponsor and creator role forms plus creator Free final review have document scrollWidth equal to clientWidth (360px with scrollbar); no horizontal overflow. Wider resize attempts did not change the existing tab, so do not claim additional width coverage. Temporary viewport reset and test tabs closed.
- npm test: 45 passing. No signup submission, terms acceptance, backend changes or payments. More complete 320/768/1440 visual coverage remains useful.

## 2026-10-11 — Shared footer, brand and policy reading tools

- Canonical tools/site-footer.html copied into all 39 rendered root/public-profile pages using tools/sync-site-shell.cjs. Added Explore, Resources and Policies groups: previews/signup/login, Help/Contact/Community/Blog/Reviews/Stats/Supporters, Privacy/Terms and direct data-deletion/cookies/payment sections. Validated target files and policy fragment IDs. Raw link.html verification text intentionally untouched; legacy public/ and test/ copies are not canonical deployed navigation targets.
- Added site-shell.css for consistent footer and brand presentation. Legacy nested header wordmarks now use the homepage logo/text/home link; existing navigation IDs, search and account controls retained. Roadmap gained the shared animated header; Settings gained a footer. Header account navigation remains role-specific.
- Privacy, Terms and legacy tos pages now use legal-pages.css and js/legalPages.js: readable sections, collapsible searchable section index, print/save-PDF action and related help/policy links. Search filters navigation only; all policy text stays present. Verified main HTML content byte-for-byte unchanged against previous commit; policy dates/substantive promises not revised. Terms/tos still contain different legacy wording; a later legal review should reconcile them. No legal-compliance claim made.
- npm test: 46 passing. Browser checks: homepage grouped footer, privacy 15 sections with Cookies filter, terms 16 sections with Payments filter; dashboard brand and search/bell/settings nodes retained, Back to top works, dashboard 752px viewport has no document overflow. Print action wired but print dialog not opened.

- Footer also includes How it works and Plans & pricing. Final policy/footer preview at 1280px has no document overflow; requested 375px override did not apply to that new tab, so mobile policy/footer verification is not claimed.

## 2026-10-11 — Campaign search and prioritisation

- Sponsor and creator private campaign dashboards now search titles/account names, sort newest/oldest/deadline/value, and filter overdue or due within seven days before pagination. Controls work on authorised loaded data without additional API requests. Closed/archived campaigns are excluded from urgency filters; date-only deadlines include the entire due day.
- Sequential sponsor rendering preserves sort order; both renderers reject stale asynchronous cards after filter changes. Creator status-tab changes are scoped to the offer section. Accessible result announcements and wrapping toolbar retain the existing theme.
- Validation: 48 automated tests pass; module syntax and whitespace checks pass. Local browser fixture verified both dashboards search to zero, clear to two, sorting selection and overdue filtering; sponsor desktop width 1280/client1265/scroll1265. No live account or financial mutations.

## 2026-10-11 — Finder discovery overhaul

- New js/finderDiscovery.js separates public-directory searching from legacy inline logic. Exact result counts, stable server ordering before 12-item pagination, scoped filter reset, loading/error/empty states and stale-response guards. Profile cards safely render account text, show factual filter-match reasons, linked platforms, plan, and approximate combined audience with an overlap caveat; recipient-specific profile/offer links retained.
- Per-account shortlist stores up to 50 public account IDs in this browser only, with saved-state buttons and shortlist-only searching; no cloud sync or account-data permission changes. Storage failure is surfaced.
- Other accounts are bounded/alphabetical rather than randomly loading the entire directory. Public offer filters now accept zero budgets and reject stale asynchronous cards. Escaped legacy Finder/recommendation profile, offer and group text/attributes; local Instagram/Facebook assets replace unreliable remote icons. Recommendations retain existing Edge Function scoring and now exclude closed public offers.
- Validation: 50 automated tests pass, all inline Finder modules and updated modules pass syntax checks, whitespace clean. Read-only live directory aggregate verified 22 rows/22 unique IDs. Browser fixtures verified sponsor/creator roles, search empty state, filter reset, recipient link and sponsor shortlist across reload; desktop width1280/client1265/scroll1265. Requested viewport override did not apply, so no new mobile-browser claim. Native recommendation ranking and real offer applications are not newly end-to-end tested; no payment/data mutations.

## 2026-10-11 — Finder layout revision

- Replaced the tall full-width search stack with a desktop filter sidebar and a primary results column. Mobile starts with collapsible filters above results. Compact category navigation, restrained card borders/actions, consistent supporting sections and collapsed explanatory text reduce visual noise. Added content-type shortcuts using the existing search handler; all IDs and account/offer handlers retained.
- 51 automated tests pass. Browser fixture checked quick-filter empty results, clear filters, opportunity tab and desktop containment (1280 width,1265 client/scroll). Browser viewport override again did not apply; responsive styles implemented but narrow browser verification remains pending.
