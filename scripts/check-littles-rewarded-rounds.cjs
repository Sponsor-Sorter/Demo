'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { create, CONTRACT, KEY } = require('../meadow-market-littles/rewarded-round-core.js');
// Synthetic provider and server fixtures only: these tests never request an ad or prove format eligibility.
const A = '130d552c-3e94-4ec4-8e6b-62548f1d9dff', B = '14d84995-9793-4051-8da2-70c4da61c765';
function fixture() {
  const files = new Map(), count = { prepare: 0, show: 0, settle: 0, verify: 0 };
  const state = { actor: A, plus: false, parentReady: true, canRequestAds: true, left: 0, now: 1800000000000 };
  const policy = { enabled: true, contract: CONTRACT, formatReviewed: true, requiredCloseMs: 5000, eligibilityEvidence: 'https://example.invalid/synthetic-fixture-only', unit: 'ca-app-pub-3940256099942544/5354046379' };
  const receipt = { contract: CONTRACT, actor: A, game: 'harvest_slice', challenge: 'challenge-1', transaction: 'transaction-1', amount: 1, expiresAt: state.now + 60000 };
  const storage = { getItem: key => files.get(key) || null, setItem: (key, value) => files.set(key, value) };
  const hooks = { prepare: async data => ({ contract: CONTRACT, actor: state.actor, game: data.game, challenge: 'challenge-1', unit: policy.unit, expiresAt: state.now + 60000 }), show: async () => ({ earned: true, closed: true }), settle: async () => receipt, verify: async () => true };
  const options = { context: () => ({ ...state, remainingBaseRounds: () => state.left }), policy: () => policy, storage, now: () => state.now, uuid: () => 'client-request-1', prepare: async data => { count.prepare++; return hooks.prepare(data); }, show: async data => { count.show++; return hooks.show(data); }, settle: async data => { count.settle++; return hooks.settle(data); }, verifyGrant: async (...args) => { count.verify++; return hooks.verify(...args); } };
  const core = create(options);
  return { core, options, state, policy, receipt, storage, files, count, hooks };
}
test('Disabled or unverified provider capability never prepares or shows an ad', async () => {
  for (const patch of [{ enabled: false }, { formatReviewed: false }, { requiredCloseMs: 30000 }, { eligibilityEvidence: '' }, { unit: '' }]) {
    const f = fixture(); Object.assign(f.policy, patch);
    assert.equal(f.core.available('harvest_slice'), false); assert.equal((await f.core.watch('harvest_slice')).status, 'unavailable');
    assert.deepEqual(f.count, { prepare: 0, show: 0, settle: 0, verify: 0 });
  }
});
test('Plus, consent, parent state and unused free rounds all suppress the offer', async () => {
  for (const patch of [{ plus: true }, { parentReady: false }, { canRequestAds: false }, { left: 1 }, { actor: '' }]) {
    const f = fixture(); Object.assign(f.state, patch); assert.equal((await f.core.watch('harvest_slice')).status, 'unavailable'); assert.equal(f.count.show, 0);
  }
});
test('A full ad plus a verified server receipt grants one completed round for the selected game only', async () => {
  const f = fixture(); assert.equal((await f.core.watch('harvest_slice')).status, 'ready');
  assert.equal(f.core.remaining('harvest_slice'), 1); assert.equal(f.core.remaining('meadowpairs'), 0);
  assert.equal(f.core.available('harvest_slice'), false); const ticket = f.core.begin('harvest_slice');
  assert.equal(f.core.complete(ticket), true); assert.equal(f.core.complete(ticket), false); assert.equal(f.core.remaining('harvest_slice'), 0);
});
test('Failed or abandoned gameplay does not consume an earned round; reopening retains it', async () => {
  const f = fixture(); await f.core.watch('harvest_slice'); f.core.begin('harvest_slice');
  const reopened = create(f.options); assert.equal(reopened.remaining('harvest_slice'), 1);
  assert.equal(reopened.complete(reopened.begin('harvest_slice')), true); assert.equal(reopened.remaining('harvest_slice'), 0);
});
test('An early ad dismissal grants nothing and does not contact settlement', async () => {
  const f = fixture(); f.hooks.show = async () => ({ earned: false, closed: true });
  assert.equal((await f.core.watch('harvest_slice')).status, 'cancelled'); assert.equal(f.core.remaining('harvest_slice'), 0);
  assert.equal(f.count.settle, 0); assert.equal(JSON.parse(f.files.get(KEY)).pending.length, 0);
});
test('A client earned callback without server verification grants nothing', async () => {
  const f = fixture(); f.hooks.verify = async () => false;
  assert.equal((await f.core.watch('harvest_slice')).status, 'unverified'); assert.equal(f.core.remaining('harvest_slice'), 0);
});
test('Wrong account, game, challenge, quantity, expired receipt or contract cannot grant a round', async () => {
  for (const patch of [{ actor: B }, { game: 'meadowpairs' }, { challenge: 'different' }, { amount: 2 }, { expiresAt: 0 }, { contract: 'littles-play-v1' }]) {
    const f = fixture(); Object.assign(f.receipt, patch); assert.equal((await f.core.watch('harvest_slice')).status, 'unverified'); assert.equal(f.core.remaining('harvest_slice'), 0);
  }
});
test('Delayed server verification recovers without showing another ad and duplicate recovery gives no extra round', async () => {
  const f = fixture(); f.hooks.settle = async () => ({ status: 'pending' });
  assert.equal((await f.core.watch('harvest_slice')).status, 'pending'); assert.equal(f.core.available('harvest_slice'), false);
  const reopened = create(f.options); f.hooks.settle = async () => f.receipt;
  assert.equal((await reopened.recover('harvest_slice')).status, 'ready'); assert.equal((await reopened.recover('harvest_slice')).status, 'nothing_pending');
  assert.equal(reopened.remaining('harvest_slice'), 1); assert.equal(f.count.show, 1);
});
test('Interrupted load only blocks another offer until the nonce deadline; late earned receipts remain recoverable', async () => {
 const f=fixture();f.hooks.show=async()=>{throw Error('Process interrupted');};f.hooks.settle=async()=>({status:'pending'});
 assert.equal((await f.core.watch('harvest_slice')).status,'pending');assert(!f.core.available('harvest_slice'));
 f.state.now+=60001;assert(f.core.available('harvest_slice'),'The prepared nonce deadline, not24hours, bounds offer suppression');
 f.receipt.expiresAt=f.state.now+60000;f.hooks.settle=async()=>f.receipt;
 assert.equal((await f.core.recover('harvest_slice')).status,'ready');assert.equal(f.core.remaining('harvest_slice'),1);assert.equal(f.count.show,1);
 assert.equal((await f.core.recover('harvest_slice')).status,'nothing_pending');
});
test('An older pending request cannot starve a newer verified request for the same game; late receipts remain exact-once',async()=>{
 const f=fixture();f.hooks.show=async()=>{throw Error('Interrupted');};f.hooks.settle=async()=>({status:'pending'});
 await f.core.watch('harvest_slice');f.state.now+=60001;
 f.hooks.prepare=async()=>({contract:CONTRACT,actor:A,game:'harvest_slice',challenge:'challenge-2',unit:f.policy.unit,expiresAt:f.state.now+60000});await f.core.watch('harvest_slice');
 const receipt=data=>({...f.receipt,challenge:data.challenge,transaction:'tx_'+data.challenge,expiresAt:f.state.now+60000});
 f.hooks.settle=async data=>data.challenge==='challenge-1'?{status:'pending'}:receipt(data);
 assert.equal((await f.core.recover('harvest_slice')).status,'ready');assert.equal(f.core.remaining('harvest_slice'),1);
 assert.equal((await f.core.recover('harvest_slice')).status,'pending');assert.equal(f.core.remaining('harvest_slice'),1);
 f.hooks.settle=async data=>receipt(data);assert.equal((await f.core.recover('harvest_slice')).status,'ready');assert.equal(f.core.remaining('harvest_slice'),2);assert.equal((await f.core.recover('harvest_slice')).status,'nothing_pending');
});
test('A late callback after an account switch never credits the new account', async () => {
  const f = fixture(); f.hooks.show = async () => { f.state.actor = B; f.core.accountChanged(); return { earned: true, closed: true }; };
  assert.equal((await f.core.watch('harvest_slice')).status, 'account_changed'); assert.equal(f.core.remaining('harvest_slice'), 0); assert.equal(f.count.settle, 0);
  f.state.actor = A; f.core.accountChanged(); assert.equal((await f.core.recover('harvest_slice')).status, 'ready');
});
test('A different account cannot spend the original account’s earned ticket', async () => {
  const f = fixture(); await f.core.watch('harvest_slice'); const ticket = f.core.begin('harvest_slice');
  f.state.actor = B; f.core.accountChanged(); assert.equal(f.core.remaining('harvest_slice'), 0); assert.equal(f.core.complete(ticket), false);
  f.state.actor = A; f.core.accountChanged(); assert.equal(f.core.remaining('harvest_slice'), 1);
});
test('Concurrent taps request only one ad', async () => {
  const f = fixture(); let release; f.hooks.show = () => new Promise(resolve => { release = resolve; });
  const first = f.core.watch('harvest_slice'); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await f.core.watch('harvest_slice')).status, 'unavailable'); release({ earned: true, closed: true }); await first; assert.equal(f.count.show, 1);
});
test('Storage failure before playback prevents an ad that could not retain its reward', async () => {
  const f = fixture(); f.storage.setItem = () => { throw Error('disk full'); };
  assert.equal((await f.core.watch('harvest_slice')).status, 'storage_unavailable'); assert.equal(f.count.show, 0);
});
test('A reused verified receipt cannot restore an already consumed round', async () => {
  const f = fixture(); await f.core.watch('harvest_slice'); f.core.complete(f.core.begin('harvest_slice'));
  const result = await f.core.watch('harvest_slice'); assert.equal(result.status, 'already_claimed'); assert.equal(result.amount, 0); assert.equal(f.core.remaining('harvest_slice'), 0);
});
test('New daily free rounds have priority over an earned ad credit', async () => {
  const f = fixture(); await f.core.watch('harvest_slice'); f.state.left = 5;
  assert.equal(f.core.begin('harvest_slice'), null); assert.equal(f.core.remaining('harvest_slice'), 1);
});
test('Leaving and returning to an account invalidates stale game-completion tickets', async () => {
  const f = fixture(); await f.core.watch('harvest_slice'); const ticket = f.core.begin('harvest_slice');
  f.state.actor = B; f.core.accountChanged(); f.state.actor = A; f.core.accountChanged();
  assert.equal(f.core.complete(ticket), false); assert.equal(f.core.remaining('harvest_slice'), 1);
});
test('Provider eligibility is checked again after asynchronous ad preparation', async () => {
  const f = fixture(), prepare = f.hooks.prepare; f.hooks.prepare = async data => { const result = await prepare(data); f.policy.requiredCloseMs = 30000; return result; };
  assert.equal((await f.core.watch('harvest_slice')).status, 'unavailable'); assert.equal(f.count.show, 0);
});
