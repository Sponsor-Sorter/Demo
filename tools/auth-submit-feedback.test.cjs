const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const loginHtml = read('login.html');
const signupHtml = read('signup.html');
const resetHtml = read('reset-password.html');
const loginSource = read('js/login.js').replace(/^import .*;\r?\n/gm, '');
const signupSource = read('js/formSubmit.js')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export async function /gm, 'async function ');

function element(value = '') {
  return {
    value, textContent: '', className: '', disabled: false, style: {}, attributes: {},
    handlers: {},
    addEventListener(name, fn) { this.handlers[name] = fn; },
    setAttribute(name, v) { this.attributes[name] = v; },
    removeAttribute(name) { delete this.attributes[name]; },
    querySelector() { return this.submitButton || null; },
  };
}

function loginFixture({ signIn, totpChallenge = false } = {}) {
  let ready;
  const calls = [];
  const els = Object.fromEntries([
    'loginForm', 'username', 'password', 'login-error-box',
    'reset-password-form', 'reset-email', 'reset-password-status', 'reset-last-password',
    'reset-password-modal', 'reset-password-open', 'reset-password-close',
    ...(totpChallenge ? [
      'twofa-step', 'twofa-totp-step', 'twofa-totp-code-group', 'twofa-backup-code-group',
      'twofa-totp-code-input', 'twofa-backup-code-input', 'twofa-totp-submit-btn',
      'twofa-totp-cancel-btn', 'twofa-use-backup-btn', 'twofa-use-totp-btn', 'twofa-totp-status',
    ] : []),
  ].map(id => [id, element()]));
  const loginButton = element();
  loginButton.textContent = 'Sign In';
  const resetButton = element();
  resetButton.textContent = 'Send Reset Link';
  els.loginForm.submitButton = loginButton;
  els['reset-password-form'].submitButton = resetButton;
  els['login-error-box'].style.display = 'none';
  els['reset-password-modal'].style.display = 'none';
  if (totpChallenge) {
    els['twofa-step'].style.display = 'none';
    els['twofa-totp-step'].style.display = 'none';
    els['twofa-totp-code-group'].style.display = 'none';
    els['twofa-backup-code-group'].style.display = 'none';
  }
  els['reset-email'].focus = function () { this.focused = true; };
  const windowObject = { addEventListener: (_name, fn) => { ready = fn; }, location: { href: 'https://example.invalid/login.html' }, localStorage: { getItem: () => null, setItem() {} } };
  const extendedData = totpChallenge
    ? { userType: 'sponsor', referral_code: null, twofa_enabled: true, twofa_method: 'totp', email: 'person@example.invalid' }
    : { userType: 'sponsor', referral_code: null, twofa_enabled: false, twofa_method: '', email: 'person@example.invalid' };
  const supabase = { auth: {
    signInWithPassword: async credentials => {
      calls.push({ method: 'signInWithPassword', credentials });
      return signIn ? signIn(credentials) : { error: { message: 'synthetic invalid credentials' } };
    },
    getUser: async () => ({ data: { user: { id: 'synthetic-user', email: 'person@example.invalid', confirmed_at: 'synthetic-confirmed' } }, error: null }),
    resetPasswordForEmail: async (...args) => {
      calls.push({ method: 'resetPasswordForEmail', args });
      return { data: {}, error: null };
    },
  },
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: extendedData, error: null }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }) };
  vm.runInNewContext(loginSource, {
    window: windowObject,
    document: { getElementById: id => els[id] || null, activeElement: null },
    supabase, OTPAuth: {}, URL, console: { warn() {}, log() {} }, alert() {},
    TextEncoder, Uint8Array, Date, Number, Math, JSON, setTimeout,
  });
  return { ready, els, calls, loginButton, resetButton, supabase, window: windowObject };
}

function event() {
  return { prevented: false, preventDefault() { this.prevented = true; } };
}

