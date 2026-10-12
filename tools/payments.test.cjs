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
    webhooks = { constructEventAsync: async (raw, signature, secret) => {
      calls.push({ verification: { raw, signature, secret } });
      if (overrides.invalidSignature) throw new Error('Invalid signature');
      return { type: overrides.eventType || 'checkout.session.completed', data: { object: session } };
    } };
    checkout = { sessions: { create: async (params, options) => {
      calls.push({ stripe: params, options });
      return { id: 'cs_test_fixture', url: 'https://checkout.stripe.com/test-fixture' };
    } } };
  }
  const source = fs.readFileSync(path.join(__dirname, '../supabase/functions', name, 'index.ts'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '').replace('import.meta.main', 'true');
  const context = vm.createContext({ Request, Response, URL, console, Stripe,
    serve: callback => { handler = callback; },
    Deno: { env: { get: key => ({ STRIPE_SECRET_KEY: 'fixture-only', SPONSORSHIP_STRIPE_SECRET_KEY: 'fixture-only',
      SUPABASE_URL: 'https://database.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only',
      SPONSORSHIP_STRIPE_WEBHOOK_SECRET: 'whsec_fixture', ...overrides.env })[key] } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/auth/v1/user') && overrides.user) return Response.json(overrides.user);
      if (url.includes('/rest/v1/sponsorship_orders?')) return Response.json(overrides.orders || []);
      if (url.endsWith('/rpc/bind_sponsorship_checkout')) return Response.json(null, { status: overrides.bindStatus || 200 });
      if (url.endsWith('/rpc/fund_sponsorship_checkout')) {
        if (overrides.networkFailure) throw new Error('Network unavailable');
        return Response.json('offer-fixture', { status: overrides.fundStatus || 200 });
      }
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

const buyer = { id: '11111111-1111-4111-8111-111111111111' };
const savedOrder = { id:'44444444-4444-4444-8444-444444444444', sponsor_user_id:buyer.id, source:'stripe',offer_kind:'private',status:'pending',total_cents:11000 };
test('private checkout uses server price and stable order key, not caller amount or metadata',async()=>{
 const f=fixture('stripe-checkout',{user:buyer,orders:[savedOrder]});
 const response=await f.request({offerType:'private',order_id:savedOrder.id,amount:0.01,metadata:{sponsor_user_id:'attacker'},frontendBaseUrl:'https://sponsorsorter.com'},'POST','https://sponsorsorter.com',{authorization:'Bearer fixture'});
 assert.equal(response.status,200);
 const c=f.calls.find(c=>c.stripe);assert.equal(c.stripe.line_items[0].price_data.unit_amount,11000);
 assert.equal(c.stripe.metadata.sponsor_user_id,buyer.id);assert.equal(c.stripe.allow_promotion_codes,false);
 assert.equal(c.options.idempotencyKey,'sponsorship-'+savedOrder.id);
 assert.equal(f.calls.filter(c=>c.url?.endsWith('/rpc/bind_sponsorship_checkout')).length,1);
});
test('private checkout refuses another account order before contacting Stripe',async()=>{
 const f=fixture('stripe-checkout',{user:buyer,orders:[{...savedOrder,sponsor_user_id:'other'}]});
 assert.equal((await f.request({offerType:'private',order_id:savedOrder.id,frontendBaseUrl:'https://sponsorsorter.com'},'POST','https://sponsorsorter.com',{authorization:'Bearer fixture'})).status,409);
 assert.equal(f.calls.filter(c=>c.stripe).length,0);
});
const paidPrivate={id:'cs_test_fixture',metadata:{offerType:'private',order_id:savedOrder.id,sponsor_user_id:buyer.id},mode:'payment',status:'complete',payment_status:'paid',payment_intent:'pi_fixture',amount_total:11000,currency:'usd'};
test('private completion verifies Stripe and delegates atomic fulfillment',async()=>{
 const f=fixture('complete-sponsorship-checkout',{user:buyer,session:paidPrivate});
 assert.equal((await f.request({session_id:'cs_test_fixture'},'POST','https://sponsorsorter.com',{authorization:'Bearer fixture'})).status,200);
 const rpc=f.calls.find(c=>c.url?.endsWith('/rpc/fund_sponsorship_checkout'));assert.equal(JSON.parse(rpc.options.body).paid_cents,11000);
});
for(const [label,changed,status] of [['unpaid',{payment_status:'unpaid'},409],['incomplete',{status:'open'},409],['another buyer',{metadata:{...paidPrivate.metadata,sponsor_user_id:'other'}},403]])test('private completion rejects '+label,async()=>{
 const f=fixture('complete-sponsorship-checkout',{user:buyer,session:{...paidPrivate,...changed}});
 assert.equal((await f.request({session_id:'cs_test_fixture'},'POST','https://sponsorsorter.com',{authorization:'Bearer fixture'})).status,status);
 assert.equal(f.calls.filter(c=>c.url?.endsWith('/rpc/fund_sponsorship_checkout')).length,0);
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

test('webhook verifies the original body and signature before fulfillment', async () => {
  const f = fixture('sponsorship-payment-webhook', {session:paidPrivate});
  const body = {id:'evt_fixture'};
  assert.equal((await f.request(body,'POST','https://sponsorsorter.com',{'stripe-signature':'fixture-signature'})).status,200);
  assert.equal(f.calls[0].verification.raw,JSON.stringify(body));
  assert.equal(f.calls[0].verification.signature,'fixture-signature');
  assert.equal(f.calls.filter(c=>c.url?.endsWith('/rpc/fund_sponsorship_checkout')).length,1);
});
for (const [label, overrides, expected] of [
  ['invalid signature',{invalidSignature:true},400],
  ['missing configuration',{env:{SPONSORSHIP_STRIPE_WEBHOOK_SECRET:undefined}},503],
  ['unpaid checkout',{session:{...paidPrivate,payment_status:'unpaid'}},200],
  ['unrelated event',{eventType:'customer.updated'},200],
  ['database failure',{fundStatus:500},500],
  ['network failure',{networkFailure:true},500],
]) test('webhook handles '+label+' safely',async()=>{
  const f=fixture('sponsorship-payment-webhook',{session:paidPrivate,...overrides});
  assert.equal((await f.request({id:'evt_fixture'})).status,expected);
  if (!['database failure','network failure'].includes(label)) assert.equal(f.calls.filter(c=>c.url?.endsWith('/rpc/fund_sponsorship_checkout')).length,0);
});

test('group checkout also uses a server-held budget and verifies fulfillment',async()=>{
 const f=fixture('stripe-checkout',{user:buyer,orders:[{...savedOrder,offer_kind:'group'}]});
 const r=await f.request({offerType:'group',order_id:savedOrder.id,amount:0.01,frontendBaseUrl:'https://sponsorsorter.com'},'POST','https://sponsorsorter.com',{authorization:'Bearer fixture'});
 assert.equal(r.status,200);const c=f.calls.find(c=>c.stripe);assert.equal(c.stripe.line_items[0].price_data.unit_amount,11000);assert.equal(c.stripe.metadata.offerType,'group');
 const completion=fixture('complete-sponsorship-checkout',{user:buyer,session:{...paidPrivate,metadata:{...paidPrivate.metadata,offerType:'group'}}});
 assert.equal((await completion.request({session_id:'cs_test_fixture'},'POST','https://sponsorsorter.com',{authorization:'Bearer fixture'})).status,200);
});
