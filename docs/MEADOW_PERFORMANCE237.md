# Meadow Markets performance 237

Latest acceptance, 12 November 2026: Play code 15 is uploaded, available to Internal testers and accepted on the Samsung through an in-place Play update. Browser control recovered and live build 237 was checked interactively. See [native acceptance](MEADOW_NATIVE175_ACCEPTANCE237.md); it supersedes the earlier pending-device/helper observations below.

Emporium refresh previously downloaded up to 5,000 historical economy receipts and repeatedly searched the local applied-ID list. It now receives a small own-account summary with status. Full receipt history stays on the server; authoritative farm delivery handles pending rewards. Older backends retain the existing recovery path, using a Set for applied IDs. Concurrent refreshes coalesce only within the same account. UTC-day VIP claims and verified Premium responses retain their existing authority.

Uncertain quiet worker ticks, worker returns and shop checks retry the exact durable request at most twice, with 250/750 ms delays and a three-second timeout per retry. Manual, paid and mixed commands keep explicit recovery. Account/map/screen changes, hidden/offline state, control blocks, access denials and conflicts stop automatic retries. Exhausted requests remain saved for recovery.

## Evidence

- Actual-source synthetic refresh profile, five refreshes with 5,000 already-applied receipts: five history reads and approximately 28.8 MB of serialized history before; zero history reads after. Median VM work changed from 29.58 ms to 0.012 ms. These are synthetic CPU/payload measurements, not measured mobile network latency; a production PostgREST row cap may limit a single response.
- Focused performance, command client/UI, Premium, club navigation, billing and commerce checks pass. Six isolated SQL fixture groups pass, including 5,002 retained rows, pending markers, VIP/account isolation and anonymous/deletion denial.
- Installed migration `20261112010210_meadow_club_receipt_summary237`; original wrapper hash preflight passed. Real authenticated database status, delivery markers and VIP owner isolation passed in a rollback-only fixture; subsequent fixture user/receipt counts are zero. No purchase/receipt history was deleted.
- Existing security-advisor findings are unchanged; no finding names the new helper. All eleven installed control236 source/ACL checks remain accepted. No commerce, control or advertising gates changed.
- Farm Edge 47 has JWT verification enabled and all eight files match read-back. Package SHA-256: `b0895b24a0b4490f1561b50402419d2b5fd8ccd5e860e04269f0cbab343df7fe`. Generated rules changed only their source fingerprint; farming arithmetic is unchanged.

## Publication acceptance — 12 November 2026

PR8 merged as `456bf969c01a73c4cd6fd0c4583f30d483e7858e`. Both PR CI43132627313 and main CI43133449822 passed game and Android jobs. The first CI attempt caught an old offline launch entry; it was corrected before merging. The exact precached navigation fallback now matches build237. Pages43133449116 succeeded; the live release reports237 and all seven changed runtime files match tested source bytes. The live game URL was opened through the app panel.

Interactive browser acceptance remains unperformed: both CUA and Windows node_repl fail before executing JavaScript with `failed to write kernel assets ... path not found`, including after kernel resets. Static live-byte verification and actual-source tests are not a substitute for a real browser interaction check.

The signed Play1.7.5/code15 bundle is6,664,523bytes (code14 was6,751,251bytes, about1.3% larger relative to15). SHA-256: `80ed937b76e6a2e8ed8c063c2723ba1a223194888521bd563af56c483a8f5a31`. The local optimized bundle and CI optimized bundle both retain all four plugins/thirteen annotated bridge methods. Signing verification passes. Native15 keeps the already-prepared Play chooser and optimized shrinking changes.

Play Internal upload and native15 physical acceptance are still pending. The concrete upload bundle is `D:/Chat Gpt/workspaces/meadow-production194-evidence/meadow-markets-1.7.5-internal.aab`; the owner received the Internal-testing upload step because browser control is unavailable. The installed Samsung remains Play1.7.4/code14, with a different signing certificate from the upload key. Do not sideload this signing identity over it or uninstall the preserved farm. Update it in place through Play.

Limited preflight on native14/web234 opened the existing level69/VIP2 farm and its Emporium. Phone input stopped when Littles resumed; its own chat confirms active subscription testing. No native15, web237 phone acceptance, new ad impression, purchase or refund is claimed. Next physical checks: Play14→15 update, retained identity/farm, live237 update, Emporium/VIP/mission refresh, worker recovery, pan/pinch/build scrolling, portrait/landscape, offline/resume and Play chooser target.

Detailed local evidence is under `D:/Chat Gpt/workspaces/meadow-production194-evidence/performance237/`: synthetic before/after profile, isolated SQL result, native15 preflight and seven-file live hash receipt. The auxiliary whole-repository size probe was stopped before completion; its partial totals are not a complete hosting-size profile.
