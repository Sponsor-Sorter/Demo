# Backend209 — direct sales and tutorial balances (web205)

The mutation inventory found two additional legacy flows: ordinary basket sales and one-time tutorial rewards. Both now have staged server equivalents.

`market.sell_direct` accepts a known good and an exact owned quantity, uses the existing unit sell price, removes the goods, adds sale gold/2XP and records one sale event. Verified premium market deliveries likewise record one sale per batch, rather than trusting a claimed result.

Successful manual farming actions award the matching original10-gold lessons once, in the same canonical transaction. Lesson IDs/titles are extracted from the actual guide definitions. Failed batches award nothing; worker polling cannot manufacture tutorial rewards. Apple harvesting, home placement and manual fleece collection retain their relevant extra lessons. The friends lesson requires a database-recorded visit by that player; its proof is fetched only when requested.

Established-farm arithmetic fixtures now explicitly seed already-earned lessons so crop/animal/shop price checks stay independent of first-player bonuses. Separate fresh-farm fixtures check the full till/plant/water/harvest gold flow, repeat denial, direct sales, visit proof and whole-batch rollback. The combined staged Deno suite is48tests. The help SQL rollback fixture also checks visit-proof isolation. Source drift/type checks pass.

Normal clients remain on web205/protocol3 and no one is enrolled. Client integration must stop the old `guides.reward(10)` mutation on enrolled farms and present the returned `lesson_rewards` without granting them again. Guide tour position/heard flags may remain device preferences; completed/rewarded lesson balances are canonical.

`farm-command-ui.js` and its210test are a separate, unattached integration work in progress. They must not be included in the normal game's index until every mutation route is audited, workers/rounds are switched, deletion cleans its new owner-bound storage keys and a complete browser canary passes. See the remaining production gates in the main backlog.
