# Meadow Markets 222: Fairplay account controls

1 November 2026. This release connects Meadow Markets to the existing Fairplay control plane in project `ejavqlyozqhzqogflqzr`. It does not create an administrator, activate commerce/ads, or change shared authentication settings. Public rollout and activation receipts are recorded below after acceptance.

## Player experience

- Settings → Community → Account notices, warnings & appeals shows only the signed-in Meadow account's decisions and relevant game/build notices. Warning acknowledgment and appeal submission retain stable request IDs across retries. Text is escaped.
- Active bans pause gameplay; social restrictions stop social/new ranked activity while retaining private farming. New sessions respect maintenance; an already admitted session can finish and leave. Account settings, recovery, deletion and support remain reachable.
- Account switches clear the prior account's notices/drafts. Expired/revoked sessions ask for sign-in instead of replacing the farm or silently discarding a pending authoritative command.
- Existing artwork, original farmer voices, brown notification positioning and normal farm layout are retained. Account notices use readable 15 px action text and at least 44 px touch targets.

## Server enforcement

All central requests bind the app to `meadow` and derive the actor from the verified bearer/session. The database independently checks `auth.sessions` identity and expiry. Client app, actor, session and evidence fields cannot change authority. Informational build numbers select notices only.

Guarded routes include raw save/profile/friendship writes, authoritative farm commands, ranked rounds, visits, rewards, collection/journey actions and new commerce/ad starts. Direct-RPC/RLS and old-gateway paths are covered. Own farm/privacy reads, appeals, recovery/deletion and previously paid provider settlement/restore remain available. Existing legacy farms remain client-authored; this release does not verify their historical wealth or enroll them in protocol 4.

Existing reports retain the private safety queue and also reach Fairplay atomically. The server validates Meadow membership and selects actual relationship/visit or public-directory evidence. Details remain an unproven allegation. Reports are deduplicated/rate limited and never automatically ban a player. Telemetry accepts only three known rejection codes with fixed server text and a ten-event hourly limit; it excludes tokens, saves and arbitrary client prose.

Declared features: `reports`, `moderation`, `warnings`, `appeals`, `maintenance`, `notices`, `telemetry`. There is no `ads.policy` consumer or central match-history declaration. Ads remain public-disabled with the existing native TFUA/PG restrictions. A heartbeat is an on-demand integration observation, not an uptime monitor.

## Exact deployment receipts

- Local migration: `supabase/migrations/20261101055508_meadow_fairplay_consumer222.sql`. Applied catalog version **20261101061454**, name `meadow_fairplay_consumer222`; statement-array SHA256 `c963cc9a97a020d3e72d3f8543f507599a0a7a9b84f2b4e533ffaf939f75db61`. Local raw-file SHA256 `690befd5403b03f83b4b795c1a31c54bb9df9c17151371290321856b38113b9b`.
- Stable `meadow-market-farm-actions` **v35**, JWT verification on, bundle SHA256 `6acc92ff7eeb57f344c9ebaee0abcd60053b10880df6f27802b591ac09b29cda`.
- Stable `meadow-market-accounts` **v18**, public login adapter with its existing per-action verification, bundle SHA256 `9f5dcc591fef6ab5aa24e87a4f770e206730512506ee36f1cd981386ce4dedd1`.
- Final generated rule-source digest prefix `2e19dcb56d66`. Native code remains **12 / 1.7.2**; no new native install is established by a web release.
- Candidate gateways `meadow-market-farm-control222` v1 and `meadow-market-accounts-control222` v1 were used for isolated transport acceptance, with bundles `d023217259907205290610a0c8679ae76726e41f7af15cdab4966b1c771f7348` and `1700c0b0e78e9925684d3788d8245378fe86aef7bf28bddc9c9be222aa5ced89`. They do not establish public-client acceptance.

Activation is deliberately separate: `meadow_private.control_config.enforced` stays false until public client acceptance. No synthetic/real player sanction is needed for activation.

## Public rollout and activation

Source `229414510a7aca03340983964ef5bc3e9b134628` is public web222. CI41282108389 passed both jobs (game regression and both Android build variants); Pages41282108449 completed successfully. The six public feed/index/control/style/game/service-worker files match the committed Git blobs. Receipt: `D:/Chat Gpt/workspaces/meadow-production194-evidence/control222/public222-source.json`. Reviewed safety.css differs only by three normalized CRLF line endings; normalized content is identical. Native12 is unchanged and no physical install is claimed.

