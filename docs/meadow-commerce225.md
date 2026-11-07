# Meadow Markets commerce225

## 7 November 2026 — web227, native commerce tests and AdMob approved

Google Play1.7.2/code12 is available in Australia. AdMob now shows Meadow Markets **Ready / Ad serving enabled**. Web227 is live; final regression/native CI42360522367 and Pages42360522499 passed, with seven public files matching Git. Samsung accepted the226→227 update and Settings confirmed227; browser227 was checked independently.

Actual  Google tests passed pending-no-credit, automatic recovery after app termination, restart idempotency, lifetime Premium, wrong-farm native Restore and two refunds followed by authenticated RTDN reversals. Two actual Test Ad views produced signed SSV rewards. Final phone wallet620gems/5tickets/Premiumfalse; no real orders, overdue unsettled receipts or active provider leases. Build227 fixes immediate offline purchase/reward guidance, confirmed on the Samsung.

Public commerce/ads/products and general new-farm issuance remain off. Remaining activation work is reviewed server-farm progression/worker rollout, genuine ad interruption/no-fill and applicable consent/Premium/frequency device checks, then reviewed commercial configuration and staged switch activation. Approval is no longer a pending gate. Full evidence and precise limits: [native227](meadow-native227.md). Earlier entries below are historical.

7 November 2026, Australia/Sydney. This prepares commerce; it does not activate public charges or ad revenue.

Web226 includes these225 changes and explicitly preserves lastPopupAt in the existing account-scoped device-preference store. The final command-UI check verifies that popup cooldown survives canonical replies and reload without being treated as a resource mutation. Native remains1.7.2/code12. Backend migration20261107082228_meadow_ad_reward_day226 also bounds the reward count to the nonce’s exact UTC day. A rollback fixture reproduced the old rejection after three new-day rewards, then passed with the fix before and after deployment. Previously issued signed callbacks can settle across midnight without consuming the next day’s limit.

## Google configuration

All seven existing Play one-time products now have an ACTIVE backwards-compatible buy option. Five existing drafts were activated through Console; Pocket Gems and Premium were already active for license testing. Google's authenticated catalogue API independently returned seven ACTIVE options, Australia available, with the unchanged AUD reference prices: Pocket Gems2.99, Gem Chest12.99, Starter4.99, Builder9.99, Tickets1.99, Pantry3.99 and lifetime Premium9.99. Clients still display Google's localized prices rather than these reference amounts.

Meadow Markets is now linked to its exact public Play package, com.meadowandmarket.game, in AdMob. Google confirmed successful app verification and started the readiness review; the Apps page shows Getting ready / Limited ad serving / Review in progress. The account was already approved. This app-specific review is separate from Play. A fresh final Production → Releases check now shows Active / Available on Google Play for1.7.2 in Australia, and its public listing opens under Fairplay Gaming. Earlier Changes in review observations are superseded. No new terms, access grants or credentials were created.

Native1.7.2/code12 retains its existing non-revenue AdMob test designation. Public backend payments, ads, production_ready and all seven backend product switches remain false. No customer charge or revenue-ad test occurred. No other app's settings were changed.

## Corrections

- Automatic owned-purchase recovery no longer depends on an open shop, current product prices or free-test status. Registered ownership and server verification remain mandatory; new checkout remains disabled when the shop is closed.
- A foreign/failed purchase in an owned-purchase list no longer prevents later valid purchases from being checked. Successful canonical receipts refresh before a manual error is reported. Automatic failures stay quiet and retries remain bounded.
- In-flight shop configuration is isolated by account and request generation. Old-owner responses cannot open checkout on the next farm. Account changes during canonical wallet refresh cannot save into the new farm.
- Provider errors are translated through an allowlist, including a clear wrong-farm message. Raw provider bodies/tokens never become player messages.
- Optional interstitials recheck the canonical wallet immediately before consent/show, respecting Premium and opt-out. Natural-break popup attempts have a three-minute minimum interval. Rewarded ads remain optional and receive no client currency grant.
- Ad/shop copy distinguishes free preview, native Google test ads, live availability and closed advertising. The generic claim that every ad is a test was removed. Existing test-specific farmer narration stays restricted to its existing test cohort; no new voice clip was required.

