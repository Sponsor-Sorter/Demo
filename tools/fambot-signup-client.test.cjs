const test = require('node:test');
const assert = require('node:assert/strict');

const { moderateSignupWithFamBot } = require('../js/famBotSignup.js');

test('signup moderation uses the configured Supabase function client with only user_id and content', async () => {
  const calls = [];
  const result = await moderateSignupWithFamBot({
    functions: { invoke: async (...args) => { calls.push(args); return { data: { flagged: false }, error: null }; } },
  }, 'synthetic signup content');
  assert.equal(result.status, 'allowed');
  assert.deepEqual(calls, [['FamBotSignup', { body: { user_id: null, content: 'synthetic signup content' } }]]);
});

test('flagged signup content is returned as blocked without allowing signup', async () => {
  const result = await moderateSignupWithFamBot({
    functions: { invoke: async () => ({ data: { flagged: true, message: 'Synthetic block' }, error: null }) },
  }, 'synthetic flagged content');
  assert.equal(result.status, 'blocked');
  assert.equal(result.result.message, 'Synthetic block');
});

test('function errors, malformed replies, throws, and invalid clients fail closed uniformly', async () => {
  const cases = [
    null,
    { data: null, error: new Error('internal fixture') },
    { data: { flagged: 'false' }, error: null },
  ];
  for (const reply of cases) {
    assert.deepEqual(await moderateSignupWithFamBot({ functions: { invoke: async () => reply } }, 'synthetic'), { status: 'unavailable' });
  }
  assert.deepEqual(await moderateSignupWithFamBot({ functions: { invoke: async () => { throw new Error('fixture'); } } }, 'synthetic'), { status: 'unavailable' });
  assert.deepEqual(await moderateSignupWithFamBot({}, 'synthetic'), { status: 'unavailable' });
  assert.deepEqual(await moderateSignupWithFamBot({ functions: { invoke: async () => ({ data: { flagged: false } }) } }, null), { status: 'unavailable' });
});
