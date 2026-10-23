# Frontlines backlog audit

Audited 23 October 2026 against the user requests, current source, preview10 publication evidence and preview11 export/check logs. Source implementation, published delivery and human/device acceptance are different statuses.

## Release status

- **Published:** preview10 browser and Android APK. Stable entry: https://sponsorsorter.com/frontlines/.
- **Ready for release:** preview11 exports. Fixes solo pause advancing AI behind the menu and browser HTTP responses being decompressed twice. Publication and real installed10-to11 update acceptance remain open.
- **Known older-build issue:** preview9/10 browser update polling can fail on compressed responses. Reopening the stable Play link loads the latest build; that is not proof of the in-game updater working.

## Priority 0 — finish the current release

- [ ] Publish the frozen preview11 packet for browser and Android; verify served manifests, APK and Web bytes.
- [ ] Confirm preview11 hosted browser parses the real release manifest without gzip errors and solo pause freezes turn/AI progress.
- [ ] Exercise the actual installed10-to11 Android download, hash verification, Android installer and resulting version. ADB installation does not count. Any Android source-install permission remains an owner action.
- [ ] Keep actual update acceptance results separate from source regression results.

## Requested features already implemented

| Area | Present in preview10 | Acceptance / remaining work |
| --- | --- | --- |
| Classic rules and cards | Reinforce/attack/fortify, capture-earned end-turn card, inherited elimination cards, forced trades, troop transfer slider | Automated gameplay checks include these flows; balance needs more playtesting |
| World board | Geographic 42-territory world, terrain relief, shared boundary data, hold/release outer bonus highlight | Further visual parity with the approved menu reference remains open |
| Camera | Orbit, closer zoom, reset, optional action-follow flights, manual flight cancellation | Phone and rendered regression coverage exists; continue checking actual multiplayer action framing |
| Cards and dice | Approved artwork on physical card stacks; on-board animated dice; six selectable finishes | Store/payment/ownership system absent; animation quality still below the user's target |
| Units | Infantry/cavalry/artillery formations and supplied rig animation, faction colors | Original low-polygon geometry and inferred missing skins remain; not newly authored AAA models |
| HUD | Responsive landscape/portrait layouts, commander portraits and stat/card icons, approved themed dialogs | Samsung raw-touch picker regression fixed; broader phones and subjective readability review remain |
| Audio | 18 new ElevenLabs cues mapped, continuous approved music, master/music/interface/battle controls | Technical mix/provenance checked; user listening approval and further sound polish remain open |
| Modes | Domination, Capitals, fixed/progressive/exponential card values, pre-game settings | Hosted three-player mode checks exist; wider playtesting remains |
| Alliances and chat | Preset table/private messages, pacts, attack/defend player/territory planning, portrait bubbles | Privacy and local AI plan checks exist; human multiplayer UX review remains |
| Local Wi-Fi | Host/join, dual offer/reply QR, direct WebRTC | Real cross-phone optical QR acceptance still pending; native uses external scanner/paste fallback |
| Online | Account forms, room search, private codes, friends and joining, authoritative rules/results | Normal human confirmation/recovery email and friends flows need acceptance |
| Standings | Separate local records and server online standings; wins, defeats, kills, unit losses, fastest win | Server-computed test results validated; ongoing production playtesting needed |
| Releases | Version text, immutable browser builds, APK manifests, download hash checks, deferred update offer | Actual native installer/update acceptance still pending; older browser polling defect fixed in11 source |

## Priority 1 — unfinished reliability / device acceptance

- [ ] Persistent campaign save/resume. Closing the process currently loses a solo campaign.
- [ ] Remembered account sessions and robust recovery/reconnect after restart. Tokens currently live only in memory.
- [ ] Human signup, confirmation/recovery links, friend requests and complete multiplayer matches across separate devices.
- [ ] Actual two-phone local QR pairing and a complete local match.
- [ ] Physical portrait/landscape sensor rotation and layout checks on more than the tested Samsung model.
- [ ] Controlled performance and memory measurements on representative lower-end phones and PCs. Existing snapshots are not comparative benchmark results.

## Priority 2 — requested content / visual quality still unfinished

- [ ] Pangea board and fantasy boards, with their own territory adjacency, bonus geometry, anchors, picking and phone readability. Only the classic world is currently playable.
- [ ] Closer visual match between playable board and approved war-table menu: terrain materials/relief, dark water, ships and chart artwork.
- [ ] Native UHD painted board assets. Current painted raster is1774×887; separate5400px geographic detail and4K rendering do not make that painted image native UHD.
- [ ] Further infantry/cavalry/artillery model, skin and animation polish; better attack/reload/contact choreography.
- [ ] Further dice rolling/contact and finish polish at close zoom, followed by user visual approval.
- [ ] Further approved UI readability/art consistency review on actual small screens.
- [ ] Final sound listening review and tuning on phone speakers/headphones; technical acceptance does not establish that the replacement sounds are liked.
- [ ] Paid dice skin storefront and owned-skin entitlements. Six finishes currently remain free preview choices.

## Evidence and limits

- Preview10 packet: `D:/Chat Gpt/workspaces/frontlines-release/2026-10-23-preview10` (frozen).
- Preview10 publication: `D:/Chat Gpt/workspaces/website-edge-audit/docs/FRONTLINES_PREVIEW10_PUBLICATION.md`.
- Preview11 logs: `D:/Chat Gpt/workspaces/frontlines-build/`: `live11-final.log` (154), `mobile11.log` (858), `features11.log` (35), `pause11-publish.log` (9), `touch-camera11.log` (37). All recorded pass.
- Unchanged preview10 checks: server71, LAN13, audio runtime25, audio provenance/mix21, unit animation21. These are carried evidence, not freshly rerun preview11 results.
- Preview11 Android/Web exports complete. A successful export is not a publication or real update acceptance result.

This audit replaces the stale README claim that online multiplayer is wholly future work. It does not mark the complete backlog done or claim AAA visual quality has been achieved.
