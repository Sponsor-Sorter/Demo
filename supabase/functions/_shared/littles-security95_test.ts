import { createLittlesEvidence } from './littles-security95.ts';
import { validateSecuritySignal } from './fairplay-security-contract-v1.mjs';
const assert = (value: unknown, label = 'Assertion failed') => { if (!value) throw Error(label); };
const actor = '11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222';

Deno.test('precise save rejection emits only bounded authenticated evidence', async () => {
  const calls: any[] = [], observer = createLittlesEvidence(async (name, body) => {
    calls.push({ name, body }); return { accepted: true };
  }, 'littles-cloud-save');
  await observer.rejectedSave(actor, request, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  assert(calls.length === 1 && calls[0].name === 'fairplay_game_security_signal_v1');
  const p = calls[0].body;
  validateSecuritySignal({ app: p.p_app, actor: p.p_actor, event_id: p.p_event_id,
    source: p.p_source, code: p.p_code, context: p.p_context });
  assert(p.p_actor === actor && p.p_context.request_id === request);
  assert(Object.keys(p.p_context).sort().join(',') === 'correlation_hash,operation,protocol,request_id,verification_stage');
});
Deno.test('same rejected reference deduplicates; a different reference stays distinct', async () => {
  const payloads: any[] = [], observer = createLittlesEvidence(async (_, p) => { payloads.push(p); return { accepted: true }; }, 'littles-cloud-save');
  for (const id of [request, request, '33333333-3333-4333-8333-333333333333'])
    await observer.rejectedSave(actor, id, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  assert(payloads[0].p_context.correlation_hash === payloads[1].p_context.correlation_hash);
  assert(payloads[0].p_event_id !== payloads[1].p_event_id);
  assert(payloads[0].p_context.correlation_hash !== payloads[2].p_context.correlation_hash);
});
Deno.test('stale revisions, limits, invalid saves and generic errors emit nothing', async () => {
  let calls = 0;
  const observer = createLittlesEvidence(async () => { calls++; return { accepted: true }; }, 'littles-cloud-save');
  for (const [code, message] of [
    ['PT409', 'LITTLES_SAVE_REVISION_CONFLICT'], ['PT429', 'LITTLES_SAVE_RATE_LIMIT'],
    ['22023', 'LITTLES_INVALID_SAVE'], ['42501', 'LITTLES_BANNED'],
    ['OTHER', 'LITTLES_REQUEST_BINDING_CONFLICT'], ['PT409', 'request_payload_conflict'],
    ['', 'LITTLES_CONTROL_UNAVAILABLE'],
  ]) await observer.rejectedSave(actor, request, code, message);
  assert(calls === 0);
});
Deno.test('bad actor or request reference cannot create evidence', async () => {
  let calls = 0;
  const observer = createLittlesEvidence(async () => { calls++; return { accepted: true }; }, 'littles-cloud-save');
  await observer.rejectedSave('caller supplied', request, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  await observer.rejectedSave(actor, 'not-a-uuid', 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  assert(calls === 0);
});
Deno.test('UUID letter casing cannot inflate the count of distinct references', async () => {
  const payloads: any[] = [], observer = createLittlesEvidence(async (_, p) => { payloads.push(p); return { accepted: true }; }, 'littles-cloud-save');
  const ref = 'aabbccdd-aabb-4abb-8abb-aabbccddeeff';
  await observer.rejectedSave(actor, ref, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  await observer.rejectedSave(actor, ref.toUpperCase(), 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  assert(payloads[0].p_context.correlation_hash === payloads[1].p_context.correlation_hash);
  assert(payloads[1].p_context.request_id === ref);
});
Deno.test('a failed evidence service stays isolated from the existing rejection', async () => {
  const observer = createLittlesEvidence(async () => { throw Error('private provider details'); }, 'littles-cloud-save');
  const result = await observer.rejectedSave(actor, request, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  assert(result.accepted === false);
  await observer.heartbeat();
});
Deno.test('heartbeat records runtime only and is throttled per observer', async () => {
  let at = 0; const calls: any[] = [];
  const observer = createLittlesEvidence(async (name, p) => { calls.push({ name, p }); return { accepted: true }; }, 'littles-play-store', () => at);
  await observer.heartbeat(); at = 30000; await observer.heartbeat(); at = 60000; await observer.heartbeat();
  assert(calls.length === 2 && calls.every(c => c.name === 'fairplay_game_detector_heartbeat_v1'));
  assert(calls.every(c => c.p.p_app === 'littles' && c.p.p_source === 'littles-play-store' && !('actor' in c.p)));
});
Deno.test('Play observer cannot produce save or wrong-account accusations', async () => {
  let calls = 0;
  const observer = createLittlesEvidence(async () => { calls++; return { accepted: true }; }, 'littles-play-store');
  await observer.rejectedSave(actor, request, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  await observer.rejectedSave(actor, request, 'PURCHASE_ACCOUNT_MISMATCH', 'PURCHASE_ACCOUNT_MISMATCH');
  assert(calls === 0);
});
Deno.test('heartbeat errors and invalid acknowledgements report constant diagnostics', async () => {
  for (const reply of [{ data: { accepted: true }, error: { message: 'private' } },
    { accepted: false }, { data: {} }, null]) {
    const logs: unknown[] = [];
    const observer = createLittlesEvidence(async () => reply, 'littles-cloud-save', () => 0, code => logs.push(code));
    await observer.heartbeat();
    assert(JSON.stringify(logs) === '["LITTLES_SECURITY95_HEARTBEAT_UNAVAILABLE"]');
  }
});
Deno.test('signal delivery and invalid acknowledgements report no payload or error body', async () => {
  for (const failure of ['throw', 'invalid', 'error']) {
    const logs: unknown[] = [];
    const observer = createLittlesEvidence(async () => {
      if (failure === 'throw') throw Error('private credentials and payload');
      return failure === 'invalid' ? { data: {} } : { data: { accepted: true }, error: { message: 'private' } };
    }, 'littles-cloud-save', () => 0, code => logs.push(code));
    const result = await observer.rejectedSave(actor, request, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
    assert(result.accepted === false && result.unavailable === true);
    assert(JSON.stringify(logs) === '["LITTLES_SECURITY95_SIGNAL_UNAVAILABLE"]');
  }
});
Deno.test('failure diagnostics are independently bounded to one constant per minute', async () => {
  let at = 0; const logs: string[] = [];
  const observer = createLittlesEvidence(async () => { throw Error('private'); }, 'littles-cloud-save', () => at, code => logs.push(code));
  for (at of [0, 1, 30000, 59999, 60000]) {
    await observer.heartbeat();
    await observer.rejectedSave(actor, request, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
  }
  assert(logs.length === 4);
  assert(logs.filter(code => code === 'LITTLES_SECURITY95_HEARTBEAT_UNAVAILABLE').length === 2);
  assert(logs.filter(code => code === 'LITTLES_SECURITY95_SIGNAL_UNAVAILABLE').length === 2);
});
Deno.test('synchronous and asynchronous diagnostic failures cannot affect outcomes', async t => {
  for (const asynchronous of [false, true]) await t.step(asynchronous ? 'async logger' : 'sync logger', async () => {
    const observer = createLittlesEvidence(async () => { throw Error('unavailable'); }, 'littles-cloud-save', () => 0, () => {
      if (asynchronous) return Promise.reject(Error('private logger failure'));
      throw Error('private logger failure');
    });
    await observer.heartbeat();
    const result = await observer.rejectedSave(actor, request, 'PT409', 'LITTLES_REQUEST_BINDING_CONFLICT');
    assert(result.accepted === false && result.unavailable === true);
    await Promise.resolve();
  });
});
