## Current23 candidate — commander expansion

64 fitted face controls; gender/voice selectors; wider same-height preview and compact left pose selector; joined shoulders/upper arms; improved medal/cord geometry and fitted library plumes; eight preview motions, six in-game custom-commander emotes, nine optional voice sets/48clips and Commander volume. Source and old-art backups remain on D:. Full client QA and native/browser candidate acceptance in progress. Build22 is live and its real21→22 update preserved campaign/profile bytes. See RELEASE23.md for exact scope and remaining art limitations.

# Frontlines backlog audit

## Preview22 material/editor-safety follow-up — candidate in QA

- Preserve the source double-sided hair and brow surfaces using the engine's back-face lighting. Render cache4 regenerates portraits without changing saved recipes.
- Defer update offers while the commander creator is open, protecting unsaved appearance edits.
- Fresh focused creator/fit/gesture/hair/update-deferral/pause/responsive checks accompany the full21 gameplay baseline. Exact22 native/browser acceptance and publication remain pending.

## Preview21 published checkpoint

**Live21:** commit3d333e071bf4f92b4fd361f4235bf84a6b752887 / Pages40080701216 succeeded.31 catalogue/release tests,5 QR tests and268 hosted whole-file SHA/MIME checks passed, preserving builds8–20. Frozen manifest693357cbaf7ee6bd043b276ddac05f3d13f91484eb21828c1cb2e0a91ecb2f9c remains immutable. Native and local/hosted browser acceptance retain their separate scopes.

- Measured head/neck anchoring and deformed skull/neck fit replace fixed accessory coordinates. The coat has sides/back; shoulder details, lapels and medals follow its surface. Hair remains under fitted head coverings. Render cache version3 retains existing recipes.
- Preview: finger drag orbits; two fingers pan/pinch; desktop right/middle drag pans and wheel zooms. Reset View and canonical saved front portrait are checked.
- Shared raw touch scrolling covers account/network, creator, settings, rules, social and option sheets. Vertical slider gestures scroll; horizontal gestures adjust. Text fields focus only on a tap, and a drag cancels button activation.
- Final fresh regression run uses source-identical code in an isolated D: QA data folder, with29 Godot jobs,3 Node jobs and2 exports. The full game/spectator campaigns reach victory; creator fit680, creator/profile91 and touch19 checks pass. Exact-package phone and browser receipts are complete. No new backend/schema/Auth-policy changes.
- Native Samsung Android14 acceptance: orbit/reset; saved canonical front portrait from a side view; face scroll over an off-centre slider without accidental changes; horizontal edit and Undo; account field/button swipes without focus or activation; tap opens keyboard; settings swipe preserves audio preferences; long hairstyle list scroll/select/Undo; save/relaunch keeps the chosen recipe. Existing actual phone campaign stays byte-identical. No fresh native pinch or physical rotation, real-account identity journey, thermal endurance or native game-to-victory claim.
- Remain open: art parity with approved character portraits, richer garment/hair/skin assets, broader devices, physical multitouch/rotation acceptance, verified-account email/cloud-avatar/friends journeys and sustained thermal/graphics work. The prior native swipe-scrolling gap is fixed in the tested21 scope.

Historical release checkpoints follow; their older pending/current labels describe those earlier checkpoints.

## Preview20 historical checkpoint

**Live:** Website commit6cc4a6694449eeeda45d921bd8e919aa9b4ced15 / Pages40072656614 succeeded.29 catalogue/release tests,5 QR checks and248 hosted SHA/MIME checks passed. Builds8–19 remain available. Browser: https://sponsorsorter.com/frontlines/builds/20/ . Android: https://sponsorsorter.com/frontlines/downloads/frontlines-1.0.0-preview-build-20.apk . Frozen manifest21d9c43894a963f2b8d52c00b12451092cbb19c769ed6d9964fc9767bc94765d remains unchanged. Native hand hold and hosted35-second hand hold passed; Close resumed play. Earlier exact-package creator/account/capture checks retain their stated hash scope. The paragraphs below record pre-publication checkpoints.

