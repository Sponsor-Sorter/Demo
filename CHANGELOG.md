# Change log

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

## 2026-10-10 — Rebuilt public previews

- Replaced duplicated sponsor/creator preview markup with one accessible, responsive workspace and role picker. Retained the shared animated grid header and dark/cyan/purple identity.
- Added working local sample creation, applicant acceptance, application/withdrawal, campaign stages, filters, comments, images, profile/account prompts, history/insights and reset. Upcoming sample deadlines replace stale dates; sample assets replace missing images.
- Removed preview IP geolocation and outbound analytics; the demo no longer needs accounts, backend calls or Chart.js to load. User-entered content is escaped or inserted as text.
- Corrected both member dashboards' completed campaign values (pending offers excluded), sponsor completed count and acceptance-rate wording. Clarified that campaign value is not a payment receipt or wallet balance; refined campaign card borders and selected status contrast.
- Passed 27 automated checks and 20 actual-viewport layout cases at 320/375/768/1440 across the role picker, both previews and both member dashboards. Exercised the full sample offer workflow, comments with HTML-like text, application/withdrawal, dialogs and reset. Production financial/OAuth completion is outside these checks; no real records changed.

## 2026-10-10 — Finder and member workspace redesign

- Added role-specific workspace introductions, quick links and keyboard-accessible dashboard section navigation.
- Moved overview, active campaigns and public offers ahead of profiles/community; retained every existing HTML ID and business control.
- Added labelled Finder filters, clear-and-search actions, amount range validation, pressed states and live result announcements.
- Rebuilt responsive metric grids, panels, offer actions, status tabs and locally scrolling history tables. Kept dark/cyan/purple branding and animated header.
- Corrected sponsorLogic's legacy Supabase client import, empty pagination and missing duration/payment/deadline display text.
- Verified 20 browser layout cases (three Finder modes and both dashboards at 320/375/768/1440), with zero page overflow; status tabs also fit. Exercised filter reset, offer filtering, section navigation and offer detail expansion using fictional read-only fixtures. All 24 existing automated checks pass.
- No database changes, payments, account creation or real-user mutations. Authenticated production transactions still need separate end-to-end verification.

## 2026-10-10 — Public page consistency

- Unified headers/navigation and centered responsive panels on contact, privacy, terms, tos and password recovery.
- Added contact input labels; fixed duplicate signed-out Login links and legacy terms client import.
- Passed 20 browser layout checks across four widths; no forms submitted or user data changed.

## 2026-10-10 — Atomic payout records and wallet reservations

- Moved admin payout decisions, wallet deduction, audit and in-app notice into a locked database transaction; repeat processing is idempotent.
- Fixed wallet reservations using the correct account ID and all reserved states; verified ordinary users cannot edit protected balances.
- Renamed bookkeeping action Record External Payment; actual provider sending remains gated on inspection and sandbox verification.
- 24 Node tests passed; two database integration suites passed with all fixture changes rolled back.

## 2026-10-10 — Payment request hardening and regression tests

- Fixed signup Checkout return URL override; restricted other return origins.
- Validate private-payment bearer tokens with Supabase Auth; reject anonymous identities.
- Bound checkout amounts, hide upstream error details, reject unknown payment states.
- Deployed checkout v45 and paid-signup completion v2; four negative production smoke checks passed.
- Added repeatable `npm test` suite: 22 passing tests. Completed sandbox payments, subscription webhooks and atomic payouts remain outstanding (see HANDOVER.md).

## 2026-10-10 — First frontend release

- Restricted profile-table access and privileged profile-field writes; added a safe public profile directory.
- Added a server-verified Pro signup path, fixed Pro price/return URLs, and stored subscription identity. Free self-service signup is limited to sponsees.
- Hardened the Stripe customer lookup and removed `redirectToCheckout` from the signup path in favor of Stripe's hosted Checkout URL.
- Updated public profile consumers and the legacy signup route for the new data boundary.
- Continued homepage, admin, OAuth, and responsive CSS cleanup.
- Hardened and deployed notification email as JWT-authenticated, own-address 2FA-only (Edge Function v26); arbitrary content/recipient mail is blocked. Client-triggered group invite email is disabled pending a safe server-authorized workflow; in-app notification remains.
- Verified the deployed endpoint rejects anonymous and malformed-JWT requests with HTTP 401.
- Supabase Security Advisor scan found five RLS-disabled, anon-writable tables and additional SECURITY DEFINER/search-path/Auth configuration findings; details and a policy-first remediation plan are recorded in `HANDOVER.md`.

