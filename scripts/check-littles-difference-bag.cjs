const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

const root = path.resolve(__dirname, '../meadow-market-littles');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const missing = Symbol('missing');

// Exercise the real menu, introduction, start and scene mount without a browser,
// real storage, network, animation frames or completed rounds.
class Element {
  constructor(selector = '') {
    this.selector = selector;
    this.nodes = new Map();
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.clientWidth = 800;
    this.clientHeight = 480;
  }
  set innerHTML(value) { this.html = value; this.nodes.clear(); }
  get innerHTML() { return this.html || ''; }
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element(selector));
    return this.nodes.get(selector);
  }
  querySelectorAll(selector) {
    const attribute = selector === '[data-game]' ? 'game' : selector === '[data-diff]' ? 'diff' : null;
    if (!attribute) return [];
    return [...this.innerHTML.matchAll(new RegExp(`data-${attribute}="([^"]+)"`, 'g'))].map((match, index) => {
      const key = `${selector}:${index}`;
      if (!this.nodes.has(key)) {
        const element = new Element();
        element.dataset[attribute] = match[1];
        this.nodes.set(key, element);
      }
      return this.nodes.get(key);
    });
  }
  getBoundingClientRect() {
    const top = this.selector === '.mini-header' ? 0 : this.selector === '.mini-caption' ? 560 : 80;
    const height = this.selector === '.mini-header' ? 80 : this.selector === '.mini-caption' ? 40 : 480;
    return { left: 0, top, right: 800, bottom: top + height, width: 800, height };
  }
  setAttribute() {}
  addEventListener() {}
  append() {}
  insertBefore() {}
  showModal() { this.open = true; }
}

function device(bag, existingStorage, quality = 88) {
  const body = new Element(), hud = new Element();
  let dialog, saved = 0, frames = 0, selected, qualityReads = 0;
  const document = {
    body,
    createElement(tag) { const element = new Element(); if (tag === 'dialog') dialog = element; return element; },
    querySelector() { return hud; },
    addEventListener() {},
  };
  const scope = {
    window: { addEventListener() {}, meadowNextGames: { games: [], handles: () => false } },
    document,
    performance: { now: () => 0 },
    requestAnimationFrame() { return ++frames; },
    cancelAnimationFrame() {},
    clearTimeout() {},
  };
  if (quality !== missing) scope.window.meadowWeeklyFair = {
    getQualityBuild() { qualityReads++; return typeof quality === 'function' ? quality() : quality; },
  };
  for (const file of ['save-state.js', 'play-levels.js', 'minigames.js']) vm.runInNewContext(read(file), scope, { filename: file });
  const rules = scope.meadowLittlesSaveState;
  const storage = existingStorage || new Map();
  if (!existingStorage) {
    const fixture = plain(rules.defaults());
    fixture.stars = 19;
    fixture.xp = 7;
    fixture.minigames.records.differences = { wins: 4, level: 3, marker: 'untouched' };
    fixture.minigames.rewards.old = 2;
    fixture.minigames.artGallery.keep = { picture: 'mine' };
    fixture.minigames.future = { keep: true };
    fixture.farms.littles.inventory.apple = 0;
    fixture.farms.littles.inventory.carrot = 50;
    fixture.farms.littles.objects = [{ id: 'barn', future: 'keep' }];
    fixture.future = { keep: ['yes', 0] };
    if (bag !== missing) fixture.minigames.differenceBag = bag;
    storage.set('save', JSON.stringify(fixture));
  }
  const adapter = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const original = storage.get('save');
  const loaded = rules.load(adapter, 'save');
  assert.equal(loaded.writable, true);
  assert.equal(loaded.migrated, false);
  assert.equal(storage.get('save'), original, 'Loading must not rewrite the save');
  const before = plain(loaded.state);
  const validBag = loaded.state.minigames.differenceBag;
  const realMount = scope.window.meadowPlayLevels.mount;
  scope.window.meadowPlayLevels.mount = (run, hooks) => { selected = run.game.variant; return realMount(run, hooks); };
  scope.window.meadowMinigames.attach({
    state: () => loaded.state,
    canPlay: () => true,
    save() { saved++; assert.equal(rules.write(adapter, 'save', loaded.state, loaded.writable), true); },
  });
  function startControls() {
    scope.window.meadowMinigames.open();
    const card = dialog.querySelectorAll('[data-game]').find(button => button.dataset.game === 'differences');
    assert.ok(card, 'The real game menu exposes spot the difference');
    card.onclick();
    dialog.querySelector('#mini-start').onclick();
  }
  function start() {
    startControls();
    assert.equal(Number.isInteger(selected) && selected >= 0 && selected < 10, true);
    const actors = dialog.querySelector('.mini-actors');
    assert.equal(actors.querySelectorAll('[data-diff]').length, 16, 'Both farm pictures actually mount');
    assert.ok(actors.innerHTML.includes(scope.window.meadowPlayLevels.differences[selected].scene + '.webp'));
    return selected;
  }
  function unchangedProgress() {
    const withoutBag = value => { const copy = plain(value); delete copy.minigames.differenceBag; return copy; };
    assert.deepEqual(withoutBag(loaded.state), withoutBag(before));
    assert.deepEqual(withoutBag(JSON.parse(storage.get('save'))), withoutBag(before));
  }
  return { start, startControls, unchangedProgress, state: loaded.state, storage, scope, validBag,
    get saved() { return saved; }, get frames() { return frames; }, get qualityReads() { return qualityReads; } };
}

