const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../meadow-market-littles');
const stateScope = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'save-state.js'), 'utf8'), stateScope);
const rules = stateScope.meadowLittlesSaveState;
const fresh = rules.defaults();
const gameSource = fs.readFileSync(path.join(root, 'littles-cloud.js'), 'utf8');
const server = new Map([
  ['little-account-1', { revision: 0, data: fresh }],
]);
const parentEmail = 'parent@example.test';

// Only the standard DOM operations used by the account dialog. No browser,
// production credentials, network, or account/save writes are involved.
function accountDocument() {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.textContent = ''; this.open = false; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute() {}
    addEventListener() {}
    focus() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  return { createElement: tag => new Element(tag), body: new Element('body') };
}
const descendants = element => [element, ...element.children.flatMap(descendants)];

function device(initialId = 'little-account-1', loginId = initialId) {
  const context = {
    globalThis: null,
    URL,
    location: { pathname: '/meadow-market-littles/', origin: 'https://sponsorsorter.com' },
    setTimeout,
    clearTimeout,
    document: accountDocument(),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
  };
  context.globalThis = context;
  vm.runInNewContext(gameSource, context);

  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
  const calls = [];
  let identity = null;
  const auth = {
    async getSession() { return { data: { session: identity ? { user: identity, access_token: 'mock-session' } : null }, error: null }; },
    async getUser() { return { data: { user: identity }, error: identity ? null : { message: 'No user' } }; },
    async signInAnonymously() {
      identity = { id: initialId, is_anonymous: true };
      return { data: { user: identity }, error: null };
    },
    async updateUser(attributes, options = {}) {
      calls.push({ method: 'updateUser', attributes, options });
      if (attributes.email) identity = { ...identity, email: attributes.email };
      if (attributes.password) identity = { ...identity, is_anonymous: false };
      return { data: { user: identity }, error: null };
    },
    async verifyOtp(input) {
      calls.push({ method: 'verifyOtp', input });
      identity = { id: loginId, email: input.email, email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false };
      return { data: { user: identity }, error: null };
    },
    async signInWithPassword(input) {
      calls.push({ method: 'signInWithPassword', input });
      identity = { id: loginId, email: input.email, email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false };
      return { data: { user: identity }, error: null };
    },
    async resetPasswordForEmail(email, options) {
      calls.push({ method: 'resetPasswordForEmail', email, options });
      return { data: {}, error: null };
    },
    async signOut(options) {
      calls.push({ method: 'signOut', options });
      identity = null;
      return { error: null };
    },
  };
  const fairplay = {
    moderation: { app: 'littles', banned: false, restricted: false, decisions: [] },
    runtime: { app: 'littles', maintenance: false, notices: [] },
    build: 36,
  };
  const client = {
    auth,
    functions: {
      async invoke(name, { body }) {
        assert.equal(name, 'meadow-littles-fairplay');
        calls.push({ method: 'fairplay', action: body.action });
        if (body.action === 'save') {
          const save = body.save;
          const account = server.get(identity.id) ?? { revision: 0, data: fresh };
          server.set(identity.id, account);
          if (save.p_expected_revision !== account.revision) {
            return { data: { code: 'LITTLES_SAVE_REVISION_CONFLICT' }, error: { context: { json: async () => ({ code: 'LITTLES_SAVE_REVISION_CONFLICT' }) } } };
          }
          account.revision += 1;
          account.data = structuredClone(save.p_save_data);
          return { data: { ok: true, result: { request_id: save.p_request_id, revision: account.revision, replayed: false } }, error: null };
        }
        const accountState = server.get(identity.id) ?? { revision: 0, data: fresh };
        const account = body.action === 'connect' ? {
          profile: { user_id: identity.id },
          save: { cloud_version: 1, revision: accountState.revision, data: structuredClone(accountState.data) },
        } : undefined;
        return { data: { ok: true, ...fairplay, ...(account ? { account } : {}) }, error: null };
      },
    },
    async rpc(name) {
      assert.equal(name, 'meadow_littles_open');
      const account = server.get(identity.id) ?? { revision: 0, data: fresh };
      return { data: { ok: true, contract: 'meadow-littles-cloud-v1', entitlements_verified: false, profile: { user_id: identity.id }, save: { cloud_version: 1, revision: account.revision, data: structuredClone(account.data) } }, error: null };
    },
  };

  const api = context.meadowLittlesCloud;
  let local = structuredClone(fresh);
  return {
    api,
    calls,
    storage,
    client,
    document: context.document,
    get user() { return identity; },
    get local() { return local; },
    setLocal(next) { local = structuredClone(next); },
    async init() {
      return api.init({ client, storage, getState: () => local, applyState: next => { if (!rules.valid(next)) return false; local = structuredClone(next); return true; } });
    },
  };
}

