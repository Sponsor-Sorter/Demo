# Build 180 — worker return pass

## Changes

- Assigned hired workers can finish up to three ready tasks each after an absence of at least one minute. Their own farm's well stamina, watering licence, available gold and walkable paths apply.
- A harvested field is replanted with its configured crop before the worker chooses another field. Replanting starts at the actual return time; no repeated historical crop cycles are invented.
- Every successful action uses the existing farm-work implementation, including exact seed/water costs, produce collection and duplicate guards. The visible map never changes.
- A saved return cursor prevents the same allowance being replayed by a reload. A crash can lose the unused allowance; it cannot grant a second allowance for the same interval.
- Work yields between actions and pauses on hidden app, unresolved cloud save, visiting, build mode, transfer or open modal. Existing live helper loops wait during this short pass.
- Helper task selection sends only flower objects to crop growth calculations. A 600-plot/400-decoration fixture checks 600 flower candidates instead of 600,600 whole-map objects.

## Verification

Focused fixtures cover two assigned farms, harvest/replant/water, exact gold changes, real planting timestamps, disabled watering, insufficient seed money, duplicate return, bounded blocked-path search, hidden-app interruption, save failure lock release and the heavy-farm scan.

Build179 cloud-save revisions remain in place. Currency and inventory are still client authoritative; server economic validation and rewarded game sessions remain separate backlog items. Native installer acceptance remains pending the phone test window. Billing and ads stay in free test mode.
