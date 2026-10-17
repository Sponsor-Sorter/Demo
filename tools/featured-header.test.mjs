import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { activeFeaturedSlots, requestFeatured } from '../js/featuredApi.mjs';
const origin = 'https://sponsorsorter.com';
const now = Date.parse('2026-10-17T08:00:00Z');
const slot = { slot_index: 1, user_id: 'owned-test', profile: { username: 'test' }, profile_url: '/u/index.html?u=test', starts_at: '2026-10-16T08:00:00Z', ends_at: '2026-10-18T08:00:00Z' };
test('active eligible account gets its canonical profile link', () => {
  assert.deepEqual(activeFeaturedSlots({ slots: [slot] }, origin, now), [slot]);
});
for (const change of [ { ends_at: '2026-10-17T08:00:00Z' }, { starts_at: '2026-10-18T08:00:00Z' }, { ends_at: null }, { profile: null }, { profile_url: 'https://other.test/u/index.html?u=test' }, { profile_url: 'javascript:alert(1)' }, { profile_url: '/login.html' } ]) {
  test(`invalid/expired placement excluded: ${JSON.stringify(change)}`, () => {
    assert.deepEqual(activeFeaturedSlots({ slots: [{ ...slot, ...change }] }, origin, now), []);
  });
}
test('duplicate slots do not create duplicate anchors', () => {
  assert.equal(activeFeaturedSlots({ slots: [slot, slot] }, origin, now).length, 1);
});
test('public GET needs no JWT', async () => {
  const result = await requestFeatured({ fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET'); assert.equal(options.headers.Authorization, undefined);
    assert.match(url, /assign-featured-star$/);
    return { ok: true, json: async () => ({ ok: true, slots: [] }) };
  } }); assert.deepEqual(result.slots, []);
});
test('authenticated checkout does not accept browser prices', async () => {
  await requestFeatured({ token: 'test', body: { action: 'checkout' }, fetchImpl: async (_, options) => {
    assert.deepEqual(JSON.parse(options.body), { action: 'checkout' });
    assert.equal(options.headers.Authorization, 'Bearer test');
    return { ok: true, json: async () => ({ ok: true, url: 'https://checkout.stripe.com/test' }) };
  } });
});
test('anonymous checkout prevented before fetch', async () => {
  await assert.rejects(requestFeatured({ body: { action: 'checkout' }, fetchImpl: () => assert.fail('no request') }), /sign in/);
});
test('deadline covers JSON body', async () => {
  await assert.rejects(requestFeatured({ timeoutMs: 10, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) }), /timed out/);
});
test('header anchors have names and do not intercept unrelated clicks', async () => {
  const source = await readFile(new URL('../js/headerFeaturedAccounts.mjs', import.meta.url), 'utf8');
  assert.match(source, /createElement\('a'\)/);
  assert.match(source, /aria-label.*View featured account/);
  assert.doesNotMatch(source, /Math.random|document.addEventListener\('click'|tabIndex|sparkle/);
});
test('spotlight uses canonical profile URL and does not randomly replace an expired slot', async () => {
  const source = await readFile(new URL('../js/featuredPage.js', import.meta.url), 'utf8');
  assert.match(source, /ctaView.href = slot.profile_url/);
  assert.match(source, /if \(slotIdx && !slot\)/);
  assert.doesNotMatch(source, /Math.random|finder.html\?user=|from\('featured_slots'\)/);
});
