# Meadow Markets native commerce acceptance — 7 November 2026

Web227 is live. Samsung SM-S908E / Android14 retains the Google Play installation, native1.7.2/code12. Google Play Production shows Active / Available in Australia. A fresh AdMob Apps read now shows Meadow Markets / com.meadowandmarket.game **Ready / Ad serving enabled**; this supersedes the earlier Getting ready observation.

Public backend payments, ads and production_ready remain false; all seven backend product flags and general new-farm issuance remain off. No real-money order was placed. Native1.7.2 remains designated Test mode in AdMob. Approval does not automatically activate customer monetisation.

## Actual Google Play tests

All checkout views explicitly identified free Google test orders. The owner authorized only $0 orders and their pending/restore/refund tests.

| Case | Observed result |
|---|---|
| Pending Pocket Gems | Slow approving test card; wallet stayed610 while pending, with no receipt or credit. |
| Restart recovery | Game force-stopped while pending. On relaunch, automatic owned-purchase recovery delivered100 gems once,610→710. A second restart retained710 without duplicate delivery. This does not claim a deliberately lost verifier HTTP response or the precise provider approval instant while closed. |
| Consumed/declined owned query | Native Restore returned “No unfinished purchases on this Play account.” This also closes the final owned-query check for the older delayed-decline attempt, which never granted a reward. |
| Lifetime Premium | Always-approving Google test instrument; Payment successful, verified settled receipt and Premiumtrue. No Play Points enrollment. |
| Wrong-farm Restore | Same Google account, game switched to test_browser. Restore showed “This purchase belongs to another farm. Sign into the farm that bought it.” Browser farm remained610gems/Premiumfalse; both receipts retained test_phone ownership. |
| Refund and revoke | Official Google refunds for both new test orders returned204 at09:41:50–51UTC. Authenticated RTDN revoked both within about two seconds.100purchase gems and Premium were reversed once; legitimate signed ad rewards remained. |

Final server wallet for test_phone:620gems,5reward tickets,Premiumfalse. Browser test farm:610gems,1ticket,Premiumfalse. No balance was manually edited to achieve these results. All six historical Google test orders are revoked, no real orders and no overdue unsettled receipts.

## Actual advertising and offline tests

Two native SDK views visibly marked Test Ad produced two signed SSV transactions, at09:21:41 and09:22:52UTC, delivering +5gems/+1ticket each exactly once. They are not in-game preview grants.

The served creatives granted rewards after a short countdown. An immediate Back attempt on the second creative was ignored until the reward had completed. Therefore genuine early-close/no-reward remains unobserved; do not mark it passed or repeat the same immediately rewarding creative endlessly. Provider no-fill, an actually displayed regional consent rejection flow and physical Premium/frequency suppression are also not claimed from callback fixtures. The current restricted-ad configuration produced no consent-choice form.

Actual Wi-Fi-off interaction on226 exposed weak feedback. Build227 makes shop refresh reject offline before checkout, Restore or rewarded preview/SDK entry, with “Connect online for purchases and ad rewards. You can keep exploring your farm.” The focused fixture verifies no native checkout/restore call while offline and normal recovery after reconnect. Samsung227 purchase and reward taps showed the immediate explanation; no reward was added. Wi-Fi was restored in finally, original airplane/rotation settings retained. This is offline entry rejection, not a provider No Fill response or fully offline gameplay.

The Samsung accepted the actual226→227 Install update prompt and Settings showed Game build227, retaining the current farm/account. It was then signed back into test_phone, retaining level66/VIP2 and its dense Homestead Back Pasture; the browser remains on the separate test_browser farm. A stale old-farm action was resolved through Load latest online farm before repeating sign-in. Post-refund native Restore showed “No unfinished purchases on this Play account,” with620gems/5tickets unchanged. The browser independently opened227 and Settings confirmed it. No new APK was required for this content update.

## Release verification

Runtime publication commits:1e37827cf535a50f2cc3f237eaa03ea37114c971 and7fd849ba16ea7e87aea070623c18e9ecb6d3754e. Final regression/native CI42360522367 and Pages42360522499 passed. Seven public runtime files match committed Git bytes. The initial runtime CI found the generated rules fingerprint stale; the follow-up changes only RULES_HASH and the final CI passed. Gameplay rules and deployed backend behavior are unchanged by that fingerprint refresh.

Focused commerce, billing, advertising, version and precache checks passed; precache verifies1392asset fingerprints. Existing complete CI includes both Android variants. No fresh audio is required for this short network-status message.

Temporary Play/ad acceptance leases were explicitly expired. A fresh subsequent transaction confirmed0active leases, both effective test predicates false and0review holds for the exact QA phone account. Only its fully revoked test-only refund hold was released. No other player/app access, balance or settings changed. General database backup work remains stopped at the owner's instruction.

Sanitized evidence: D:/Chat Gpt/workspaces/meadow-production194-evidence/native226. Key files:pending-current.png,auto-recovery-result.png,restore-empty.png,wrong-farm-result.png,premium-after-purchase.png,refund-results.json,settings227.png,offline227-feedback.png,offline227-ad-feedback.png,admob172-test-on.png,admob-ready227.png,browser227.png,phone-current227.png,refund-restore-feedback227.png. Private order IDs/credentials remain outside Git and are omitted here.

## Remaining commercial activation work

1. Finish reviewed server-farm progression/worker canaries and staged issuance/conversion. Existing beta wealth is not verified acquisition history; do not bypass provenance checks or mass-convert it.
2. Finish genuinely observed ad interruption/no-fill and applicable consent/Premium/frequency checks. Maintain SDK callback fixtures as separate evidence.
3. Review the commercial native/test-device configuration, verify effective registered-farm eligibility and localized offers, then activate customer checkout and ad issuance separately. Keep original paid receipt settlement, Restore and signed callbacks running if new sales are closed.

Google Play and AdMob approval are complete. These remaining implementation/acceptance gates, rather than another Google review, keep public monetisation off.
