const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/messages.js'), 'utf8');

function extract(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end).trim();
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function queryFixture(response) {
  const calls = [];
  const supabase = {
    from(table) {
      const call = { table, filters: [], orders: [], limit: null };
      calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return this; },
        eq(column, value) { call.filters.push(['eq', column, value]); return this; },
        gt(column, value) { call.filters.push(['gt', column, value]); return this; },
        or(value) { call.filters.push(['or', value]); return this; },
        order(column, options) { call.orders.push([column, options]); return this; },
        limit(value) { call.limit = value; return this; },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
      };
      return query;
    },
  };
  const fetchSource = extract('async function fetchOfferMessages(', '\nfunction buildMiniAvatar(');
  const context = { supabase, console: { error() {}, warn() {} } };
  vm.runInNewContext(`${fetchSource}\nthis.fetchOfferMessages = fetchOfferMessages; this.fetchOfferMessagesSince = fetchOfferMessagesSince;`, context);
  return { calls, fetchOfferMessages: context.fetchOfferMessages, fetchOfferMessagesSince: context.fetchOfferMessagesSince };
}

function commentsQueryFixture(response) {
  const supabase = {
    from() {
      const query = {
        select() { return this; },
        or() { return this; },
        order() { return this; },
        limit() { return this; },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
      };
      return query;
    },
  };
  const commentsSource = extract('async function loadLatestCommentsForMe(', '\nfunction avatarHTML(');
  const context = { supabase, console: { error() {} }, myEmail: () => 'account@example.test', accountGeneration: 7 };
  vm.runInNewContext(`${commentsSource}\nthis.loadLatestCommentsForMe = loadLatestCommentsForMe;`, context);
  return context.loadLatestCommentsForMe;
}

function offersQueryFixture(response) {
  const supabase = {
    from() {
      const query = {
        select() { return this; },
        or() { return this; },
        order() { return this; },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
      };
      return query;
    },
  };
  const offersSource = extract('async function loadMyOffers(', '\nfunction getPeerForOffer(');
  const offerById = new Map([['preserved-offer', { id: 'preserved-offer' }]]);
  const peerByOfferId = new Map([['preserved-offer', { peerName: 'Existing' }]]);
  const context = {
    supabase,
    console: { error() {}, warn() {} },
    myEmail: () => 'account@example.test',
    myUsername: () => 'account',
    offerById,
    peerByOfferId,
    loadPeerProfiles: async () => {},
    getPeerForOffer: () => ({ peerName: 'Peer' }),
    accountGeneration: 7,
    offerLoadGeneration: 0,
  };
  vm.runInNewContext(`${offersSource}\nthis.loadMyOffers = loadMyOffers;`, context);
  return { context, offerById, peerByOfferId };
}

function guardFixture() {
  const context = {
    accountGeneration: 1,
    threadRefreshGeneration: 0,
    chatLoadGenerations: new Map(),
  };
  const guards = extract('function nextChatLoadGeneration(', '\nfunction $(id)');
  vm.runInNewContext(`${guards}\nthis.nextChatLoadGeneration = nextChatLoadGeneration; this.isCurrentChatLoad = isCurrentChatLoad; this.isCurrentThreadRefresh = isCurrentThreadRefresh;`, context);
  return context;
}

function refreshFixture(offerRequests, commentRequests) {
  const rendered = [];
  const statuses = [];
  const context = {
    accountGeneration: 1,
    threadRefreshGeneration: 0,
    ensureUI() {},
    loadMyOffers: () => offerRequests.shift(),
    loadLatestCommentsForMe: () => commentRequests.shift(),
    renderThreadStatus: (message) => statuses.push(message),
    renderThreads: (threads) => rendered.push(threads),
    updateBadge() {},
    peerByOfferId: new Map(),
    offerById: new Map(),
    unreadByOffer: new Map(),
    getPeerForOffer: (offer) => ({ peerName: offer.id, peerEmail: null, peerPic: null, offerTitle: offer.id, offerAmount: null }),
  };
  const guardSource = extract('function isCurrentThreadRefresh(', '\nfunction $(id)');
  const refreshSource = extract('async function refreshThreads()', '\nfunction persistOpenChats(');
  vm.runInNewContext(`${guardSource}\n${refreshSource}\nthis.refreshThreads = refreshThreads;`, context);
  return { context, rendered, statuses, refreshThreads: context.refreshThreads };
}

