const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const login = fs.readFileSync(path.join(__dirname, "../login.html"), "utf8");
const resetPage = fs.readFileSync(path.join(__dirname, "../reset-password.html"), "utf8");
const loginScript = fs.readFileSync(path.join(__dirname, "../js/login.js"), "utf8");
const resetScript = fs.readFileSync(path.join(__dirname, "../js/resetPassword.js"), "utf8");
const privacyScript = fs.readFileSync(path.join(__dirname, "../js/privacy.js"), "utf8");
const resetRequestStart = loginScript.indexOf("resetPasswordForEmail(");
const resetRequestBlock = loginScript.slice(resetRequestStart, resetRequestStart + 1000);

test("password reset request feedback is announced as a polite status", () => {
  assert.match(login, /<p id="reset-password-status" class="reset-status" role="status" aria-live="polite" aria-atomic="true"><\/p>/);
  assert.match(loginScript, /resetStatus\.textContent\s*=\s*['"]If an account matches that email, a reset link will be sent\./);
  assert.doesNotMatch(loginScript, /resetStatus\.textContent\s*=\s*['"]Error sending reset email:/);
  assert.doesNotMatch(resetRequestBlock, /error\.message/);
});

test("password reset callback resolves within the current site path", () => {
  assert.match(loginScript, /new URL\(['"]\.\/reset-password\.html['"],\s*window\.location\.href\)\.href/);
  assert.doesNotMatch(loginScript, /window\.location\.origin\}\s*\/reset-password\.html/);
});

test("new password feedback is announced as a polite status", () => {
  assert.match(resetPage, /<p id="new-password-status" class="reset-status" role="status" aria-live="polite" aria-atomic="true"><\/p>/);
  assert.match(resetScript, /statusEl\.textContent\s*=\s*message;/);
  assert.match(resetScript, /function setStatus\(message, isError = false\)/);
});

test("password recovery never logs session or credential fields", () => {
  assert.doesNotMatch(resetScript, /onAuthStateChange\s*\(/);
  // This page handles only a recovery token/session; any console output risks
  // leaking provider errors or credentials through browser diagnostics.
  assert.doesNotMatch(resetScript, /console\.(?:log|info|warn|error)\s*\(/);
  assert.match(resetScript, /if\s*\(error\)\s*\{[\s\S]*?btn\.disabled\s*=\s*true;[\s\S]*?return;/);
  assert.match(resetScript, /catch\s*\{[\s\S]*?btn\.disabled\s*=\s*true;[\s\S]*?return;/);
});

test("password reset preserves leading and trailing password characters", () => {
  assert.match(resetScript, /const newPassword = newPasswordInput\.value;/);
  assert.match(resetScript, /const confirmPassword = confirmPasswordInput\.value;/);
  assert.doesNotMatch(resetScript, /(?:newPasswordInput|confirmPasswordInput)\.value\.trim\(\)/);
});

test("privacy request records render as text and only allow HTTPS downloads", () => {
  assert.doesNotMatch(privacyScript, /statusEl\.innerHTML/);
  assert.match(privacyScript, /document\.createTextNode\(`\$\{requestType\}[\s\S]*?\)`\)/);
  assert.match(privacyScript, /new URL\(req\.result_url\)/);
  assert.match(privacyScript, /resultUrl\.protocol === ['"]https:['"]/);
  assert.match(privacyScript, /button\.setAttribute\('data-id', String\(req\.id \?\? ''\)\)/);
});

test("account deletion request messaging does not imply immediate deletion", () => {
  assert.match(privacyScript, /does not delete your account immediately/i);
  assert.match(privacyScript, /Your account has not been deleted/i);
});

function recoveryPage(overrides = {}) {
  let ready;
  const timers = [];
  const calls = [];
  const submitButton = { disabled: false };
  const form = {
    handlers: {},
    addEventListener(name, fn) { this.handlers[name] = fn; },
    querySelector() { return submitButton; },
  };
  const element = (value = "") => ({
    value,
    style: {},
    attributes: {},
    addEventListener() {},
    setAttribute(name, v) { this.attributes[name] = v; },
  });
  const elements = {
    "new-password-form": form,
    "new-password": element(),
    "confirm-password": element(),
    "new-password-status": element(),
    "new-password-toggle": element(),
    "confirm-password-toggle": element(),
    "password-strength-bar": element(),
    "password-strength-text": element(),
  };
  const supabase = { auth: {
    getSession: async () => {
      calls.push({ method: "getSession" });
      if (overrides.getSessionReject) throw new Error("synthetic network failure");
      return overrides.getSession || { data: { session: { user: { id: "synthetic-user" } } }, error: null };
    },
    updateUser: async value => {
      calls.push({ method: "updateUser", value });
      return overrides.updateResult || { data: { user: { id: "synthetic-user" } }, error: null };
    },
    signOut: async options => {
      calls.push({ method: "signOut", options });
      return { error: null };
    },
  } };
  const source = resetScript.replace(/^import .*;\r?\n/m, "");
  vm.runInNewContext(source, {
    window: { addEventListener: (_name, fn) => { ready = fn; }, location: { href: "https://example.invalid/reset-password.html#synthetic-token" } },
    document: { getElementById: id => elements[id] || null },
    createClient: () => supabase,
    setTimeout: fn => { timers.push(fn); return timers.length; },
  });
  return { calls, elements, form, submitButton, timers, ready: async () => ready(),
    supabase, location: "https://example.invalid/reset-password.html#synthetic-token" };
}

test("missing, expired, reused or malformed recovery results do not enable password update", async () => {
  // These are synthetic client responses only; they do not emulate Supabase token semantics.
  for (const label of ["missing", "expired", "reused", "malformed"]) {
    const page = recoveryPage({ getSession: { data: { session: null }, error: null } });
    await page.ready();
    assert.equal(page.submitButton.disabled, true, label);
    assert.equal(page.form.handlers.submit, undefined, label);
    assert.match(page.elements["new-password-status"].textContent, /invalid or has expired/i);
  }
});

test("recovery lookup errors and timeouts fail closed without logging credentials", async () => {
  for (const overrides of [
    { getSession: { data: { session: null }, error: { message: "synthetic error" } } },
    { getSessionReject: true },
  ]) {
    const page = recoveryPage(overrides);
    await page.ready();
    assert.equal(page.submitButton.disabled, true);
    assert.equal(page.form.handlers.submit, undefined);
    assert.match(page.elements["new-password-status"].textContent, /could not verify/i);
  }
});

test("valid synthetic session updates exact password then requests global sign-out before redirect", async () => {
  const page = recoveryPage();
  await page.ready();
  assert.equal(page.submitButton.disabled, false);
  page.elements["new-password"].value = "  synthetic password  ";
  page.elements["confirm-password"].value = "  synthetic password  ";
  let prevented = false;
  await page.form.handlers.submit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(page.calls.find(c => c.method === "updateUser").value.password, "  synthetic password  ");
  assert.equal(page.calls.some(c => c.method === "signOut"), false);
  assert.equal(page.timers.length, 1);
  await page.timers[0]();
  assert.equal(page.calls.find(c => c.method === "signOut").options.scope, "global");
});

test("recovery page leaves URL-token consumption to Supabase and stores no raw token itself", () => {
  assert.doesNotMatch(resetScript, /location\.(?:hash|search)|localStorage|sessionStorage/);
  assert.match(resetScript, /auth\.getSession\(\)/);
});
