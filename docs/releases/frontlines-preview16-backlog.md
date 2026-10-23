# Frontlines backlog audit

Audited 23 October 2026 against the user requests, current source, preview 10 publication evidence and preview 11 export/check logs. Source implementation, published delivery and human/device acceptance are different statuses.

## Release status

- **Current live:** preview15 browser and APK. All136 served hashes verified, hosted zoom/reset and saved-campaign resume accepted. The slow-frame-rate stale-board regression is fixed. Native15 broad interaction receipt and controlled desktop sparse-mesh performance comparison are preserved in its immutable packet.
- **Preview16 final candidate accepted:** capture destination stays selected for the next attack; compulsory fifth-card and inherited-hand trades restart the same player at placement with no duplicate base income/card award. New faction-base shader and shared meshes, displaced-terrain culling margin and slider endpoint touch padding. Fresh1419 source/server/live-service checks passed. Exact final APK checked on Samsung: one-tap chained attack, earned-fifth trade/deploy/turn completion and8→5→2 inherited trades. Website publication and normal15→16 updater acceptance remain pending. Backendv4 is live, retaining old trade timing for rooms with host_build<=15.

- **Earlier publication:** preview14 browser and Android APK, Pages39906193662; all120 served hashes verified. Stable entry: https://sponsorsorter.com/frontlines/. The owner confirmed physical portrait/landscape rotation on13. Hosted14's30-target stale-board regression was fixed and accepted in15.
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

- [x] Persistent local campaign save/resume: published14,16 source checks and actual process-restart recovery of pending1/24 occupation passed. Network session/reconnect is separate and remains open.
- [ ] Remembered account sessions and robust recovery/reconnect after restart. Tokens currently live only in memory.
- [ ] Human signup, confirmation/recovery links, friend requests and complete multiplayer matches across separate devices.
- [ ] Actual two-phone local QR pairing and a complete local match.
- [ ] Physical portrait/landscape sensor rotation and layout checks on more than the tested Samsung model.
- [ ] Controlled performance and memory measurements on representative lower-end phones and PCs. Existing snapshots are not comparative benchmark results.

## Preview15 cycle — native accepted, publication pending

- Fixes the hosted14 stale-board regression: every due `UPDATE_ONCE` refresh is explicitly re-armed, even when the cached viewport property still reads ONCE. Forced20FPS checks cover consecutive camera moves and pause/resume in both aspects.
- Conservative sparse terrain meshes remove wholly ocean-covered lattice cells with a two-cell coast margin. Desktop397,396 triangles versus1,048,576; mobile115,254 versus262,144. Every territory texel remains covered by both cell triangles, and retained vertex/UV/tangent data match the original lattice. Picking, country masks and elevation remain unchanged.
- Ship canvas now has stitched hems/panel seams, distance-filtered weave and gentle movement pinned at its edges. This is a material polish pass, not replacement AAA ship or army models.
- A same-process PC overview comparison, dense/sparse/sparse/dense with120 frames each, measured26.86/47.70/47.84/26.86FPS. Rendered primitives fell1.94m→1.29m; material settings and view were held fixed. This does not establish equivalent phone gains or broad-device performance.
- Spectators no longer get deployment/turn controls or AI-impersonating diplomacy. Commander statistics/cards and free/action camera remain available. Local saves update their local host-build metadata on resume after an update.
- Fresh cycle checks: geometry10, slow-render/spectator11, save17, gameplay104, mobile844, new interactions26, full dice framing36, card/capital42, features35, audio37, rig21, touch/camera37, pause12, QR12, forms14, quality30:1,288 total, zero failures in final logs. Camera framing adds a small safety inset; the framing test waits for the actual glide after first-use shader compilation.
- Exact final APK SHA256fc59776b16fa1242e24282eda148e2c376185f2a287af911f649448a2e704c48 is installed/hash-matched. Native pan/zoom in Balanced30 and Ultra30, rotation, max/min dice/live roll, occupation1/24 process restart/full24 transfer, forced5→2 card trade, unobstructed physical award, Music50→20→50, text100→140→100, raw-touch quality selection and zero-human Capitals progression into round2 passed. Spectator commander panel has statistics/Close only. Phone is paused with its campaign saved; Balanced30/text100 restored. It uses the existing preview certificate; ADB installation is not an in-app updater journey. Hosted15 publication remains pending.
- Native Ultra samples dropped49→41→40→32→32→32 rootFPS while warming; thermal status at the final receipt was3 after returning to Balanced. Initial Balanced samples50/54/53/45/44/47 are limited observations, not a controlled phone A/B comparison. Keep the lower-power default and continue thermal/performance work.
- Next polish discovered during touch testing: extend slider endpoint hit areas beyond the track, label the pause entry Settings to include all tabs, and check terrain displacement culling at extreme close views.

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

## Preview14 release cycle — published with known30-target defect

