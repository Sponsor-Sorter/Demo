# Meadow Markets remaining work

Last reconciled for build184. Release receipts are in meadow-market-build172 through183.md.

| Area | Status | Next concrete action |
|---|---|---|
| Paddock artwork | Published172 | Preserve HDillustrated physical views |
| Coop artwork/grid/hens | Published178 | Preserve exact ground/perimeter and directional hen tests |
| Brown notification position | Published175 | Directly below farm title |
| Game account logout/token isolation | Published173/175 | Existing farm/session preserved through native8→9; logout edge cases covered by fixtures |
| Native APK updater | Accepted24Oct on Samsung | Actual8→9 in-game download, permission, Android install and saved-farm relaunch passed; see native9 acceptance note |
| Cloud-save stale writes | Published179 | Live client confirmed; server revisions and retry receipts verified |
| Offline helper catch-up | Implemented180 | Up to three ready jobs per assigned worker, saved cursor, real replant times |
| Cross-map automation | Existing foreground loop | Long-session fairness and bounded scheduling audit |
| Heavy-farm performance | Improved180/181 | Flower lists shared per pass; mature crop ticks skip repeat plant writes; native frame-time profile remains |
| High-level pacing | Existing150/151 arithmetic | Check worker/upgrade/recipe paths and expose useful next work |
| Server resource validation | Bounds strengthened24Oct | All protocol2 write paths reject invalid gold/inventory; earned quantities still need a server ledger |
| Server game scores | Issued/validated184 | One-use rounds, action/path checks, server clock, verified-only ranked prizes; human input/bot resistance and farm ledger remain |
| Story and recovery | Updated184 | Eleven compact chapters retain 35 goals; recovery reservation prevents races and consumes keys after successful Auth writes |
| Documentation | Reconciled184 | See meadow-market-maintenance.md for actual guarantees, limits and release process |
| Free purchases/ad previews | Audited183 | Seven pack checkouts, Premium, rewarded preview, receipt replay protection and opt-in passed; keep free while testing |
| Play Billing/AdMob | Not integrated | Configure products, server purchase verification, licence testers and test ad units before real monetization |
| Local storage failures | Fixed183 | Cloud scheduling and responsive controls survive a failed device save; physical storage-pressure test remains |
| Friend visiting/help | Browser accepted183 | Invitation, acceptance, live visit, feed and delivered visitor log passed with two test farms |

Phone handling: do not interrupt owner input or another test slot. A successful native build is not a device acceptance receipt.