## Deployed refund regression

The rollback-only collected-bundle refund fixture exposed a real database constraint regression: origins212 replaced farm_economy_journal_lane_check without preserving server_refund from refund204. Gem-only refunds did not exercise that collected-resource path. The repair retains all six existing/required lanes, including both server_initial and server_refund. Migration20261107080601_meadow_commerce_refund225 is applied with bounded lock/statement timeouts. It changes no saved balances, permissions or commerce switches.

The actual database fixture passed first with the repair inside a rolled-back transaction, then again against the applied migration. It reverses collected gold/items once on legacy and protocol4 farms, journals the original source, restores internal context and keeps client writes denied. A source regression check now requires both lanes in the latest constraint, preventing another later migration from silently removing either.

Older SQL acceptance fixtures were updated to create rollback-only Auth sessions and include session_id, so they test the current enforced session guard rather than bypassing it. No live user's session was created or changed by those fixtures.

## Acceptance and limits

- Full client regression passed on build225. Focused commerce, billing, ad, popup-frequency and refund regressions passed. Seven Deno purchase/signature/notification tests passed.
- Actual current-database rollback fixtures passed scoped license acceptance, ad lane/throttling, collected-bundle refund, and all seven catalogue deliveries. The new fixture independently checks fixed bundle contents, exact totals, replay/ownership, settlement, all seven refunds, no refunded supplies left to collect, three-ad daily limit and already-issued callback settlement after new issuance is closed. All fixture accounts, purchases, grants and switch changes rolled back.
- Post-migration security advisors reported no ERROR and no new permission change. Existing private deny-all INFO and shared Auth warnings remain as previously documented.
- Final backend read: zero real orders, overdue unsettled purchases, enabled products or active provider/ad acceptance leases; public commerce and new-farm issuance off. No backup work resumed.
- Provider SQL/VM tests are not physical Google checkout/ad acceptance. Prior actual2November evidence remains in build223. True interrupted-success/restart, wrong-farm native Restore, final pending-decline owned query, genuine ad early-close/no-reward, no-fill/offline and consent/Premium/frequency device cases remain pending. The owner was asked whether the Samsung is free; it remains untouched without release from Frontlines.

## Activation sequence

1. Finish the remaining native tests using Google free instruments and non-revenue ads on the correct protected farm, then close its scoped test leases.
2. Finish the reviewed general server-farm issuance/conversion rollout. Existing legacy farms must not become paid farms merely by bypassing provenance guards; new_farms remains off. The current two protected test farms do not prove all new-player progression routes.
3. Play approval and the public listing are confirmed; perform the public physical installation check and wait for AdMob app Ready. Preserve test build/device designations while producing/reviewing the commercial native configuration.
4. Enable backend products and customer checkout separately from ad issuance after acceptance. Re-read effective status for a protected registered farm and verify localized prices. Ads also require the player's consent/settings; Premium suppresses optional popups.
5. Keep original paid receipt settlement, Restore and signed callbacks operational if new purchases/ads must be closed. Do not turn on real revenue automatically just because Google approves the app.

Evidence directory: D:/Chat Gpt/workspaces/meadow-production194-evidence/commerce225. Includes sanitized Google catalogue output, AdMob verification screenshot, regression log and operator scripts. Private service credentials remain outside Git.

The actual live225 browser shop opened on the existing approved test farm showing its server wallet of610gems/one ticket and correct free-test copy. No test pack or ad was run in the browser. Final web226 deployment evidence is in the local acceptance record; the native binary is unchanged.

Web226 is live from0f2b4e456eae9a481d2f6e451184f5788615c192. Regression/native CI42355290964 and Pages42355290880 passed. Seven live runtime files match Git bytes. The actual225→226 in-game Install update was accepted; Settings confirms226 and the same level17/VIP1 farm returned. No Samsung input or new provider purchase/ad view is claimed.
