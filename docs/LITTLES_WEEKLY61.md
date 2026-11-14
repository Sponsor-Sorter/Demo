# Weekly Farm Fair · content61

The home-screen trophy opens a full-screen illustrated harvest fair. Children see their weekly completed rounds, three animated trophies, seven daily activity bars and the optional shared ranking. The next play button is prominent; reduced-motion preferences remove animations.

## Rules

- Monday–Sunday UTC. The device-local five free completed rounds/game/day rule stays unchanged. Failed or abandoned attempts do not spend a round.
- Every completed round advances trophies: bronze3, silver8, gold15. These award2,3,5 extra completed rounds respectively for **each** game for the remainder of that week. Bonuses are used after the normal daily allowance; unused bonus rounds expire at the week boundary. Plus remains unlimited and never spends bonuses.
- Only the first five completions/game/UTC day earn10 ranking points each, including for Plus. Extra purchases, speed and lifetime stars never increase those points. Ties share a place.
- Server-issued begin tickets, actor/session binding, minimum elapsed time, idempotent finishes and serialized per-account spending protect receipts. This is a casual client-reported completion board, not cryptographic verification of puzzle solutions.

## Privacy and control

Private by default. Only a verified parent account can enable sharing through the grown-up gate. Public rows contain nickname, points, rank and a viewer-relative you flag. The nickname is generated from a fixed farm vocabulary and changes weekly. No display names, account UUIDs, emails, child writing names, chat, public profiles or user-entered text are exposed. Opt-out immediately removes the shared row without losing trophies.

Private tables have RLS and no player table grants. The public RPC is an invoker wrapper over one actor-guarded private definer. Existing bans are respected; banned participants are filtered from the ranking. Weekly tables cascade from the Littles profile so a Littles-only deletion also removes this activity without erasing shared Fairplay Auth. No paid entitlement or central Admin grant is changed.

## Staged acceptance

weekly_config defaults to public disabled. Only designated disposable QA actors and the existing phone-test parent can see the candidate while native acceptance is pending. Public activation is a separate read-back-verified configuration change after full installed-app rounds pass. No Android reinstall, reset, account switch or browser-on-phone substitution is part of this release.

Local/source and server acceptance: full Littles regression, bonus/free/Plus rules, duplicate/early/foreign tickets, real bonus spending, optional sharing, ties, opt-out, full bonus exhaustion, week reset and profile-deletion rollback passed. Headless layout acceptance covers320×568,390×844,823×384,1024×1366,1366×1024 and a clearly isolated20-row fixture. Actual public rows are never populated with fictional players.

Phone acceptance, public activation and exact publication hashes remain pending and will be recorded after observation. Private evidence: D:/Chat Gpt/workspaces/littles-weekly61/.

## Artwork

Built-in image-generation tool. Final asset: meadow-market-littles/assets/generated/weekly61/fair.webp (1536×1024). Prompt: polished preschool cartoon harvest fair, sunny meadow, small red barn and rolling hills, wooden pavilion and bunting at outer edges, three trophy cups on rustic crates, calm central cream parchment noticeboard, no text/numbers/buttons, uncluttered full-bleed composition. Generated original retained under C:/Users/jrbwi/.codex/generated_images/01a15c4c-ab18-7e71-b610-3ae086f39918/exec-dfc3ff0e-2a2b-4554-b232-a36cc8e1655d.png.

## Native61 functional checkpoint · 14 November2026

The existing official Samsung Play14/1.0.1 app restored the same signed-in parent and154stars. Six full Letter Balloon Pop rounds passed, each with six observed target letters and all three farmer characters. The first included a gentle wrong-letter retry; a separate partial round was abandoned before completion. The server read-back shows6 completions,5 scoring rounds(50points),1 bonus spent and sharing still false. No install, reset, account switch, save choice or VIP grant occurred.

The native landscape review found that the graph required scrolling and the eighth home genre wrapped below the first row. Content62 corrects those layouts, and its final native visual acceptance remains pending. The public weekly rollout gate remains off until that passes. Migration source filenames are aligned with their already-applied Supabase ledger versions; definitions are not rerun.