// Use the unchanged real quality provider with synthetic authenticated status
// responses. No real account, RPC, browser storage or network is involved.
async function realQuality(d, publicQuality, previewQuality) {
  const values = new Map([['meadow-littles-quality-build', String(publicQuality)]]);
  let identity = 'synthetic-quality-test-only';
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const week = monday.toISOString().slice(0, 10);
  d.scope.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  d.scope.window.meadowLittlesAccess = { configure() {}, begin: () => true };
  d.scope.window.meadowLittlesCloud = {
    getStatus: () => ({ userId: identity }),
    weekly: async action => {
      assert.equal(action, 'status');
      return { user_id: identity, enabled: true, week, public_quality_build: publicQuality, quality_build: previewQuality };
    },
  };
  vm.runInNewContext(read('weekly-fair.js'), d.scope, { filename: 'weekly-fair.js' });
  const fair = d.scope.window.meadowWeeklyFair;
  fair.accountChanged(identity);
  await fair.refresh();
  return { fair, values, clearIdentity() { identity = null; fair.accountChanged(null); } };
}

function legacyBagUnchanged(d) {
  const before = plain(d.state), stored = d.storage.get('save');
  assert.throws(() => d.startControls(), /differenceBag\.pop is not a function/);
  assert.deepEqual(plain(d.state), before);
  assert.equal(d.storage.get('save'), stored);
  assert.equal(d.saved, 0);
  assert.equal(d.frames, 0);
}

const malformed = [
  ['nonempty string', 'stale'],
  ['object with a length', { length: 1, marker: 'keep' }],
  ['empty string', ''],
  ['null', null],
  ['missing value', missing],
  ['empty array', []],
  ['duplicate indexes', [2, 2]],
  ['negative index', [-1, 5]],
  ['out-of-range index', [2, 10]],
  ['fractional index', [1.5, 5]],
  ['string index', [2, '8']],
  ['null array entry', [2, null]],
];
for (const [name, bag] of malformed) test(`differences recovers ${name} without losing progress`, () => {
  const d = device(bag);
  const selected = d.start();
  const remaining = plain(d.state.minigames.differenceBag);
  assert.equal(remaining.length, 9);
  assert.deepEqual([...remaining, selected].sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i));
  assert.equal(d.saved, 1);
  assert.equal(d.frames, 1);
  d.unchangedProgress();
});

for (const bag of [[2, 5, 8], [0], [9, 0, 4], Array.from({ length: 10 }, (_, i) => i)]) test(`differences preserves valid bag ${bag.join(',')}`, () => {
  const d = device(bag);
  assert.equal(d.start(), bag.at(-1));
  assert.equal(d.state.minigames.differenceBag, d.validBag, 'Valid arrays keep their identity and order');
  assert.deepEqual(plain(d.state.minigames.differenceBag), bag.slice(0, -1));
  assert.equal(d.saved, 1);
  d.unchangedProgress();
});

