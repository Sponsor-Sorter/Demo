# Family well expansion — build 124

Existing stages 1–4 retain their prices and benefits. Four additional gold upgrades unlock as the farm levels up:

| New stage | Player level | Gold | Jobs per farmer | Drink seconds |
| --- | --- | --- | --- | --- |
| Copper | 8 | 1,800 | 16 | 11 |
| Sheltered spring | 12 | 3,600 | 22 | 10 |
| Carved homestead | 18 | 7,200 | 30 | 9 |
| Grand brass | 25 | 14,000 | 40 | 8 |

After all seven gold upgrades, the gem icon beside the well opens four sequential crystal upgrades:

| Crystal stage | Player level | Gems | Jobs per farmer | Drink seconds |
| --- | --- | --- | --- | --- |
| Crystal spring | 25 | 25 | 55 | 7 |
| Sapphire | 28 | 50 | 75 | 6 |
| Royal crystal | 32 | 90 | 100 | 5 |
| Crown spring | 36 | 150 | 140 | 4 |

All eight new sprites are generated transparent WebP assets, 384×520, aligned to the same ground anchor. The map footprint stays unchanged. A new ElevenLabs Farmer Jay guide explains the upgrade paths. Existing replanting controls and helper pause switches remain.

Gem spending uses the existing game-only wallet RPC. The server validates owned well, completed gold tier, saved player level, receipt-derived gem tier, expected tier, wallet balance and idempotency. Insufficient gems opens the shop without purchasing a pack automatically. SQL fixtures roll back, covering all prices, retry, stale tier, ownership, prerequisite, level gate and maximum tier. No new tables or grants are introduced.
