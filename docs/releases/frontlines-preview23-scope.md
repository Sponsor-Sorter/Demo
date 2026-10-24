# Frontlines preview23 — commander creator expansion

Candidate; publication awaits final browser/Android acceptance.

## Character controls and fit

- 64 actual facial morph controls, up from42. Added nose-tip/bridge widths, nostril flare/angle, septum, curvature, compression, whole-nose position/projection; jaw height, chin prominence/taper, cheek hollowness; lip widths/height/projection, philtrum, dimples and smile lines.
- Face controls grouped by anatomy. Every fitted hair/beard part is rebuilt with the same authored target deltas. Gender is selectable independently of hair, clothing and voice; its starting facial structure remains editable.
- A joined anatomical garment replaces the intersecting torso/sleeve prototype. Its shoulders, biceps, back and chest share geometry. One subdivision gives11,856 garment triangles. The original supplied unit animation rigs are unchanged.
- Fitted collar/headwear measurements remain. Medals gain raised stars, and formal uniforms have braided cords. Red/blue admiral plumes are extracted from supplied library geometry/UVs and attached to the fitted headwear frame with the feather tips visible outside hair and hat crowns.
- Short beard reuses the detailed fitted full-beard groom with shortened strands; no duplicate full mesh allocation is shipped for that style. Hair colour uses a luminance-preserving tint.

## Preview, motion and voices

- Wider preview at the existing height. Rendering follows its actual aspect ratio, bounded to1280pixels on mobile and1536on desktop; canonical saved portraits remain1024square.
- Compact POSE and REPLAY controls on the preview’s left, with larger portrait labels. Still, idle, victory, defeat, bow, flirt, laugh and angry poses. Head/neck motion is retargeted from supplied guard/governor curves; bow/flirt/laugh/angry and restrained breathing are authored secondary motion. This is not a full facial performance-capture rig.
- Nine optional voice sets/48 short clips plus Silent. Original pitches retained; PCM16 clips are trimmed and level-matched. Separate Commander volume control follows existing audio settings. Each voice can be previewed. Technical decoding/level checks are separate from subjective listening approval.
- Custom commanders can react to captures and send six limited emotes through the existing player-card panel. Public/private audience rules and cooldowns apply; emotes also work with alliances disabled.
- One transient256px portrait renderer serves the table, with a bounded queue and24Hz updates. A dormant20-second single-rig cache avoids importing the same face again on every capture; it then expires. It stops in the background, at pause/menu, or under serious phone thermal status. Static approved portraits without a custom3D recipe remain static.

## Compatibility and live service

- Existing catalog/recipe format1 retained. New persona fields and added morphs are optional on the server; legacy42-control recipes remain valid without rewriting their shape. Portrait render cache version5.
- frontliners-service version8 adds only bounded appearance fields/morph IDs and emote codes. Existing index.ts authentication/transaction logic and world data are byte-identical to version7. No database/Auth settings changed.
- Live three-guest private-room check passed: personas roundtrip, out-of-turn public emote and private-recipient exclusion. Temporary QA users/room removed; no ranked results generated. This does not claim a new verified-account cloud-profile write or email flow.

## Art and acceptance limits

The creator is improved but does not yet match the approved painted commander artwork’s realism. Eating/drinking props were not added: the searched standalone library candidates were item/controller stubs rather than a verified fitted prop/hand performance. Full-body retargeting, cinematic lip sync and a complete clothing wardrobe remain future art work. Original data/provenance is retained. Device-specific visual/performance checks and immutable delivery hashes are recorded separately when complete.
