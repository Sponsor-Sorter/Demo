import { createVerifier, signatureRaw } from './verify.ts';
import { createHandler, UNIT } from './handler.ts';
import { createHandler as createApi } from '../littles-ad-rounds/handler.ts';
const assert = (value: unknown, message = 'Assertion failed') => { if (!value) throw Error(message); };
const now = 1800000000000, challenge = '11111111-1111-4111-8111-111111111111';
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
function der(raw: Uint8Array) {
  const ints = [raw.slice(0, 32), raw.slice(32)].map(value => {
    while (value.length > 1 && value[0] === 0) value = value.slice(1);
    if (value[0] & 128) value = new Uint8Array([0, ...value]);
    return [2, value.length, ...value];
  }).flat();
  return new Uint8Array([48, ints.length, ...ints]);
}
async function fixture() {
  const key = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', key.publicKey));
  let fetches = 0;
  const verify = createVerifier(async (url: string | URL | Request) => {
    assert(String(url) === 'https://www.gstatic.com/admob/reward/verifier-keys.json'); fetches++;
    return Response.json({ keys: [{ keyId: 7, pem: '-----BEGIN PUBLIC KEY-----\n' + b64(spki) + '\n-----END PUBLIC KEY-----' }] });
  }, () => now);
  async function signed(patch: Record<string, string> = {}, extra = '') {
    const query = new URLSearchParams({ ad_network: 'test-fixture', ad_unit: UNIT, custom_data: challenge, reward_amount: '1', reward_item: 'extra_round', timestamp: String(now), transaction_id: 'signed_fixture_1', ...patch }).toString() + extra;
    const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, new TextEncoder().encode(query)));
    return new URL('https://example.invalid/reward?' + query + '&signature=' + encodeURIComponent(b64(der(raw))) + '&key_id=7');
  }
  return { verify, signed, fetches: () => fetches };
}
Deno.test('Actual ECDSA checks raw query; tampering, duplicate params and malformed signatures fail', async () => {
  const f = await fixture(), url = await f.signed();
  assert((await f.verify(url)).get('transaction_id') === 'signed_fixture_1'); await f.verify(url); assert(f.fetches() === 1);
  for (const bad of [new URL(url.href.replace('extra_round', 'extra_round_changed')), await f.signed({}, '&reward_amount=2'), new URL(url.href + '&signature=again'), new URL(url.href.replace('key_id=7', 'key_id=8'))]) {
    let rejected = false; try { await f.verify(bad); } catch { rejected = true; } assert(rejected);
  }
  for (const bad of [new Uint8Array(), new Uint8Array([48, 6, 2, 1, 128, 2, 1, 1]), new Uint8Array([48, 7, 2, 2, 0, 1, 2, 1, 1])]) {
    let rejected = false; try { signatureRaw(bad); } catch { rejected = true; } assert(rejected);
  }
});
Deno.test('Only signed correct unit, one extra_round and a valid challenge reach receipt storage', async () => {
  const f = await fixture(), writes: any[] = [];
  const handler = createHandler({ verify: f.verify, now: () => now, record: async data => { writes.push(data); return { recorded: true }; } });
  assert((await handler(new Request(await f.signed()))).status === 200); assert(writes.length === 1); assert(writes[0].p_challenge === challenge);
  const invalid: Record<string, string>[] = [{ ad_unit: 'other-unit' }, { reward_amount: '2' }, { reward_item: 'coins' }, { custom_data: 'wrong' }, { timestamp: String(now + 60001) }, { timestamp: String(now - 86400001) }, { transaction_id: 'bad space' }];
  for (const patch of invalid) {
    assert((await handler(new Request(await f.signed(patch)))).status === 403);
  }
  assert(writes.length === 1);
  assert((await handler(new Request(await f.signed({ user_id: 'littles-admob-setup', custom_data: 'verification-only' })))).status === 200); assert(writes.length === 1, 'Signed setup probe must not grant anything');
  assert((await handler(new Request(await f.signed(), { method: 'POST' }))).status === 405);
  const failed = createHandler({ verify: f.verify, now: () => now, record: async () => ({ recorded: false }) });
  assert((await failed(new Request(await f.signed()))).status !== 200, 'Never acknowledge an unrecorded receipt');
});
Deno.test('End-user API rejects missing auth, wrong origins, oversized/invalid requests and non-contract responses', async () => {
  let calls = 0;
  const api = createApi(async (name, data: any, bearer) => { calls++; assert(name === 'meadow_littles_ad_rounds'); assert(bearer === 'fixture-session'); assert(data.p_action === 'status'); return { contract: 'littles-ad-round-v1' }; });
  const request = (body: string, headers: Record<string, string> = {}) => new Request('https://example.invalid/api', { method: 'POST', headers: { authorization: 'Bearer fixture-session', origin: 'https://sponsorsorter.com', ...headers }, body });
  assert((await api(request('{"action":"status","data":{}}'))).status === 200);
  assert((await api(request('{}', { authorization: '' }))).status === 401);
  assert((await api(request('{}', { origin: 'https://evil.invalid' }))).status === 403);
  assert((await api(request('x'.repeat(4097)))).status === 413);
  for (const body of ['broken', '{"action":"grant","data":{}}', '{"action":"status","data":[]}']) assert((await api(request(body))).status === 400 || body === 'broken');
  assert(calls === 1);
});
