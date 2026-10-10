const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const test = require('node:test');

// Execute the real request handlers with isolated Stripe/Auth/database doubles.
// No external network calls, real credentials, accounts or money are used.
const price = 'price_1SbWeEGpIACU7TxK1H3mXQfR';
function fixture(name, overrides = {}) {
  let handler;
  const calls = [];
  const session = { mode: 'subscription', status: 'complete', payment_status: 'paid',
    metadata: { offerType: 'signup', signup_email: 'test@example.com' },
    subscription: 'sub_test', customer: 'cus_test', ...overrides.session };
  const subscription = { customer: 'cus_test', status: 'active',
    items: { data: [{ price: { id: price } }] }, ...overrides.subscription };
  class Stripe {
    checkout = { sessions: { create: async params => {
      calls.push({ stripe: params });
      return { id: 'cs_test_fixture', url: 'https://checkout.stripe.com/test-fixture' };
    } } };
  }
  const source = fs.readFileSync(path.join(__dirname, '../supabase/functions', name, 'index.ts'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '');
  const context = vm.createContext({ Request, Response, URL, console, Stripe,
    serve: callback => { handler = callback; },
    Deno: { env: { get: key => ({ STRIPE_SECRET_KEY: 'fixture-only',
      SUPABASE_URL: 'https://database.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only' })[key] } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/checkout/sessions/')) return Response.json(session);
      if (url.includes('/subscriptions/')) return Response.json(subscription);
      if (url.includes('/admin/users/')) return Response.json({ email: overrides.authEmail || 'test@example.com' });
      if (url.endsWith('/rpc/register_paid_profile')) return Response.json({}, { status: overrides.rpcStatus || 200 });
      throw new Error('Unexpected outbound request');
    }
  });
  vm.runInContext(stripTypeScriptTypes(source), context);
  return { calls, request: (body, method = 'POST', origin = 'https://sponsorsorter.com', extraHeaders = {}) =>
    handler(new Request('https://function.invalid', { method,
      headers: { origin, 'Content-Type': 'application/json', ...extraHeaders },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) })) };
}
const signup = { offerType: 'signup', signupEmail: 'test@example.com', frontendBaseUrl: 'https://sponsorsorter.com' };
const completion = { user_id: '00000000-0000-4000-8000-000000000001', session_id: 'cs_test_fixture', profile: { email: 'test@example.com' } };

test('signup checkout fixes return destinations even when caller supplies absolute URLs', async () => {
  const f = fixture('stripe-checkout');
  assert.equal((await f.request({ ...signup, success_url: 'https://evil.invalid/collect', cancel_url: 'https://evil.invalid/cancel' })).status, 200);
  const params = f.calls[0].stripe;
  assert.match(params.success_url, /^https:\/\/sponsorsorter.com\/payment-success-signup.html\?/);
  assert.equal(params.cancel_url, 'https://sponsorsorter.com/signup.html?payment=cancelled');
  assert.equal(params.line_items[0].price, price);
  assert.equal(params.mode, 'subscription');
});
for (const [label, body] of [
  ['invalid signup email', { ...signup, signupEmail: 'invalid' }],
  ['unapproved price', { ...signup, subscriptionPriceId: 'price_attacker' }],
  ['unapproved return base', { ...signup, frontendBaseUrl: 'https://evil.invalid' }],
]) test(`checkout rejects ${label} before Stripe`, async () => {
  const f = fixture('stripe-checkout');
  assert.equal((await f.request(body)).status, 400);
  assert.equal(f.calls.length, 0);
});
test('checkout refuses unauthenticated private payments', async () => {
  const f = fixture('stripe-checkout');
  assert.equal((await f.request({ amount: 10, offerType: 'private' })).status, 401);
  assert.equal(f.calls.length, 0);
});
test('checkout refuses a forged authorization header', async () => {
  const f = fixture('stripe-checkout');
  // Unexpected fetch is caught; a fake token must never reach Stripe.
  assert.notEqual((await f.request({ amount: 10, offerType: 'private' }, 'POST', 'https://sponsorsorter.com', { authorization: 'Bearer forged' })).status, 200);
  assert.equal(f.calls.filter(c => c.stripe).length, 0);
});
test('bounty checkout rejects an external return destination', async () => {
  const f = fixture('stripe-checkout');
  assert.equal((await f.request({ kind: 'game_bounty', amount: 10, success_url: 'https://evil.invalid', cancel_url: 'https://evil.invalid' })).status, 400);
  assert.equal(f.calls.length, 0);
});
test('bounty checkout rejects amounts above Stripe limits', async () => {
  const f = fixture('stripe-checkout');
  assert.equal((await f.request({ kind: 'game_bounty', amount_cents: 100000000 })).status, 400);
  assert.equal(f.calls.length, 0);
});
test('checkout rejects an unapproved request origin', async () => {
  const f = fixture('stripe-checkout');
  assert.equal((await f.request(signup, 'POST', 'https://evil.invalid')).status, 403);
  assert.equal(f.calls.length, 0);
});
test('verified paid signup reaches profile provisioning', async () => {
  const f = fixture('complete-paid-signup');
  assert.equal((await f.request(completion)).status, 200);
  assert.equal(f.calls.filter(c => c.url.endsWith('/rpc/register_paid_profile')).length, 1);
});
for (const [label, overrides] of [
  ['unpaid session', { session: { payment_status: 'unpaid' } }],
  ['unknown payment state', { session: { payment_status: 'unexpected' } }],
  ['open session', { session: { status: 'open' } }],
  ['wrong email', { session: { metadata: { offerType: 'signup', signup_email: 'other@example.com' } } }],
  ['wrong price', { subscription: { items: { data: [{ price: { id: 'price_wrong' } }] } } }],
  ['cancelled subscription', { subscription: { status: 'canceled' } }],
  ['wrong Auth account', { authEmail: 'other@example.com' }],
]) test(`paid signup rejects ${label} without provisioning`, async () => {
  const f = fixture('complete-paid-signup', overrides);
  assert.equal((await f.request(completion)).status, 403);
  assert.equal(f.calls.filter(c => c.url.endsWith('/rpc/register_paid_profile')).length, 0);
});
test('signup rejects unapproved origins before external requests', async () => {
  const f = fixture('complete-paid-signup');
  assert.equal((await f.request(completion, 'POST', 'https://evil.invalid')).status, 403);
  assert.equal(f.calls.length, 0);
});
test('provisioning failure does not report success', async () => {
  const f = fixture('complete-paid-signup', { rpcStatus: 500 });
  assert.equal((await f.request(completion)).status, 500);
});
