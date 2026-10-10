# Change log

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
