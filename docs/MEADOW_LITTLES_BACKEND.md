# Meadow Market Littles backend

Updated 21 October 2026 Australia/Sydney. Project `ejavqlyozqhzqogflqzr` (existing Meadow Markets/BargainBarge), not Sponsor Sorter project `mqixtrnhotqqybaghgny`.

## Deployed objects

Migration `20261020233058_meadow_littles_cloud_storage.sql` creates only:

- `public.meadow_littles_profiles`: own UUID, display name and timestamps; no public directory/email/child profile fields.
- `public.meadow_littles_saves`: own JSON progress, cloud format version, monotonic revision and last successful request binding.
- `meadow_littles_private` fixed-search-path guarded implementations.
- Public SECURITY INVOKER RPCs `meadow_littles_open` and `meadow_littles_save`.

Existing `meadow_market_*` tables/functions, original game files and shared Auth configuration were not modified. New profiles/saves have RLS and authenticated owner-only SELECT. Clients cannot directly insert/update/delete them; guarded RPCs derive the actor from Auth and check its current session and Auth ban state. Guest Auth users are allowed; an unsigned publishable-key caller is not a signed-in guest. Foreign keys delete these rows when their Auth account is deleted.

All JSON is client-reported game progress. Stars/gems/XP/scores, `purchases` and `adFree` are **unverified**. They grant no real subscription, charge, reward, payout or purchased entitlement. No billing, public leaderboard or child-discovery service was added. Art/history and scores can remain inside private progress JSON.

## Browser integration

Load `meadow-market-littles/littles-cloud.js` before the Littles application. It defines `window.meadowLittlesCloud`; do not use the repository-root Sponsor Sorter Supabase client. The module creates a separate Supabase client using the existing Meadow publishable key and **`meadow-littles-auth-v1`** storage. It never copies the original game's session/save keys.

```js
await meadowLittlesCloud.init({
  getState: () => state,
  applyState: cloudState => {
    // Validate known fields/types and replace ONLY the Littles state.
    // Use the game's normal state validator and redraw routine.
    applyValidatedLittlesState(cloudState);
  },
  onStatus: ({state: cloudStatus, code, isGuest, revision}) => {
    // Show plain text status. Keep offline play and local saving available.
  }
});
// After normal local save:
meadowLittlesCloud.queueSave(state);
// Grown-up/settings button:
meadowLittlesCloud.openAccount();
```

`applyValidatedLittlesState` above is application integration pseudocode, not a provided function. The game owner owns the actual state validation/redraw. Cloud data must not be rendered as active HTML or treated as trusted code. Keep `meadow-littles-save-v1` local saving independent of network success. The module does not import farming-simulator saves.

API methods: `init`, `queueSave`, `flush`, `retryPending`, `choose('cloud'|'device')`, `openAccount`, `linkEmail`, `verifyEmail`, `setPassword`, `signIn`, `recover`, `signOut`, `getStatus`. Tests may inject `init({client,storage,...})`; production defaults use the dedicated game configuration. `queueSave` snapshots at enqueue time and debounces writes by1.2seconds. No automatic execution/purchase APIs exist.

Status states include `offline`, `ready`, `saving`, `saved`, `retry_required`, `choice_required`, `signed_out`. Existing remote progress from another device requires explicit cloud/device choice. No silent overwrite occurs. User-selected device overwrite reloads current revision before saving; a concurrent write still causes a conflict.

Pending request UUID, expected revision, expected user and exact snapshot are persisted per Littles user. Unknown outcomes retry that same packet. Later local progress is kept separate until the original packet resolves. Account switches are checked by the client and bound by the server's `p_expected_user_id`. Malformed/unknown receipts retain pending intent. Explicit choice can discard an unresolved local intent after fresh server read. Do not clear all browser storage to resolve a save conflict.

## RPC contract

Authenticated POST `/rest/v1/rpc/meadow_littles_open`:

```json
{"p_display_name":null}
```

Omit the optional display name for normal load. The first call creates only the caller's Littles profile/save. Optional display name must be1..32trimmed characters with no control characters.

Response:

```json
{"ok":true,"contract":"meadow-littles-cloud-v1","profile":{"user_id":"UUID","display_name":"Little Farmer","is_guest":true},"save":{"cloud_version":1,"revision":0,"data":{},"updated_at":"ISO","last_request_id":null},"entitlements_verified":false}
```

Authenticated POST `/rest/v1/rpc/meadow_littles_save`:

