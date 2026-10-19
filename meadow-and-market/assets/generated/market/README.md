# Farmers Market assets and behaviour

Generated for Meadow Markets, 19 October 2026.

- `farmers-market.webp`: 1536×1024 generated cozy painterly 3D village square, canvas awning produce stalls around the edges, bread, honey and flowers, bunting, broad clear foreground serving counter, warm morning light. No text, UI or people. Exported at WebP quality 88, retaining source resolution; cover fills both orientations.
- `packingbench.webp`, `marketcart.webp`: generated as two separate 768×1024 cells in a transparent 1536×1024 sheet. Matching isometric farm angle and a 2×1 ground footprint. Packing bench has wrapping supplies, tools and produce; market cart has wheels, crates and a striped canopy. Each cell exported independently to 512×683 transparent WebP. The map uses the exact 2×1 placement footprint; neither item changes the map grid.
- `market-welcome`, `market-pack`, `market-weigh`: three distinct ElevenLabs recordings using Farmer Jay’s established Mike voice. Normalized to -18 LUFS/-2 dB peak, 44.1kHz, 96kbps MP3. Listen/replay follows existing sound preferences.

Premium crop sales are 1.5× the usual item price, rounded per unit; a Packing Bench changes this to 1.65×. A Market Cart raises the batch cap from 3 to 6. Shared farm ownership activates each perk once; duplicate buildings never stack. Challenges cost no gold. Only a successful completed round removes inventory and awards its displayed quote. Failed, cancelled, timed-out or invalidated deliveries keep goods. Results remain in the scene until the player chooses. Backgrounding, rotation and Listen pause an active challenge.

The existing order board remains under Requests, including ingredient discovery, direct delivery, refresh cooldowns and quick sales. Farmers Market itself is a full-screen illustrated scene. The installed Android app receives this web release through its existing update prompt; its native code is unchanged.
