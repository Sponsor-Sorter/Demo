# Meadow Markets interaction standard

- Mini-games use full-viewport illustrated artwork in both orientations.
- Put counters, progress, timers and pause controls in one top HUD. Reserve its measured bounds and the caption/safe-area bounds when placing targets. Targets remain separated and reachable.
- Keep primary care and upgrade actions immediately beneath the popup heading. Keep secondary details below them. Explain disabled requirements and show the gold cost before purchase.
- Explain new unlocks with a character, readable instructions, matching narration and a clear next action. Respect voice/mute preferences and offer replay. Queue guidance until active dialogs and building are finished.
- Keep loss/win results compact over the frozen mini-game until the player chooses an option. Retry starts a fresh round. No thanks returns to the farm.
- Preserve both direct playfield interaction and labelled controls where either is useful. Use touch-safe targets, prevent duplicate events and preserve timing/cooldowns.
- Cover new layouts with portrait/landscape safe-area tests and actual browser/phone checks before release.

- Full-screen gameplay is mandatory: edge-to-edge game artwork, top HUD and bottom tool tray inside the game, no constrained popup playfields.
- Physical care tools drag from the tray and remain under the finger. Rub tools over the actual animal silhouette; pour only over the matching trough; drop the ball onto the animal. Pointer cancel, rotation and pausing stop work immediately.
- Farmer automation calls simulation care directly, respects the well stamina/rest cycle and never opens a mini-game; manual games pause helpers to avoid conflicting updates.

- Never place opaque or gradient full-width background strips behind gameplay headers, captions, or bottom tool trays. Artwork must remain visible beneath those regions. Float individual buttons and readable shadowed text directly over the artwork.

- Full-screen illustrated backgrounds with floating controls are the default for every game scene. Change this only when the user explicitly requests an exception. Animal size must suit the scene; use species-specific animal sizes against the barn, keeping feet on the same ground plane. Chickens can be slightly oversized relative to real life for touch interaction.

- Attention badges are red circles with actionable counts, capped visually at 99+. Preserve button names and hit areas. Resolve action badges only when the action is handled; mark visitor entries seen only after their log loads successfully.
- Friend help is limited, non-destructive and recorded online. Apply each help event once; never water a different planting cycle or overwrite a friend’s save from the visiting device.
