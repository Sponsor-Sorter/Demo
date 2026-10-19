# Meadow Markets username accounts

Deploy `index.ts` as `meadow-market-accounts` in the existing game project after applying `supabase/meadow-accounts.sql`.

The public endpoint checks passwords through Supabase Auth. Registration independently verifies the caller's current anonymous JWT and their existing Meadow Markets profile. The privileged service key is supplied by the Edge runtime and never shipped in the game. Login usernames and short-lived hashed rate buckets have RLS and no client writes.

Registration converts the current guest user in place, preserving their save and friendships. Internal email aliases are game-controlled identifiers, not real recovery addresses. Project-wide confirmation and other applications' logins are not changed. Browser authentication uses the dedicated `meadow-markets-auth-v1` key. Switching saves the current farm before installing the new session, and retains a previous guest session so it can be reopened on that device.

Email recovery is not implemented for username accounts yet. It must verify ownership of a real recovery address before changing the alias. Do not disable project-wide email confirmation or mark a user's real mailbox verified without proof.
