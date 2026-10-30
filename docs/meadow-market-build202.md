# Meadow Markets 202

30 October 2026. Browser acceptance and travel hit-target correction. Existing Android wrappers are unchanged.

## Corrected

The Eastbank return button was inside the transformed camera and overlapped the tall brand/helper HUD in short landscape. A real DOM hit test identified the HUD as the tap receiver. Travel controls now live in a screen overlay beneath the measured header, with a 44 px touch target. Camera pan/zoom no longer shifts them underneath the HUD. Painted building hotspots remain in map coordinates.

## Browser acceptance

Live201, using the existing test_browser farm:

- Animal family and full-screen grooming opened; dragging the hand registered 8% progress. Leaving applied no unfinished care reward.
- Collect all delivered two eggs; Care all restored every need on the Willowbrook chicken while Eastbank was loaded, charging exactly 10 gold.
- Flour consumed three wheat, queued two output and was collected by a helper. Automation controls opened.
- Vendor delivery consumed three strawberries/two carrots and awarded the stated 105 gold/20 reputation. Cancelling a market scale round preserved the 204 apples.
- A daily harvest mission awarded five gems/50 gold once and changed to Collected, without a confirmation dialog.
- Accepted friend's live farm loaded, including its placed items. Water-help correctly reported no eligible crops. Actual help delivery and cross-device pairing were not exercised in this pass.
- Eastbank unlocked for 650 gold. A tree placed for 70 gold, rotated, moved to an adjacent tile and survived reload. Sell showed the 35-gold confirmation and Keep it preserved the tree.
- The server activity view contained the land purchase, tree purchase, move and account reward. Browser reload kept the account, map and tree.
- Word-search drag found STRAWBERRY. Removed hide-animal/bee/tractor/refill activities were absent from the main catalogue.
- Embedded shared-screen Harvest Four completed a seven-move win. Choose another game returned to the selector. This does not prove Wi-Fi pairing.
- Portrait390×844 and landscape844×390 layouts checked. Live browser warning/error log query returned no captured entries at the observation.

Local202: pre-existing preview cloud conflict blocked account switching as intended; loading the canonical farm resolved it. A login attempt from the unsupported127.0.0.1:8782 origin was rejected by CORS; the established localhost:8771 preview retained its existing reviewer session. No credential was changed. Corrected travel hit targets were unobstructed in both orientations, and tapping Return completed the bridge journey to Willowbrook. Full local regression suite, focused travel/notice checks and four cleanup worker tests passed.

Evidence lives outside the public repository in meadow-production194-evidence/browser202. No phone acceptance is claimed: user requested waiting for phone availability.

## Account-deletion maintenance carried forward

After the existing seven-day cancellation/purge, generated game-only logins enter a private lease queue. A service worker retires an Auth principal only after current Auth data and fresh database ownership checks agree. Exact UUID game alias, confirmed email, no phone/MFA/OAuth/other-provider/storage ownership, no remaining Meadow account and no references in other application tables are required. Shared or uncertain identities are preserved. Other application table checks fail closed.

Worker calls use timestamped HMAC signatures valid for two minutes. The Vault key is never sent through the managed pg_net queue; its managed default ACLs must not be mistaken for a successful postgres REVOKE. The player cannot invoke the private signer or service-only retirement RPC. Jobs use bounded batches/leases and retry failures. The queue was empty; signed live transport returned200/zero processed and unsigned returned401. No real Auth account was deleted. Rollback ownership/lease/cross-app fixtures passed; actual provider deletion remains unexercised against live users. Security advisors returned zero ERROR-level findings.

## Remaining launch gates

Ordinary farming still accepts legacy client snapshots; the journal is not full server authority. Google Play approval/public installation, physical Samsung/iPad acceptance, real Billing purchase/restore/refund and AdMob consent/SSV/no-fill acceptance remain. Live payments/ads stay disabled. Do not claim this browser pass proves production readiness.
