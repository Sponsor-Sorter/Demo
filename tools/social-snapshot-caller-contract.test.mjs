import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { facebookPostSnapshotMetrics, projectSnapshotRaw, youtubeVideoSnapshotMetrics } from '../js/socialSnapshotMetrics.mjs';
import { setSupabaseForTest } from '../js/supabaseClient.js';
import { observedMetrics } from '../js/campaignReports.js';
import { statsnapFallback, statsnapSaveAfterSuccess } from '../js/statsnap.js';

const website = new URL('../', import.meta.url);

test('YouTube snapshot mapping preserves missing counters as null and explicit zero as zero', () => {
  assert.deepEqual(youtubeVideoSnapshotMetrics({ statistics: { viewCount: '0', commentCount: 8 } }), {
    views: 0, likes: null, comments: 8
  });
  assert.deepEqual(youtubeVideoSnapshotMetrics({}), { views: null, likes: null, comments: null });
});

test('both actual Website callers use the shared YouTube snapshot mapper', async () => {
  for (const name of ['sponseeOffers.js', 'sponsorOffers.js']) {
    const source = await readFile(new URL(`../js/${name}`, import.meta.url), 'utf8');
    assert.match(source, /import\s*\{[^}]*youtubeVideoSnapshotMetrics[^}]*\}\s*from\s*['"]\.\/socialSnapshotMetrics\.mjs['"]/);
    assert.match(source, /const metrics = youtubeVideoSnapshotMetrics\(stats\.video\);/);
    assert.doesNotMatch(source, /views:\s*Number\(stats\.video\?\.statistics\?\.viewCount\)\s*\|\|\s*0/);
  }
});

test('Facebook snapshot names remain provider-specific and preserve null versus zero', () => {
  const metrics = facebookPostSnapshotMetrics({
    post: { reactions: { summary: { total_count: 0 } }, shares: { count: 2 } },
    insights: { post_media_view: { value: 0 }, post_engaged_users: { value: '4' } },
    impressions: null,
    reach: 0
  });
  assert.deepEqual(metrics, {
    reactions: 0, comments: null, shares: 2, impressions: null, reach: 0,
    engaged_users: 4, post_media_view: 0, post_total_media_view_unique: null
  });
  assert.equal('impressions' in metrics, true);
  assert.equal('reach' in metrics, true);
  assert.equal(metrics.post_media_view, 0, 'media views must not be aliased to impressions');
  assert.equal(metrics.post_total_media_view_unique, null, 'unique media views must not be aliased to reach');
  assert.equal(facebookPostSnapshotMetrics({ post: { reactions: { summary: { total_count: 3 } } } }).reactions, 3);
  const numericStrings = facebookPostSnapshotMetrics({ insights: {
    post_impressions: { value: '0' }, post_impressions_unique: { value: '5' },
    post_media_view: { value: '0' }, post_total_media_view_unique: { value: null }
  } });
  assert.equal(numericStrings.impressions, 0);
  assert.equal(numericStrings.reach, 5);
  assert.equal(numericStrings.post_media_view, 0);
  assert.equal(numericStrings.post_total_media_view_unique, null);
});

