# Meadow Markets 247 acceptance

Accepted 14 November 2026. These final notes are retained on a local documentation branch; they do not require another Pages publication.

## Published source

- Main: `5cd9137a97aef622d2ede62910b0279ce9b79d76`, merged PR 32.
- Reviewed combined candidate: `4f5bdb68d38f7e7267df48388463685953dfd95b`; its Git tree matches main exactly.
- Live game: <https://sponsorsorter.com/meadow-and-market/?release=247>.
- Main Meadow/optimized Android CI `43554481809`, Littles CI `43554481784` and Pages `43554481583`: success.
- Public readback: 23/23 named files match canonical source, including Meadow 247, owner-reviewed Littles 64 and protected Frontlines/native/catalogue files.
- Gateway 61: eight of eight reviewed files match deployed bytes, JWT verification enabled. The generated rules fingerprint changed; farming arithmetic and authority did not.

## Consumer and Admin acceptance

The validator and controller checks cover fixed contract/digest validation, account and resume races, bounded cache lifetime, stricter queued requirements, existing cooldown/consent checks, provider/kill-switch changes and UI-only preference persistence. Existing ad, commerce, Premium and command-UI checks pass. The two Deno purchase/signed-callback cases pass.

Root fetched the hash-verified live `ad-policy.js` and `store.js`, ran their actual consumer in a minimal Node fixture, and used the genuine QA Auth user with only the own-account commerce RPC. The result was available, reason `no_policy`, null version and defaults of three completed games/180 seconds. Existing pack projection was preserved. There was no native SDK, advertisement call, policy write or fixture-user write. This proves code/API integration; it is not browser, native UI or provider-impression acceptance.

Root recorded the evidence and enabled only consumer qualification for minimum build 247. Independent read-only database acceptance confirms:

- Consumer qualified: true; minimum build: 247.
- Accepted policies: zero; active reader result: null.
- Existing ads, payments and production flags: true.
- Root readback confirms deletion processing and retention approval remain false.

No default policy was installed. Reward amounts, products, purchase history and existing farms remain unchanged. Native Play 1.7.6/code 16 was not replaced in this release. The prior 246 Samsung pack/transfer acceptance remains the latest physical Meadow acceptance.

## Evidence and next work

Private local evidence is under `D:/Chat Gpt/workspaces/meadow-production194-evidence/performance237/`: `meadow247-public-readback.json`, `meadow247-gateway61-readback.json`, `meadow247-backend-readback.json` and `meadow247-final-acceptance.json`.

Root's private evidence is under `FairplayAdmin/evidence/meadow-policy-integration-20261114/`: `public-consumer.json`, `public-consumer-api.json` and `consumer-qualification.json`. Keep raw account identifiers and credentials out of public source.

Remaining work is listed in the active backlog: hosting/checkout reduction with a hosted comparison, longer cross-map and touch sessions, Android advisories, development-dependency review, weekly-prize eligibility feedback and Bee Shelter edge cases. No archive deletion, workflow optimization or new native provider testing was mixed into this release. Main/Pages, phone, Windows UI and heavy-build leases are released. Littles owns its separate acceptance and later work.
