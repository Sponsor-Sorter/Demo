# Games and apps catalogue publishing

The human requested one public place to get and run the games/apps, following the Sponsor Sorter home-page theme. The Website owns `games.html`, its shared footer link, catalogue metadata, styling and QR codes. Product agents retain their game/app source, hosting, builds and release acceptance.

## Public entry points

| Product | Stable catalogue URL |
| --- | --- |
| Meadow Markets | https://sponsorsorter.com/games.html#meadow-markets |
| Bargain Barge | https://sponsorsorter.com/games.html#bargain-barge |
| Sponsor Sorter Android app | https://sponsorsorter.com/games.html#sponsor-sorter |

QR codes encode these stable entries, not an APK that will become outdated. Keep entry IDs stable. A future product gets its own unique ID and section.

## Required release handoff

Send the Website owner the product name/type, accurate short description, original image, browser play URL if one exists, Android download/installation URL if available, version name AND native build code, browser build separately, platform requirements, how-to-play/install steps, and known limitations. Include immutable artifact URL, byte size, SHA-256, package/signing identity and acceptance evidence when available. Mark testing or pending releases clearly.

Never infer an Android version code from a browser cache/version number. A download landing page is not a playable browser app. Do not advertise candidate-only features, silent Android installation, iOS binaries that do not exist, or an unaccepted build as the current accepted release. Catalogue publication does not certify all game/app business flows.

For the Sponsor Sorter Android app, public build 8 remains listed until its owner accepts a successor. Do not promote build 9 merely because it compiled or was installed on one device.

## Source and update steps

1. Update `content/games-catalogue.json` with verified release metadata. Keep action URLs public HTTPS and artwork local to this repository or an existing game asset path.
2. Run `node tools/build-games-catalogue.mjs` to render the static accessible page. It uses the home page's shared footer and theme. Do not hand-edit the generated page.
3. For a new entry or changed stable ID, generate QR SVGs with `python tools/generate-games-qr.py` (`qrcode==8.2`). QR generation is local; no third-party QR service receives URLs or user data.
4. Review desktop/mobile layout, instructions, links, image loading, metadata and QR destinations. Changes to an APK remain the product owner's release responsibility.
5. Publish through the Website release process, verify delivered assets and stable anchors, then report the exact commit/build and acceptance limits to the product owner.

The Meadow Markets browser label reads only its same-origin `release.json` and accepts a positive integer build. If the manifest is unavailable, it retains the last published snapshot. This does not assert that a browser build number is an Android build number.

## Ownership boundaries

- Add new products to the catalogue, rather than replacing the Sponsor Sorter home page, footer or shared header with a game download page.
- Product owners may publish within their agreed game/app route. Coordinate route changes and link changes with the Website owner.
- Keep the catalogue public and simple: browse, read, play, download. Do not add account creation, payment, permissions or extra integration requirements just to open a catalogue entry.
- Preserve the Sponsor Sorter shared header, near-black background, charcoal panels and original product artwork.
- Internal Admin tools are not public catalogue downloads unless the human explicitly requests public distribution.

## Initial evidence

19 October 2026: Bargain Barge owner verified Android 0.4.4 / native build 19, its versioned APK and SHA-256; Sponsor Sorter Android owner verified public 1.0.0 / native build 8 and the existing install page. Meadow Markets browser snapshot is build 74 from its release manifest; its native metadata must remain separately identified.

## Frontlines immutable releases

Frontlines uses `/frontlines/builds/N/` for each accepted Web export, plus a versioned APK in `/frontlines/downloads/`. Preserve all previous build folders and old runtime assets. Root `release.json` selects the browser folder; `android-release.json` separately records APK package, native versionCode, bytes, SHA-256 and signing certificate. Import only a frozen owner packet with acceptance evidence and verify every byte against its manifest. Keep `frontlines/** -text` in Git attributes so export line endings remain exact.

The root bootstrap retains the URL query and hash. Catalogue actions link directly to the current accepted folder, with stable entry QR codes unchanged. GitHub-hosted responses currently report max-age=600; timestamp manifest requests and immutable folders avoid mixing game assets. Do not claim server no-store headers. APK sideload acceptance and ADB upgrades do not prove the in-app updater: separately record the Android download, confirmation, installer handoff and old-to-new result.