**Release status:** Supabase database changes and four Edge Function versions are live. Frontend published to main and verified live at https://sponsorsorter.com (release a463ffb). See [HANDOVER.md](HANDOVER.md) for verification and outstanding release gates.

- Enabled RLS and explicit access policies on five exposed application tables; verified anonymous mutation restrictions and private-row isolation.
- Fixed homepage navigation to one row and mobile overflow on home/login/signup; scoped leaking signup CSS and hardened roadmap editing/text rendering.

- Versioned root-page stylesheet links so existing visitors load the new modular CSS after deployment.

## 2026-10-10 — Admin workspace rebuild

- Replaced the long admin page with 12 grouped destinations, matching the existing dark theme and blue/purple brand.
- Added exact-count overview cards, pending report/payout/privacy queues, recent activity, section search, quick actions, refresh and saved section URLs.
- Separated notification composition/history from the activity log; fixed persistent filters, role labels, empty results and filtered CSV exports.
- Consolidated duplicate startup handlers into one authenticated entry point and load sections on demand. Admin styling is now a separate, formatted admin.css file.
- Added retained report resolution and status filters, honest analytics labels, escaped user-authored table text, safe detail dialogs and spreadsheet formula neutralization.
- Disabled incomplete browser-only account deletion; available-record exports are explicitly incomplete and omit credential fields.
- Checked all 12 views at 320/768/1024/1440/1920px with fictional read-only records: 60 checks, no horizontal page overflow or console errors. Also checked access denial, partial read errors, filters, empty results, section search and HTML text escaping.
- Live administrator data and real mutation workflows still require a signed-in administrator check; no payments, bulk notifications or destructive actions were performed.
- Live read-only SQL checks under an authenticated admin role passed for overview and queue tables; schema checks confirmed the fields used by the new loaders. No backend data was changed.
- Helper regression tests passed: node --test tools/admin.test.cjs (3 tests: text/URL safety, CSV formula protection and self-access safeguards).

## 2026-10-10 — Homepage rebuild

- Rebuilt the homepage around a clear product introduction, creator/sponsor paths, demonstration dashboard links, four-step campaign workflow, pricing, FAQs and help/legal links.
- Retained the dark theme, existing logo, cyan/purple/blue accents and grid artwork. Added independent, formatted homepage.css; removed the homepage's large inline stylesheet and dependency on global styles.
- Removed homepage private-table queries, activity ticker, unverifiable marketing guarantees, competitor comparisons, newsletter capture and rate calculator. Existing legacy homepage.js is preserved but no longer loaded here.
- Checked actual browser widths 320, 375, 540, 768, 800, 1024, 1440 and 1920: no overflow, all four header links in one row. FAQ mouse/keyboard, section navigation, asset/link targets and console checks passed.
- Rollback: restore ONLY index.html from backup/homepage-before-redesign-20261010 (20c0bf5), then publish. This preserves the admin/security work. homepage.css can remain unused.

## 2026-10-10 — Homepage frame consistency

- Standardised card/preview/CTA corner radii, neutral divider colours and accent frame tokens.
- Platform-fee card now retains the same frame on desktop, tablet and mobile; creator/sponsor preview links align at the bottoms of their cards.
- Browser checks at 320/375/768/1024/1440/1920 confirmed consistent 1px frames/16px radii, no horizontal overflow and single-row main navigation.

## 2026-10-10 — Signup information correction

- Corrected stale US$9.99 one-month wording to the actual US$10/month Pro subscription in static and dynamic confirmation copy; Free messaging remains payment-free.
- Shortened signup introduction to accurate creator/sponsor roles and costs; removed unsupported escrow/automatic-stat promises. Fixed logo-input label, sponsor spelling, footer logo/year.
- Browser exercised Sponsor Pro and Creator Free step selection and confirmation copy without submitting registration or accepting terms. Inline script syntax check passed. This is a copy/accessibility correction, not a checkout or signup backend validation.

## 2026-10-10 — Login, shared grid header and signup validation

