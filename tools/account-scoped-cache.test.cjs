const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const helperSource = fs.readFileSync(path.join(__dirname, '../js/accountScopedCache.js'), 'utf8')
  .replace('export function', 'function');
const helper = vm.runInNewContext(`${helperSource}; accountScopedStorageKey`);
const messages = fs.readFileSync(path.join(__dirname, '../js/messages.js'), 'utf8');

test('open-chat cache keys are isolated by authenticated account', () => {
  const aKey = helper('ss_open_chats_v2', 'account-a');
  const bKey = helper('ss_open_chats_v2', 'account-b');
  assert.equal(aKey, 'ss_open_chats_v2:account-a');
  assert.notEqual(aKey, bKey);
  const storage = new Map([[aKey, '[{"offerId":"offer-a"}]']]);
  assert.equal(storage.get(bKey), undefined);
});

test('open-chat cache rejects missing account identity and clears the unsafe legacy key', () => {
  assert.equal(helper('ss_open_chats_v2', null), null);
  assert.equal(helper('', 'account-a'), null);
  assert.match(messages, /const LEGACY_LS_KEY = ['"]ss_open_chats_v2['"]/);
  assert.match(messages, /localStorage\.removeItem\(LEGACY_LS_KEY\)/);
});

test('persisted chat state contains only account-owned UI preferences and offer IDs', () => {
  assert.match(messages, /const storageKey = accountScopedStorageKey\(LS_KEY_PREFIX, activeUser\?\.id\)/);
  assert.match(messages, /localStorage\.setItem\(storageKey, JSON\.stringify\(payload\)\)/);
  assert.match(messages, /localStorage\.getItem\(storageKey\)/);
  const persistBlock = messages.slice(messages.indexOf('function persistOpenChats'), messages.indexOf('function restoreOpenChats'));
  assert.match(persistBlock, /offerId,\s*minimized:\s*!!st\.minimized,\s*infoOpen:\s*!!st\.infoOpen,\s*lastOpenedAt:/);
  assert.doesNotMatch(persistBlock, /lastCommentText|peerEmail|messageText|comment_text/);
});
