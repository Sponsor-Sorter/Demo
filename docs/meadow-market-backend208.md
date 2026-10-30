# Backend208 — verified expedition rewards (web205)

Staged farm commands now cover fishing/woodland begin, start, pause/resume and collect. The server applies the existing bait cost, unlocks, cooldown and twenty-minute trip lifetime. Each retry receives a new attempt ID. Collecting an old attempt, a paused/expired trip or an already-collected trip fails.

The input contains timed casts or named woodland picks, not a score or goods. Fishing recomputes the existing three-cast phase/accuracy formula. Woodland follows server-issued targets, counts wrong picks and time penalties, and requires completion or the real timeout. Server clocks bound action time; pause duration comes from server-recorded pause/resume actions. Existing fish/forage thresholds, quantities and XP are retained. This limits reward forgery and replay; it does not prove human input or solve botting.

Four focused tests pass for bait/cost, precise cast score, injected output/score rejection, timing/lifetime limits, issued targets, partial timeout, retry and pause/resume. The combined staged suite is44tests. The existing canonical CAS/command receipt boundary prevents duplicate collection; no new public credential or snapshot route is introduced.

**Client is still unconverted.** Journey activities must record actions, start the issued attempt when play begins, forward pause/resume and collect through these commands. Preserve full-screen art, farmer voices, retry/result screens and existing controls. Do not call local `completeTrip` on enrolled farms.

Shared village project creation/progress already runs through `meadow_market_journey_service`; it reads saved level/hall prerequisites and accepted-friend visitor help, without client-supplied contribution amounts. The remaining client migration must synchronize its returned landmark metadata through an authoritative path and preserve genuine completion. Do not treat locally cached landmark metadata as proof for story rewards.

Next priorities: complete command UI routing, server-owned initialization and reviewed legacy conversion, shared-landmark metadata, then browser canary and rollout. Real commerce remains off, cohort empty, phone testing paused and public Play beta in review. Physical/provider acceptance is still required.
