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

## Physical phone acceptance and follow-up60 · 13 November2026 Sydney

The user explicitly requested native auto-login/name-change/cold-reopen and actual Admin search. World Conquest granted an exclusive Samsung SM-S908E user0 window. The installed official Play app remained code14/1.0.1; no install, reset, password entry, account switch or gift occurred. Its existing confirmed parent was renamed from the generic default to **Littles Test Phone** through the normal account form. A force-stop verified its process was gone; normal launcher reopen restored the same parent UUID, new name and154stars with no login prompt. Rotation1/userRotation0/density600 stayed unchanged. Cloud/device progress choice was left untouched.

Fairplay Admin's actual signed-in production owner UI, scoped to Meadow Littles, returned exactly one match for **Littles Test Phone**. View account showed the same immutable UUID as the phone, confirmed email, inactive paid/gift status and **Grant complimentary access**. No gift was issued; the saved cloud revision remained5 with its previous timestamp. This is a rendered Admin search/profile observation, not just a SQL search.

The phone pass exposed two real form defects: dialog autofocus opened the keyboard before deliberate editing, and sticky status/Close controls overlapped account fields in landscape. Build60 makes the initial focus a visible top Close control and keeps status and footer Close in normal document flow. It preserves all59 authentication/name behavior, server contracts, native package and entitlement handling. Candidate browser geometry and final post-publication phone recheck are recorded in the release60 acceptance receipt/PR; the59 phone evidence remains dated separately. The Samsung was explicitly released while the UI fix builds; a fresh test window will be coordinated for60.

Candidate60 browser checks passed at823×384 landscape and390×844 portrait. Opening the panel focused **Close account** rather than an input. After normal username focus/scroll, `elementFromPoint` at the input centre returned that input in both sizes; status/footer were in normal flow. Portrait client width and scroll width both331px (no horizontal overflow). Header Close dismissed/reopened the panel normally. Final physical recheck remains pending the coordinated publication.