Post-publication library review found readable1024px army and512px guard textures, plus sampled cavalry death/artillery movement sounds. Nine candidates were staged with SHA verification on D:; no runtime replacements were made. See ASSET_LIBRARY_REVIEW20.md. Native swipe-scroll polish, verified-account email/cloud-avatar acceptance and thermal improvements remain open.

Account touch and session repairs, the 42-morph 3D creator with account-scoped portraits, appearance backend v7 and shared territory-card layout are implemented. Board control icons follow Settings/player-stat assets; the hand control uses three fanned cards and speed is numerical. Fresh final exports and exact-package phone/browser acceptance are in progress. Preview19 remains public until the frozen20 packet is published. See RELEASE20.md for scope and unverified real-account journeys. Gameplay asset-library evaluation is deferred until this release is live, as requested.

Phone follow-ups observed during20 acceptance: account controls/keyboard work and all actions are reachable via scrollbar, but freeform swipe scrolling needs polish. Warm, USB-powered Ultra60 reached Android thermal status3; adaptive protection reduced render scale to65% and actual motion to30FPS. Keep this performance/thermal limitation open. Hand-card view being dismissed by AI turn changes was found during normal native play and repaired by pausing local simulation while covered panels are open; online tables remain authoritative/live.

Audited 23 October 2026 against the user requests, current source, preview 10 publication evidence and preview 11 export/check logs. Source implementation, published delivery and human/device acceptance are different statuses.

## Release status

- **Native18 graphics finding:** exact candidate a649a3a7 installed and resumed the real round2/48-battle campaign. Close zoom/orbit/ownership toggle and reinforcement into cavalry passed. One real attack (Mongolia to Irkutsk) recorded attack[5,3,1] vs defend[5], one attacker loss, no crash. It exposed excessive landscape action-camera distance27.27. Corrected the HUD-safe framing area to the clear space left of the feed;31 checks across throw profiles/headings now frame at11-15.5 while retaining full throw visibility and heading. Candidate a649a3a7 is superseded pending rebuild/phone recheck, not release acceptance. Android rotation settings remain untouched.

- **Preview18 graphics source (24 October):** centred geographic relief normals, filtered rock strata, water wind ripples and broken shore foam. Capital meshes gain recessed windows, gate ironwork, cornices and roof ribs within three merged surfaces. Unit materials distinguish cloth, leather and skin. Supplied original GLBs retained; refined copies use curved subdivision with unchanged original vertices, nodes, skins and animation bytes. Infantry 386 to 1214 triangles, cavalry 714 to 2676, cannon 722 to 1646. Godot 41 checks confirm exact imported animation keys, sampled bone poses and legal skin weights. Unit23, combat83 and quality30 checks pass. Added close-range horse eyes/muzzle/bridle/bit rings/saddle fittings/hooves and human faces, uniform buttons, belts and trim, bound to existing bones; cannon carriages use wood. Fine geometry is cached and distance-limited. Final refinement47, unit23, combat83, quality30 and detail-performance4 checks pass. The42-army overview added zero draw calls for the fine trim (1186 with/without in this PC check); this is not a phone FPS benchmark. This is source work; exports18 remain stale.
- **Preview18 camera source:** framing consumed once per roll; manual camera input cancels automatic motion; replicated selection and delayed capture cannot reacquire the view. Camera18 and touch/framing43 checks passed in both orientations. Combat now retains one actor per participating die, faces actual opponents, uses weapon-attached muzzle flashes/soft smoke, and plays one full death per dice casualty. Animation32, unit23, dice36, pause12 and gameplay111 checks passed. Native acceptance/publication pending.
- **Phone recovery:** the preview18 fixture test left WindowManager rotation locked when interrupted by owner use. The captured rotation settings and private campaign/dice configuration were restored byte-for-byte; verified live17 was reinstalled and shown. Native18 fixture entry is disabled. No18 native acceptance or publication is claimed; phone inputs held while owner reviews/plays.
- **Approved card details source:** approved frame unchanged. Full territory title on ivory, long names wrap, soldier/horse/cannon type and +2 IF OWNED appear on hand/table/earned cards. Trade summary separates reserve award and owned-territory bonuses. Landscape uses more available card space. Details301 and layout26 checks passed; portrait/landscape and physical renders inspected. Rebuild18 required.

