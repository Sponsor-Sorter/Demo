# Sponsor Sorter handover

**Updated:** 2026-10-10  
**Workspace:** `C:\Users\jrbwi\Documents\Codex\2026-10-10\i-ve-created-a-sponsor-sorter\work\Demo`  
**Branch:** `codex/stylesheet-modules`  
**Remote:** `origin` → `https://github.com/Sponsor-Sorter/Demo.git`

## State

Frontend release prepared for publication to origin/main and https://sponsorsorter.com. Related Supabase restrictions and four Edge Functions are already deployed. See the release verification section below for the final publication result.

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
