const SNAPSHOT_METRIC_NAMES = new Set([
  'post_impressions',
  'post_impressions_unique',
  'post_engaged_users',
  'engaged_users',
  'post_media_view',
  'post_total_media_view_unique'
]);

function metricNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (!['number', 'string'].includes(typeof value)) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER ? number : null;
}

function counterNumber(value) {
  const candidate = value && typeof value === 'object'
    ? firstPresent(value?.summary?.total_count, value?.count, value?.total_count, value?.value)
    : value;
  return metricNumber(candidate);
}

function firstPresent(...values) {
  return values.find(value => value !== null && value !== undefined);
}

function readInsight(insights, names) {
  for (const name of names) {
    const value = insights?.[name];
    if (value !== null && value !== undefined) return insightValue(value);
  }
  const items = Array.isArray(insights) ? insights :
    Array.isArray(insights?.data) ? insights.data :
      Array.isArray(insights?.metrics) ? insights.metrics : [];
  for (const item of items) {
    if (names.includes(String(item?.name || item?.metric || item?.title || '').toLowerCase())) {
      const values = Array.isArray(item.values) ? item.values : [];
      return insightValue(values.length ? values.at(-1) : item);
    }
  }
  return null;
}

function insightValue(value) {
  if (value && typeof value === 'object') {
    if ('value' in value) return metricNumber(value.value);
    if (Array.isArray(value.values)) return insightValue(value.values.at(-1));
    return null;
  }
  return metricNumber(value);
}

export function youtubeVideoSnapshotMetrics(video) {
  const statistics = video?.statistics || {};
  return {
    views: metricNumber(statistics.viewCount),
    likes: metricNumber(statistics.likeCount),
    comments: metricNumber(statistics.commentCount)
  };
}

function textNode(tag, value, className = '') {
  const node = document.createElement(tag);
  node.textContent = value == null ? '' : String(value);
  if (className) node.className = className;
  return node;
}

function safeHttpsUrl(value, allowedHosts) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (!allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))) return null;
    return url.href;
  } catch { return null; }
}

function metricText(value) {
  const number = metricNumber(value);
  return number === null ? '—' : number.toLocaleString();
}

function appendMetricRows(card, metrics, fields) {
  const rows = document.createElement('div');
  rows.style.cssText = 'display:flex;flex-wrap:wrap;gap:18px 26px;margin-top:10px';
  for (const [key, label] of fields) {
    const row = document.createElement('div');
    const heading = textNode('b', `${label}:`);
    const value = textNode('span', metricText(metrics?.[key]));
    value.className = `metric-value metric-${key}`;
    if (metricNumber(metrics?.[key]) === null) {
      value.setAttribute('role', 'group');
      value.setAttribute('aria-label', 'Not available');
      value.textContent = '';
      const glyph = document.createElement('span');
      glyph.textContent = '—';
      glyph.setAttribute('aria-hidden', 'true');
      value.append(glyph);
    }
    row.append(heading, document.createElement('br'), value);
    rows.append(row);
  }
  card.append(rows);
}

function serializeCard(card) {
  // Values from providers are assigned through textContent/property setters;
  // outerHTML serializes them as escaped text before existing callers insert it.
  return card.outerHTML;
}

