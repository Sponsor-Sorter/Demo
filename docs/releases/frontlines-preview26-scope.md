# Frontlines preview26 — prehistoric battlefields

Candidate release. Publication and exact-package acceptance are separate gates; preview25 remains the public game until those gates pass.

## Battlefields

Main World is joined by Cambrian540 Ma, Ordovician445 Ma, Devonian405 Ma, Carboniferous325 Ma, Triassic235 Ma (Pangaea), Jurassic175 Ma and Cretaceous105 Ma. Each has42 territories, six bonuses, a distinct connected graph, painted terrain, registered relief, engraved territory boundaries, bonus perimeters, ocean artwork and ships. Existing armies, animated combat, dice, physical cards, capitals and rules use the selected map.

Choose a battlefield in Game Modes & Rules before starting solo play or hosting. The library uses the approved UI assets, responsive two/three-column grids, touch scrolling, thumbnails and in-game map credits. Download a new map once to keep it for offline play. Optional packs are7.7–10.6 MB each; they are excluded from the base APK and browser PCK. Downloads require pinned length/SHA256 before mounting. Incomplete downloads cannot replace an accepted pack. A joining player is offered the host's required map; graph/revision mismatches are rejected.

## Readability and rendering

Home projects every playable anchor into the uncovered HUD area, accommodating each map's land distribution in landscape and portrait. Crowded troop counters are spaced with short leader lines while their terrain and click identities remain unchanged. Desktop albedo is4096×2048; mobile is2048×1024. Lossless territory/engraving textures retain precise borders. Mobile detail shares its existing albedo texture instead of decoding an extra4K copy. Phone and desktop use separate terrain meshes/elevation lattices, with matched CPU/shader height sampling for pieces, capitals, picking and dice.

Source8K masters are retained in the authoring workspace. The painted source is1774×887 and the8K authoring composite combines registered/upscaled painting with authored detail; it is not a native8K painting or a measured ancient elevation model. Terrain, vegetation and decorative ships are stylized game art. Coastline reconstruction sources and CC BY4.0 attribution are available through Map Credits and in every pack.

## Compatibility and evidence

Campaigns, local/online room settings and authoritative server state carry a map identity. Legacy Earth saves/rooms retain the original graph. Service9 adds the seven allowlisted graphs without schema, account policy or authentication changes. Preview25 creator fitting, expression controls, saved identities and military animation clips remain in place.

Fresh owner evidence before packaging includes14 complete AI games (each map in Domination and Capitals),64 live server authority checks with disposable QA users/rooms removed, public-HTTPS acquisition of all seven packs, and settled Home/counter-click/overlap checks in both orientations. Full sequential source regressions, exact exports, browser acceptance, actual phone interaction/performance and OTA receipts are recorded separately. A desktop mobile-layout render is not a physical phone performance test. No claim of AAA visual parity, broad-device thermal approval or measured paleotopography is made from passing functional tests.

## Authoring reference

Complete source: `D:/Chat Gpt/workspaces/frontlines-map-authoring/`.
Delivery inventory: `https://sponsorsorter.com/frontlines/maps/packs-r1-manifest.json`.
Immutable R1 assets are published independently of runtime26; any changed pack requires a new revision and URL.


## Owner QC findings corrected

- Web verifies a bounded response body, writes it explicitly and verifies the saved pack; native retains disk streaming. This fixes a successful browser HTTP completion without a retained file.
- Compact GET-size captions and fitted approved skins prevent portrait grid expansion. Visible bounds are enforced after deferred word-wrap measurement, fixing a2317-pixel panel on a900-pixel window that disabled scrolling after reopen.
- Bonus captions and counters avoid each other, HUD pills and buttons at140% text. Cached free-edge placement handles dense bonus groups. Counter layout restores after an earned-card animation clears drawn counters.
- Credits follow orientation changes. Android Back closes map selection before the underlying rules sheet.

Final source:44 Godot jobs,5 Node jobs, two exports,14 complete AI games,336 readability/HUD/accessibility checks,67 library checks,24 repeated-scroll checks,336 resume checks,687 desktop and988 phone-layout renderer checks, and seven actual3840x2160 captures. The read-only geometry/border audit994 checks and live service9 authority64 checks passed separately.

Exact APK SHA256ecd54b06b1f6d92cc56f7cf52500aec1a585ac245d0dec2cdf68c485d0c578c1 (104368520bytes); Web PCK84d673cd9f7d29b2a686f6d3c58ff247cd8267e30ebc18dc4e8654f383d0cc71 (76389112bytes). Final browser acceptance covers all7 cached selections, reopen/wheel scrolling, portrait/landscape/140% text, credits rotation,235 placement, reload/Continue and empty cards. Unsupported browser hold/battle/offline/old25 migration are excluded; native acceptance is separate.
