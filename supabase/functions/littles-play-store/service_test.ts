import { reconcile, rpc } from './service.ts';

const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
async function rejects(run: () => Promise<unknown>, code: string) {
  try { await run(); } catch (error) { assert(error instanceof Error && error.message === code, 'Unexpected failure'); return; }
  throw new Error('Expected rejection');
}

Deno.test('actual reconciliation handles void HTTP saves before acknowledging purchases', async t => {
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLAY_SERVICE_ACCOUNT'];
  const prior = names.map(name => Deno.env.get(name)), originalFetch = globalThis.fetch;
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const encoded = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey))));
  const owner = '11111111-1111-4111-8111-111111111111', account = 'a'.repeat(64), token = 'fixture-purchase-token';
  let writeSucceeds = true, acknowledged = false;
  const events: string[] = [];
  Deno.env.set('SUPABASE_URL', 'https://mock.invalid');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture-service-key');
  Deno.env.set('GOOGLE_PLAY_SERVICE_ACCOUNT', JSON.stringify({ client_email: 'fixture@example.invalid', private_key: '-----BEGIN PRIVATE KEY-----\n' + encoded + '\n-----END PRIVATE KEY-----' }));
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'fixture-oauth-token', expires_in: 3600 });
    if (url.includes('/purchases/subscriptionsv2/tokens/')) return Response.json({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: acknowledged ? 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' : 'ACKNOWLEDGEMENT_STATE_PENDING',
      externalAccountIdentifiers: { obfuscatedExternalAccountId: account }, testPurchase: {},
      lineItems: [{ productId: 'ml_plus', offerDetails: { basePlanId: 'monthly' }, expiryTime: new Date(Date.now() + 300000).toISOString() }],
    });
    if (url.endsWith('/rpc/meadow_littles_play_owner')) return Response.json({ user_id: owner, test_allowed: true });
    if (url.endsWith('/rpc/meadow_littles_play_record')) { events.push('record'); return new Response(null, { status: writeSucceeds ? 204 : 503 }); }
    if (url.endsWith(':acknowledge')) { events.push('acknowledge'); return new Response(null, { status: 204 }); }
    if (url.endsWith('/rpc/meadow_littles_play_status')) return new Response(null, { status: 204 });
    throw new Error('Unexpected isolated HTTP request');
  }) as typeof fetch;
  try {
    await t.step('204 receipt save completes and acknowledgement follows', async () => {
      const result = await reconcile(token, owner);
      assert(result.active && result.owner === owner, 'Valid paid delivery was lost');
      assert(events.join(',') === 'record,acknowledge', 'Acknowledge must follow the successful durable write');
    });
    await t.step('missing status bodies fail closed', async () => {
      await rejects(() => rpc('meadow_littles_play_status', {}), 'LITTLES_STORE_UNAVAILABLE');
    });
    await t.step('a failed receipt write prevents acknowledgement', async () => {
      events.length = 0; writeSucceeds = false;
      await rejects(() => reconcile(token, owner), 'LITTLES_STORE_UNAVAILABLE');
      assert(events.join(',') === 'record', 'An undelivered purchase was acknowledged');
    });
    await t.step('restore of an acknowledged purchase never acknowledges again', async () => {
      events.length = 0; writeSucceeds = true; acknowledged = true;
      assert((await reconcile(token, owner)).active, 'Acknowledged restore failed');
      assert(events.join(',') === 'record', 'Acknowledged purchase was acknowledged twice');
    });
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (prior[index] === undefined) Deno.env.delete(name); else Deno.env.set(name, prior[index]!); });
  }
});