test('login and signup keep native validation and submit controls for keyboard submission', () => {
  assert.match(loginHtml, /<form id="loginForm"[^>]*>/);
  assert.match(loginHtml, /<input\s+type="email"\s+id="username"[\s\S]*?required/);
  assert.match(loginHtml, /<input\s+type="password"\s+id="password"[\s\S]*?required/);
  assert.match(loginHtml, /<button type="submit">Sign In<\/button>/);
  assert.match(signupHtml, /<form id="registrationForm"/);
  assert.match(signupHtml, /<button type="submit" id="submitBtn">/);
  assert.doesNotMatch(loginHtml, /<form[^>]*\bnovalidate\b/i);
  assert.doesNotMatch(signupHtml, /<form[^>]*\bnovalidate\b/i);
  const signupEmail = signupHtml.match(/<input\b(?=[^>]*\bid="email")[^>]*>/)?.[0];
  const signupPassword = signupHtml.match(/<input\b(?=[^>]*\bid="password")[^>]*>/)?.[0];
  const signupConfirm = signupHtml.match(/<input\b(?=[^>]*\bid="confirm-password")[^>]*>/)?.[0];
  const tos = signupHtml.match(/<input\b(?=[^>]*\bid="agreeTOS")[^>]*>/)?.[0];
  const resetEmail = loginHtml.match(/<input\b(?=[^>]*\bid="reset-email")[^>]*>/)?.[0];
  const recoveryPassword = resetHtml.match(/<input\b(?=[^>]*\bid="new-password")[^>]*>/)?.[0];
  const recoveryConfirm = resetHtml.match(/<input\b(?=[^>]*\bid="confirm-password")[^>]*>/)?.[0];
  assert.match(signupEmail, /type="email"/);
  assert.match(signupEmail, /required/);
  assert.match(signupPassword, /type="password"/);
  assert.match(signupPassword, /minlength="8"/);
  assert.match(signupPassword, /required/);
  assert.match(signupConfirm, /type="password"/);
  assert.match(signupConfirm, /minlength="8"/);
  assert.match(signupConfirm, /required/);
  assert.match(tos, /type="checkbox"/);
  assert.match(tos, /required/);
  assert.match(resetEmail, /type="email"/);
  assert.match(resetEmail, /required/);
  assert.match(recoveryPassword, /minlength="8"/);
  assert.match(recoveryPassword, /required/);
  assert.match(recoveryConfirm, /minlength="8"/);
  assert.match(recoveryConfirm, /required/);
});

test('invalid login submission is announced without starting an auth request', async () => {
  const page = loginFixture();
  await page.ready();
  page.els.loginForm.handlers.submit(event());
  assert.equal(page.calls.length, 0);
  assert.equal(page.els['login-error-box'].style.display, 'block');
  assert.equal(page.loginButton.disabled, false);
});

test('mocked valid login reaches the sponsor dashboard and clears loading state', async () => {
  const page = loginFixture({ signIn: async () => ({ data: { user: { id: 'synthetic-user' } }, error: null }) });
  await page.ready();
  page.els.username.value = 'person@example.invalid';
  page.els.password.value = 'synthetic-password';
  await page.els.loginForm.handlers.submit(event());
  assert.equal(page.window.location.href, 'dashboardsponsor.html');
  assert.equal(page.loginButton.disabled, false);
  assert.equal(page.loginButton.attributes['aria-busy'], undefined);
});

test('two-factor challenge keeps the login form hidden and ignores re-entry after loading settles', async () => {
  const page = loginFixture({
    signIn: async () => ({ data: { user: { id: 'synthetic-user' } }, error: null }),
    totpChallenge: true,
  });
  await page.ready();
  page.els.username.value = 'person@example.invalid';
  page.els.password.value = 'synthetic-password';
  await page.els.loginForm.handlers.submit(event());
  assert.equal(page.els.loginForm.style.display, 'none');
  assert.equal(page.els['twofa-totp-step'].style.display, 'block');
  assert.equal(page.loginButton.disabled, false);
  assert.equal(page.calls.filter(call => call.method === 'signInWithPassword').length, 1);
  await page.els.loginForm.handlers.submit(event());
  assert.equal(page.calls.filter(call => call.method === 'signInWithPassword').length, 1);
  assert.equal(page.els['twofa-totp-step'].style.display, 'block');
});