- **Current live:** preview17 browser and APK, commit2b45a13b52e9a762faf528f5dab556b96a0076f2 / Pages39961182445. All171 served hashes/MIME checks accepted, preserving8â€“16. Actual16â†’17 in-app download, verification, Android installer/Play Protect scan and installed APK hash passed on Samsung; no ADB install substituted after the update offer. Exact APK SHA256c46603e0d61048346b4a405ebd8331a3d08717bb31b14c96861deee320fdda39. Saved campaign resumed afterward. Separate receipts: `phone17/updater17-acceptance.json` and `phone17/native17-followup.json` under the build evidence folder.
- **Preview18 working build:** fixes discovered during real phone testing: existing local campaigns immediately apply their commander's dice finish; menu selection applies on resume; spectator/online authority remains protected. The card-earned notice clears the battle feed/header in both orientations and at100â€“140% text scale. Desktop eliminated-card badge retains its horizontal alignment. Export and exact-package phone acceptance remain pending.
- **Preview17 delivered:** permanent capital cities/guards; all-six-capital local victory;1Ã—/2Ã—/3Ã— solo/spectator speed; compact70%-transparent feed; larger aspect-preserved terrain-aware dice; portrait playing cards shared with physical cards; next-three portrait turn row; eliminated-card exits; aligned statistics; terrain-following orders and synchronized gunfire. Full rendered-input Capitals match passed; native fixture-driven trade/occupation/chained attack/fortify/elimination/capital/speed/auto-roll/audio-slider/graphics-picker/WM rotation passed. This is not a full human network match or broad-device acceptance.

- **Earlier publication:** preview14 browser and Android APK, Pages39906193662; all120 served hashes verified. Stable entry: https://sponsorsorter.com/frontlines/. The owner confirmed physical portrait/landscape rotation on13. Hosted14's30-target stale-board regression was fixed and accepted in15.
- **Released fixes:** preview 11. Fixes solo pause advancing AI behind the menu and browser HTTP responses being decompressed twice. Actual installed10-to11 update accepted: offer, download, verification and installer handoff observed; owner completed Android permission/install. Installed version11, exact APK hash and menu launch confirmed afterward.
- **Known older-build issue:** preview 9/10 browser update polling can fail on compressed responses. Reopening the stable Play link loads the latest build; that is not proof of the in-game updater working.

## Priority 0 â€” finish the current release

- Preview17 acceptance completed. Hosted new campaign Cobalt attacker/ivory defender render correctly; a resumed campaign kept its original skin after a Settings change. Preview18 addresses local live reskinning. Online skins remain lobby-authoritative, with that limitation explained in Settings.

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

## Priority 1 â€” unfinished reliability / device acceptance

- [x] Persistent local campaign save/resume: published14,16 source checks and actual process-restart recovery of pending1/24 occupation passed. Network session/reconnect is separate and remains open.
- [ ] Remembered account sessions and robust recovery/reconnect after restart. Tokens currently live only in memory.
- [ ] Human signup, confirmation/recovery links, friend requests and complete multiplayer matches across separate devices.
- [ ] Actual two-phone local QR pairing and a complete local match.
- [ ] Physical portrait/landscape sensor rotation and layout checks on more than the tested Samsung model.
- [ ] Controlled performance and memory measurements on representative lower-end phones and PCs. Existing snapshots are not comparative benchmark results.

## Preview15 cycle â€” native accepted, publication pending