test('both actual Facebook callers pass response metrics through the shared mapper', async () => {
  for (const name of ['sponseeOffers.js', 'sponsorOffers.js']) {
    const source = await readFile(new URL(`../js/${name}`, import.meta.url), 'utf8');
    assert.match(source, /import\s*\{[^}]*facebookPostSnapshotMetrics[^}]*\}\s*from\s*['"]\.\/socialSnapshotMetrics\.mjs['"]/);
    assert.match(source, /liveMetrics:\s*facebookPostSnapshotMetrics\(\{[\s\S]{0,200}engagedUsers:\s*engaged/);
    assert.doesNotMatch(source, /reactions:\s*Number\(reactions\s*\?\?\s*0\)/);
  }
});

test('both actual callers use DOM-backed provider cards instead of interpolating provider text', async () => {
  for (const name of ['sponseeOffers.js', 'sponsorOffers.js']) {
    const source = await readFile(new URL(`../js/${name}`, import.meta.url), 'utf8');
    assert.match(source, /renderYoutubePostCard\(stats\.video/);
    assert.match(source, /renderFacebookPostCard\(p,/);
    assert.doesNotMatch(source, /\$\{stats\.video\.snippet\.title\}/);
    assert.doesNotMatch(source, /\$\{shortMsg\}/);
  }
});

test('snapshot metric allowlist retains Facebook counters and exact Meta insight names', () => {
  assert.deepEqual(observedMetrics({ reactions: 0, engaged_users: 5, post_media_view: null, post_total_media_view_unique: 0, views: null }), {
    views: null, reactions: 0, engaged_users: 5, post_media_view: null, post_total_media_view_unique: 0
  });
});

test('raw snapshot data is a bounded metrics-only projection without post content', () => {
  assert.deepEqual(projectSnapshotRaw('youtube', {
    snippet: { title: 'private-looking title', description: 'not persisted' },
    statistics: { viewCount: '0', likeCount: '3' }
  }), { statistics: { viewCount: '0', likeCount: '3' } });
  assert.deepEqual(projectSnapshotRaw('facebook', {
    post: { message: 'not persisted', reactions: { summary: { total_count: 0 } }, shares: { count: 1 } },
    insights: { post_media_view: { value: '0' }, post_total_media_view_unique: { value: 7 } }
  }), {
    postMetrics: { reactions: 0, shares: 1 },
    insights: { post_media_view: { value: '0' }, post_total_media_view_unique: { value: 7 } }
  });
  assert.deepEqual(projectSnapshotRaw('facebook', {
    post: {}, insights: [{ name: 'post_media_view', values: [{ value: 0 }] }]
  }), { postMetrics: {}, insights: { post_media_view: { values: [{ value: 0 }] } } });
});

test('success flow records legacy history before snapshot upsert and stores raw metric projection', async () => {
  const calls = [];
  const fake = {
    async rpc(name, args) { calls.push({ kind: 'rpc', name, args }); return { data: null, error: null }; },
    auth: { async getSession() { calls.push({ kind: 'session' }); return { data: { session: { user: { id: 'synthetic-user' } } } }; } },
    from(table) {
      return {
        select(columns) { calls.push({ kind: 'select', table, columns }); return this; },
        eq(key, value) { calls.push({ kind: 'eq', table, key, value }); return this; },
        async maybeSingle() { calls.push({ kind: 'read', table }); return { data: null, error: null }; },
        upsert(payload, options) {
          calls.push({ kind: 'upsert', table, payload, options });
          return { select: () => ({ maybeSingle: async () => ({ data: payload, error: null }) }) };
        }
      };
    }
  };
  setSupabaseForTest(fake);
  await statsnapSaveAfterSuccess({
    originalUrl: 'https://www.youtube.com/watch?v=synthetic', platformHint: 'youtube', offerId: 'synthetic-offer',
    liveMetrics: { views: null, likes: 0, comments: null },
    raw: { statistics: { likeCount: '0' }, snippet: { title: 'not persisted' } }
  });
  const history = calls.find(call => call.kind === 'rpc');
  const upsert = calls.find(call => call.kind === 'upsert');
  assert.equal(history.name, 'record_campaign_observation');
  assert.deepEqual(history.args.metrics, { likes: 0 }, 'history payload remains in the pre-existing SQL metric allowlist and omits unknowns');
  assert.ok(calls.findIndex(call => call.kind === 'rpc') < calls.findIndex(call => call.kind === 'upsert'));
  assert.deepEqual(upsert.payload.last_stats, {
    metrics: { views: null, likes: 0, comments: null }, raw: { statistics: { likeCount: '0' } }
  });
});

test('unchanged legacy snapshot backfills a missing raw metrics projection', async () => {
  const liveMetrics = { views: null, likes: 0, comments: null };
  const normalizedUrl = 'https://www.youtube.com/watch?v=synthetic-backfill';
  const stable = value => value === null ? 'null' : Array.isArray(value) ? `[${value.map(stable).join(',')}]` :
    typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value);
  const metricsHash = createHash('sha256').update(stable({ platform: 'youtube', url: normalizedUrl, metrics: liveMetrics })).digest('hex');
  const stored = {
    normalized_url: normalizedUrl,
    platform: 'youtube', offer_id: 'synthetic-offer',
    last_stats: { metrics: { views: null, likes: 0, comments: null } },
    metrics_hash: metricsHash, last_success_at: 'old', last_checked_at: 'old', last_error: null, updated_by: 'synthetic-user'
  };
  let upsertPayload;
  setSupabaseForTest({
    async rpc() { return { data: null, error: null }; },
    auth: { async getSession() { return { data: { session: { user: { id: 'synthetic-user' } } } }; } },
    from() {
      return {
        select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: stored, error: null }; },
        upsert(payload) { upsertPayload = payload; return { select: () => ({ maybeSingle: async () => ({ data: payload }) }) }; }
      };
    }
  });
  await statsnapSaveAfterSuccess({
    originalUrl: 'https://www.youtube.com/watch?v=synthetic-backfill', platformHint: 'youtube', offerId: 'synthetic-offer',
    liveMetrics, raw: { statistics: { likeCount: '0' } }
  });
  assert.ok(upsertPayload, 'raw projection should be persisted even when normalized metrics have not changed');
  assert.deepEqual(upsertPayload.last_stats.raw, { statistics: { likeCount: '0' } });
});

test('unknown-only successful response does not append an empty observation row', async () => {
  const calls = [];
  setSupabaseForTest({
    async rpc(name) { calls.push(name); return { data: null, error: null }; },
    auth: { async getSession() { return { data: { session: null } }; } },
    from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; }, upsert(payload) { return { select: () => ({ maybeSingle: async () => ({ data: payload }) }) }; } }; }
  });
  await statsnapSaveAfterSuccess({
    originalUrl: 'https://www.youtube.com/watch?v=synthetic-empty', platformHint: 'youtube', offerId: 'synthetic-offer',
    liveMetrics: { views: null, likes: null, comments: null }, raw: { statistics: {} }
  });
  assert.deepEqual(calls, []);
});

