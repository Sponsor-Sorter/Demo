# Build 157 — place picker and feedback

- Place cards use the real farm renderer with an explicit saved farm, shared isometric footprints, actual crop growth, animal housing and building stages. Preview rendering cannot change the active farm or bind placement gestures.
- Town preview shares the town building renderer and saved restoration stages.
- Two generous columns, full uncropped map art and a scrollable list; cards grow to their content rather than overlapping.
- VIP tier pill sits before gold and level, opens the existing free-test shop and refreshes from the account wallet.
- Shared capture-phase tap audio covers dynamic tabs/close buttons even where navigation stops propagation. Existing mute/effects preferences still apply.
- Opening a badged tab briefly pulses visible attention sources. Handles asynchronous friend requests, ready animal cards, deliveries, rewards and nested mission tabs. Reduced-motion users get a static outline.

QA: full regression suite passed. Added explicit off-map preview and unchanged-save/handler assertions. Loaded the existing populated level20 test backup through the normal import UI. Verified 28–39 placed objects per map, five town buildings, two columns without overlap, and nine visible animal attention pulses. Tap audio reached the Web Audio playback path. Portrait HUD verified with VIP/gold/level in order; expanded brand space prevents navigation overlap.
