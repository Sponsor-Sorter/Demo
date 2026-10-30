# Meadow Markets 201

Public-beta safety preparation,30October2026. Native Play1.7.0/code10 remains the existing wrapper; live game201 adds community controls.

## Shipped

- Report/block on friend cards, directory cards, visits and visitor history; unblock in Settings.
- Explicit community-rule agreement before changing a public name or connecting with players. New accounts start with a generated public farm name.
- Bilateral server visibility and invitation guards. Blocking removes the connection and pending help. Unblocking does not restore a friendship.
- Private, rate-limited, idempotent reports; staff review workflow and180-day cleanup. No automatic sanctions based solely on a complaint.
- Privacy/community pages and versioned offline cache entries.

## Evidence

Full local regression suite passed; focused safety fixture passed. Database rollback fixtures exercised authenticated rules, accepted-friend save reads, report ownership/replay, bilateral blocks, private block lists/reports, own-save access, denied invitations/visits and unblock isolation. Fixtures left no generated test users behind. Security advisors found no new ERROR-level issue; deny-by-default private tables intentionally have no player policy, and guest players retain owner-only safety controls.

CI41003362563 and41003763338 passed game and Android jobs. Pages41003763298 succeeded. Live Settings displayed201, the community settings loaded from the live backend, and no warning/error logs were captured. Local portrait report dialog and rules prompt were checked; no report was submitted against a real player and no real account was blocked for the UI check.

Play listing, ten app-content declarations, dedicated reviewer access and unlimited Australian early-access invitations were saved.16 changes were submitted; Console shows Changes in review, with automated checks pending at the recorded receipt. This is not Google approval or a production release.

## Remaining gates

Public Play approval and download acceptance; Samsung Play install/signing migration and touch checks; native performance/storage/iPad acceptance; production purchase/ad credentials and real provider tests; ordinary farming server authority; exclusive-game Auth-principal retention. Live purchases, ads and products remain disabled. Preserve the direct Samsung farm and its login before any distribution switch.