- Fixes the hosted14 stale-board regression: every due `UPDATE_ONCE` refresh is explicitly re-armed, even when the cached viewport property still reads ONCE. Forced20FPS checks cover consecutive camera moves and pause/resume in both aspects.
- Conservative sparse terrain meshes remove wholly ocean-covered lattice cells with a two-cell coast margin. Desktop397,396 triangles versus1,048,576; mobile115,254 versus262,144. Every territory texel remains covered by both cell triangles, and retained vertex/UV/tangent data match the original lattice. Picking, country masks and elevation remain unchanged.
- Ship canvas now has stitched hems/panel seams, distance-filtered weave and gentle movement pinned at its edges. This is a material polish pass, not replacement AAA ship or army models.
- A same-process PC overview comparison, dense/sparse/sparse/dense with120 frames each, measured26.86/47.70/47.84/26.86FPS. Rendered primitives fell1.94mâ†’1.29m; material settings and view were held fixed. This does not establish equivalent phone gains or broad-device performance.
- Spectators no longer get deployment/turn controls or AI-impersonating diplomacy. Commander statistics/cards and free/action camera remain available. Local saves update their local host-build metadata on resume after an update.
- Fresh cycle checks: geometry10, slow-render/spectator11, save17, gameplay104, mobile844, new interactions26, full dice framing36, card/capital42, features35, audio37, rig21, touch/camera37, pause12, QR12, forms14, quality30:1,288 total, zero failures in final logs. Camera framing adds a small safety inset; the framing test waits for the actual glide after first-use shader compilation.
- Exact final APK SHA256fc59776b16fa1242e24282eda148e2c376185f2a287af911f649448a2e704c48 is installed/hash-matched. Native pan/zoom in Balanced30 and Ultra30, rotation, max/min dice/live roll, occupation1/24 process restart/full24 transfer, forced5â†’2 card trade, unobstructed physical award, Music50â†’20â†’50, text100â†’140â†’100, raw-touch quality selection and zero-human Capitals progression into round2 passed. Spectator commander panel has statistics/Close only. Phone is paused with its campaign saved; Balanced30/text100 restored. It uses the existing preview certificate; ADB installation is not an in-app updater journey. Hosted15 publication remains pending.
- Native Ultra samples dropped49â†’41â†’40â†’32â†’32â†’32 rootFPS while warming; thermal status at the final receipt was3 after returning to Balanced. Initial Balanced samples50/54/53/45/44/47 are limited observations, not a controlled phone A/B comparison. Keep the lower-power default and continue thermal/performance work.
- Next polish discovered during touch testing: extend slider endpoint hit areas beyond the track, label the pause entry Settings to include all tabs, and check terrain displacement culling at extreme close views.

## Priority 2 â€” requested content / visual quality still unfinished

- [ ] Pangea board and fantasy boards, with their own territory adjacency, bonus geometry, anchors, picking and phone readability. Only the classic world is currently playable.
- [ ] Closer visual match between playable board and approved war-table menu: terrain materials/relief, dark water, ships and chart artwork.
- [ ] Native UHD painted board assets. Current painted raster is 1774Ã—887; separate 5400px geographic detail and 4K rendering do not make that painted image native UHD.
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

## Preview14 release cycle â€” published with known30-target defect

- Maximum legal attack dice are selected when choosing an enemy. A raw-touch/mouse slider lowers or raises the legal count.
- Zero human commanders starts six AI players, including automatic Capitals selection. Spectator turn/trade mutations are blocked.
- Commander stat assets are close to card-icon size, with larger numbers below each icon; troop badges and card counts are larger. Settings provide saved100â€“140% text size.
- Local campaign snapshots write atomically and validate geography, owners and unique cards. Resume restores armies, capitals, cards, pending occupation/trade and camera heading/distance. Network sessions/credentials are excluded.
- Painted terrain mipmaps and measured geographic detail reduce unstable grain; dark water has moving wave fields/coastal foam; cloth/skin/leather/weapon materials differ. A coarse geographic shadow caster replaces repeated dense terrain shadow geometry on desktop.
- A fixed PC sample changed close terrain from49.9 to59.5FPS and6.09m to2.16m rendered primitives. Full-map sample25.8 to27.3FPS. These are view samples, not broad-device guarantees.
- Full dice-motion bounds guide camera framing without changing heading. Card awards use the HUD-safe viewport rather than sitting under commander cards.
- Pause/background stops covered3D viewport redraw; mobile is capped60FPS. Balanced/High/Ultra detail and separate30/60 board motion settings persist; mobile defaults to Balanced30 with a separate native-resolution HUD. Final Samsung Balanced samples reported42â€“44 rootFPS and thermal1; extended earlier high-detail testing reported thermal3. No universal sustained60FPS claim. Hosted14 later exposed a stale-board bug at the30 target;15 re-arms every due one-shot viewport refresh.
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

