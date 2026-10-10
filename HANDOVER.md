# Sponsor Sorter handover

**Updated:** 2026-10-10  
**Workspace:** `C:\Users\jrbwi\Documents\Codex\2026-10-10\i-ve-created-a-sponsor-sorter\work\Demo`  
**Branch:** `codex/stylesheet-modules`  
**Remote:** `origin` → `https://github.com/Sponsor-Sorter/Demo.git`

## State

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