function historyResultFixture() {
  const calls = [];
  const context = {
    renderChatError: (offerId) => calls.push(['error', offerId]),
    renderChatMessages: (offerId, rows) => calls.push(['render', offerId, rows]),
  };
  const resultSource = extract('function renderChatHistoryResult(', '\nfunction appendOneMessage(');
  vm.runInNewContext(`${resultSource}\nthis.renderChatHistoryResult = renderChatHistoryResult;`, context);
  return { calls, renderChatHistoryResult: context.renderChatHistoryResult };
}

test('history query error stays distinguishable from a successful empty history', async () => {
  const failing = queryFixture({ data: null, error: new Error('synthetic failure') });
  const failedResult = await failing.fetchOfferMessages('offer-a');
  assert.equal(failedResult.data, null);
  assert.ok(failedResult.error);

  const empty = queryFixture({ data: [], error: null });
  const emptyResult = await empty.fetchOfferMessages('offer-a');
  assert.deepEqual(emptyResult.data, []);
  assert.equal(emptyResult.error, null);

  const malformed = queryFixture({ data: null, error: null });
  const malformedResult = await malformed.fetchOfferMessages('offer-a');
  assert.equal(malformedResult.data, null);
  assert.ok(malformedResult.error);
});

test('conversation preview query error stays distinguishable from a successful empty result', async () => {
  const fail = commentsQueryFixture({ data: null, error: new Error('synthetic failure') });
  const failedResult = await fail();
  assert.equal(failedResult.data, null);
  assert.ok(failedResult.error);

  const empty = commentsQueryFixture({ data: [], error: null });
  const emptyResult = await empty();
  assert.deepEqual(emptyResult.data, []);
  assert.equal(emptyResult.error, null);

  const malformed = commentsQueryFixture({ data: null, error: null });
  const malformedResult = await malformed();
  assert.equal(malformedResult.data, null);
  assert.ok(malformedResult.error);
});

test('offer query failure is not treated as a successful empty offer list', async () => {
  const failed = offersQueryFixture({ data: null, error: new Error('synthetic failure') });
  const failure = await failed.context.loadMyOffers();
  assert.ok(failure.error);
  assert.equal(failed.offerById.has('preserved-offer'), true);

  const empty = offersQueryFixture({ data: [], error: null });
  const emptyResult = await empty.context.loadMyOffers();
  assert.equal(emptyResult.error, null);
  assert.deepEqual(emptyResult.data, []);
  assert.equal(empty.offerById.size, 0);

  const malformed = offersQueryFixture({ data: null, error: null });
  const malformedResult = await malformed.context.loadMyOffers();
  assert.ok(malformedResult.error);
  assert.equal(malformed.offerById.has('preserved-offer'), true);
});

test('refresh shows an error state for failed queries and empty state only after successful empty queries', async () => {
  const failed = refreshFixture(
    [Promise.resolve({ data: null, error: new Error('offers failed') })],
    [Promise.resolve({ data: [], error: null })],
  );
  assert.equal(await failed.refreshThreads(), false);
  assert.equal(failed.rendered.length, 0);
  assert.match(failed.statuses[0], /could not load conversations/i);

  const empty = refreshFixture(
    [Promise.resolve({ data: [], error: null })],
    [Promise.resolve({ data: [], error: null })],
  );
  assert.equal(await empty.refreshThreads(), true);
  assert.deepEqual(empty.rendered, [[]]);
  assert.equal(empty.statuses.length, 0);
});

test('chat history error preserves unread state while successful empty history marks it read', () => {
  const fixture = historyResultFixture();
  let readCount = 0;

  assert.equal(fixture.renderChatHistoryResult('offer-a', { data: null, error: new Error('offline') }, () => readCount++), false);
  assert.deepEqual(fixture.calls, [['error', 'offer-a']]);
  assert.equal(readCount, 0);

  assert.equal(fixture.renderChatHistoryResult('offer-a', { data: [], error: null }, () => readCount++), true);
  assert.equal(fixture.calls[1][0], 'render');
  assert.deepEqual(fixture.calls[1][2], []);
  assert.equal(readCount, 1);
});

