import { facebookPostSnapshotMetrics, renderFacebookPostCard, renderYoutubePostCard, youtubeVideoSnapshotMetrics } from '../../js/socialSnapshotMetrics.mjs';
import { setSupabaseForTest } from '../../js/supabaseClient.js';
import { statsnapSaveAfterSuccess } from '../../js/statsnap.js';

const status = document.getElementById('status');
const results = document.getElementById('results');
const retry = document.getElementById('retry');
const hostileText = '<img src=x onerror="window.__socialXss=1"><svg onload="window.__socialXss=2">synthetic</svg>';
let providerAttempts = 0;
let snapshotWrites = 0;
window.__socialXss = 0;

setSupabaseForTest({
  async rpc() { throw new Error('fixture must not append campaign history'); },
  auth: { async getSession() { return { data: { session: { user: { id: 'synthetic-browser-actor' } } } }; } },
  from(table) {
    if (table !== 'stats_snapshot') throw new Error(`unexpected fixture table: ${table}`);
    return {
      select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: null, error: null }; },
      upsert(payload) {
        snapshotWrites += 1;
        const attempt = snapshotWrites;
        return { select() { return this; }, async maybeSingle() {
          return attempt === 1
            ? { data: null, error: { message: 'synthetic interrupted snapshot write' } }
            : { data: payload, error: null };
        } };
      }
    };
  }
});

async function syntheticProviderRead() {
  providerAttempts += 1;
  if (providerAttempts === 1) throw new Error('synthetic provider interruption');
  return {
    youtube: { id: 'Abcdefghijk', snippet: { title: hostileText, publishedAt: '2026-10-15T00:00:00Z' }, statistics: { viewCount: '0', commentCount: '2' } },
    facebook: { post: { message: hostileText, reactions: { summary: { total_count: 0 } }, shares: { count: 3 } }, insights: { reach: { value: 0 }, post_media_view: { value: 0 } } }
  };
}

function renderResults(data) {
  const youtubeMetrics = youtubeVideoSnapshotMetrics(data.youtube);
  const facebookMetrics = facebookPostSnapshotMetrics({ post: data.facebook.post, insights: data.facebook.insights, reach: 0 });
  const storyPost = { story: hostileText };
  const storyMetrics = facebookPostSnapshotMetrics({ post: storyPost });
  results.innerHTML = renderYoutubePostCard(data.youtube, { metrics: youtubeMetrics }) +
    renderFacebookPostCard(data.facebook.post, facebookMetrics, { permalink: 'https://www.facebook.com/synthetic' }) +
    renderFacebookPostCard(storyPost, storyMetrics, { permalink: 'https://www.facebook.com/synthetic-story' });
  const title = results.querySelector('.youtube-metric-card h3')?.textContent;
  const postText = [...results.querySelectorAll('.facebook-post-message')].map(node => node.textContent);
  const textNodesOnly = !results.querySelector('script, svg, img, iframe, object');
  const metrics = Object.fromEntries([...results.querySelectorAll('.metric-value')].map(node => {
    const card = node.closest('article');
    const cardName = card.classList.contains('youtube-metric-card') ? 'youtube' :
      card === results.querySelector('.facebook-metric-card') ? 'facebook' : 'facebook-story';
    return [`${cardName}:${node.className.replace('metric-value ', '')}`, node.textContent];
  }));
  return { title, message: postText[0], story: postText[1], textNodesOnly, metrics, xss: window.__socialXss };
}

async function refresh() {
  status.textContent = 'Refreshing provider metrics…';
  try {
    const data = await syntheticProviderRead();
    const youtubeMetrics = youtubeVideoSnapshotMetrics(data.youtube);
    let saveResult = null;
    try {
      saveResult = await statsnapSaveAfterSuccess({
        originalUrl: 'https://www.youtube.com/watch?v=Abcdefghijk', platformHint: 'youtube',
        liveMetrics: youtubeMetrics, raw: data.youtube
      });
    } catch { /* The caller keeps live results visible when caching is interrupted. */ }
    const rendered = renderResults(data);
    status.textContent = saveResult
      ? 'Live metrics refreshed and snapshot retry succeeded.'
      : 'Snapshot write interrupted; live metrics remain visible. Retry refresh.';
    window.__socialUiResult = {
      providerAttempts, snapshotWrites, rendered,
      status: status.textContent,
      snapshotWriteSucceeded: Boolean(saveResult)
    };
  } catch {
    status.textContent = 'Provider temporarily unavailable. Retry metrics refresh.';
    window.__socialUiResult = { providerAttempts, snapshotWrites, status: status.textContent, rendered: null };
  }
}

retry.addEventListener('click', refresh);
await refresh();
