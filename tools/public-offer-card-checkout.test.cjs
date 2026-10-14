const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function loadCheckoutNotice() {
  return import('../js/publicCheckoutNotice.js');
}

test('public card checkout announces visible guidance and preserves the draft when storage works', async () => {
  const { showPublicCheckoutUnavailable } = await loadCheckoutNotice();
  const values = new Map();
  const status = { hidden: true, textContent: '', getAttribute(name) {
    return ({ role: 'status', 'aria-live': 'polite' })[name] || null;
  } };
  const offer = { offer_title: 'Fixture offer', offer_amount: 25 };

  const saved = showPublicCheckoutUnavailable(offer, {
    storage: { setItem: (key, value) => values.set(key, value) },
    statusElement: status,
  });

  assert.equal(saved, true);
  assert.deepEqual(JSON.parse(values.get('pendingOfferData')), offer);
  assert.equal(status.hidden, false);
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.match(status.textContent, /draft is saved/);
  assert.match(status.textContent, /contact support/);
});

test('storage failure is announced honestly without claiming the draft was saved', async () => {
  const { showPublicCheckoutUnavailable } = await loadCheckoutNotice();
  const status = { hidden: true, textContent: '' };
  const saved = showPublicCheckoutUnavailable({}, {
    storage: { setItem() { throw new Error('storage unavailable'); } },
    statusElement: status,
  });

  assert.equal(saved, false);
  assert.equal(status.hidden, false);
  assert.match(status.textContent, /could not save your offer draft/);
  assert.doesNotMatch(status.textContent, /draft is saved in this browser/);
});

test('a throwing localStorage getter is handled as a storage failure', async () => {
  const { showPublicCheckoutUnavailable } = await loadCheckoutNotice();
  const status = { hidden: true, textContent: '' };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Access denied', 'SecurityError'); },
  });

  try {
    const saved = showPublicCheckoutUnavailable({}, { statusElement: status });
    assert.equal(saved, false);
    assert.equal(status.hidden, false);
    assert.match(status.textContent, /could not save your offer draft/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('public offer page invokes the disabled-checkout helper without a Stripe fallback', () => {
  const html = fs.readFileSync('publicOffers.html', 'utf8');
  const start = html.indexOf('// Public card checkout is disabled');
  const end = html.indexOf('// cost calc listeners', start);
  const fallback = html.slice(start, end);

  assert.match(html, /import \{ showPublicCheckoutUnavailable \} from '\.\/js\/publicCheckoutNotice\.js'/);
  assert.match(fallback, /showPublicCheckoutUnavailable\(offerData\)/);
  assert.doesNotMatch(fallback, /fetch\(|Stripe\(|redirectToCheckout|STRIPE_BACKEND|STRIPE_PK/);
  assert.doesNotMatch(html, /js\.stripe\.com\/v3|functions\/v1\/stripe-checkout|STRIPE_PK/);
});

test('payment return renders reconciliation guidance and never suggests another payment', () => {
  const html = fs.readFileSync('payment-success-public.html', 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  const moduleBody = scripts.at(-1)[1];
  const status = { textContent: '' };
  vm.runInNewContext(moduleBody, {
    document: { getElementById: id => id === 'insert-status' ? status : null },
  });

  assert.match(html, /<title>Payment Status \| Sponsor Sorter<\/title>/);
  assert.match(html, /<h1>We can’t verify this payment here\.<\/h1>/);
  assert.match(status.textContent, /cannot verify whether your card was charged/);
  assert.match(status.textContent, /Do not submit payment again/);
  assert.match(status.textContent, /Contact support to reconcile/);
  assert.match(status.textContent, /draft, if present in this browser, has been left untouched/);
  assert.doesNotMatch(status.textContent, /use wallet|pay again|make another payment/i);
});