Final13 APK was installed by ADB at the user's request to repair the connected test phone; exact installed SHA matches final export. Actual menu and match launch passed. Native raw-touch Music50-to18 worked and was restored50. Android WindowManager-driven portrait1440Ã—3088 / landscape3088Ã—1440 / portrait transitions filled the display and kept the campaign, with original free/default settings restored. A separate physical-sensor hand rotation is not claimed. This is not a new in-app update acceptance.

Fresh final13 checks:111 gameplay (17-round AI victory, stable873 nodes),854 mobile,41 focused interactions,37 touch/camera and37 audio/music.35 unchanged feature checks carried from12; older pause/server/LAN/unit/provenance evidence remains explicitly carried. Source/export/installed acceptance records are separate. Native acceptance: `D:/Chat Gpt/workspaces/frontlines-build/android-qa/build13-native-acceptance.json`.

## Queued 2026-10-24: thermal fixes and personal portraits

User approved a mobile thermal/performance pass: sustainable mobile frame rate (30 FPS default, optional 60), sharp HUD with adaptive 3D resolution, distance-based mesh/shadow/animation cost, profiling water/terrain/shadows, reduced paused/menu work, Android thermal adaptation, and a repeatable 20–30 minute phone endurance check. These remain requested work, not completed or validated.

After those fixes, research an extensive player portrait character creator with face/body sliders as appropriate, colour controls, clothing and accessories, compatible with the approved portrait art direction and in-game displays. Present feasibility and asset/rig requirements before claiming compatibility. Add the player's portrait at bottom centre of the main menu. Leaderboards and Settings should use themed asset icon buttons consistent with existing approved UI.

Work paused at the user's existing usage floor: account reports 36% used / 64% remaining, below the requested 65% remaining threshold. No new fixes, character research, exports or deployment completed for this request.

## 24 October 2026: thermal protection and portrait-creator research

The user extended the remaining-usage stop floor from65% to50%; work resumed.

Implemented in the unpublished18 source candidate:
- Android PowerManager thermal-status polling on API29+, through Godot AndroidRuntime. Runtime limits do not overwrite the saved detail/FPS choices. Status2 caps board motion30; status3 reduces linear resolution to65%; higher statuses reduce further. Recovery restores resolution in5% steps after30-second intervals, and holds30FPS until the resolution budget has recovered above80%.
- Adaptive board resolution uses5-second sustained-framerate windows; increases require six good windows. Paused/menu frames do not count as slow gameplay. Adaptive detail can be toggled in Graphics; thermal protection remains enabled.
- The HUD remains at native canvas resolution. Mobile menus/paused tables use30FPS; backgrounded app15FPS. Existing paused3D render/child-processing suspension remains.
- Mobile idle table rigs outside a close camera frustum sleep. Combat/movement/death sequence actors remain fully animated; original animation tracks unchanged.
- Severe thermal state skips9 terrain relief/AO height samples while retaining geographic textures, territory masks and physical terrain geometry.
- Main menu shows an existing approved commander portrait bottom-centre, opening Commander Account. Settings and Rankings use original gold/navy SVG icons over the approved circular button asset. This is not a completed personalized character creator.

Focused policy tests29 passed; menu desktop/mobile landscape/portrait renders inspected. Full suite and fresh browser/Android exports in progress. Exact installed-package and sustained phone heat acceptance remain pending. No new deployment is claimed.

Research is in COMMANDER_CREATOR_RESEARCH.md: recommend an authored modular3D bust, bounded blend-shape sliders, fitted clothing, masked colour controls and cached portrait rendering for gameplay. Existing portraits are PNGs and supplied unit rigs do not include an appropriate face morph/clothing library. Asset production is required before a convincing full creator can be implemented. No asset purchases or account/schema changes made.

### Final18 thermal/menu phone acceptance

