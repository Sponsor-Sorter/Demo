# Meadow Markets build 186 — farm journal and atomic account rewards

## Shipped scope

- A private, owner-scoped farm economy journal records saved gold, XP, level, basket and shop-shelf changes. Shared baskets are counted once. Ordinary farm changes are explicitly `legacy_snapshot`; their recorded amounts are not proof that they were earned.
- Protocol 3 delivers server-owned account receipts inside the same database transaction as the farm save. Delivery rows are unique per receipt. The client stages receipt IDs and no longer directly awards their gold, goods, XP, speed boosts, well licences or queue upgrades.
- Historical deliveries are imported only from the existing server save's acknowledgement list. An incoming client list cannot suppress or replay a server delivery. Existing farms, wallets and progress are retained.
- Save request IDs have durable body hashes and response patches. Lost responses retry the same body. A later farm revision causes a conflict rather than replaying over it. A stale reward cursor cannot silently overwrite a newer delivery.
- Acknowledged effects rebase both the live farm and snapshots queued while a response was missing. Speed projections are tied to the original crop cycle/jobs, so newly started work cannot inherit an older speed purchase. Upgrades use the receipt's actual map.
- Settings has a collapsed **Gold & basket history** entry with the latest 25 account activity records. Restoring a backup retains the current reward cursor and permanent upgrades on matching buildings.
- After a farm enrolls, old/direct save writers cannot downgrade its economy protocol. Other apps and Littles are unchanged. Billing and ads remain free test systems.

## Verification

The full Node regression suite, new projection/retry tests and six existing isolated recovery Edge tests pass locally. `tools/meadow-economy186-check.sql` runs rolled-back assertions against the deployed database: historical import, forged incoming applied list, fixed delivery, shared inventory, target map, XP/level bonus, speed binding, identical retry, changed-body rejection, stale cursor/revision, exact-once journal entries, balance reconstruction, private table permissions and old-writer rejection.

An isolated browser preview used the real service: Builder's bundle changed 313 gold to 3,313 and its wallet to 300 gems/VIP2. This was a free test transaction, not real billing. Production and Samsung acceptance are recorded separately after deployment; code compilation alone is not that proof.

## Remaining production gate

This is **not yet a fully authoritative farm simulation**. Crop timers/harvests, animal care/products, crafting and shop settlements, buildings/upgrades, helper catch-up, story milestones and non-game mission events still originate in client farm actions. Their gold/items are journalled as legacy activity. An edited client or restored legacy snapshot can still falsify that part of the economy. Server receipt delivery does not fix that trust boundary.

Next implementation sequence:

1. Introduce explicit, versioned farm commands with server-held crop/recipe/item/upgrade rules and per-action IDs. Start with sow/water/harvest and server-clock crop cycles; reject snapshots that alter those protected fields after opt-in.
2. Migrate animal product/care rules, crafting inputs/jobs/output, vendor sales and shop shelves/elapsed sales into those atomic commands.
3. Migrate construction, upgrades, worker costs and bounded offline helper replay. Keep cross-map jobs on the same owner serialization lane and use server timestamps, not claimed elapsed time.
4. Make story and mission progress derive from accepted commands, then migrate rewards. Preserve a one-time, explicitly legacy opening balance instead of claiming old progress was verified.
5. Enforce the ledger balance on every save/backup path only after all normal gameplay sources are represented. Test concurrent devices, offline reconciliation and restore safety before enabling real payments.

The owner completed the real recovery steps privately in the live browser. A subsequent normal sign-in with the owner-selected new test password restored the same level5/VIP1 test_browser farm; a metadata-only check showed no active recovery key. The agent did not read the key or perform the credential-change submission. No credentials are stored in the release notes. A fresh recovery key must be saved after a successful reset because each key is single use.
