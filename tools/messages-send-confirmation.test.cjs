const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/messages.js'), 'utf8');

function extractBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end).trim();
}

const productionHelpers = [
  extractBetween('function setSendButtonState(', '\nfunction markDraftEdited('),
  extractBetween('function markDraftEdited(', '\nfunction setSendStatus('),
  extractBetween('function setSendStatus(', '\nfunction isConfirmedMessageRow('),
  extractBetween('function isConfirmedMessageRow(', '\nfunction escapeHtml('),
  extractBetween('async function sendMessage(offerId) {', '\nfunction wireDropdown()'),
].join('\n\n');

const canonicalRow = overrides => ({
  id: 'comment-1',
  offer_id: 'offer-1',
  user_id: 'user-1',
  comment_text: 'hello from a test',
  created_at: '2026-10-15T00:00:00.000Z',
  ...overrides,
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fixture(insertResponse) {
  const calls = [];
  const messages = [];
  const renderedIds = new Set();
  const draftRevisions = new WeakMap();
  const textarea = { value: 'hello from a test', style: { height: '42px' } };
  const sendButton = { disabled: false };
  const status = { textContent: '', hidden: true };
  const offer = {
    sponsor_id: 'sponsor-1',
    sponsee_id: 'user-1',
    sponsor_email: 'sponsor@example.test',
    sponsee_email: 'sponsee@example.test',
  };
  const context = {
    accountGeneration: 1,
    sendInFlight: new Set(),
    draftRevisions,
    offerById: new Map([['offer-1', offer]]),
    peerByOfferId: new Map([['offer-1', { myRole: 'sponsee' }]]),
    getPeerForOffer: () => ({ myRole: 'sponsee' }),
    myAuthId: () => 'user-1',
    myUsername: () => 'Synthetic User',
    myEmail: () => 'user@example.test',
    document: {
      getElementById(id) {
        if (id === 'ss-chat-input-offer-1') return textarea;
        if (id === 'ss-chat-send-offer-1') return sendButton;
        if (id === 'ss-chat-status-offer-1') return status;
        return null;
      },
    },
    supabase: {
      from(table) {
        return {
          insert(rows) {
            calls.push({ table, rows });
            return {
              select(columns) {
                calls[calls.length - 1].columns = columns;
                return { single: insertResponse };
              },
            };
          },
        };
      },
    },
    alreadyRendered: (offerId, id) => renderedIds.has(id),
    appendOneMessage(offerId, row, isMe) {
      messages.push({ offerId, row, isMe });
      if (row?.id != null) renderedIds.add(String(row.id));
    },
    dropdownOpen: () => false,
    refreshThreads: async () => {},
    console: { error() {}, warn() {} },
  };
  vm.runInNewContext(`${productionHelpers}\nthis.__sendMessage = sendMessage;`, context);
  return {
    calls,
    messages,
    renderedIds,
    textarea,
    sendButton,
    status,
    sendMessage: context.__sendMessage,
    inFlight: context.sendInFlight,
    setSendButtonState: context.setSendButtonState,
    markDraftEdited: context.markDraftEdited,
  };
}

test('shows and clears a message only after a canonical row confirms the insert', async () => {
  const row = canonicalRow();
  const page = fixture(async () => ({ data: row, error: null }));

  await page.sendMessage('offer-1');

  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].table, 'private_offer_comments');
  assert.equal(page.calls[0].rows[0].comment_text, row.comment_text);
  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0].row, row);
  assert.equal(page.textarea.value, '');
  assert.equal(page.textarea.style.height, 'auto');
  assert.equal(page.sendButton.disabled, true);
  assert.equal(page.status.hidden, true);
});

test('returned insert error preserves the draft and shows an unknown-outcome notice', async () => {
  const page = fixture(async () => ({ data: null, error: new Error('synthetic returned error') }));

  await page.sendMessage('offer-1');

  assert.equal(page.calls.length, 1);
  assert.equal(page.messages.length, 0);
  assert.equal(page.textarea.value, 'hello from a test');
  assert.equal(page.status.hidden, false);
  assert.match(page.status.textContent, /could not confirm/i);
  assert.match(page.status.textContent, /check the conversation before retrying/i);
  assert.equal(page.sendButton.disabled, false);
});

test('thrown transport failure preserves the draft without automatic retry or synthetic message', async () => {
  const page = fixture(async () => { throw new Error('synthetic unknown transport outcome'); });

  await page.sendMessage('offer-1');

  assert.equal(page.calls.length, 1);
  assert.equal(page.messages.length, 0);
  assert.equal(page.textarea.value, 'hello from a test');
  assert.match(page.status.textContent, /could not confirm/i);
  assert.equal(page.sendButton.disabled, false);
});

test('empty or mismatched returned rows are not shown as confirmed messages', async () => {
  const invalidRows = [
    null,
    canonicalRow({ offer_id: 'another-offer' }),
    canonicalRow({ user_id: 'another-user' }),
    canonicalRow({ comment_text: 'different text' }),
  ];

  for (const row of invalidRows) {
    const page = fixture(async () => ({ data: row, error: null }));
    await page.sendMessage('offer-1');
    assert.equal(page.calls.length, 1);
    assert.equal(page.messages.length, 0);
    assert.equal(page.textarea.value, 'hello from a test');
    assert.match(page.status.textContent, /could not confirm/i);
    assert.equal(page.sendButton.disabled, false);
  }
});

test('in-flight text edits survive confirmed success and button remains disabled until settled', async () => {
  const response = deferred();
  const page = fixture(() => response.promise);
  const pendingSend = page.sendMessage('offer-1');
  await Promise.resolve();

  assert.equal(page.calls.length, 1);
  assert.equal(page.messages.length, 0);
  assert.equal(page.textarea.value, 'hello from a test');
  assert.equal(page.sendButton.disabled, true);

  page.textarea.value = 'edited while request was pending';
  page.markDraftEdited(page.textarea);
  page.setSendButtonState('offer-1', page.textarea, page.sendButton);
  assert.equal(page.sendButton.disabled, true);

  response.resolve({ data: canonicalRow(), error: null });
  await pendingSend;

  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0].row.comment_text, 'hello from a test');
  assert.equal(page.textarea.value, 'edited while request was pending');
  assert.equal(page.sendButton.disabled, false);
  assert.equal(page.inFlight.has('offer-1'), false);
});

test('a draft edited and restored during the request is not cleared on success', async () => {
  const response = deferred();
  const page = fixture(() => response.promise);
  const pendingSend = page.sendMessage('offer-1');
  await Promise.resolve();

  page.textarea.value = 'temporary edit';
  page.markDraftEdited(page.textarea);
  page.textarea.value = 'hello from a test';
  page.markDraftEdited(page.textarea);

  response.resolve({ data: canonicalRow(), error: null });
  await pendingSend;

  assert.equal(page.messages.length, 1);
  assert.equal(page.textarea.value, 'hello from a test');
  assert.equal(page.sendButton.disabled, false);
});
