# Production and helper controls — build 120

- Kitchen and craft shed: building and batch artwork on the left; fixed collection/upgrade controls on the right, with separate scrollable Recipes and Automation views. The well uses the same two-panel layout.
- Queue slots: eight optional gem upgrades per building, adding to its normal 2/3/4 slots. Upgrade prices are 20, 40, …, 160 test gems. No real payment is connected. Entitlements travel with the object when moved.
- Apply `tools/meadow-production-slots.sql` to the existing BargainBarge Meadow service. This preserves the deployed private function and adds a bounded `queue_slot` exchange. Fresh installations also include it in `tools/meadow-play-services.sql`.
- The existing wallet row lock, authenticated game profile, owned-building check, expected level and request receipts protect spending. Retry a failed request with the same ID. `tools/meadow-production-slots-check.sql` tests prices, replay, ownership and the eighth-slot limit inside a rolled-back transaction.
- Production automation counts shared pantry stock plus queued output on all farms. A new batch must fit under the chosen cap; zero disables the cap. Ingredients are reserved at queue time. Pending flour prevents helpers repeatedly queuing prerequisite flour.
- The well defaults to the previous crop. Selected-crop mode uses any crop unlocked by level. Its optional per-crop stock target includes expected harvests on all farms; a whole field can cross the target, after which new planting pauses. Already growing fields are preserved.
- Helpers retain their existing routes, well breaks, pause settings and current-farm restriction. Queued work finishes while away; helper actions resume when that farm is visited.
- Android 1.5.1 (versionCode 7) keeps swipe-revealed transient system bars and publishes visible bar/cutout insets to CSS. The web app uses safe-area environment values; installed PWA fullscreen is requested where supported. Browser chrome and iOS status-bar visibility remain controlled by the platform.
- Main HUD icons use alpha-shaped white outlines. Notification badges add a glow, cleared when attention count reaches zero. Travel is approximately 16% smaller than build 119.
- New ElevenLabs Farmer Jay production and well guides are introduced once per farm and can be replayed from Listen.

Focused runtime checks: `node scripts/check-meadow-production120.cjs`. The existing regression entry point also runs these checks.
