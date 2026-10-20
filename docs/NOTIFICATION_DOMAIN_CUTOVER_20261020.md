# Canonical notification cutover — 20 October 2026

Backend reported migrations 20261020105211 and 20261020105408 live, synthetic SQL rollback coverage for nine domain cases, dedupe and zero external deliveries. Website does not independently certify SQL evidence.

Removed browser producers/fallbacks for private offer creation, review, group invitations/responses/status, affiliate application review and settlement, and private offer archival. Domain writes, error propagation, UI refresh and realtime retained. Admin broadcast plus inbox display/read/delete retained. Central unused compatibility helpers remain; backend will coordinate ordinary INSERT lockdown separately.

Five focused Node tests pass, including execution of real group/invitation handlers using fake adapters and injected backend errors. Six changed business modules pass syntax checks. No live campaign, payout or inbox records created by Website tests. Server rollback tests are distinct from production browser end-to-end acceptance. Module consumer cache aliases advanced. Release receipt: external NOTIFICATION_DOMAIN_RELEASE_DELIVERY.json.
