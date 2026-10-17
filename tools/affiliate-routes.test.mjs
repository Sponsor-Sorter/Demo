import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { affiliateRequest } from '../js/affiliateRequest.mjs';

const dashboard = await readFile(new URL('../js/AffiliateDashboard.js', import.meta.url), 'utf8');
const admin = await readFile(new URL('../js/AffiliateAdmin.js', import.meta.url), 'utf8');
const settings = await readFile(new URL('../js/settings.js', import.meta.url), 'utf8');
const args = { base: 'https://example.test/functions/v1/', path: 'affiliate/summary', token: 'test-jwt' };
test('routed request sends JWT and canonical URL', async () => {
  const value = await affiliateRequest({ ...args, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://example.test/functions/v1/affiliate/summary');
    assert.equal(options.headers.Authorization, 'Bearer test-jwt');
    assert.equal(options.method, 'GET'); assert.equal(options.body, undefined);
    return { ok: true, json: async () => ({ ok: true }) };
  } }); assert.equal(value.ok, true);
});
test('missing JWT prevents request', async () => {
  await assert.rejects(affiliateRequest({ ...args, token: '', fetchImpl: () => assert.fail('must not fetch') }), /sign in/);
});
for (const payload of [null, [], { ok: false }, { success: false }, { error: 'private provider detail' }]) {
  test(`application failure rejected: ${JSON.stringify(payload)}`, async () => {
    await assert.rejects(affiliateRequest({ ...args, fetchImpl: async () => ({ ok: true, json: async () => payload }) }), /request failed/);
  });
}
test('HTTP failure rejected even with success JSON', async () => {
  await assert.rejects(affiliateRequest({ ...args, fetchImpl: async () => ({ ok: false, json: async () => ({ ok: true }) }) }));
});
test('deadline covers response body', async () => {
  await assert.rejects(affiliateRequest({ ...args, timeoutMs: 10, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) }), /timed out/);
});
test('no legacy routes, browser wallet writes, commission calculations or admin fallback', () => {
  const executable = [dashboard, admin, settings].map(s => s.replace(/^\s*\/\/.*$/gm, '')).join('\n');
  assert.equal(/(?:\/|callFunction\(["'])affiliate-(?:apply|get-referral-link|mark-approved-paid|mark-paid|approve-pending|register|ensure-referral-link|set-referral-code|admin-get-stats)[`"']/.test(executable), false);
  assert.doesNotMatch(dashboard, /\.update\(|DEFAULT_SIGNUP_PRICE|markApprovedPaidViaEdge|isCurrentUserAdmin/);
  assert.match(dashboard, /callAffiliate\('summary'\)/);
  assert.match(settings, /path: 'affiliate\/applications'/);
});
test('application desired rate has a distinct ID from the dashboard display', () => {
  assert.equal(settings.includes('id="aff-desired-rate" type="number"'), true);
  assert.equal(settings.includes("getElementById('aff-desired-rate')?.value"), true);
  assert.equal(settings.includes('id="aff-rate"'), false);
});
const walletSource = dashboard.slice(dashboard.indexOf('async function payApprovedToWallet()'), dashboard.indexOf('/* ------------- UI helpers'));
for (const amount of [0, 2.75]) {
  test(`wallet uses returned credit ${amount} without database writes`, async () => {
    let calls = 0; const notices = []; const messages = [];
    const context = vm.createContext({
      callAffiliate: async (path, options) => { calls++; assert.equal(path, 'wallet/claim'); assert.equal(options.method, 'POST'); return { ok: true, credited_amount: amount }; },
      supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user' } } } }) } },
      notifyPayout: async value => notices.push(value), toast: value => messages.push(value),
      fmtCurrency: value => `$${value}`, window: {}, console,
    });
    vm.runInContext(`${walletSource}; globalThis.runClaim = payApprovedToWallet;`, context);
    assert.equal(await context.runClaim(), amount > 0); assert.equal(calls, 1);
    assert.equal(notices.length, amount > 0 ? 1 : 0);
    if (amount > 0) assert.equal(notices[0].payout_amount, '2.75');
  });
}
test('failed claim does not notify or retry', async () => {
  let calls = 0;
  const context = vm.createContext({ callAffiliate: async () => { calls++; throw new Error('failed'); }, toast: () => {}, notifyPayout: () => assert.fail('no notice'), console });
  vm.runInContext(`${walletSource}; globalThis.runClaim = payApprovedToWallet;`, context);
  assert.equal(await context.runClaim(), false); assert.equal(calls, 1);
});
