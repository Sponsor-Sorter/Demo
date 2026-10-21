# Animal Family and performance — build 122

The roster now uses a compact toolbar and single readable cards on phones, with more columns on wider screens. Care meters sit side by side; all existing care, collection and farm filters remain available. Background artwork stays full screen.

Performance changes: cached card references, one map-qualified animal lookup per tick, no rewrites of unchanged text, rounded meter updates, lazy portraits, and no automatic full roster rebuild every minute. Crop growth uses one object lookup per pass. Fixed the flower selector error that interrupted growth refreshes. Hidden orchard artwork no longer refreshes behind other screens.

These reduce lookup and DOM work; no FPS gain is claimed without profiling. Helper rendering, large transparent artwork and save serialization remain profiling candidates.

Three new journal milestones reward welcoming five species, keeping six housed animals comfortable, and reaching friendship level three with five animals. Existing exact-once claim protection applies.
