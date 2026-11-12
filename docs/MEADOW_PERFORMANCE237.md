# Meadow Markets performance 237

Emporium refresh previously downloaded up to 5,000 historical economy receipts and repeatedly searched the local applied-ID list. It now receives a small own-account summary with status. Full receipt history stays on the server; authoritative farm delivery handles pending rewards. Older backends retain the existing recovery path, using a Set for applied IDs. Concurrent refreshes coalesce only within the same account. UTC-day VIP claims and verified Premium responses retain their existing authority.

Uncertain quiet worker ticks, worker returns and shop checks retry the exact durable request at most twice, with 250/750 ms delays and a three-second timeout per retry. Manual, paid and mixed commands keep explicit recovery. Account/map/screen changes, hidden/offline state, control blocks, access denials and conflicts stop automatic retries. Exhausted requests remain saved for recovery.

## Evidence

- Actual-source synthetic refresh profile, five refreshes with 5,000 already-applied receipts: five history reads and approximately 28.8 MB of serialized history before; zero history reads after. Median VM work changed from 29.58 ms to 0.012 ms. These are synthetic CPU/payload measurements, not measured mobile network latency; a production PostgREST row cap may limit a single response.
- Focused performance, command client/UI, Premium, club navigation, billing and commerce checks pass. Six isolated SQL fixture groups pass, including 5,002 retained rows, pending markers, VIP/account isolation and anonymous/deletion denial.
- Installed migration `20261112010210_meadow_club_receipt_summary237`; original wrapper hash preflight passed. Real authenticated database status, delivery markers and VIP owner isolation passed in a rollback-only fixture; subsequent fixture user/receipt counts are zero. No purchase/receipt history was deleted.
- Existing security-advisor findings are unchanged; no finding names the new helper. All eleven installed control236 source/ACL checks remain accepted. No commerce, control or advertising gates changed.
- Farm Edge 47 has JWT verification enabled and all eight files match read-back. Package SHA-256: `b0895b24a0b4490f1561b50402419d2b5fd8ccd5e860e04269f0cbab343df7fe`. Generated rules changed only their source fingerprint; farming arithmetic is unchanged.

Publication CI, live browser acceptance and Play-native15 acceptance are pending at this source checkpoint. Native15 keeps the already-prepared Play chooser and optimized shrinking changes; it must be installed through Play in place over native14 so the farm and signing identity are preserved. It is not a public native release yet.
