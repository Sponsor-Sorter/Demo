# Animal care mini-games — build 89

Full-screen feeding, grooming and play from Our animal family and animal detail actions. Food and water both required. Tools remain in bottom tray. Progress and timer stay in top bar. No changes on exit or loss. Completion applies existing care once; fleece collection uses the existing readiness and product cooldown guards. Sheep and alpacas display shaver, disabled while fleece grows. All play rewards use existing friendship cooldowns.

Barn, paddock and seven tools generated with built-in imagegen; reference source images retained in Codex generated_images. Barn 1536x1024, tools256x256 with original transparent alpha. Coop scene reuses shipped full artwork; paddock is a newly generated fully fenced scene. Tool crops follow exact512px atlas cells. Jay lessons generated in ElevenLabs using Mike - Animation, Explainers & Gaming; normalized44.1kHz96kbps with loudness -18LUFS. Audio: care-feed, care-groom, care-play, care-result. Existing failure dialogue retained.

Prompt set: spacious sunlit timber barn with empty central floor; six isolated padded care tools in a3x2 transparent atlas (grain scoop, watering can, soft brush, cloth, petting hand, ball); individual burgundy fleece shaver with silver comb teeth. Warm hand-painted storybook farm style, no text or UI.

Checks: five species and gated tools; independent food/water progress; capped progress; delayed exact-once care; pause on background/resize; persistent result; retry/exit. Browser plays feeding, chicken pet/cloth grooming, ball game, sheep brush/cloth/shaver and records voiced result. Phone live update and touch checks recorded separately.

## Build 90 — hands-on tools
Tools now follow the captured finger from the tray. Feed and water pour only over the matching trough; moving away or releasing stops pouring. Grooming requires moving strokes over the visible animal silhouette, with distinct cloth and ready-fleece phases. Ball play requires a valid drop onto the animal; missed drops do not count. Secondary fingers cannot cancel or hijack the active tool. Keyboard operation remains available. Farmer Jay’s three new ElevenLabs drag lessons use care-feed-drag, care-groom-drag and care-play-drag; result dialogue remains shared. Farmer automation continues to use direct care and well stamina, pausing during manual games.