Exact18 APK SHA256 fb3763bce8b8b6ac053770203f4da9da3c5638c4d73a140568b4d8b227afe667 (74,896,234 bytes; same signing certificate as17) installed and verified on Samsung SM-S908E. Native PowerManager status polling confirmed in logs.

Twenty-minute Balanced30 foreground test completed:40 thermal samples, all status0 and reported30FPS; skin32.6 to36.3C. USB-powered/full battery, one phone, mixed initial capture then static overview, not a controlled old/new benchmark or frame-time percentile measurement. Five-minute warmed Ultra60 test triggered native status1/2, reduced render scale to75% and capped actual motion30 while retaining savedUltra60. Skin fell from peak40.1 to38.4C. No severe status3 in either new test; no captured script/FATAL errors. This demonstrates adaptation, not universal immunity to heat.

Real existing campaign resumed with49 battles. Roll50 captured Irkutsk from Mongolia. Camera heading remained0.2910578871, framed at distance12.3364 rather than prior27, and later manual pan/Home held. Max occupation confirmed (Mongolia1, Irkutsk3), Irkutsk remained selected for chaining. Restart/resume preserved that real campaign. OriginalUltra60, auto-rollON, ownership coloursON and pan controls restored; audio/dice hashes unchanged. Phone left paused. Android WM settings remained default / lock0 / stored0; no forced rotation performed.

1,391 fresh source checks passed, including30 thermal/picking/menu and4 idle-actor checks. Physical hand rotation remains pending at user request; no new broad-device/native full-game/multiplayer/updater acceptance claim. Creator research complete; creator asset library and implementation remain open. Native receipt: D:/Chat Gpt/workspaces/frontlines-build/phone18/native18-acceptance.json. Publication still pending at this checkpoint.

## Preview19 follow-up: immediate save durability and cancelled fortification

Preview18 is live: Website commit f929dfbebf76330f39adc6e0229b8f1c1cf230c0 / Pages40005383130,207 served hashes/MIME passed. Its hosted browser check exposed an immediate post-occupation reload restoring the prior pending move. Settled paused reload retained correct state; no duplicate capture observed. This issue is explicitly open in18 and prompted a separate19 candidate. Frozen18 remains unchanged.

19 source now saves completed human transitions directly, rather than waiting for the3-second autosave. A small synchronous browser localStorage recovery journal covers the normal IndexedDB flush window, uses monotonic revisions and the campaign validator, and retains a cleared-game tombstone. Native saves remain normal atomic files. Browser storage must be available; this is not a claim of universal persistence under denied/quota-exhausted storage. Resume suppresses temporary initialization saves and restores pending unconfirmed movement dialogs.

Local19 browser QA passed immediate occupation reload with exact source1/target4 and retained attack chaining. It also found that Cancel left a fortification pair queued; End Turn then implicitly moved60% of that army. This is a bug for human players. Fixed Cancel to clear the pair and restricted the automatic movement branch to AI-owned armies.25 focused source regressions pass; refreshed complete suite and both exports are running. Website will rerun the cancelled move/end-turn case against refreshed Web19. No19 publication authorized until exact final package/native acceptance and a new frozen packet.

The first pre-cancel-fix19 APK (964e54db44417f02abfba4ff58dccb64e0053a0a2efab00362fefec68f230f4b) was installed only as an unpublished candidate and archived in phone19. It has not been used for gameplay. REBUILD19_REQUIRED blocks further installs until the final rebuild; final19 SHA is not yet assigned. The real phone campaign backup remains available. No new20-minute thermal benchmark is claimed for19;18 endurance evidence will be carried explicitly.


### Final19 acceptance before publication

Final19 signed APK SHA256 3b4bfec1a11f671af582dc29262e57d3ecaa7ea2d93d0c675ac70257b3fbe7f5 (74,900,330 bytes) matches the exact installed Samsung SM-S908E package. The full sequential source suite plus JS journal checks passed with no recorded failures; final export source fingerprint and Android stage hashes match. No runtime source edits followed export.