async function run() {
  const first = device();
  assert.equal((await first.init()).state, 'ready', 'a new device can keep playing with a private guest save');
  assert.equal(first.user.is_anonymous, true);
  await assert.rejects(first.api.signOut(), error => error.code === 'LITTLES_LINK_EMAIL_BEFORE_SIGN_OUT');

  const localProgress = structuredClone(fresh);
  localProgress.stars = 17;
  first.setLocal(localProgress);
  first.api.queueSave(localProgress);
  const saved = await first.api.choose('device');
  assert.equal(saved.ok, true);
  assert.equal(server.get('little-account-1').revision, 1);
  assert.equal(server.get('little-account-1').data.stars, 17);

  const link = await first.api.linkEmail(parentEmail);
  assert.equal(link.verificationRequired, true);
  const update = first.calls.find(call => call.method === 'updateUser' && call.attributes.email);
  assert.equal(update.options.emailRedirectTo, 'https://sponsorsorter.com/meadow-market-littles/');
  await first.api.verifyEmail(parentEmail, '123456');
  assert.equal(first.user.is_anonymous, false, 'verified email upgrades the same guest account');
  assert.equal(first.user.id, 'little-account-1', 'linking preserves the account and its save owner');
  await first.api.setPassword('safe-test-password');

  const second = device('little-account-2', 'little-account-1');
  assert.equal((await second.init()).state, 'ready', 'recovery starts without replacing local progress');
  const signIn = await second.api.signIn(parentEmail, 'safe-test-password');
  assert.equal(signIn.ok, true);
  assert.equal(second.api.getStatus().state, 'choice_required', 'a new device asks before loading a cloud save');
  assert.equal(second.local.stars, 0, 'sign-in does not replace device progress automatically');
  const restored = await second.api.choose('cloud');
  assert.equal(restored.ok, true);
  assert.equal(second.local.stars, 17, 'explicit cloud choice restores the linked account progress');
  assert.equal(server.get('little-account-1').revision, 1, 'recovery reads progress without mutating the production save');
  const recovery = await second.api.recover(parentEmail);
  assert.equal(recovery.ok, true);
  const reset = second.calls.find(call => call.method === 'resetPasswordForEmail');
  assert.equal(reset.options.redirectTo, 'https://sponsorsorter.com/meadow-market-littles/');
  await second.api.signOut();
  assert.equal(second.calls.find(call => call.method === 'signOut').options.scope, 'local');

  const ui = device('dialog-guest', 'little-account-1');
  await ui.init();
  ui.api.openAccount();
  const guestDialog = ui.document.body.children.at(-1);
  const guestControls = descendants(guestDialog);
  assert(guestControls.some(node => node.textContent === 'Guest account'));
  assert(!guestControls.some(node => node.textContent === 'Sign out from Littles'));
  guestControls.find(node => node.type === 'email').value = parentEmail;
  guestControls.find(node => node.type === 'password').value = 'safe-test-password';
  await guestControls.find(node => node.textContent === 'Sign in to an existing account').onclick();
  const parentDialog = ui.document.body.children.at(-1);
  const parentControls = descendants(parentDialog);
  assert.notEqual(parentDialog, guestDialog, 'successful sign-in refreshes account controls immediately');
  assert.equal(guestDialog.open, false);
  assert(parentControls.some(node => node.textContent === 'Recoverable account'));
  assert(parentControls.some(node => node.textContent === 'Use cloud progress'), 'the signed-in parent can choose their existing cloud save');
  assert.equal(ui.local.stars, 0, 'refreshing the dialog never replaces device progress');
  await parentControls.find(node => node.textContent === 'Sign out from Littles').onclick();
  assert.equal(ui.api.getStatus().userId, null);
  assert(descendants(ui.document.body.children.at(-1)).some(node => node.textContent === 'Connect cloud save'), 'sign-out refreshes the available account action');
  assert.equal(server.get('little-account-1').data.stars, 17, 'sign-in and sign-out controls do not alter the parent save');

  console.log('Littles account recovery contract: guest linkage, email confirmation, password setup/reset, explicit progress restore and immediate sign-in/sign-out dialog controls passed with an isolated mock; no production account or save was changed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