export function renderYoutubePostCard(video, { metrics = youtubeVideoSnapshotMetrics(video), dateLabel = '', durationLabel = '' } = {}) {
  const card = document.createElement('article');
  card.className = 'social-metric-card youtube-metric-card';
  card.setAttribute('aria-label', 'YouTube video metrics');
  card.style.cssText = 'background:none;border-radius:15px;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.05em';
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:12px';
  const thumbnailUrl = safeHttpsUrl(video?.snippet?.thumbnails?.medium?.url || video?.snippet?.thumbnails?.default?.url, ['googleusercontent.com', 'ytimg.com']);
  if (thumbnailUrl) {
    const image = document.createElement('img');
    image.src = thumbnailUrl;
    image.alt = 'Video thumbnail';
    image.style.cssText = 'width:auto;height:80px;border-radius:8px;object-fit:cover';
    header.append(image);
  }
  const details = document.createElement('div');
  details.style.cssText = 'min-width:0;flex:1 1 0;overflow-wrap:anywhere';
  const title = textNode('h3', video?.snippet?.title || 'Untitled YouTube video');
  title.style.cssText = 'margin:0;color:#e74c3c;font-size:1.12em';
  details.append(title);
  const duration = durationLabel || video?.contentDetails?.duration;
  if (duration) details.append(textNode('div', `Duration: ${duration}`));
  if (video?.snippet?.publishedAt && Number.isFinite(Date.parse(video.snippet.publishedAt))) {
    details.append(textNode('div', `Published: ${new Date(video.snippet.publishedAt).toLocaleDateString()}`));
  }
  if (dateLabel) details.append(textNode('div', dateLabel, 'metric-live-date'));
  header.append(details);
  card.append(header);
  appendMetricRows(card, metrics, [['views', 'Views'], ['likes', 'Likes'], ['comments', 'Comments']]);
  const videoId = String(video?.id || '');
  if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    const link = document.createElement('a');
    const url = new URL('https://www.youtube.com/watch');
    url.searchParams.set('v', videoId);
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open on YouTube';
    link.style.cssText = 'display:block;margin-top:10px;text-align:right;color:#36aaff';
    card.append(link);
  }
  return serializeCard(card);
}

export function renderFacebookPostCard(post, metrics, { permalink = '', dateLabel = '' } = {}) {
  const card = document.createElement('article');
  card.className = 'social-metric-card facebook-metric-card';
  card.setAttribute('aria-label', 'Facebook post metrics');
  card.style.cssText = 'background:none;border-radius:15px;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.05em';
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:12px';
  const content = post?.post || post?.data || post || {};
  const thumbnailUrl = safeHttpsUrl(
    content.thumbnail || content.full_picture || content.picture ||
      content.attachments?.data?.[0]?.media?.image?.src || content.attachments?.data?.[0]?.media?.image?.url ||
      content.attachments?.data?.[0]?.subattachments?.data?.[0]?.media?.image?.src ||
      content.attachments?.data?.[0]?.subattachments?.data?.[0]?.media?.image?.url,
    ['facebook.com', 'fbcdn.net']
  );
  if (thumbnailUrl) {
    const image = document.createElement('img');
    image.src = thumbnailUrl;
    image.alt = 'Facebook post';
    image.referrerPolicy = 'no-referrer';
    image.style.cssText = 'width:auto;height:80px;border-radius:8px;object-fit:cover';
    header.append(image);
  }
  const details = document.createElement('div');
  details.style.cssText = 'min-width:0;flex:1 1 0;overflow-wrap:anywhere';
  const heading = textNode('h3', 'Facebook Post');
  heading.style.cssText = 'margin:0';
  details.append(heading);
  const created = content.created_time || content.created_at || content.created;
  if (created && Number.isFinite(Date.parse(created))) details.append(textNode('div', `Published: ${new Date(created).toLocaleDateString()}`));
  if (dateLabel) details.append(textNode('div', dateLabel, 'metric-live-date'));
  const message = (content.message ?? content.story ?? '').toString().trim();
  if (message) details.append(textNode('p', message.length > 150 ? `${message.slice(0, 150)}…` : message, 'facebook-post-message'));
  header.append(details);
  card.append(header);
  appendMetricRows(card, metrics, [
    ['reactions', 'Reactions'], ['comments', 'Comments'], ['shares', 'Shares'],
    ['impressions', 'Impressions'], ['reach', 'Reach'], ['engaged_users', 'Engaged users'],
    ['post_media_view', 'Post media views'], ['post_total_media_view_unique', 'Unique post media views']
  ]);
  const safePermalink = safeHttpsUrl(permalink, ['facebook.com', 'fb.watch']);
  if (safePermalink) {
    const link = document.createElement('a');
    link.href = safePermalink;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open on Facebook';
    link.style.cssText = 'display:block;margin-top:10px;text-align:right;color:#7fb4ff';
    card.append(link);
  }
  return serializeCard(card);
}

