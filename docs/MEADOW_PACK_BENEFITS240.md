# Harvest Fair pack benefits — build 240

The three existing A$0.99 non-consumable products now include their permanent decoration, 20 gems and three manually activated boosters. Welcome Garden adds 5% crop-growth speed while placed; Coop Charm adds 5% egg-production speed; Market Makeover adds 5% farm-shop sale income. Each placement bonus applies once on its farm. Each booster adds 25% to its corresponding rate for fifteen wall-clock minutes on the chosen farm, including time away. Placement plus booster is 30%; repeated activation on the same farm/kind is rejected until expiry. Mini-game scoring and reward verification are unchanged.

Private per-entitlement grants backfill currently owned verified purchases and approved free-test packs once. New purchases credit product gems through the existing verified delivery; the backfill only credits missing gems. Restores, repeated callbacks and free-test repeats do not grant duplicates. Refunds retain purchase history, revoke unused charges and close active effects. Provider tokens/sources are never returned to players. Snapshot writes cannot alter paid boost state.

The shared reducer integrates actual time intervals, rather than applying the current multiplier to an entire past cycle. Transfers, storage, rotations, expiry and offline sales retain their proper timing. Shop income carries fractional gold between sales. Expired intervals are discarded only when no unfinished productive cycle needs them. The browser only displays effects; activation and quantities are committed by the online farm gateway.

Focused acceptance before publication:

- Six new timing/inventory suites passed: activation/charge exhaustion, same-kind rejection, reload, map scope, exact expiry, mid-cycle crops, placement/storage/transfers, chicken-only production and care, offline/fractional shop sales, revocation and score preservation.
- Existing story, farm-action, worker, gateway, billing, command/UI, commerce, performance, navigation, build and refund checks passed in the focused run. Full publication CI remains the release gate.
- Both transactional database fixture files passed and rolled back. They check all three products, purchase/account/replay protection, refund cleanup and retained history; old-owner gems/boosters once, private grants and forged snapshot rejection.
- Migration `20261112120613_meadow_pack_benefits240.sql` applied. Farm gateway 52 is JWT-protected; all eight read-back files match the reviewed package. Existing refunded Coop Charm was excluded from the automatic backfill. No new native binary is required for these existing product IDs.
- Local full-game browser acceptance confirmed the placed-item bonus, complete pack contents and an authoritative Welcome Garden activation on test_browser: one charge used, two retained, fifteen-minute active window. Portrait geometry is full-screen with a scrollable controls area; landscape shows art and controls side by side.

Publication/live/native acceptance and the final Google product-description state are recorded after those checks. No new artwork or narration is required: original approved pack art is reused, and these secondary controls use concise text plus the existing reward effect.