test('login preserves exact password, blocks duplicate submits, and restores controls after auth errors', async () => {
  let release;
  const page = loginFixture({ signIn: () => new Promise(resolve => { release = resolve; }) });
  await page.ready();
  page.els.username.value = 'person@example.invalid';
  page.els.password.value = '  exact password  ';
  const first = page.els.loginForm.handlers.submit(event());
  assert.equal(page.loginButton.disabled, true);
  assert.equal(page.loginButton.attributes['aria-busy'], 'true');
  assert.equal(page.loginButton.textContent, 'Signing in…');
  assert.equal(page.els.username.disabled, true);
  assert.equal(page.els.password.disabled, true);
  await page.els.loginForm.handlers.submit(event());
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].credentials.password, '  exact password  ');
  release({ error: { message: 'synthetic failure' } });
  await first;
  assert.equal(page.els['login-error-box'].style.display, 'block');
  assert.equal(page.loginButton.disabled, false);
  assert.equal(page.loginButton.attributes['aria-busy'], undefined);
  assert.equal(page.loginButton.textContent, 'Sign In');
  assert.equal(page.els.username.disabled, false);
  assert.equal(page.els.password.disabled, false);
});

test('login network rejection shows recoverable feedback and permits retry', async () => {
  let attempts = 0;
  const page = loginFixture({ signIn: async () => { attempts++; throw new Error('synthetic offline'); } });
  await page.ready();
  page.els.username.value = 'person@example.invalid';
  page.els.password.value = 'synthetic-password';
  await page.els.loginForm.handlers.submit(event());
  assert.equal(page.els['login-error-box'].style.display, 'block');
  assert.equal(page.loginButton.disabled, false);
  await page.els.loginForm.handlers.submit(event());
  assert.equal(attempts, 2);
});

test('reset request can close while pending, prevents duplicates, clears stale feedback and retries', async () => {
  let release;
  let attempts = 0;
  const page = loginFixture();
  page.supabase.auth.resetPasswordForEmail = async (...args) => {
    page.calls.push({ method: 'resetPasswordForEmail', args });
    attempts++;
    if (attempts === 1) return new Promise(resolve => { release = resolve; });
    return { data: {}, error: null };
  };
  await page.ready();
  page.els['reset-password-open'].handlers.click();
  assert.equal(page.els['reset-password-modal'].style.display, 'flex');
  page.els['reset-email'].value = 'person@example.invalid';
  const first = page.els['reset-password-form'].handlers.submit(event());
  assert.equal(page.resetButton.disabled, true);
  assert.equal(page.resetButton.textContent, 'Sending…');
  assert.equal(page.els['reset-email'].disabled, true);
  await page.els['reset-password-form'].handlers.submit(event());
  assert.equal(page.calls.filter(call => call.method === 'resetPasswordForEmail').length, 1);
  page.els['reset-password-close'].handlers.click();
  assert.equal(page.els['reset-password-modal'].style.display, 'none');
  page.els['reset-password-open'].handlers.click();
  assert.equal(page.els['reset-password-modal'].style.display, 'flex');
  assert.equal(page.els['reset-password-status'].textContent, '');
  assert.equal(page.els['reset-email'].disabled, true);
  assert.equal(page.calls.find(call => call.method === 'resetPasswordForEmail').args[0], 'person@example.invalid');
  release({ data: null, error: { message: 'synthetic network failure' } });
  await first;
  assert.match(page.els['reset-password-status'].textContent, /could not submit/i);
  assert.equal(page.resetButton.disabled, false);
  assert.equal(page.resetButton.textContent, 'Send Reset Link');
  assert.equal(page.resetButton.attributes['aria-busy'], undefined);
  assert.equal(page.els['reset-email'].disabled, false);
  page.els['reset-password-close'].handlers.click();
  page.els['reset-password-open'].handlers.click();
  assert.equal(page.els['reset-password-status'].textContent, '');
  await page.els['reset-password-form'].handlers.submit(event());
  assert.match(page.els['reset-password-status'].textContent, /if an account matches that email/i);
  assert.equal(attempts, 2);
});

test('reset request network rejection restores a retryable control and generic status', async () => {
  let attempts = 0;
  const page = loginFixture();
  page.supabase.auth.resetPasswordForEmail = async (...args) => {
    page.calls.push({ method: 'resetPasswordForEmail', args });
    attempts++;
    if (attempts === 1) throw new Error('synthetic offline');
    return { data: {}, error: null };
  };
  await page.ready();
  page.els['reset-email'].value = 'person@example.invalid';
  await page.els['reset-password-form'].handlers.submit(event());
  assert.match(page.els['reset-password-status'].textContent, /could not submit/i);
  assert.equal(page.resetButton.disabled, false);
  await page.els['reset-password-form'].handlers.submit(event());
  assert.match(page.els['reset-password-status'].textContent, /if an account matches that email/i);
  assert.equal(attempts, 2);
});

