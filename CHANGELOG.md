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

**Release status:** Supabase database changes and four Edge Function versions are live. Frontend release is prepared for publication to main. See [HANDOVER.md](HANDOVER.md) for verification and outstanding release gates.

- Enabled RLS and explicit access policies on five exposed application tables; verified anonymous mutation restrictions and private-row isolation.
- Fixed homepage navigation to one row and mobile overflow on home/login/signup; scoped leaking signup CSS and hardened roadmap editing/text rendering.

- Versioned root-page stylesheet links so existing visitors load the new modular CSS after deployment.
