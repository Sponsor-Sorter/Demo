# Frontlines preview25 — commander preview polish

Candidate in validation. Preview24 is the current public release, including its completed real 23-to-24 Android update.

## Changes

- FACE frames the actual animated face more closely in the existing preview area. Reset View restores the bust; saving still renders a neutral, front-facing portrait independently of preview orbit, zoom or pose.
- Compact pose captions measure the chosen font and fit long names. Pose, Replay and Face use the existing approved round button asset rather than squeezing the wide account button frame.
- Head fitting reads the existing GLB float buffers directly and uses a 206,575-byte, mesh-hash-bound sparse index lookup. It avoids GPU blend-shape readback without adding duplicated head geometry. All six presets produce bit-identical fitted vertices and attachment measurements against the original path. Missing, malformed or stale lookup data falls back to normal mesh inspection.
- The 28 expression channels, denser 34,672-triangle head, fitted teeth/tongue, gaze, eyelids, facial hair and voice-amplitude jaw movement from24 remain. Military unit animation clips, saved identity format and campaigns are unchanged.

## Acceptance

Source regressions, exact browser and Android checks, publication and real in-app update receipts are recorded separately. Candidate compilation does not by itself establish phone or hosted acceptance.

Local fitting-stage measurements are substantially lower with the cache. Cold texture loading and shader work still contribute to total startup; this is not a general frame-rate or thermal improvement claim.

The creator remains an authored animated bust, below the approved painted portraits in sculpt, hair and fabric realism. Speech follows audio amplitude rather than phonemes. Painted NPC portraits without a custom3D recipe stay static. No new physical phone rotation/pinch, verified-account email/cloud write, broad-device endurance or eating/drinking props are claimed.


Preview25 exact browser acceptance passed at1280x720,390x844 and844x390, including all eight pose captions, close-up/reset, choice scrolling, neutral saved portrait/reload and an actual in-table Laugh. Cosmetic art finding retained: a thin dark neck/collar seam can be exposed during close-up Laugh/Flirt/orbit. Compact FACE uses a shorter oval frame. Native acceptance and publication are separately recorded.
