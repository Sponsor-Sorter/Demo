# Littles accounts · build 59

Grown-up Settings → Grown-up account & cloud save now offers an editable **Account username** and read-only Account ID. Normal session restoration uses the existing Supabase persistent session, not stored passwords. Refresh/online/pageshow/foreground changes reconnect outside Supabase's auth callback lock. A remembered account with an expired session requests sign-in instead of silently creating another guest. Explicit sign-out stays signed out across a restart and still exposes the sign-in form.

The existing storage key `meadow-littles-auth-v1` is unchanged. The configured storage adapter is now passed explicitly to Supabase. `meadow-littles-account-v1` stores only the remembered UUID or signed-out marker. A per-account `choice` marker persists the explicit cloud/device decision across a restart during account switching. No local/cloud save is automatically imported, reset or reassigned by login or renaming. Pending saves and revisions remain scoped by immutable Auth UUID.

## Canonical Admin contract

- Profile: `public.meadow_littles_profiles`, immutable `user_id` UUID primary key; editable `display_name` and `updated_at`.
- Update: authenticated `public.meadow_littles_open(p_display_name text)`; existing private `open`/`require_actor`/`guard_read` enforce current live session, ownership and moderation. Client validates 1–32 trimmed Unicode characters and rejects control characters; the server remains authoritative.
- Admin search: existing Fairplay `server/adapters.mjs` and hosted `cloud/handler.mjs` already use `display_name ilike '%query%'` for Littles and exact `user_id` for UUID input. No new field, function, index, migration, public player directory or Admin release is required. Existing profile UUID primary-key index is unchanged.
- Names are non-unique display names. UI shows the complete immutable Account ID for disambiguation. A name is never an entitlement, role, login identifier or proof of ownership. Gifts/revokes remain targeted to verified Auth UUID, using the existing Admin authorization/confirmation flow. Auth `user_metadata` is not used for authorization.
- Parent login remains grown-up email plus password. Child Write My Name activity remains unrelated/session-only. No changes to shared Auth settings, subscriptions, free-round policy or gifts.

## Verification

- `node scripts/check-littles-accounts.cjs`: persistent SDK storage/key, cold-restart login, token refresh outside auth callback, offline recovery, expired session, explicit sign-out, persisted save choice, name validation, unchanged UUID/save/revision and no password in storage.
- Existing account-recovery checks pass, including actual dialog button callbacks after sign-in/out. Full Littles regression passes.
- Real browser guest `Littles QA Orchard59` was renamed through UI; reload returned the same UUID/name without another login. A scoped server read using the same case-insensitive field as Fairplay found that exact account with save revision zero. Empty name is rejected with readable feedback. A final startup check caught a panel opened before profile loading finished; the panel now refreshes its name/status automatically, with a delayed-connect regression check. Small-screen layout was checked at390×844: no horizontal overflow.
- Phone lease: Littles is not sending phone input and holds no reservation. Current phone owner is unverified; last Meadow246 handoff released it. Root's reserved parent and Google reviewer identities/grants remain untouched. No native account switch, reinstall, data reset or physical-phone acceptance is claimed by these checks.

Publishing acceptance is recorded in the release PR after merge/Pages verification. Backend schema and native Play package are unchanged; the installed app loads the hosted content update normally.
