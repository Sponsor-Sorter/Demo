# Change log

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
