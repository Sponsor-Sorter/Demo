# Isolated Littles QA

Rules and account lifecycle checks use in-memory Supabase clients. The local browser fixture server adds `connect-src 'self'; form-action 'self'` to every response, including the full app entry and errors. A fresh QA browser profile cannot send signup, realtime or other remote connection requests from these pages.

Run the guarded checks from the repository root:

```
node scripts/check-littles-qa-network.cjs
node scripts/check-littles.cjs
node scripts/check-littles-bug-input-browser.cjs
```

For another Node QA entry point, preload the loopback-only guard:

```
node --require ./tools/littles-local/qa-network.cjs path/to/check.cjs
```

The guard rejects remote fetch, HTTP, HTTPS, sockets and WebSockets. Fetch redirects cannot leave a local fixture. The game-checks CI job applies this preload to child Node processes too. Browser acceptance checks verify the actual CSP against a reachable fake auth endpoint: zero signup or preflight requests may escape the page. Do not probe real signup endpoints to test isolation.

Live phone/browser acceptance reuses the existing retained identities and persistent app/browser storage. Never point an empty isolated profile at the public game or retry provisioning after an error. Eleven archived one-off production signup scripts were retired on 27 November 2026; do not restore their provisioning modes. Their exact original hashes and the authorised keep-20 cleanup receipt are stored in the local QA evidence directory.

This is test infrastructure only. Normal players can still create guest accounts, and their login, saves and purchases use the existing production path.
