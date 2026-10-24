# Preview20 acceptance scope

## Changes

- Native touch handling no longer consumes synthetic mouse events twice. Account forms keep feedback and Back visible, handle busy state, validate input and explain confirmation requirements.
- Remembered Android sessions use a non-exportable Android Keystore AES-GCM key. Browser refresh sessions use origin-wide storage. Offline restoration preserves the saved identity; expired sessions return to sign in. Passwords are never persisted.
- A real 3D commander creator provides 42 face morphs, six presets, modular hair/beards, outfits, headgear, medals, skin and material colour controls, Undo/Redo, Before, Save and discard. Saved portraits appear in the menu, own commander and validated LAN/online appearance recipes. Existing approved portraits remain defaults.
- Hand and board territory cards share printed layout, approved frame and unit art. Bonus text is clear of the footer rule.
- Pause, Home, Rotate/Pan, Bonuses, ownership and action-camera controls use gold/navy assets matching Settings and player stats. The hand button reuses the player-card artwork as a three-card fan with a count. Speed displays 1×/2×/3×.
- Browser layout responds to narrow viewports independently of desktop graphics budgets.
- Local AI pauses while hand cards, battle history or native account/social panels are open, so turn changes cannot dismiss the viewer. Shared online games continue normally.

## Evidence and limits

The frozen packet contains exact package hashes, fresh source regression logs, native device evidence and scoped browser acceptance. A synthetic refresh-token Android probe verified encrypted write/read, refresh replacement, process-restart restoration and clearing; it did not submit real credentials. Automated auth cases use an isolated mock service. Real email confirmation and a verified-user cloud appearance roundtrip require a real user/inbox and are not claimed by those checks.

Creator meshes and authored face targets derive from pinned MakeHuman CC0 data. Runtime textures retain their full source dimensions and alpha, encoded as WebP98. Geometry compression is lossless. Data provenance and licenses are in assets/creator/catalog.json and LICENSE-MAKEHUMAN-CC0.md. New HUD SVGs are original source artwork. No third-party gameplay asset library replacements are part of this release.

Backend frontliners-service v7 adds bounded, account-owned appearance recipes and an optimistic revision check. The existing battle engine is unchanged from v6. Existing table prefixes and RLS remain in place; global Auth settings were not changed.

Build18 thermal endurance is carried evidence, not a new20 benchmark. Physical phone rotation, broad-device performance, verified-user email journeys and AAA visual parity are not implied by a successful export or source test.

The long, USB-powered native Ultra60 review reached Android thermal status3; the existing protection reduced rendering to30FPS/65% scale. This is an observed limitation, not a claim that overheating has been eliminated. Native account actions were reached with the scrollbar; freeform swipe scrolling still needs interaction polish. New handheld installs default to Balanced30, while existing user preferences are preserved.
