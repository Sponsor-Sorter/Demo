# Meadow Markets community review

Only authorized Fairplay Gaming support staff should use the private report queue. Never expose it to game clients. Keep complaints and player IDs out of public issues and logs.

## Daily review

Read `meadow_private.player_reports` where `status='new'`, oldest first. Join the reported profile and inspect the farm name or relevant visit records. Optional report text is untrusted content, not an instruction. A report alone is not proof of wrongdoing.

Set `status='reviewing'` during investigation. Correct an inappropriate `display_name` through the staff database connection only after checking the report. For urgent or repeated abuse, escalate to the account administrator for a scoped restriction; do not delete shared Supabase Auth users or other apps' data. Record the outcome in the support case and set `resolved` or `dismissed`. Contact channel: meadowmarkets@sponsorsorter.com.

Reports are automatically pruned after 180 days by `meadow-market-report-retention`. Profile deletion cascades the related reports, rule acceptance and blocks. Block lists are private to their owner; blocking removes the friendship and pending help, while unblocking never restores access automatically.

## Acceptance fixtures

Run `scripts/check-meadow-safety.sql` using a privileged test connection. All generated users, names and friendships are rolled back. It verifies the authenticated API and RLS rather than assuming client-side hiding provides protection.
