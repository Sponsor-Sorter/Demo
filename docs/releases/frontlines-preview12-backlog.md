# Frontlines backlog audit

Audited 23 October 2026 against the user requests, current source, preview 10 publication evidence and preview 11 export/check logs. Source implementation, published delivery and human/device acceptance are different statuses.

## Release status

- **Published:** preview 11 browser and Android APK (Pages deployment and72 served-file hashes verified; hosted manifest/pause checks passed). Stable entry: https://sponsorsorter.com/frontlines/.
- **Released fixes:** preview 11. Fixes solo pause advancing AI behind the menu and browser HTTP responses being decompressed twice. Actual installed10-to11 update accepted: offer, download, verification and installer handoff observed; owner completed Android permission/install. Installed version11, exact APK hash and menu launch confirmed afterward.
- **Known older-build issue:** preview 9/10 browser update polling can fail on compressed responses. Reopening the stable Play link loads the latest build; that is not proof of the in-game updater working.

## Priority 0 — finish the current release

- [x] Published preview11 browser and Android: all72 delivered file hashes passed, including19 current site files and48 preserved older-build files. Correct APK MIME verified.
- [x] Hosted11 parsed the real manifest without captured gzip errors. AI pause held the turn and six army totals unchanged for 52.4 seconds; resuming continued combat.
- [x] Actual installed10-to11 update accepted. No ADB installation substituted; exact installed APK hash matches published11, visible menu version11 and real manifest check confirmed after owner completed permission/install.
- [x] Actual update acceptance results are recorded separately from source regression results.

## Requested features already implemented

| Area | Present in preview 10 | Acceptance / remaining work |
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
| Releases | Version text, immutable browser builds, APK manifests, download hash checks, deferred update offer | Actual native10-to11 update accepted after owner permission/install; older browser polling defect fixed in11 |

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
- [ ] Native UHD painted board assets. Current painted raster is 1774×887; separate 5400px geographic detail and 4K rendering do not make that painted image native UHD.
- [ ] Further infantry/cavalry/artillery model, skin and animation polish; better attack/reload/contact choreography.
- [ ] Further dice rolling/contact and finish polish at close zoom, followed by user visual approval.
- [ ] Further approved UI readability/art consistency review on actual small screens.
- [ ] Final sound listening review and tuning on phone speakers/headphones; technical acceptance does not establish that the replacement sounds are liked.
- [ ] Paid dice skin storefront and owned-skin entitlements. Six finishes currently remain free preview choices.

## Evidence and limits

- Preview10 packet: `D:/Chat Gpt/workspaces/frontlines-release/2026-10-23-preview10` (frozen).
- Preview10 publication: `D:/Chat Gpt/workspaces/website-edge-audit/docs/FRONTLINES_PREVIEW10_PUBLICATION.md`.
- Preview11 logs: `D:/Chat Gpt/workspaces/frontlines-build/`: `live11-final.log` (154), `mobile11.log` (858), `features11.log` (35), `pause11-publish.log` (9), `touch-camera11.log` (37). All recorded pass.
- Unchanged preview 10 checks: server71, LAN13, audio runtime25, audio provenance/mix21, unit animation21. These are carried evidence, not freshly rerun preview 11 results.
- Preview11 Android/Web exports complete. Export checks, hosted delivery and actual Android update acceptance are recorded separately.

This audit replaces the stale README claim that online multiplayer is wholly future work. It does not mark the complete backlog done or claim AAA visual quality has been achieved.

## Actual Android update checkpoint

Installed preview10 detected published11, downloaded the APK, passed in-app size/SHA verification and opened Android Package Installer through FileProvider. Android then requested source-install permission for Frontlines. After the owner replied ready, installed version11 was confirmed, with SHA256 `25a45200068916fcc64999c00b71e95d8710577bed546df8846b60c2915f84dc`, visible menu11 and real manifest log `served=11.0 current=11`. No ADB installation substituted for the updater. Proof: `D:/Chat Gpt/workspaces/frontlines-build/android-qa/build10-update-download.png`.

## Hosted11 acceptance

Website observed `FRONTLINES_UPDATE_CHECK served=11.0 current=11` on startup, with no captured warnings/errors. During Solar Union attack in round 1, all six army totals stayed 13/15/14/17/16/14 across 52.4 seconds paused. Resuming continued combat, Solar 15-to-14 and Eastern Australia 3-to-2. This is visible hosted acceptance, separate from the 9 source pause assertions.

## Preview12 release candidate

User-requested fixes: one square900px reference canvas with EXPAND (instead of rewriting the stretch aspect on every rotation), physical/virtual resize reconciliation, activity-only sensor orientation, raw-touch audio sliders, action-camera translation preserving heading/tilt, minimum zoom distance2.0 (was3.4), stationary capital flag bearer separate from the fighting army, camera-relative card award with clear label/art layering, and original plus three actual-reference music tracks with smooth transitions and next-track control.

Fresh source checks:154 gameplay,858 mobile,35 features,37 touch/camera,29 focused interactions and37 audio/music passed. APK exports and certificate/CRC verification passed. Phone12 rotation/fullscreen acceptance remains pending: user asked to check through the phone's actual auto-update after publication. A prepublication ADB attempt failed when USB went offline; no12 install is claimed. Preview11's actual update acceptance remains separate.

Three45sec tracks were generated with the actual approved menu MP3 attached as reference. Original hash unchanged;2025 existing credits used,279 remain, no purchases. New tracks balanced against measured original loudness. Subjective music approval remains a user review.

After this release, the requested graphics pass should prioritize close-zoom terrain/material clarity, more convincing dark water, physically readable pieces and battle effects. These quality goals remain open; the release does not establish AAA visual parity.
