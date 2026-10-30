# Backend207 — verified Farmers Market sales (web205)

The staged farm-command gateway now consumes an owned, successful, verified `market_pack` or `market_weigh` round for `market.sell`. The database supplies the round, goal, originating map and expiry. The command accepts only the round ID and selected good: no client win, score, amount, price or reward.

The server checks current unlocked market goods, exact basket stock, packing-bench premium and market-cart batch capacity using the original quote rules. It charges the goods, awards the fixed sale gold/8XP and consumes the round in the same transaction. The private redemption record prevents a new request ID from reusing a win. Expired, lost, unverified, other-map, other-owner and already-consumed rounds cannot pay. A retry of the accepted request returns the current canonical farm.

The client integration remains **unattached**. When migrating Farmers Market UI, await `finishRound` verification, then send `market.sell`; do not call the old local `settleSale` path for an enrolled farm. Offline practice cannot create a verified sale. Preserve the existing full-screen artwork, controls, narration, scores and retry/back options. Normal protocol3 clients are unchanged until the complete migration is ready.

## Evidence

- 40 Deno reducer/gateway/progression/worker/help/market tests passed. Added cases cover quantity/price injection, cart/bench rules, missing/expired/invalid wins, account/map proof isolation and same-batch reuse.
- Rollback database fixture checks proof ownership, canonical sale plus durable round consumption, accepted retry, new-ID double-spend denial, private grants and rollback of attempted duplicate gold. All fixture data rolls back.
- Source drift/typecheck pass; Edge deployed with JWT verification. No player enrolled and no commerce flags activated.

Web205 remains live and browser update acceptance is recorded under farm205 evidence. Full client UI wiring, server initialization/legacy conversion, verified fishing/woodland rewards and shared village projects still remain. Then a browser canary/rollout and actual native/store/ad/iPad acceptance are required. Google Play beta remains in review; phone work remains paused by the user.