Independent production-browser acceptance passed existing Willowbrook Meadow level17 farm boot, Settings → Game build222, Community → Account notices with no restrictions, and Account/recovery/settings return. Console warnings/errors were empty. No manual save/gameplay, report, decision, purchase or ad actions; autonomous helpers progressed while visible. Screenshot: `C:/Users/jrbwi/OneDrive/Documents/ChatGPT/mobile games/FairplayAdmin/evidence/meadow-control222/public222-account-notices.png`.

Enforcement was enabled **2026-11-01T06:55:28.763Z** after checking zero active Meadow decisions and no maintenance. Public commerce/ads/readiness remained false. A new disposable anonymous account then passed actual stable services with enforcement ON: pre-profile status200, profile201, admission200, identity200, unchanged disabled-new-farm guard409, actor spoof422, logout204, revoked-RPC403 and gateway401. No save/resources/password/email was created. Cleanup refused an initial display-name assumption; after inspecting only that exact anonymous QA UUID and proving no saves, sessions or other-app memberships, the normalized QA profile and Auth row were removed. Temporary token file deleted. Evidence: `stable-auth222-report.json` in the external control222 evidence folder.

An independent fresh **post-enforcement** reload also passed existing level17 farm connection, Settings222, Community/account notices and recovery/settings return. No console warnings/errors or manual gameplay/account/provider mutations. Proof: `FairplayAdmin/evidence/meadow-control222/public222-enforcement-on.png`.

One on-demand integration declaration was accepted at **2026-11-01T06:57:27.336397Z**: app `meadow`, protocol1, consumer `meadow-control222`, all seven declared features, metrics `client_rollout=public222`, `enforcement=true`, `observation=on-demand acceptance, not uptime`. No ads.policy capability is declared. Final sanitized receipt: `D:/Chat Gpt/workspaces/meadow-production194-evidence/control222/final-receipt.json`.

## Acceptance evidence and limits

1. `tools/meadow-control222-check.sql` passed in explicit rollback transactions: session expiry/revocation, actor/app spoofing, actual authenticated-role raw writes, ban/restrict/revoked/expired decisions, read/recovery preservation, acknowledgment/appeal ownership and retry, report evidence/dedup/rate limits, wrong-game isolation, maintenance admission, notice filtering, old service routes and bounded telemetry. No test decision/report persisted.
2. Focused control gateway/UI/immutable-retry checks, the 63 shared rule/gateway/control tests, generated-rule comparison, Deno type checks and the full Node regression passed. CI remains the committed-source check.
3. Actual disposable Auth → PostgREST/Edge test at **2026-11-01T06:19:40.980Z**: valid identity/status 200; body actor spoof 422; RPC spoof 400; logged-out 401; revoked JWT rejected by RPC 403, farm gateway 401 and account adapter 401. New-farm rollout remained disabled (409). The synthetic account/profile was removed, session revoked and temporary token file deleted; no password, email, resource grant or sanction created. Sanitized evidence: `D:/Chat Gpt/workspaces/meadow-production194-evidence/control222/live-auth-report.json`.
4. Independent real-browser review of the actual control module in a synthetic local harness passed **2026-11-01T06:34:25.723Z**: warnings/ack, appeals, ban/recovery access, maintenance distinctions, session expiry, account switch, notices, 390×844 layout without horizontal overflow, readable actions and 44 px controls. Receipt/screenshots: `C:/Users/jrbwi/OneDrive/Documents/ChatGPT/mobile games/FairplayAdmin/evidence/meadow-control222/ui-acceptance.json`. This is not production farm boot, native phone or backend evidence. Accepted control.js SHA256 `1b4eff2d5031531a8de14c7a31dd13a72890962e5b968feb35d9d82e13a8f260`; safety.css `5ab6fcf7a35846ddb539594ccadbb3129ec495a20d59ff7bebbdaeef29181228`.

The physical iPad check is pending with the human. Samsung native 12/provider acceptance and the other launch gates in `MEADOW_LAUNCH_STATUS.md` remain separate. No current Google public-review status has been rechecked for this release.

## Rollback

If control integration causes a regression, turn `control_config.enforced` off while investigating; leave paid settlement/recovery operational. Preserve decisions/reports/audit history. Publish any client rollback as a higher web/cache build. Do not lower native/web versions, mass-convert farms or use legacy snapshots to bypass authoritative save rules.

Exact operator-only emergency switch (data setting, not a schema change):

```sql
update meadow_private.control_config set enforced=false where id;
```