The real round2 campaign continued from battle50. Rolls51/52 captured Alberta from Northwest Territory (one attacker loss). Confirming maximum occupation2 wrote the final1/2 troop counts in0.375 seconds. Force-stop was requested0.469 seconds after the tap (returned0.625 seconds), before the old3-second autosave interval. Relaunch/Continue retained52 battles,18 own forces,10 territories and one card; direct WesternUS selection opened a force2 attack without reselecting Alberta. Cancel cleared the pair. Phone left paused. Original Ultra60, auto-rollON, ownership coloursON and audio values retained; dice.cfg remains absent/default Ivory with campaign skins unchanged. Earlier hash-only preference comparisons used CRLF-captured backups; final19 compares normalized text and documents missing dice.cfg rather than treating its cat-error text as a real config.

Final Web PCK18a1b3e3f4955450ea146a9043d0ccfabe964c7113b54c82e74e94e76ac88ac1 passed fresh launch, immediate occupation reload, chained selection, pending fortification restoration, Cancel and End Turn with unchanged troop counts. Separate final local browser receipt is included. Local temporary LAN execution cannot save or clear the unrelated offline campaign. Native receipts and browser receipts are scoped; no new in-app updater, physical hand rotation, broad-device or native full-game-to-victory claim. Build18 thermal20-minute/5-minute evidence is carried explicitly, not a new19 benchmark. Full character creator remains researched only and requires an authored portrait asset library. Final19 publication proceeds through Website after freezing; hosted delivery verification remains the next step.


### Preview19 live publication

Website commit243dbeab96ddd2639cd320152c906cb3c42e94be; Pages40019693434 succeeded.27/27 catalogue/release tests,5/5 QR and228/228 hosted SHA/MIME checks passed, preserving releases8-18. Latest browser and Android manifests point to19. APK SHA3b4bfec1a11f671af582dc29262e57d3ecaa7ea2d93d0c675ac70257b3fbe7f5; frozen packet unchanged.

Hosted19 resumed an actual18 save with exact prior army totals and Crimson dice. Real Venezuela capture followed by maxmove3 and immediate confirm/reload (intrinsic2381ms/608ms, no deliberate wait) retained CentralAmerica1/Venezuela3, correct totals and chained attack selection. Pending fortification restored on reload;Cancel cleared it;EndTurn retained3/1 and awarded one card. Hosted campaign paused. These are scoped live browser checks, not a new native updater/full-game/broad-device acceptance.

Live browser: https://sponsorsorter.com/frontlines/builds/19/
APK: https://sponsorsorter.com/frontlines/downloads/frontlines-1.0.0-preview-build-19.apk
Publication,delivery and browser receipts: D:/Chat Gpt/workspaces/website-edge-audit/docs/FRONTLINES_PREVIEW19_{PUBLICATION.md,DELIVERY.json,BROWSER_ACCEPTANCE.json}.


## Land war collection arrival — 24 October2026

The new collection now lists1494 files,132 bundle manifests and439 prepared GLB scene paths. Readable sample GLBs contain skins, named animations and embedded PNG textures. The previously missing E_army_master.dds and land_battle_cpt_grd_e.dds filenames are present; filename presence does not establish successful access to their bytes.

Many entries remain OneDrive offline/recall placeholders. Reads fail with Windows cloud-provider low-system-resources errors; C: fell to about162MiB free. Bulk hydration was stopped.169 readable data/doc files (~22.4MiB), including31GLBs and51WAVs, were staged on D:/Chat Gpt/workspaces/frontlines-asset-library/land-war. Original collection unchanged. Inventory: tools/reports/land_war_collection_inventory.json; detailed SHA inventory in the staged folder. No runtime replacements, tests, export or publication performed for this arrival pass.

Resume only from a complete direct D-drive copy (set FRONTLINES_LAND_WAR_SOURCE) or working authenticated access to \\192.168.50.239\NetworkShare. That share remains inaccessible to this execution context. Staging now refuses source drives with less than1GiB free and skips cloud recall/offline files. Bundled programs/scripts are not executed. Prioritize textured infantry/cavalry/artillery retaining animations and faction readability, then capital towns/flags, budgeted biome scenery and auditioned combat audio. Do not claim the collection fully imported or read merely because its manifests enumerate files.
