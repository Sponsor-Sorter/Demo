// js/publicDashboard.js
// (icons for Linked Platforms; no money; grey empty stars; CTAs under avatar)
import { supabase } from './supabaseClient.js';

const $ = (id) => document.getElementById(id);
const q = (sel) => document.querySelector(sel);
const log = (...a) => console.log('[publicdashboard]', ...a);

/* -------- Slug (prefer ?u=, fallback /u/<slug>) -------- */
function getSlugFromLocation() {
  const qp = new URLSearchParams(location.search).get('u');
  if (qp) return decodeURIComponent(qp);
  const path = (location.pathname || '').replace(/\/+$/, '');
  const m = path.match(/\/u\/([^/]+)$/i);
  if (m && m[1] && m[1].toLowerCase() !== 'index.html') return decodeURIComponent(m[1]);
  return '';
}

/* ---------------- Utils ---------------- */
function resolveProfilePic(val) {
  if (!val) return '../logos.png';
  if (/^https?:\/\//i.test(val)) return val;
  return `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${val}`;
}
function initialAvatar(name) {
  const s = String(name || 'SS').trim();
  return s ? s[0].toUpperCase() : 'S';
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}
function niceName(k) {
  const s = String(k || '').toLowerCase();
  const map = {
    yt:'YouTube', youtube:'YouTube',
    ig:'Instagram', instagram:'Instagram',
    tiktok:'TikTok', tt:'TikTok',
    x:'X', twitter:'X',
    twitch:'Twitch',
    facebook:'Facebook', fb:'Facebook'
  };
  return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
}
function guessHandleUrl(kind, value) {
  const v = String(value || '').replace(/^@/,'');
  const k = String(kind || '').toLowerCase();
  if (k === 'youtube' || k === 'yt') return `https://youtube.com/@${v}`;
  if (k === 'instagram' || k === 'ig') return `https://instagram.com/${v}`;
  if (k === 'tiktok' || k === 'tt')   return `https://tiktok.com/@${v}`;
  if (k === 'x' || k === 'twitter')   return `https://x.com/${v}`;
  if (k === 'twitch')                 return `https://twitch.tv/${v}`;
  if (k === 'facebook' || k === 'fb') return `https://facebook.com/${v}`;
  if (/^https?:\/\//i.test(value))   return value;
  return '#';
}
function safeArray(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  try {
    const p = typeof x === 'string' ? JSON.parse(x) : x;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/* -------- Platform icons (use your existing files) -------- */
const ASSET_BASE = '../'; // public page sits under /u/, assets are one level up
function platformIconSrc(kind) {
  const k = String(kind || '').toLowerCase();
  const map = {
    youtube: 'youtubelogo.png', yt: 'youtubelogo.png',
    instagram: 'instagramlogo.png', ig: 'instagramlogo.png',
    tiktok: 'tiktoklogo.png', tt: 'tiktoklogo.png',
    twitter: 'twitterlogo.png', x: 'twitterlogo.png',
    twitch: 'twitchlogo.png',
    facebook: 'facebooklogo.png', fb: 'facebooklogo.png'
  };
  const file = map[k] || 'logos.png';
  return ASSET_BASE + file;
}
function makeHandleIcon(kind, value) {
  const a = document.createElement('a');
  a.className = 'handle';
  a.target = '_blank';
  a.rel = 'noopener';
  a.href = guessHandleUrl(kind, value);
  a.title = `${niceName(kind)}: ${String(value).startsWith('@') ? value : '@' + value}`;

  const img = document.createElement('img');
  img.src = platformIconSrc(kind);
  img.alt = niceName(kind);
  img.style.width = '30px';
  img.style.height = '30px';
  img.style.verticalAlign = '-4px';
  img.style.display = 'inline-block';
  img.style.objectFit = 'contain';
  img.style.borderRadius = '10px';

  a.textContent = '';
  a.appendChild(img);
  return a;
}
function makePlatformIcon(kind) {
  const span = document.createElement('span');
  span.className = 'handle';
  span.title = niceName(kind);

  const img = document.createElement('img');
  img.src = platformIconSrc(kind);
  img.alt = niceName(kind);
  img.style.width = '22px';
  img.style.height = '22px';
  img.style.verticalAlign = '-4px';
  img.style.display = 'inline-block';
  img.style.objectFit = 'contain';

  span.textContent = '';
  span.appendChild(img);
  return span;
}

/* -------- Remove/Hide any money UI still in the HTML -------- */
function removeAmountColumn(tableEl) {
  if (!tableEl) return;
  const ths = tableEl.querySelectorAll('thead th');
  let idx = -1;
  ths.forEach((th, i) => {
    const t = (th.textContent || '').trim().toLowerCase();
    if (t.includes('amount')) idx = i;
  });
  if (idx === -1) return;
  ths[idx]?.remove();
  tableEl.querySelectorAll('tbody tr').forEach(tr => {
    if (tr.children[idx]) tr.children[idx].remove();
  });
}
function stripMoneyUI() {
  const vol = $('kpi-volume');
  if (vol) vol.closest('.card')?.remove();
  const recentTable = document.querySelector('.recent-deals table, fieldset.recent-deals table, table.recent-deals');
  removeAmountColumn(recentTable);
  const histTable = document.querySelector('.Archived-deals table, fieldset.Archived-deals table, table.Archived-deals');
  removeAmountColumn(histTable);
}

/* --------------- SEO --------------- */
function setOG(p) {
  const title = `${p.username || 'Creator'} — Sponsor Sorter`;
  const desc = p.title || p.about_yourself || 'Creator profile and reviews.';
  const img = resolveProfilePic(p.profile_pic);
  document.title = `${p.username || 'Public Profile'} — Sponsor Sorter`;
  const add = (attr, name, content) => {
    const m = document.createElement('meta');
    m.setAttribute(attr === 'property' ? 'property' : 'name', name);
    m.setAttribute('content', content);
    document.head.appendChild(m);
  };
  add('property','og:title', title);
  add('property','og:description', String(desc || '').slice(0,180));
  add('property','og:image', img);
  add('name','twitter:title', title);
  add('name','twitter:description', String(desc || '').slice(0,180));
}

/* --------------- Stars (filled vs empty colors) --------------- */
function renderStarsInto(containerEl, avg) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  const n = Number(avg);
  const full = Math.max(0, Math.min(5, Math.floor(Number.isFinite(n) ? n : 0)));
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span');
    span.className = 'star ' + (i <= full ? 'full' : 'empty');
    span.textContent = '★';
    containerEl.appendChild(span);
  }
}

/* --------------- Number & date helpers --------------- */
function formatCount(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}
function parseDateLike(v) {
  if (!v && v !== 0) return null;
  if (typeof v === 'number') {
    const d = new Date(v * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v);
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const d = new Date(n * 1000);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatDate(v) {
  const d = parseDateLike(v);
  if (!d) return '—';
  return d.toLocaleDateString();
}
function formatDateTime(v) {
  const d = parseDateLike(v);
  if (!d) return '—';
  return d.toLocaleDateString() + ' ' +
    d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function showEl(el, show = true) {
  if (!el) return;
  el.style.display = show ? '' : 'none';
}

/* --------------- Live platform stats renderers --------------- */
function renderYoutubeStats(yt) {
  const card = $('platform-youtube');
  if (!card || !yt || !yt.connected) return;

  showEl(card, true);

  const avatar = $('yt-profile-pic');
  const avatarSrc = yt.profile_pic || yt.profile_image_url || yt.avatar_url;
  if (avatar && avatarSrc) avatar.src = avatarSrc;

  const title = yt.channel_title || yt.title || 'YouTube Channel';
  const titleEl = $('yt-channel-title');
  if (titleEl) titleEl.textContent = title;

  const subsEl = $('yt-subscribers');
  if (subsEl) subsEl.textContent = formatCount(yt.subscriber_count);
  const viewsEl = $('yt-views');
  if (viewsEl) viewsEl.textContent = formatCount(yt.view_count);
  const videosEl = $('yt-videos');
  if (videosEl) videosEl.textContent = formatCount(yt.video_count);

  const wrap = $('yt-latest-wrapper');
  const last = yt.last_video || null;
  if (!last || (!last.thumbnail_url && !last.url)) {
    showEl(wrap, false);
    return;
  }
  showEl(wrap, true);

  const thumb = $('yt-last-thumb');
  if (thumb && last.thumbnail_url) thumb.src = last.thumbnail_url;
  const link = $('yt-last-video-link');
  if (link && last.url) link.href = last.url;

  const tEl = $('yt-last-title');
  if (tEl) tEl.textContent = last.title || 'Latest video';

  const lvEl = $('yt-last-views');
  if (lvEl) {
    const v = last.view_count;
    lvEl.textContent = v != null ? `${formatCount(v)} views` : '—';
  }

  const dEl = $('yt-last-date');
  if (dEl) dEl.textContent = formatDate(last.published_at);
}

function renderTiktokStats(tt) {
  const card = $('platform-tiktok');
  if (!card || !tt || !tt.connected) return;

  showEl(card, true);

  const avatar = $('tt-profile-pic');
  const avatarSrc = tt.profile_pic || tt.profile_image_url || tt.avatar_url;
  if (avatar && avatarSrc) avatar.src = avatarSrc;

  const name = tt.display_name || tt.username || '';
  const uEl = $('tt-username');
  if (uEl) uEl.textContent = name || 'TikTok';

  const followersEl = $('tt-followers');
  if (followersEl) followersEl.textContent = formatCount(tt.follower_count);
  const likesEl = $('tt-likes');
  if (likesEl) likesEl.textContent = formatCount(tt.likes_count);
  const vidsEl = $('tt-videos');
  if (vidsEl) vidsEl.textContent = formatCount(tt.video_count);

  const wrap = $('tt-latest-wrapper');
  const last = tt.last_video || null;
  if (!last || (!last.thumbnail_url && !last.cover_image_url && !last.url)) {
    showEl(wrap, false);
    return;
  }
  showEl(wrap, true);

  const thumb = $('tt-last-thumb');
  const cover = last.thumbnail_url || last.cover_image_url;
  if (thumb && cover) thumb.src = cover;

  const link = $('tt-last-link');
  if (link && last.url) link.href = last.url;

  const descEl = $('tt-last-desc');
  if (descEl) descEl.textContent = last.description || 'Latest TikTok';

  const vEl = $('tt-last-views');
  if (vEl) {
    const v = last.view_count;
    vEl.textContent = v != null ? `${formatCount(v)} views` : '—';
  }
  const dEl = $('tt-last-date');
  if (dEl) dEl.textContent = formatDate(last.create_time);

  const lEl = $('tt-last-likes');
  if (lEl) lEl.textContent = `Likes: ${formatCount(last.like_count)}`;
  const cEl = $('tt-last-comments');
  if (cEl) cEl.textContent = `Comments: ${formatCount(last.comment_count)}`;
  const sEl = $('tt-last-shares');
  if (sEl) sEl.textContent = `Shares: ${formatCount(last.share_count)}`;
}

function renderTwitchStats(tw) {
  const card = $('platform-twitch');
  if (!card || !tw || !tw.connected) return;

  showEl(card, true);

  const avatar = $('tw-profile-pic');
  const avatarSrc = tw.profile_pic || tw.profile_image_url || tw.avatar_url;
  if (avatar && avatarSrc) avatar.src = avatarSrc;

  const name = tw.display_name || tw.username || tw.login || '';
  const nEl = $('tw-display-name');
  if (nEl) nEl.textContent = name || 'Twitch';

  const fEl = $('tw-followers');
  if (fEl) fEl.textContent = formatCount(tw.follower_count);

  const isLive = !!tw.is_live;
  const statusEl = $('tw-status');
  if (statusEl) statusEl.textContent = isLive ? 'Live now' : 'Offline';

  const viewEl = $('tw-viewers');
  if (viewEl) viewEl.textContent =
    isLive && tw.viewer_count != null ? formatCount(tw.viewer_count) : '—';

  const wrap = $('tw-latest-wrapper');
  const stream = (isLive && tw.current_stream) ? tw.current_stream : (tw.last_stream || null);
  if (!stream || (!stream.thumbnail_url && !stream.url && !stream.title)) {
    showEl(wrap, false);
    return;
  }
  showEl(wrap, true);

  const thumb = $('tw-last-thumb');
  if (thumb && stream.thumbnail_url) thumb.src = stream.thumbnail_url;

  const link = $('tw-last-link');
  if (link && stream.url) link.href = stream.url;

  const tEl = $('tw-last-title');
  if (tEl) tEl.textContent = stream.title || (isLive ? 'Live stream' : 'Last stream');

  const gEl = $('tw-last-game');
  if (gEl) gEl.textContent = stream.game_name || '—';

  const lvEl = $('tw-last-views');
  if (lvEl) {
    const v = stream.view_count;
    lvEl.textContent = v != null ? `${formatCount(v)} views` : (isLive ? 'Live viewers' : '—');
  }

  const dEl = $('tw-last-date');
  if (dEl) dEl.textContent = formatDateTime(stream.started_at);
}

function renderInstagramStats(ig) {
  const card = $('platform-instagram');
  if (!card || !ig || !ig.connected) return;

  showEl(card, true);

  const avatar = $('ig-profile-pic');
  const avatarSrc = ig.profile_pic || ig.profile_image_url || ig.avatar_url;
  if (avatar && avatarSrc) avatar.src = avatarSrc;

  const name = ig.username || '';
  const uEl = $('ig-username');
  if (uEl) uEl.textContent = name ? `@${name}` : 'Instagram';

  const fEl = $('ig-followers');
  if (fEl) fEl.textContent = formatCount(ig.follower_count);

  const pEl = $('ig-posts');
  if (pEl) pEl.textContent = formatCount(ig.media_count);

  const reach7 = ig.insights_7d?.reach;
  const rEl = $('ig-reach-7d');
  if (rEl) rEl.textContent = reach7 != null ? formatCount(reach7) : '—';

  // Latest media
  const last = ig.last_media || null;
  const lastWrap = $('ig-last-wrapper');
  if (last && (last.thumbnail_url || last.media_url || last.permalink)) {
    showEl(lastWrap, true);
    const thumb = $('ig-last-thumb');
    const cover = last.thumbnail_url || last.media_url;
    if (thumb && cover) thumb.src = cover;
    const link = $('ig-last-link');
    if (link && last.permalink) link.href = last.permalink;
    const cEl = $('ig-last-caption');
    if (cEl) cEl.textContent = last.caption || 'Latest post';

    const llEl = $('ig-last-likes');
    if (llEl) llEl.textContent = `Likes: ${formatCount(last.like_count)}`;
    const lcEl = $('ig-last-comments');
    if (lcEl) lcEl.textContent = `Comments: ${formatCount(last.comments_count)}`;
    const lvEl = $('ig-last-views');
    if (lvEl) lvEl.textContent =
      last.view_count != null ? `Views: ${formatCount(last.view_count)}` : 'Views: —';

    const dEl = $('ig-last-date');
    if (dEl) dEl.textContent = formatDateTime(last.timestamp);
  } else {
    showEl(lastWrap, false);
  }

  // Top media
  const top = ig.top_media || null;
  const topWrap = $('ig-top-wrapper');
  if (top && (top.thumbnail_url || top.media_url || top.permalink)) {
    showEl(topWrap, true);
    const thumb = $('ig-top-thumb');
    const cover = top.thumbnail_url || top.media_url;
    if (thumb && cover) thumb.src = cover;
    const link = $('ig-top-link');
    if (link && top.permalink) link.href = top.permalink;
    const cEl = $('ig-top-caption');
    if (cEl) cEl.textContent = top.caption || 'Top recent post';

    const llEl = $('ig-top-likes');
    if (llEl) llEl.textContent = `Likes: ${formatCount(top.like_count)}`;
    const lcEl = $('ig-top-comments');
    if (lcEl) lcEl.textContent = `Comments: ${formatCount(top.comments_count)}`;
    const lvEl = $('ig-top-views');
    if (lvEl) lvEl.textContent =
      top.view_count != null ? `Views: ${formatCount(top.view_count)}` : 'Views: —';

    const eEl = $('ig-top-engagement');
    if (eEl) {
      const er = top.engagement_rate;
      eEl.textContent = er != null ? `Engagement: ${er.toFixed(2)}%` : 'Engagement: —';
    }
  } else {
    showEl(topWrap, false);
  }
}

function renderFacebookStats(fb) {
  const card = $('platform-facebook');
  if (!card || !fb || !fb.connected) return;

  showEl(card, true);

  const avatar = $('fb-profile-pic');
  const avatarSrc = fb.profile_pic || fb.profile_image_url || fb.avatar_url;
  if (avatar && avatarSrc) avatar.src = avatarSrc;

  const name = fb.page_name || fb.name || '';
  const nEl = $('fb-page-name');
  if (nEl) nEl.textContent = name || 'Facebook Page';

  const fEl = $('fb-followers');
  if (fEl) fEl.textContent = formatCount(fb.follower_count);

  const lEl = $('fb-likes');
  if (lEl) lEl.textContent = formatCount(fb.page_likes);

  const reach = fb.insights_28d?.reach ?? fb.insights_28d?.page_impressions_unique;
  const reachEl = $('fb-28d-reach');
  if (reachEl) reachEl.textContent = reach != null ? formatCount(reach) : '—';

  const wrap = $('fb-latest-wrapper');
  const last = fb.last_post || null;
  if (!last || (!last.thumbnail && !last.full_picture && !last.permalink_url && !last.message)) {
    showEl(wrap, false);
    return;
  }
  showEl(wrap, true);

  const thumb = $('fb-last-thumb');
  const cover = last.thumbnail || last.full_picture;
  if (thumb && cover) thumb.src = cover;

  const link = $('fb-last-link');
  if (link && last.permalink_url) link.href = last.permalink_url;

  const mEl = $('fb-last-message');
  if (mEl) mEl.textContent = last.message || 'Latest post';

  const dEl = $('fb-last-date');
  if (dEl) dEl.textContent = formatDateTime(last.created_time);
}

function renderLiveStats(payload) {
  if (!payload) return;
  try {
    renderYoutubeStats(payload.youtube);
    renderTiktokStats(payload.tiktok);
    renderTwitchStats(payload.twitch);
    renderInstagramStats(payload.instagram);
    renderFacebookStats(payload.facebook);
  } catch (e) {
    console.error('[publicdashboard] renderLiveStats error', e);
  }
}

/* --------------- Renderers --------------- */
function moveCTAsUnderAvatar() {
  const pic = q('.profile-picture');
  const ctas = q('.cta-row');
  if (pic && ctas && ctas.parentElement !== pic) {
    pic.appendChild(ctas);
  }
}

function renderProfile(p) {
  // avatar
  const av = $('avatar');
  if (p.profile_pic) {
    const img = document.createElement('img');
    img.src = resolveProfilePic(p.profile_pic);
    img.alt = p.username || 'Avatar';
    av.replaceWith(img);
  } else {
    av.textContent = initialAvatar(p.username);
  }

  // header + pills
  const role = p.user_type === 'besponsored' ? 'Sponsee' : (p.user_type ? 'Sponsor' : '');
  if (role) {
    const el = $('role-pill');
    el.style.display = 'inline-flex';
    el.textContent = role;
  }
  if (p.location) {
    const el = $('loc-pill');
    el.style.display = 'inline-flex';
    el.textContent = p.location;
  }
  if (typeof p.review_count === 'number') {
    const el = $('reviews-pill');
    el.style.display = 'inline-flex';
    el.textContent = `${p.review_count} review${p.review_count === 1 ? '' : 's'}`;
  }

  // details
  $('user-username').textContent = p.username || '—';
  $('user-location').textContent = p.location || '—';
  $('user-gender').textContent   = p.title || '—';
  const ctEl = $('contenttype');
  if (ctEl) ctEl.textContent = p.contenttype || '—';
  $('about').textContent         = p.about_yourself || '—';

  // rating
  renderStarsInto($('stars'), p.avg_rating);
  $('avg').textContent =
    (p.avg_rating || p.avg_rating === 0)
      ? Number(p.avg_rating).toFixed(2)
      : '—';

  // handles/platforms → ICONS ONLY
  const handlesWrap = $('handles');
  handlesWrap.innerHTML = '';
  const handles = (p.social_handles && typeof p.social_handles === 'object') ? p.social_handles : null;
  const platforms = safeArray(p.platforms);
  if (!handles && platforms.length === 0) {
    handlesWrap.innerHTML = `<span class="muted">No platforms connected.</span>`;
  } else {
    const frag = document.createDocumentFragment();
    if (handles) {
      Object.entries(handles).forEach(([k, v]) => {
        if (!v) return;
        frag.appendChild(makeHandleIcon(k, v));
      });
    }
    if (!handles || platforms.length) {
      platforms.forEach(pf => frag.appendChild(makePlatformIcon(pf)));
    }
    handlesWrap.appendChild(frag);
    const linked = $('linked-accounts');
    if (linked) linked.innerHTML = handlesWrap.innerHTML;
  }

  // put CTAs under the avatar column
  moveCTAsUnderAvatar();

  setOG(p);
}

function renderKPIs(k) {
  $('kpi-total').textContent     = (k?.total_offers ?? 0).toLocaleString();
  $('kpi-active').textContent    = (k?.active_offers ?? 0).toLocaleString();
  $('kpi-completed').textContent = (k?.completed_offers ?? 0).toLocaleString();
}

function renderRecentDeals(rows) {
  const tb = $('recent-deals-body');
  tb.innerHTML = '';
  if (!rows?.length) {
    tb.innerHTML = `<tr><td colspan="5" class="muted">No recent deals.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const created = r.created_at ? new Date(r.created_at) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.sponsee_username ?? '—'}</td>
      <td>${r.status ?? '—'}</td>
      <td>${created ? created.toLocaleDateString() : '—'}</td>
      <td>${r.deadline ?? '—'}</td>
      <td>${r.live_date ?? '—'}</td>`;
    frag.appendChild(tr);
  });
  tb.appendChild(frag);
}

function renderHistory(rows) {
  const tb = $('history-body');
  tb.innerHTML = '';
  if (!rows?.length) {
    tb.innerHTML = `<tr><td colspan="6" class="muted">No completed/archived deals yet.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const created = r.created_at ? new Date(r.created_at) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.sponsee_username ?? '—'}</td>
      <td>${created ? created.toLocaleDateString() : '—'}</td>
      <td>${r.live_date ?? '—'}</td>
      <td>${r.deadline ?? '—'}</td>
      <td>${r.sponsor_to_sponsee ?? '—'}</td>
      <td>${r.sponsee_to_sponsor ?? '—'}</td>`;
    frag.appendChild(tr);
  });
  tb.appendChild(frag);
}

function renderReviews(items) {
  const wrap = $('reviews');
  wrap.innerHTML = '';
  if (!items || !items.length) {
    wrap.innerHTML = `<div class="muted">No reviews yet.</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach(r => {
    const d = new Date(r.created_at);
    const el = document.createElement('div');
    el.className = 'review';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
        <div class="stars"></div>
        <div class="muted" style="font-size:12px;">
          ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
        </div>
      </div>
      <div style="margin-top:4px;color:#dbe7ff;">${escapeHtml(r.review_text || '')}</div>
      <div class="muted" style="margin-top:6px;font-size:12px;">by ${r.reviewer_role === 'sponsor' ? 'Sponsor' : 'Sponsee'}</div>`;
    frag.appendChild(el);
    // render star objs into the inner .stars
    const starsEl = el.querySelector('.stars');
    renderStarsInto(starsEl, r.rating);
  });
  wrap.appendChild(frag);
}

/* --------------- Live stats loader --------------- */
async function loadLiveStats(profile) {
  if (!profile || !profile.username) return;
  try {
    const { data, error } = await supabase.functions.invoke('get-profile-live-stats', {
      body: { username: profile.username }
    });
    if (error) {
      console.error('[publicdashboard] get-profile-live-stats error', error);
      return;
    }
    if (!data || data.error) {
      if (data && data.error) {
        console.warn('[publicdashboard] get-profile-live-stats payload error', data.error);
      }
      return;
    }
    renderLiveStats(data);
  } catch (e) {
    console.error('[publicdashboard] get-profile-live-stats exception', e);
  }
}

/* ---------------- Load ---------------- */
async function load() {
  // strip any money UI first so headers match our row cells
  stripMoneyUI();

  const slug = getSlugFromLocation();
  if (!slug) {
    q('.wrap').innerHTML = `<p class="err">Profile link is missing.</p>`;
    return;
  }

  // Profile
  const { data: profile, error: perr } = await supabase
    .from('public_user_profiles')
    .select('user_id, slug, username, title, company_name, location, about_yourself, user_type, platforms, social_handles, profile_pic, created_at, avg_rating, review_count, contenttype')
    .eq('slug', slug)
    .maybeSingle();

  if (perr) {
    console.error(perr);
    q('.wrap').innerHTML = `<p class="err">This public profile is unavailable or disabled.</p>`;
    return;
  }
  if (!profile || profile.slug == null) {
    q('.wrap').innerHTML = `<p class="err">This public profile is unavailable or disabled.</p>`;
    return;
  }

  renderProfile(profile);

  // fire live stats (YouTube / TikTok / Twitch / Instagram / Facebook)
  loadLiveStats(profile).catch(e => console.error(e));

  // KPIs (counts only)
  const { data: kpi } = await supabase.rpc('get_public_summary', { p_slug: slug });
  renderKPIs(Array.isArray(kpi) ? kpi[0] : kpi);

  // Recent deals (no amount)
  const { data: recents } = await supabase.rpc('get_public_recent_deals', { p_slug: slug, p_limit: 6 });
  renderRecentDeals(recents || []);

  // History (no amount)
  const { data: history } = await supabase.rpc('get_public_history', { p_slug: slug, p_limit: 20 });
  renderHistory(history || []);

  // Reviews (view)
  const { data: reviews } = await supabase
    .from('public_profile_reviews')
    .select('created_at, rating, review_text, reviewer_role')
    .eq('slug', slug)
    .order('created_at', { ascending: false })
    .limit(6);

  renderReviews(reviews || []);
}

load().catch(e => {
  console.error(e);
  q('.wrap').innerHTML = `<p class="err">Unexpected error loading profile.</p>`;
});
