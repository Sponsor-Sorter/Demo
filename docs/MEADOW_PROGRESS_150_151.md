# Meadow Markets builds 150–153

## Player features

- Farm desk: one farm-journey entry, with existing mastery, community and additional goals grouped in expandable sections.
- Farm journey: ten connected milestones, suggested next action, source navigation, permanent completed-step markers.
- Four farm focuses: market gardener, animal keeper, artisan producer, orchard and apiary. One active focus per area; choose again after 24 hours. Learned ranks remain on that farm. Rank gates are player levels 8/12/18, practice 20/60/150 and gold 300/800/1800.
- Practice is earned by real harvest, care, collected production batches, orchard picking and hive collections. Helpers count. Existing activity is not retrospectively minted into new practice.
- Grower ranks lower seeds and add field yield; keeper ranks slow needs and add produce; artisan ranks shorten newly queued batches; orchard ranks shorten apple and honey cycles by 10/20/30%. Hives still require flowering patches.
- Village regulars: relationship rewards at 3/10/25 deliveries. Each claimed milestone adds 2% to that customer's future pay, capped at 6%. Customer order buttons show actual gold and lead directly to relationship milestones.
- Four weekly seasonal market themes. Two featured goods receive 10% higher farm-shop prices. Offline sales use their actual sale time's theme. These are market themes, not seasonal terrain or weather variants. Goods never expire.
- Established friend projects are included in the journey, with existing permanent village landmarks and useful accepted-friend contributions.

## Account recovery

Settings → Account & switch farm → Save or replace recovery key. A signed-in Meadow Markets account and its current password are required. Keys have 256 random bits, are displayed once, and can be downloaded/copied. Only their SHA-256 hashes are retained by the server. Keys are never stored in game saves or browser storage.

Sign in → Forgot password → username, saved key and a new password. Claiming a key is atomic and single-use. Creating another key replaces the old one. Recovery changes the password of the same account; it does not create another farm. Refresh sessions are revoked after successful recovery; already issued access tokens remain valid until expiry, as with Supabase global sign-out.

Live migration: `meadow_account_recovery_keys`. Source: `supabase/meadow-recovery.sql`. The existing account tables were present; an initial information_schema query did not expose them. No account-table recreation occurred.

The `meadow-market-accounts` Edge Function remains the existing public login endpoint with authentication inside each relevant action. Recovery hashes and the claim RPC are inaccessible to player/anonymous roles. Sponsor Sorter, BargainBarge and Littles authentication are not changed.

## Performance and visual checks

- Cloud writer retains immutable first/in-flight snapshots and the newest pending snapshot for each account segment. A simulated 300-pending-save burst results in one pending write. Switching identities cannot merge their saves.
- Helper job selection measures walkable cells once per attempt and reuses full reachability from a failed search. Blocked targets no longer cause repeated complete searches of the same area.
- Idle pose rendering is limited to 10 Hz; walking, working and drinking retain animation-frame updates. Constant left/top assignments moved out of the movement loop.
- Approved farmer artwork retained. Pixel analysis confirmed eight distinct frames in all 48 walk/action directional rows. Runtime tests exercise every walking/action frame and all eight direction mappings.
- Existing fixed-soil, crop-centre and placement tests continue to pass for all plot sizes. HD full-screen workshop artwork is reused for the new screens.
- Narrow layouts retain 44 px actions, an internal scrolling body, compact headers and collapsible secondary explanations.

## Verification

- Full local regression suite and mandatory pre-push runtime-version checks.
- Live recovery: guest conversion preserves ID; key setup requires password; wrong key fails; reset consumes key; old password fails; new password opens original account.
- Live friends: farm private before acceptance; recipient accepts request; friend reads farm; useful watering applies once; repeated event is idempotent; one acknowledgment contributes once to a shared landmark. Ephemeral friend-test profiles are removed afterwards.
- Economy arithmetic audit: ordinary 250-gold start, eight crops, seventeen recipes, twenty requests; every tested recipe has a positive processing margin and every request pays above the raw basket value. This is a deterministic arithmetic audit, not a completed human retention or pacing study. Level gates, care time and user interaction time require continued playtesting.
- Existing test purchases, ad previews, Premium suppression, account entitlements and exact-once receipts remain covered. User explicitly chose to keep real payments and ads disabled. Store billing, real ad networks and production subscription operation remain deferred.

Five new ElevenLabs guides use Hope/Noah/Mike for Farmer Jade/Farmer Rhys/Farmer Jay. Build 151's Jade guide supersedes the three-focus build 150 guide while keeping the older audio available for older clients.

Build 152 folds focus instructions behind an expand arrow, shows the remaining focus-change wait, and keeps scroll position while claiming milestones or upgrading a focus. A 390 × 844 browser check confirmed no horizontal content overflow and 44 px header actions.

Build 153 moves the current farm into the focus header and exposes detailed rules through a 44 px help control. The permanent introductory panel is removed, so landscape phones show upgrade choices immediately. The final 390 px header and content have no horizontal overflow.