test('refreshThreads commits only the newest deferred response', async () => {
  const oldOffers = deferred();
  const oldComments = deferred();
  const newOffers = deferred();
  const newComments = deferred();
  const fixture = refreshFixture(
    [oldOffers.promise, newOffers.promise],
    [oldComments.promise, newComments.promise],
  );

  const oldRefresh = fixture.refreshThreads();
  const newRefresh = fixture.refreshThreads();
  newOffers.resolve({ data: [{ id: 'new-offer', created_at: '2026-10-15T00:00:00Z' }], error: null });
  newComments.resolve({ data: [], error: null });
  await newRefresh;
  oldOffers.resolve({ data: [{ id: 'old-offer', created_at: '2026-10-14T00:00:00Z' }], error: null });
  oldComments.resolve({ data: [], error: null });
  await oldRefresh;

  assert.equal(fixture.rendered.length, 1);
  assert.equal(fixture.rendered[0][0].offer_id, 'new-offer');
});

test('incremental history query reports errors without converting them into an empty page', async () => {
  const fixture = queryFixture({ data: null, error: new Error('synthetic failure') });
  const result = await fixture.fetchOfferMessagesSince('offer-a', '2026-10-15T00:00:00.000Z');
  assert.equal(result.data, null);
  assert.ok(result.error);
  assert.equal(fixture.calls[0].filters.some((f) => f[0] === 'gt' && f[1] === 'created_at'), true);
});

test('older deferred chat response cannot overwrite a newer reopen response', async () => {
  const state = guardFixture();
  const older = deferred();
  const newer = deferred();
  const applied = [];
  const accountVersion = state.accountGeneration;
  const oldGeneration = state.nextChatLoadGeneration('offer-a');
  const oldRequest = older.promise.then((value) => {
    if (state.isCurrentChatLoad('offer-a', oldGeneration, accountVersion)) applied.push(value);
  });
  const newGeneration = state.nextChatLoadGeneration('offer-a');
  const newRequest = newer.promise.then((value) => {
    if (state.isCurrentChatLoad('offer-a', newGeneration, accountVersion)) applied.push(value);
  });

  newer.resolve('new history');
  await newRequest;
  older.resolve('stale history');
  await oldRequest;
  assert.deepEqual(applied, ['new history']);
});

test('closing a chat invalidates its pending request and account change invalidates every chat', async () => {
  const state = guardFixture();
  const pending = deferred();
  const applied = [];
  const accountVersion = state.accountGeneration;
  const generation = state.nextChatLoadGeneration('offer-a');
  const request = pending.promise.then((value) => {
    if (state.isCurrentChatLoad('offer-a', generation, accountVersion)) applied.push(value);
  });
  state.nextChatLoadGeneration('offer-a'); // close, then reopen has a newer token
  state.accountGeneration += 1; // account switch invalidates prior account's result
  pending.resolve('old-account history');
  await request;
  assert.deepEqual(applied, []);
});

test('older refresh response cannot replace a newer refresh or survive an account switch', async () => {
  const state = guardFixture();
  const oldRefresh = deferred();
  const newRefresh = deferred();
  const applied = [];
  const accountVersion = state.accountGeneration;
  const oldGeneration = ++state.threadRefreshGeneration;
  const oldRequest = oldRefresh.promise.then((value) => {
    if (state.isCurrentThreadRefresh(oldGeneration, accountVersion)) applied.push(value);
  });
  const newGeneration = ++state.threadRefreshGeneration;
  const newRequest = newRefresh.promise.then((value) => {
    if (state.isCurrentThreadRefresh(newGeneration, accountVersion)) applied.push(value);
  });
  newRefresh.resolve('new list');
  await newRequest;
  oldRefresh.resolve('stale list');
  await oldRequest;
  assert.deepEqual(applied, ['new list']);

  const switchedAccountVersion = state.accountGeneration;
  const switchedGeneration = ++state.threadRefreshGeneration;
  const staleAfterSwitch = deferred();
  const switchedRequest = staleAfterSwitch.promise.then((value) => {
    if (state.isCurrentThreadRefresh(switchedGeneration, switchedAccountVersion)) applied.push(value);
  });
  state.accountGeneration += 1;
  staleAfterSwitch.resolve('prior account list');
  await switchedRequest;
  assert.deepEqual(applied, ['new list']);
});
