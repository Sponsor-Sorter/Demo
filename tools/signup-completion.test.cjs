const test = require('node:test');
const assert = require('node:assert/strict');

async function loadCompletionHelper() {
  const path = require('node:path');
  const { pathToFileURL } = require('node:url');
  return import(pathToFileURL(path.resolve(__dirname, '../js/signupCompletion.js')).href);
}

test('new signup uses Supabase Auth and does not log in again', async () => {
  const { createOrResumeSignupAccount } = await loadCompletionHelper();
  const calls = [];
  const client = { auth: {
    signUp: async args => { calls.push(['signUp', args]); return { data: { user: { id: 'user-new' }, session: null }, error: null }; },
    signInWithPassword: async args => { calls.push(['signInWithPassword', args]); throw new Error('must not sign in'); },
  } };
  const result = await createOrResumeSignupAccount(client, { email: 'new@example.invalid', password: 'fixture-pass', metadata: { username: 'Fixture' } });
  assert.equal(result.data.user.id, 'user-new');
  assert.equal(result.resumed, false);
  assert.deepEqual(calls.map(call => call[0]), ['signUp']);
});

test('duplicate signup resumes the same account with the provided credentials', async () => {
  const { createOrResumeSignupAccount } = await loadCompletionHelper();
  const calls = [];
  const client = { auth: {
    signUp: async args => { calls.push(['signUp', args]); return { data: { user: null }, error: { message: 'User already registered' } }; },
    signInWithPassword: async args => { calls.push(['signInWithPassword', args]); return { data: { user: { id: 'user-existing' }, session: { access_token: 'fixture' } }, error: null }; },
  } };
  const result = await createOrResumeSignupAccount(client, { email: 'existing@example.invalid', password: 'fixture-pass', metadata: {} });
  assert.equal(result.data.user.id, 'user-existing');
  assert.equal(result.resumed, true);
  assert.deepEqual(calls.map(call => call[0]), ['signUp', 'signInWithPassword']);
  assert.equal(calls[1][1].email, 'existing@example.invalid');
});

test('Auth duplicate-obscuring response without user also attempts credentialed resume', async () => {
  const { createOrResumeSignupAccount } = await loadCompletionHelper();
  let loginCalled = false;
  const result = await createOrResumeSignupAccount({ auth: {
    signUp: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => { loginCalled = true; return { data: { user: { id: 'user-existing' } }, error: null }; },
  } }, { email: 'existing@example.invalid', password: 'fixture-pass', metadata: {} });
  assert.equal(loginCalled, true);
  assert.equal(result.data.user.id, 'user-existing');
  assert.equal(result.resumed, true);
});

test('non-duplicate signup errors are returned without attempting sign in', async () => {
  const { createOrResumeSignupAccount } = await loadCompletionHelper();
  let loginCalled = false;
  const authError = { message: 'Password should be at least 8 characters' };
  const result = await createOrResumeSignupAccount({ auth: {
    signUp: async () => ({ data: null, error: authError }),
    signInWithPassword: async () => { loginCalled = true; return { data: null, error: null }; },
  } }, { email: 'new@example.invalid', password: 'short', metadata: {} });
  assert.equal(result.error, authError);
  assert.equal(loginCalled, false);
});

test('failed resume reports the credential error and remains retryable', async () => {
  const { createOrResumeSignupAccount } = await loadCompletionHelper();
  const credentialError = { message: 'Email not confirmed' };
  const result = await createOrResumeSignupAccount({ auth: {
    signUp: async () => ({ data: { user: null }, error: { message: 'User already registered' } }),
    signInWithPassword: async () => ({ data: null, error: credentialError }),
  } }, { email: 'existing@example.invalid', password: 'fixture-pass', metadata: {} });
  assert.equal(result.error, credentialError);
  assert.equal(result.resumed, true);
});
