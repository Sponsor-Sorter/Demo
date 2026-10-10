// Read-only/negative production checks: never creates Checkout sessions or users.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../js/supabaseClient.js'), 'utf8');
const base = source.match(/const SUPABASE_URL = '([^']+)'/)[1];
const key = source.match(/const SUPABASE_ANON_KEY = '([^']+)'/)[1];
const cases = [
  ['unapproved checkout origin', 'stripe-checkout', { offerType: 'signup' }, 'https://unapproved.invalid', 403],
  ['invalid signup email', 'stripe-checkout', { offerType: 'signup', signupEmail: 'invalid' }, 'https://sponsorsorter.com', 400],
  ['forged private-payment token', 'stripe-checkout', { offerType: 'private', amount: 10 }, 'https://sponsorsorter.com', 401],
  ['invalid completion details', 'complete-paid-signup', {}, 'https://sponsorsorter.com', 400],
];
(async () => {
  for (const [label, fn, body, origin, status] of cases) {
    const response = await fetch(`${base}/functions/v1/${fn}`, {
      method: 'POST', headers: { apikey: key, authorization: 'Bearer deliberately-invalid', origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, status, label);
    console.log(`PASS ${label}: HTTP ${response.status}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
