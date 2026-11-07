# Meadow Markets commercial activation — 7 November 2026

Google Play production remains 1.7.2/code12, available in Australia. Web228 fixes worker scheduling and checkout eligibility; web229 replaces the obsolete invitation-only installation link with the public Play listing. No new native binary is needed for these changes.

## Effective configuration

- General new-farm issuance is on. New farms receive the server-owned 250-gold, level-one, nine-object baseline and protocol4 provenance.
- Public payments, production readiness and advertising issuance are on. All seven backend products are enabled and correspond to the existing active Google Play offers. Localized prices come from Play; browser purchases direct players to the Android app.
- Purchases require a registered game account and a verified farm. Earlier beta saves retain their existing gameplay and balances; they are not silently converted or charged. Checkout explains when a farm needs review. Original receipt recovery remains independent of new checkout.
- Approved free tester access is preserved. No real-money purchase was made during this work. Play license tests remain controlled by Google's test instruments.
- Popup advertisements remain off by default, optional and suppressed by Premium. Rewarded ads remain voluntary, with server limits of three completed rewards per UTC day and ten nonce issuances per hour.
- The owner approved registering the Samsung SM-S908E advertising ID in AdMob. The account now lists that device. Meadow1.7.2 app-wide Test mode is off; no Frontlines setting was changed. The temporary device-ID file was removed.

## Acceptance

The actual deployed farm API passed starter till/plant/water/timed harvest, exact replay, early-harvest denial, hiring/assignment, timed worker jobs, production ingredient spending/timed collection, housing/care, shop stock/plans, vendors, expansions, rotations/sales, all six farms, all fifteen village restoration stages, greenhouse and nursery, and the 20-gem automatic-watering entitlement. Forged clocks, output amounts, market proofs and stale requests were denied.

A real defect was reproduced: a newly assigned worker could consume the farm's older absence cursor. Catch-up now starts after the later of that cursor and the worker's own last assignment/job. The new regression failed before the fix and passed after it. Live acceptance then confirmed no immediate catch-up, replanting the previous carrot on a genuine timed lease, and licensed watering on its next lease. Gateway39 contains the fix and229 rules fingerprint, with JWT verification retained.

The real Java ad plugin is compiled and executed against controlled SDK callbacks in CI. Consent-unavailable, age/PG configuration, malformed nonce, concurrency, No Fill/retry, early dismissal, show failure and earned-but-unverified handling pass. These are callback-contract tests, not a claim that a real network supplied every failure or regional consent form. Current advertising remains restricted with TFUA true and PG rating; this work does not weaken that policy.

After activation, one SDK rewarded view completed and its signed SSV callback credited test_phone exactly once:620→625 gems and5→6 tickets. A subsequent server issuance was denied by the real three-completion daily cap without starting another SDK view. No ad install or advertiser link was clicked. A visible Test Ad badge was not captured for this post-registration view; do not describe it as a proven non-revenue impression. Dashboard registration and SDK-log test-ID suggestions are distinct evidence. Keep normal tester accounts on their free-preview path; require a visible Test Ad badge before further SDK ad testing.

Actual deployed guest eligibility, hourly issuance and daily completion guards were also exercised in rolled-back database transactions. Registered verified eligibility and legacy denial were checked transactionally before activating checkout, with the original tester entitlement restored before commit.

Three disposable anonymous canaries and their farms/ledger fixtures were removed after their sessions were expired or revoked and stable API admission returned401. Private tokens were removed. Temporary provider overrides are expired. No real player farm layout, wealth, password or account was changed. General backup work remains stopped at the owner's instruction.

## Release evidence and operations

Runtime228 publication:8ce0cbd735e2715db39f0d963dfe8cbb3d0d3d10. Full regression/native CI42370514599 and Pages42370514182 passed. Browser accepted its real227→228 update and Settings reported228; Samsung independently reported228 with the same test_phone farm. Five public runtime files matched committed bytes. All62 server farming tests, the complete game regression suite and focused commerce/billing/ad/Java checks passed. The only subsequent runtime change is the229 public-install route and fingerprint.

Final229 publication:ace42abef4ebb386a23573343a7dc1d458643f85. Full regression/native CI42373752922 and Pages42373752864 passed. All five public runtime files match committed bytes. Live browser Settings reports229 and its expanded installation section links the public package listing without an invitation. The Samsung accepted the real228→229 Install update prompt; Settings reports229 and its same level66/VIP2 Homestead Back Pasture returned. Browser release logs contained no warnings/errors before this final text/link change. Evidence: browser-public-install229.png,update229-prompt.png,settings229.png,after-install229.png. No fresh native billing order was necessary for this text-only follow-up.

Sanitized evidence and scripts: D:/Chat Gpt/workspaces/meadow-production194-evidence/native226. Device/order identifiers and credentials are omitted from Git. The reviewed legacy-layout proposals are not applied; some old layouts still need an individual support review before paid eligibility.

To stop new commerce without stranding paid receipts, set only the relevant private commerce_config flag false. Keep store verification, original receipt replay, Restore, authenticated RTDN and already-issued signed SSV callbacks running. To pause server-baseline enrollment, set farm_start_config.new_farms false. Do not reset player farms or grant blanket tester access as a rollback.