export function facebookPostSnapshotMetrics({
  post = {}, insights = null, reactions = null, comments = null, shares = null,
  impressions = null, reach = null, engagedUsers = null
} = {}) {
  const metricPost = post?.post || post?.data || post || {};
  const rawReactions = firstPresent(reactions,
    metricPost?.reactions?.summary?.total_count,
    metricPost?.reaction_count,
    metricPost?.reactions);
  const rawComments = firstPresent(comments,
    metricPost?.comments?.summary?.total_count,
    metricPost?.comment_count,
    metricPost?.comments);
  const rawShares = firstPresent(shares,
    metricPost?.shares?.count,
    metricPost?.share_count,
    metricPost?.shares);
  return {
    reactions: counterNumber(rawReactions),
    comments: counterNumber(rawComments),
    shares: counterNumber(rawShares),
    impressions: metricNumber(firstPresent(impressions, readInsight(insights, ['post_impressions', 'impressions']))),
    reach: metricNumber(firstPresent(reach, readInsight(insights, ['post_impressions_unique', 'reach']))),
    engaged_users: metricNumber(firstPresent(engagedUsers, readInsight(insights, ['post_engaged_users', 'engaged_users']))),
    post_media_view: readInsight(insights, ['post_media_view']),
    post_total_media_view_unique: readInsight(insights, ['post_total_media_view_unique'])
  };
}

function projectRawMetric(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  if ('value' in value) return { value: projectRawMetric(value.value) ?? null };
  if (Array.isArray(value.values)) {
    return { values: value.values.slice(-1).map(item => ({ value: projectRawMetric(item?.value) ?? null })) };
  }
  return undefined;
}

// Keep provider metric provenance without persisting post text, titles, tokens,
// or unrelated response fields. This is the bounded raw metrics projection.
export function projectSnapshotRaw(platform, raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (platform === 'youtube') {
    const statistics = raw.statistics || {};
    const projected = {};
    for (const key of ['viewCount', 'likeCount', 'commentCount']) {
      if (statistics[key] !== undefined && statistics[key] !== null) projected[key] = projectRawMetric(statistics[key]);
    }
    return { statistics: projected };
  }
  if (platform !== 'facebook') return null;
  const post = raw.post || raw.data || {};
  const reactions = firstPresent(post?.reactions?.summary?.total_count, post?.reaction_count,
    typeof post?.reactions === 'number' || typeof post?.reactions === 'string' ? post.reactions : undefined);
  const comments = firstPresent(post?.comments?.summary?.total_count, post?.comment_count,
    typeof post?.comments === 'number' || typeof post?.comments === 'string' ? post.comments : undefined);
  const shares = firstPresent(post?.shares?.count, post?.share_count,
    typeof post?.shares === 'number' || typeof post?.shares === 'string' ? post.shares : undefined);
  const postMetrics = {};
  for (const [key, value] of [['reactions', reactions], ['comments', comments], ['shares', shares]]) {
    if (value !== undefined && value !== null) postMetrics[key] = projectRawMetric(value);
  }
  const sourceInsights = raw.insights || raw;
  const insights = {};
  for (const name of SNAPSHOT_METRIC_NAMES) {
    let value = sourceInsights?.[name];
    const items = Array.isArray(sourceInsights) ? sourceInsights :
      Array.isArray(sourceInsights?.data) ? sourceInsights.data :
        Array.isArray(sourceInsights?.metrics) ? sourceInsights.metrics : [];
    if (value === undefined && items.length) {
      const item = items.find(entry => String(entry?.name || entry?.metric || entry?.title || '').toLowerCase() === name);
      value = item ? { values: item.values } : undefined;
    }
    if (value !== undefined && value !== null) insights[name] = projectRawMetric(value);
  }
  return { postMetrics, insights };
}
