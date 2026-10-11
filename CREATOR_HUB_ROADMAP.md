# Sponsor Sorter: creator hub product direction

Research date: 11 October 2026. These are proposed improvements, not shipped features. Competitor statements below come from their own public documentation and have not been independently tested.

## Product aim

Give creators one place to present their work, find suitable partners, organise deliverables, review content, and understand campaign results. Give sponsors a clear route from choosing a creator to assessing the agreed work. Preserve the current black/blue grid identity.

The first useful audience is creators actively seeking or managing brand partnerships. Expand from that proven workflow into wider creator tools. Feature count alone will not produce a healthy marketplace; genuine sponsors and relevant opportunities are essential.

## Research and adaptations

| Source | Observed pattern | Sponsor Sorter adaptation |
| --- | --- | --- |
| [Passionfroot creator tools](https://www.passionfroot.me/creators) | Media kits, rates, booking forms, scheduling and a campaign workspace | Extend existing public profiles with optional service packages, availability and approved portfolio examples. Add a private daily workspace. |
| [beehiiv direct sponsorships](https://www.beehiiv.com/support/article/30651400536727-how-to-create-a-direct-sponsorship-storefront) | Product/package storefront and dedicated booking/pricing dashboard | Reusable sponsorship packages: deliverables, platforms, price/currency, revision allowance, turnaround and usage permissions. Requests start a proposal, not an automatic financial commitment. |
| [Collabstr approvals and payments](https://collabstr.com/features/approve-and-pay/) | Deliverable review, revision requests, approval and transaction history | Extend existing private draft/version review into an explicit checklist, agreed changes and visible audit trail. Payment remains a separate server-verified state. |
| [Kit creator discovery](https://help.kit.com/en/articles/10294473-how-to-find-creator-network-creators-to-recommend) | Multiple recommendation reasons and a Not interested control | Add account-owned saved/dismissed recommendations and creator-to-creator collaboration discovery. Never claim shared connections unless those connections actually exist. |

Adapt workflows using original implementation and wording. Do not copy proprietary code, assets or competitor claims.

## Existing foundations to reuse

- Finder supports profile/opportunity/group discovery, a browser-local shortlist and explicit preference matching. Latest matching ranks opposite-role partners; it does not yet include collaboration matching or durable feedback. Candidate scan is capped at 5,000 and follower data can be unavailable.
- Public profiles and sharing already exist; build on these rather than create a second public identity system.
- Campaign search, ordering and deadline filters already exist in js/campaignTools.js.
- Private draft upload, version review, publication validation and participant protections have been implemented. Current HANDOVER.md records test scope and limitations.
- Payments are NOT fully production-verified. Verified funding, atomic settlement, webhook handling, replay protection and refund recovery remain gating work. Admin recording of an external payout is not proof that funds moved.

## Build order and completion criteria

### 0. Reliable transactions and platform connections

Before promoting paid deals, reconcile provider-backed funding, settlement, refunds and payouts; test duplicate events, concurrency, partial failures and recovery in test mode. Never infer payment from a redirect or a client status. Confirm OAuth reconnect and revocation paths. Protect real user Moikailive from test mutations. This is prerequisite work, not a UI enhancement.

### 1. Today workspace and campaign calendar

Show overdue deliverables, deadlines this week, drafts awaiting the current user's decision, and the next valid action for each campaign. Reuse authorised campaign records; avoid another parallel status system. Add calendar/list views and opt-in calendar export. All dates must define timezone semantics. Private feed URLs, if introduced, need revocable secrets; do not publish campaign details in public feeds.

Acceptance: each item opens the exact relevant campaign; terminal/archived items do not appear as unfinished tasks; creator and sponsor see correct actor-specific actions; empty/error states are useful; keyboard and narrow-screen layouts work.

### 2. Public media kit and sponsorship packages

Creator-controlled packages and portfolio items, a professional printable media kit, platform statistics with source and last-updated timestamps, explicit availability, and a proposal CTA. Keep private contact details, wallet balances, tokens and unpublished drafts out of the public projection. Distinguish declared handles from verified platform connections. Packages are editable future offers; accepted agreements retain a snapshot.

Acceptance: public and signed-in views expose only intended fields; unsafe URLs rejected; disabled profiles respect visibility; proposal uses correct recipient; package editing cannot silently alter an existing agreement.

### 3. Durable partner discovery and collaboration

Save shortlist and dismissals privately per account, explain weaker matches, offer adjustable preferences, and add a separate opt-in creator-collaboration mode. Move candidate ranking to indexed server queries before the directory outgrows the current bounded client scan. Add language, explicit availability and commercial preferences only through consented profile fields.

Acceptance: no account can read another's private shortlist/feedback; dismiss/undo persists across devices; sparse data gives honest results; missing follower counts never become verified eligibility; no paid-plan ranking advantage disguised as compatibility.

### 4. Campaign results that remain useful

Keep completed campaigns accessible. Show supported platform metrics, last refresh time, collection status and metric history. Handle deleted/private content, expired authorisations and unavailable APIs honestly. Compute cost per view/engagement only with valid denominators and explicit spend definition. Sales ROI requires actual attribution data, not estimated views. Background refresh needs bounded retries, quotas and monitoring; avoid promising universal real-time coverage.

Acceptance: inaccessible content shows unavailable/stale rather than zero; sponsor can revisit a completed campaign; previous snapshots survive an API failure; participant-only commercial data remains private.

### 5. Content library, relationships and practical resources

Organise approved content and usage expiry, past partners, reusable briefs and negotiation/disclosure checklists. Add collaboration groups and moderation/reporting where there is actual community demand. Track rights granted per agreement rather than imply the platform owns uploaded work. Introduce external deal tracking later with clearly labelled manual records; these must not count as verified platform payments or reviews.

## Validation and measurement

- Validate demand with genuine creators and sponsors. Track completed profiles, relevant enquiry rate, proposal-to-acceptance rate, on-time completion and repeat partnerships. Separate test fixtures from business metrics.
- Prefer a small set of genuinely useful opportunities over inflated empty listings. Do not fabricate users, testimonials, verification or results.
- Every release: role/ownership checks, safe text and links, mobile/desktop containment, useful empty/error states, tests for new behaviour, and a precise handover of anything unverified.
- Do not rebuild newsletters, social publishing, livestream hosting or an advertising network until there is evidence users need those inside Sponsor Sorter and the supporting integrations are feasible.

## Recommended next implementation

Build the Today workspace first while continuing the payment readiness work. It adds daily value using existing authorised records, benefits both roles, and does not depend on a large marketplace or new external providers. Follow with media kit packages and durable recommendation feedback.