```json
{"p_request_id":"fresh UUID","p_expected_revision":0,"p_cloud_version":1,"p_save_data":{"schema":1,"stars":0,"gems":0},"p_expected_user_id":"current Auth UUID"}
```

The cloud format version is separate from the game state's `schema`. The whole save must be an object containing numeric JSON `schema:1`, at most262144bytes in PostgreSQL JSONB text. Revision must be a nonnegative safe integer. No trusted server balances are inferred from that state. Oversized art bitmaps should not be silently uploaded; keep bounded progress/gallery metadata or add a separately reviewed private art-storage design.

Success:

```json
{"ok":true,"contract":"meadow-littles-cloud-v1","revision":1,"request_id":"same UUID","replayed":false,"updated_at":"ISO","entitlements_verified":false}
```

The save row is locked and its revision compared atomically. Exact replay of the **most recently successful** request returns the same revision with `replayed:true`; changed content under that UUID is rejected. After a later successful save, an old request is no longer a retained receipt: its old revision conflicts. This is not indefinite idempotency history. Serial client writes plus CAS make unknown older outcomes reconcile safely. Minimum interval500ms applies to new saves; exact current-request replay bypasses the interval.

Static errors: `LITTLES_SIGN_IN_REQUIRED`/`LITTLES_ACCOUNT_CHANGED`403; `LITTLES_INVALID_DISPLAY_NAME`/`LITTLES_INVALID_SAVE`/`LITTLES_OPEN_REQUIRED`400; `LITTLES_REQUEST_BINDING_CONFLICT`/`LITTLES_SAVE_REVISION_CONFLICT`409; `LITTLES_SAVE_RATE_LIMIT`429. Unknown client errors display `LITTLES_CLOUD_UNAVAILABLE`, without raw SQL/provider text. On409 do not blindly generate a replacement request against the old revision: reload and offer an explicit progress choice.

## Recoverable grown-up account

The settings dialog provides normal Supabase Auth operations:

1. Link an email to the existing guest UUID using `auth.updateUser({email})`.
2. Verify the email through its confirmation link, or `verifyOtp` with `type:'email_change'` if the existing template includes a code.
3. Only after verification, set a password with `auth.updateUser({password})`.
4. Sign in using email/password on another device. Password recovery uses `resetPasswordForEmail` and then the verified recovery session's password update.

Passwords are not stored in game/profile/save tables. The module never sends passwords to a custom game RPC. Guest sign-out is blocked by its UI until email linking, because a guest otherwise cannot recover that Auth identity. Signing into an existing account does not reassign the previous guest's rows; local progress transfer requires explicit device/cloud choice.

The published Littles URL must be accepted by the project's existing redirect allowlist for confirmation/recovery links. Manual identity linking/email capabilities and actual parent email round-trip must be checked in the deployed game. No shared Auth settings or templates were changed here to avoid affecting the original game. Do not report email recovery as live-tested from backend save tests alone; no real email was sent during these tests.

## Verification evidence

- Candidate DDL compiled and authenticated-without-session/direct-write denial checks passed in a rollback transaction before deployment.
-16actual HTTP checks with two normal GoTrue guest accounts passed: own load/save; exact replay; changed UUID binding409; stale revision409; cross-account SELECT empty; expected-account403; direct UPDATE403; oversized data400; two simultaneous writes yield one success and one conflict; latest revision read; normal sign-out; revoked-session RPC403.
- Both disposable Auth users were deleted; their new Littles profile/save rows cascaded; final Littles counts0/0. No email, payment or subscription was created.
- Six focused client tests passed: immutable snapshot; stable unknown-outcome retry despite newer local state; account switch prevents RPC; explicit remote choice; fresh-revision device choice; malformed receipt retains intent. Syntax check passed.
- Original profiles fingerprint matched before/after. Original live saves fingerprint changed during the interval; this is recorded without attributing the concurrent activity. No Littles migration/test statement wrote original game tables. Do not claim all original live saves were static.
- Evidence files in the Supabase worker workspace: `work/meadow-littles/live_probe.py`, `LIVE-ACCEPTANCE.json`, `CLEANUP-IDS.json`, `cloud_test.cjs`.
- Game-agent index/UI wiring, visual acceptance and a real email confirmation/recovery round-trip remain separate from these backend/module checks.

[Supabase anonymous accounts and identity linking](https://supabase.com/docs/guides/auth/auth-anonymous)
