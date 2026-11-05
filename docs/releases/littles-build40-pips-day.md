# Build 40 — Pip’s hands-on little day

Replaced the four task-completion buttons with four physical play activities in the full-screen paddock:

- Feed: move three separate carrots to Pip’s mouth. Missed drops return to the tray. Pip chews before each carrot counts.
- Brush: rub the brush over six muddy patches. Only movement near a patch clears it; holding still or brushing the background does not advance progress. Dirt fades at the touched positions.
- Ball: roll the ball into the paddock three times. Pip moves with animated legs, hops and a wagging tail while the ball rolls out and returns. Progress counts after a completed return.
- Bedtime: place three hay bundles into the bed, then pull the blanket over Pip. Pip settles, closes its eyes and snoozes before the result appears.

The lamb is drawn as articulated SVG parts with independent eyes, ears, mouth, tail and legs. No sprite downloads occur during play. The existing paddock image fills the screen, and all controls sit within the scene. The home preview shows the actual lamb and play items. Pause freezes gameplay and character animation; moving to another stage requires the child to choose Next. No timer, failure or daily chore.

Touch dragging is the main interaction. Select-then-tap supports children who find dragging difficult; keyboard input provides another way to perform each action. Existing approved Farmer Jay encouragement and farm effects are reused. The intro’s sound button is labelled Hear Pip; it no longer requests a nonexistent minigame-lambcare audio file.

Verification: full mouse/drag playthrough on desktop; three-carrot phone drag sequence including rejected drops; repeated brush movements clean spatially matched patches; pause during eating preserves progress; keyboard playthrough through the simplified result and replay; portrait phone 390×844, landscape phone 844×390, tablet 820×1180. No browser console errors. Geometry regression checks cover stationary touches, off-animal strokes, local cleaning and full brushing. Littles game, recovery, state and offline cache checks passed.