- Maximum legal attack dice are selected when choosing an enemy. A raw-touch/mouse slider lowers or raises the legal count.
- Zero human commanders starts six AI players, including automatic Capitals selection. Spectator turn/trade mutations are blocked.
- Commander stat assets are close to card-icon size, with larger numbers below each icon; troop badges and card counts are larger. Settings provide saved100–140% text size.
- Local campaign snapshots write atomically and validate geography, owners and unique cards. Resume restores armies, capitals, cards, pending occupation/trade and camera heading/distance. Network sessions/credentials are excluded.
- Painted terrain mipmaps and measured geographic detail reduce unstable grain; dark water has moving wave fields/coastal foam; cloth/skin/leather/weapon materials differ. A coarse geographic shadow caster replaces repeated dense terrain shadow geometry on desktop.
- A fixed PC sample changed close terrain from49.9 to59.5FPS and6.09m to2.16m rendered primitives. Full-map sample25.8 to27.3FPS. These are view samples, not broad-device guarantees.
- Full dice-motion bounds guide camera framing without changing heading. Card awards use the HUD-safe viewport rather than sitting under commander cards.
- Pause/background stops covered3D viewport redraw; mobile is capped60FPS. Balanced/High/Ultra detail and separate30/60 board motion settings persist; mobile defaults to Balanced30 with a separate native-resolution HUD. Final Samsung Balanced samples reported42–44 rootFPS and thermal1; extended earlier high-detail testing reported thermal3. No universal sustained60FPS claim. Hosted14 later exposed a stale-board bug at the30 target;15 re-arms every due one-shot viewport refresh.
- Native form inputs now handle raw-touch focus and keyboard requests, including password keyboard type, and reflow above the keyboard while scrolling the focused input into view. Native pairing auto-scrolls its entire QR into view after creation/rotation.
- Fresh cycle checks: gameplay104, mobile844, new interactions26, save16, full dice framing36, capital/card interaction42, modes35, audio37, unit animation21, touch/camera37, pause12, QR layout12, raw-touch forms14, quality settings30. Server71/LAN13/SFX provenance21 remain carried evidence from10.
- Phone14 candidate discovery covered settings/text size, mode pickers, zero-human Capitals, combat max/min dice, capture and full-range occupation, real process-restart recovery, forced trades, capital choice, chat bubbles and native host QR. Exact final5378d4cb APK acceptance covers full keyboard/QR visibility, unobstructed card title/art/symbol, min/max attacks and pending occupation restart; see frozen `validation/native-acceptance.json`. Candidate typing/password cases are explicitly separate from final-APK evidence. QR codes are not public release media.
- Remaining coverage: real human signup/recovery/friends, two-phone optical pairing and complete human online matches; other phone hardware and longer controlled thermal/performance runs.

## Actual Android update checkpoint

Installed preview10 detected published11, downloaded the APK, passed in-app size/SHA verification and opened Android Package Installer through FileProvider. Android then requested source-install permission for Frontlines. After the owner replied ready, installed version11 was confirmed, with SHA256 `25a45200068916fcc64999c00b71e95d8710577bed546df8846b60c2915f84dc`, visible menu11 and real manifest log `served=11.0 current=11`. No ADB installation substituted for the updater. Proof: `D:/Chat Gpt/workspaces/frontlines-build/android-qa/build10-update-download.png`.

## Hosted11 acceptance

Website observed `FRONTLINES_UPDATE_CHECK served=11.0 current=11` on startup, with no captured warnings/errors. During Solar Union attack in round 1, all six army totals stayed 13/15/14/17/16/14 across 52.4 seconds paused. Resuming continued combat, Solar 15-to-14 and Eastern Australia 3-to-2. This is visible hosted acceptance, separate from the 9 source pause assertions.

## Preview12 release candidate

User-requested fixes: one square900px reference canvas with EXPAND (instead of rewriting the stretch aspect on every rotation), physical/virtual resize reconciliation, activity-only sensor orientation, raw-touch audio sliders, action-camera translation preserving heading/tilt, minimum zoom distance2.0 (was3.4), stationary capital flag bearer separate from the fighting army, camera-relative card award with clear label/art layering, and original plus three actual-reference music tracks with smooth transitions and next-track control.

Fresh source checks:154 gameplay,858 mobile,35 features,37 touch/camera,29 focused interactions and37 audio/music passed. APK exports and certificate/CRC verification passed. Phone12 rotation/fullscreen acceptance remains pending: user asked to check through the phone's actual auto-update after publication. A prepublication ADB attempt failed when USB went offline; no12 install is claimed. Preview11's actual update acceptance remains separate.

Three45sec tracks were generated with the actual approved menu MP3 attached as reference. Original hash unchanged;2025 existing credits used,279 remain, no purchases. New tracks balanced against measured original loudness. Subjective music approval remains a user review.

After this release, the requested graphics pass should prioritize close-zoom terrain/material clarity, more convincing dark water, physically readable pieces and battle effects. These quality goals remain open; the release does not establish AAA visual parity.

## Preview13 fullscreen repair

The user clarified that menu artwork was visible outside the inset match viewport. Preview13 removes menu background drawing during matches and renders the3D scene over the full canvas under the floating HUD. HUD placement uses a separate play rectangle, with camera-control/portrait overlap assertions. Action framing avoids HUD regions. Portrait3D rendering has a1.6MP budget; HUD stays independently sharp. Audio slider mouse-wheel gain changes are disabled.

Final13 APK was installed by ADB at the user's request to repair the connected test phone; exact installed SHA matches final export. Actual menu and match launch passed. Native raw-touch Music50-to18 worked and was restored50. Android WindowManager-driven portrait1440×3088 / landscape3088×1440 / portrait transitions filled the display and kept the campaign, with original free/default settings restored. A separate physical-sensor hand rotation is not claimed. This is not a new in-app update acceptance.

Fresh final13 checks:111 gameplay (17-round AI victory, stable873 nodes),854 mobile,41 focused interactions,37 touch/camera and37 audio/music.35 unchanged feature checks carried from12; older pause/server/LAN/unit/provenance evidence remains explicitly carried. Source/export/installed acceptance records are separate. Native acceptance: `D:/Chat Gpt/workspaces/frontlines-build/android-qa/build13-native-acceptance.json`.