- Rebuilt login with the public dark theme, responsive form layout, correct brand logo, full-width navigation and preserved login/email-2FA/TOTP/backup-code controls.
- Removed login advertising and decorative profile carousels; no longer queries profiles when no carousel exists. Password recovery no longer asks for an old password it never used; added dialog semantics, focus return, Escape and keyboard focus containment.
- Added shared connection-header.css/js/connectionHeader.js to 37 root pages with existing branded headers. Original blue grid artwork remains; three decorative light trails travel along orthogonal connection paths. Reduced-motion CSS disables animation. Existing authenticated controls remain intact.
- Home, login and signup now have equal-width, single-row navigation spanning the full banner. Admin uses the same full-width banner treatment with its existing five account links.
- Signup validates each panel before advancing, checks matching passwords, exposes the current step accessibly and reveals earlier invalid fields on final native validation. Removed a duplicate location element ID.
- Browser checks: public entry pages at actual 320/768/1440 widths, signup also 375; no overflow, equal-width links. Login password toggle and reset dialog focus/Escape passed. Signup missing-fields/password mismatch/sponsor-required-fields checks passed with fictional inputs; no signup, reset email or payment submitted.
- Follow-up: legacy Help page has pre-existing small-screen content/account-nav overflow; broader legacy navbar consolidation remains. Actual account login/2FA delivery and financial flows were not exercised in this UI release.

## 2026-10-10 — Original grid artwork animation

- Restored handslogo2.jpg at its original 2222×888 pixel scale and original -80px horizontal/bottom crop, removing the heavy tint and invented large grid paths. Public/admin brand banners are 200px high (public phone banner 150px).
- Increased decoration from 3 to 51 independently timed light trails. Coordinates are traced from visible horizontal lines in the original raster; reference coordinates saved in tools/header-grid-routes.json. Image and animation share native coordinates and crop, so trails remain aligned at every viewport.
- Reduced-motion preference displays only the original artwork. Decorative layers remain clipped, noninteractive and hidden from assistive technology.
- Twelve real browser layout checks passed: homepage/login/signup/admin at 320/768/1440 pixels, no overflow. JS syntax and whitespace checks passed. Shared module/cache URLs advanced to grid2 across 37 pages.

## 2026-10-10 — Public polish and dashboard workspace layout

- Enlarged public/admin header branding (up to 72px text and 88px icon) with phone sizing; restored original-style glossy hover/keyboard/selected tab highlights using scalable gradients.
- Added scoped workspace-layout.css/js/workspaceLayout.js for sponsor/sponsee dashboards, Finder and guest previews. Consolidates legacy nav rows without replacing account-control nodes; constrains dashboard frames, offer cards, privacy controls and history tables; wraps ratings and switches profile/card details to a phone layout. Demo banner is now a restrained, clearly labelled preview notice.
- Rebuilt Help as a searchable 14-topic centre covering accounts, offers, campaigns, connections and costs. Removed unsupported marketing claims, irrelevant charts and their backend queries. Added clear no-results recovery, accessible native disclosures, support links and consistent header/footer.
- Added canonical/sharing metadata for homepage and Help, plus a public-page sitemap/robots entry. No outreach, paid marketing or ranking guarantees.
- Browser checks: Help and both populated guest roles at 320/375/768/1440, no overflow; preview role switching and sponsor offer-details button passed. Help search case-insensitive match/no-results/clear and disclosure controls passed. Larger public branding checked at 320/375/768/1440/1920; one-row navigation and no overflow. Admin enlarged header checked at phone/desktop widths.
- Finder remains login-gated in the available browser; its scoped layout requires signed-in confirmation. Financial actions and real login/2FA/subscription lifecycle remain outside this visual validation. See HANDOVER.md for outstanding production issues.

### 2026-10-11 Navigation account controls
Bell, messages and settings stay beside tabs on the right; removed the legacy separate-row rule, compacted dashboard controls, preserved guest visibility, refreshed stylesheet cache URLs. Browser checks at 320/375/768/1440, zero overflow; navigation geometry checked after CSS transitions settle.


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

## 2026-10-11 — draft upload handling
- Small private draft videos now use standard Storage uploads; larger clips retain resumable chunks.
- Upload failures show actionable, sanitized status messages.
- Added transport and error handling regression tests (40 tests passing).
- Restored login email delivery by verifying the sending domain DNS; owner confirmed recovery.

## 2026-10-11 — multidirectional connection lights
- Header lights now follow 117 paths traced from the original grid artwork, turning up/down/left/right.
- 44 staggered lights fade out, select a different route and reappear. Reduced-motion support retained; animations pause in background tabs.
- Original artwork, header sizing and navigation preserved. 42 automated tests pass.