test('recovered bag survives reload and uses every scene before reseeding', () => {
  const first = device('stale'), selected = first.start();
  const d = device(missing, first.storage), expected = plain(d.state.minigames.differenceBag);
  const used = [selected];
  while (expected.length) { const next = expected.pop(); assert.equal(d.start(), next); used.push(next); }
  assert.deepEqual(used.sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i));
  assert.equal(d.start() >= 0, true);
  assert.equal(d.state.minigames.differenceBag.length, 9);
  d.unchangedProgress();
});

test('denied access does not consume or repair the bag or write a save', () => {
  const d = device('stale'), before = plain(d.state);
  d.scope.window.meadowLittlesAccess = { begin: () => false };
  assert.doesNotThrow(() => d.startControls());
  assert.deepEqual(plain(d.state), before);
  assert.equal(d.saved, 0);
  assert.equal(d.frames, 0);
  assert.equal(d.qualityReads, 0, 'Denied access exits before consulting the rollout gate');
});

test('public quality 87 preserves valid bag order without opting into the repair', () => {
  const d = device([2, 5, 8], undefined, 87);
  assert.equal(d.start(), 8);
  assert.equal(d.state.minigames.differenceBag, d.validBag);
  assert.deepEqual(plain(d.state.minigames.differenceBag), [2, 5]);
  d.unchangedProgress();
});

for (const [name, bag] of malformed.slice(0, 2)) test(`public quality 87 keeps existing ${name} behavior until activation`, () => {
  legacyBagUnchanged(device(bag, undefined, 87));
});

const unresolved = [
  ['missing provider', missing], ['missing quality', () => undefined], ['null quality', null],
  ['NaN quality', NaN], ['infinite quality', Infinity], ['string quality', '88'],
  ['fractional quality', 88.5], ['throwing provider', () => { throw Error('quality unresolved'); }],
];
for (const [name, quality] of unresolved) test(`${name} fails closed to existing public behavior`, () => {
  legacyBagUnchanged(device('stale', undefined, quality));
});

for (const quality of [missing, () => { throw Error('quality unresolved'); }]) test('unavailable quality still allows an existing valid scene bag', () => {
  const d = device([2, 5, 8], undefined, quality);
  assert.equal(d.start(), 8);
  assert.deepEqual(plain(d.state.minigames.differenceBag), [2, 5]);
  d.unchangedProgress();
});

test('later authoritative integer quality keeps the repair enabled', () => {
  const d = device('stale', undefined, 89);
  d.start();
  assert.equal(d.state.minigames.differenceBag.length, 9);
  d.unchangedProgress();
});

test('real quality provider enables preview 88 while retaining public 87', async () => {
  const d = device('stale'), q = await realQuality(d, 87, 88);
  assert.equal(q.fair.getQualityBuild(), 88);
  assert.equal(q.values.get('meadow-littles-quality-build'), '87');
  d.start();
  assert.equal(d.state.minigames.differenceBag.length, 9);
  d.unchangedProgress();
});

test('real public 87 quality keeps valid scene order unchanged', async () => {
  const d = device([2, 5, 8]), q = await realQuality(d, 87, 87);
  assert.equal(q.fair.getQualityBuild(), 87);
  assert.equal(d.start(), 8);
  assert.deepEqual(plain(d.state.minigames.differenceBag), [2, 5]);
  d.unchangedProgress();
});

test('real quality provider drops private repair eligibility after an account change', async () => {
  const d = device('stale'), q = await realQuality(d, 87, 88);
  assert.equal(q.fair.getQualityBuild(), 88);
  q.clearIdentity();
  assert.equal(q.fair.getQualityBuild(), 87);
  legacyBagUnchanged(d);
});

test('real public quality 88 enables the repair after promotion', async () => {
  const d = device('stale'), q = await realQuality(d, 88, 88);
  assert.equal(q.fair.getQualityBuild(), 88);
  assert.equal(q.values.get('meadow-littles-quality-build'), '88');
  d.start();
  assert.equal(d.state.minigames.differenceBag.length, 9);
  d.unchangedProgress();
});
