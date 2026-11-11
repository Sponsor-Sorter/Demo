import { acknowledge, sha, subscription } from './google.ts';
import { validateSubscription } from './rules.ts';
export async function rpc(name: string, body: unknown, bearer?: string) {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, base = Deno.env.get('SUPABASE_URL')!;
  const response = await fetch(base + '/rest/v1/rpc/' + name, { method: 'POST', signal: AbortSignal.timeout(12000), headers: { apikey: secret, Authorization: 'Bearer ' + (bearer || secret), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error('LITTLES_STORE_UNAVAILABLE');
  return response.json();
}
export async function reconcile(token: string, expectedOwner?: string) {
  // The start timestamp prevents a slower earlier lookup overwriting a later lookup.
  const observed = new Date().toISOString(), purchase = await subscription(token);
  const accountId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (typeof accountId !== 'string' || !/^[a-f0-9]{64}$/.test(accountId)) throw new Error('PURCHASE_ACCOUNT_MISMATCH');
  const owner = await rpc('meadow_littles_play_owner', { p_account_hash: accountId });
  if (!owner?.user_id || expectedOwner && owner.user_id !== expectedOwner) throw new Error('PURCHASE_ACCOUNT_MISMATCH');
  const verified = validateSubscription(purchase, accountId);
  if (verified.test && !owner.test_allowed) throw new Error('LICENSE_TEST_NOT_ENABLED');
  const tokenHash = await sha(token);
  const linked = purchase.linkedPurchaseToken;
  if (linked !== undefined && (typeof linked !== 'string' || linked.length < 10 || linked.length > 4096 || linked === token)) throw new Error('INVALID_PURCHASE');
  await rpc('meadow_littles_play_record', { p_user: owner.user_id, p_account_hash: accountId, p_token_hash: tokenHash, p_state: verified.state, p_expires: verified.expires, p_observed: observed, p_test: verified.test, p_linked_hash: linked ? await sha(linked) : null });
  // Durable entitlement/ownership first. Never acknowledge an undelivered purchase.
  if (verified.active && !verified.acknowledged) await acknowledge(token);
  return { owner: owner.user_id, active: verified.active };
}