test('cached snapshot fallback preserves explicit zero and leaves missing Facebook counters unknown', async () => {
  const snapshot = {
    offer_id: 'synthetic-offer', normalized_url: 'https://www.facebook.com/synthetic', platform: 'facebook',
    last_stats: { metrics: { reactions: 0, comments: null, post_media_view: 0, post_total_media_view_unique: null } },
    metrics_hash: 'synthetic-hash', last_success_at: '2026-10-16T00:00:00Z', updated_by: 'synthetic-user'
  };
  setSupabaseForTest({
    async rpc() { throw new Error('history RPC must not run without an offerId'); },
    auth: { async getSession() { return { data: { session: { user: { id: 'synthetic-user' } } } }; } },
    from() {
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: snapshot, error: null }; },
        upsert(payload) { return { select() { return this; }, async maybeSingle() { return { data: payload, error: null }; } }; }
      };
    }
  });
  const fallback = await statsnapFallback({ originalUrl: 'https://www.facebook.com/synthetic', platformHint: 'facebook' });
  assert.equal(fallback.metrics.reactions, 0);
  assert.equal(fallback.metrics.comments, null);
  assert.equal(fallback.metrics.post_media_view, 0);
  assert.equal(fallback.metrics.post_total_media_view_unique, null);
  assert.equal(fallback.metrics.impressions, null);
  assert.equal(fallback.metrics.reach, null);
});