test('empty reset request is rejected locally before an auth call', async () => {
  const page = loginFixture();
  await page.ready();
  await page.els['reset-password-form'].handlers.submit(event());
  assert.match(page.els['reset-password-status'].textContent, /enter your email/i);
  assert.equal(page.calls.filter(call => call.method === 'resetPasswordForEmail').length, 0);
  assert.equal(page.resetButton.disabled, false);
});

test('signup rejects invalid agreement/password, locks early, prevents duplicates, and retries', async () => {
  let readyHandlers = [];
  let submitCount = 0;
  let releaseFetch;
  const form = element();
  const button = element();
  button.textContent = 'Sign Up';
  const label = element('Sign Up');
  const spinner = element();
  const backButton = element();
  button.querySelector = selector => selector === '.btn-text' ? label : selector === '.spinner' ? spinner : null;
  form.submitButton = button;
  const tos = element();
  tos.checked = false;
  const els = { registrationForm: form, submitBtn: button, agreeTOS: tos, 'back-step-3': backButton, 'userType': element('besponsored'), 'planType': element('free') };
  const data = {
    username: 'Fixture', email: 'fixture@example.invalid', password: 'synthetic-password',
    confirm_password: 'synthetic-password', 'about-yourself': 'fixture bio', userType: 'besponsored', planType: 'free',
  };
  class FixtureFormData {
    constructor() {}
    entries() { return Object.entries(data); }
    getAll() { return []; }
    get() { return null; }
  }
  const context = {
    document: {
      addEventListener: (_name, fn) => readyHandlers.push(fn),
      getElementById: id => els[id] || null,
      querySelector() { return null; },
    },
    window: { location: { search: '', origin: 'https://example.invalid', href: '', assign() {} } },
    URLSearchParams, FormData: FixtureFormData,
    fetch: () => { submitCount++; return new Promise(resolve => { releaseFetch = resolve; }); },
    localStorage: { setItem() {}, getItem() { return null; }, removeItem() {} },
    btoa: value => Buffer.from(value).toString('base64'), Date, URL, console: { error() {} }, alert() {},
  };
  vm.runInNewContext(signupSource, context);
  readyHandlers.forEach(handler => handler());
  const submit = form.handlers.submit;
  await submit(event());
  assert.equal(context.window.__signupProcessing, undefined);
  assert.equal(submitCount, 0);
  tos.checked = true;
  data.confirm_password = 'mismatch';
  await submit(event());
  assert.equal(submitCount, 0);
  assert.equal(context.window.__signupProcessing, false);
  assert.equal(button.disabled, false);
  assert.equal(backButton.disabled, false);
  data.confirm_password = data.password;
  const first = submit(event());
  assert.equal(context.window.__signupProcessing, true);
  assert.equal(button.disabled, true);
  assert.equal(button.attributes['aria-busy'], 'true');
  assert.equal(backButton.disabled, true);
  await submit(event());
  assert.equal(submitCount, 1);
  releaseFetch({ ok: false, status: 503, statusText: 'synthetic failure', json: async () => ({ error: 'mock failure' }) });
  await first;
  assert.equal(context.window.__signupProcessing, false);
  assert.equal(button.disabled, false);
  assert.equal(button.attributes['aria-busy'], undefined);
  assert.equal(backButton.disabled, false);
  assert.equal(label.textContent, 'Sign Up');

  const malformedDecision = submit(event());
  assert.equal(submitCount, 2);
  releaseFetch({ ok: true, status: 200, json: async () => ({ message: 'synthetic response without a decision' }) });
  await malformedDecision;
  assert.equal(context.window.__signupProcessing, false);
  assert.equal(context.window.location.href, '');
  assert.equal(button.disabled, false);

  const retry = submit(event());
  assert.equal(submitCount, 3);
  releaseFetch({ ok: true, status: 200, json: async () => ({ flagged: false }) });
  await retry;
  assert.equal(context.window.__signupProcessing, false);
  assert.equal(context.window.location.href, './payment-success-signup.html?mode=free');
});
