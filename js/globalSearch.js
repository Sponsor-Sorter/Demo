// ./js/globalSearch.js
import { supabase } from './supabaseClient.js';

/** Feature flags (tables now provided) */
const ENABLE_FORUM = true;  // forum_posts schema provided ✅
const ENABLE_BLOG  = true;  // blog_posts schema provided ✅

const elInput   = document.getElementById('global-search-input');
const elResults = document.getElementById('global-search-results');

// Guard: if the search UI isn't on this page, no-op safely
if (!elInput || !elResults) {
  // console.debug('[globalSearch] nav search not present');
} else {

let abortCtrl = null;
let activeIndex = -1;
let flatResults = []; // flattened list for keyboard nav

// Debounce
function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Scoring: prefix > contains, then recency
function scoreRow(q, text, updated_at) {
  q = (q || '').trim().toLowerCase();
  const t = (text || '').toLowerCase();
  let score = 0;
  if (t.startsWith(q)) score += 100;
  if (t.includes(q))  score += 30;
  if (updated_at) {
    const ts = new Date(updated_at).getTime() || 0;
    score += Math.min(50, (Date.now() - ts) / (1000*60*60*24) * -0.5);
  }
  return score;
}

// Destination URLs
function linkFor(item) {
  switch (item.kind) {
    case 'private_offer': {
      // Stay on the SAME dashboard/page; just set ?offer=<id> in the current URL.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('offer', item.id);
        return url.toString();
      } catch {
        // Fallback (very old browsers)
        const sep = window.location.search ? '&' : '?';
        return `${window.location.pathname}${window.location.search}${sep}offer=${encodeURIComponent(item.id)}`;
      }
    }
    case 'public_offer':  return `./finder.html#public-offer-${encodeURIComponent(item.id)}`;
    case 'profile': {
      // route based on userType
      const u = encodeURIComponent(item.username || item.email || '');
      if (item.userType === 'besponsored') return `./viewprofile.html?username=${u}`;
      if (item.userType === 'sponsor')     return `./viewprofiles.html?username=${u}`;
      // fallback (if userType missing)
      return `./viewprofile.html?u=${u}`;
    }
    case 'forum_post':    return `./forum.html#post-${encodeURIComponent(item.id)}`;
    case 'blog_post':     return item.slug
      ? `./blog.html?slug=${encodeURIComponent(item.slug)}`
      : `./blog.html#post-${encodeURIComponent(item.id)}`;
    default: return '#';
  }
}

// Icons
function iconFor(kind) {
  if (kind === 'profile')      return './logos.png';
  if (kind === 'public_offer') return './megaphone.png';
  if (kind === 'forum_post')   return './forumicon.png';
  if (kind === 'blog_post')    return './blogicon.png';
  return './offericon.png';
}

// Render
function renderSection(title, items) {
  if (!items?.length) return '';
  return `
    <div class="search-section">
      <div class="search-section-title">${title}</div>
      ${items.map((it) => `
        <div class="search-item" role="option"
             data-link="${escapeHtml(linkFor(it))}">
          <div class="content">
            <div class="title">${escapeHtml(it.title || it.username || it.email || 'Untitled')}</div>
            <div class="subtitle">${escapeHtml(it.subtitle || '')}</div>
          </div>
          <div class="meta">
            <img class="icon" src="${iconFor(it.kind)}" alt="">
            <div class="pill">${it.kind.replace('_',' ')}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#39;");
}

function openPopover() { elResults.hidden = false; }
function closePopover() { elResults.hidden = true; activeIndex = -1; }

function setActive(idx) {
  activeIndex = idx;
  const rows = elResults.querySelectorAll('.search-item');
  rows.forEach((r, i) => r.setAttribute('aria-selected', i === idx ? 'true' : 'false'));
  const active = rows[idx];
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function gotoActive() {
  const item = flatResults[activeIndex];
  if (!item) return;
  window.location.href = linkFor(item);
}

// Click outside → close
document.addEventListener('click', (e) => {
  if (!elResults.contains(e.target) && e.target !== elInput) closePopover();
});

// Keyboard nav
elInput.addEventListener('keydown', (e) => {
  const rows = elResults.querySelectorAll('.search-item');
  const count = rows.length;
  if (e.key === 'ArrowDown') { e.preventDefault(); if (count) setActive((activeIndex + 1) % count); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (count) setActive((activeIndex - 1 + count) % count); }
  else if (e.key === 'Enter') { if (!elResults.hidden) { e.preventDefault(); if (activeIndex < 0 && count) setActive(0); gotoActive(); } }
  else if (e.key === 'Escape') { closePopover(); }
});

// === Identity (attribution) ===
async function getCurrentIdentity() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return { id: null, email: null, username: null };
    const user = data.user;

    // 1) No-RLS path
    let username = user?.user_metadata?.username || null;

    // 2) Best-effort: users_extended_data.user_id → username (RLS may block; ignore errors)
    if (!username) {
      try {
        const { data: ux } = await supabase
          .from('users_extended_data')
          .select('username')
          .eq('user_id', user.id)
          .single();
        username = ux?.username || null;
      } catch {}
    }

    return { id: user.id || null, email: user.email || null, username };
  } catch {
    return { id: null, email: null, username: null };
  }
}

// Local contains
function matchesQuery(q, ...fields) {
  const needle = (q || '').trim().toLowerCase();
  if (!needle) return true;
  const hay = fields.filter(Boolean).map(String).join(' ').toLowerCase();
  return hay.includes(needle);
}

// === Main search ===
const runSearch = debounce(async (q) => {
  q = (q || '').trim();
  if (!q) { closePopover(); return; }

  if (abortCtrl) abortCtrl.abort();
  abortCtrl = new AbortController();

  const like = `%${q}%`;

  try {
    const { username } = await getCurrentIdentity();

    const tasks = [
      // PRIVATE OFFERS (attributed by username; exclude archived)
      (async () => {
        if (!username) return [];
        const { data, error } = await supabase
          .from('private_offers')
          .select('id, offer_title, offer_description, stage, created_at, sponsor_username, sponsee_username')
          .eq('archived', false) // 🚫 exclude archived
          .or(`sponsor_username.eq.${username},sponsee_username.eq.${username}`)
          .limit(50);
        if (error || !data) return [];
        const filtered = data.filter(row =>
          matchesQuery(q, row.offer_title, row.offer_description, row.sponsor_username, row.sponsee_username)
        );
        return filtered.slice(0, 12).map(row => ({
          kind: 'private_offer',
          id: row.id,
          title: row.offer_title || `Offer #${String(row.id).slice(0,8)}`,
          subtitle: [
            row.sponsor_username && `Sponsor: ${row.sponsor_username}`,
            row.sponsee_username && `Sponsee: ${row.sponsee_username}`,
            (typeof row.stage !== 'undefined') && `Stage ${row.stage}`
          ].filter(Boolean).join(' • '),
          updated_at: row.created_at,
          _rankText: `${row.offer_title||''} ${row.offer_description||''} ${row.sponsor_username||''} ${row.sponsee_username||''}`
        }));
      })(),

      // PUBLIC OFFERS (your mapping)
      (async () => {
        const { data, error } = await supabase
          .from('public_offers')
          .select('id, offer_title, offer_description, deadline')
          .or(`offer_title.ilike.${like},offer_description.ilike.${like}`)
          .limit(8);
        if (error || !data) return [];
        return data.map(row => ({
          kind: 'public_offer',
          id: row.id,
          title: row.offer_title || `Public Offer #${row.id}`,
          subtitle: [row.offer_description, row.deadline && `Deadline: ${row.deadline}`].filter(Boolean).join(' • '),
          updated_at: undefined,
          _rankText: `${row.offer_title||''} ${row.offer_description||''} ${row.deadline||''}`
        }));
      })(),

      // PROFILES (select userType to route correctly)
      (async () => {
        const { data, error } = await supabase
          .from('users_extended_data')
          .select('id, username, email, company_name, userType, created_at')
          .or(`username.ilike.${like},email.ilike.${like},company_name.ilike.${like}`)
          .limit(8);
        if (error || !data) return [];
        return data.map(row => ({
          kind: 'profile',
          id: row.id,
          username: row.username,
          email: row.email,
          userType: row.userType, // used by linkFor
          title: row.username || row.email,
          subtitle: [row.company_name].filter(Boolean).join(' • '),
          updated_at: row.created_at,
          _rankText: `${row.username||''} ${row.email||''} ${row.company_name||''}`
        }));
      })(),

      // BLOG POSTS (published only)
      ENABLE_BLOG ? (async () => {
        try {
          const { data, error } = await supabase
            .from('blog_posts')
            .select('id, slug, title, excerpt, category, tags, published, author_name, updated_at, created_at')
            .eq('published', true)
            .or(`title.ilike.${like},excerpt.ilike.${like},content.ilike.${like},slug.ilike.${like},category.ilike.${like},author_name.ilike.${like}`)
            .limit(8);
          if (error || !data) return [];
          return data.map(row => ({
            kind: 'blog_post',
            id: row.id,
            slug: row.slug,
            title: row.title || row.slug || `Post #${row.id}`,
            subtitle: [
              row.author_name && `by ${row.author_name}`,
              row.category && `in ${row.category}`,
              row.excerpt
            ].filter(Boolean).join(' • '),
            updated_at: row.updated_at || row.created_at,
            _rankText: `${row.title||''} ${row.excerpt||''} ${row.category||''} ${row.slug||''} ${row.author_name||''}`
          }));
        } catch { return []; }
      })() : async () => [],

      // FORUM POSTS (your forum_posts schema)
      ENABLE_FORUM ? (async () => {
        try {
          const { data, error } = await supabase
            .from('forum_posts')
            .select('id, title, content, category, tags, created_at, comments_count, is_closed')
            // Avoid ilike on text[] tags (can error). We match title/content/category.
            .or(`title.ilike.${like},content.ilike.${like},category.ilike.${like}`)
            .limit(8);
          if (error || !data) return [];
          return data.map(row => ({
            kind: 'forum_post',
            id: row.id,
            title: row.title || `Post #${row.id}`,
            subtitle: [
              row.category && `in ${row.category}`,
              Number.isFinite(row.comments_count) && `${row.comments_count} comments`,
              row.is_closed ? 'closed' : ''
            ].filter(Boolean).join(' • '),
            updated_at: row.created_at,
            _rankText: `${row.title||''} ${row.content||''} ${row.category||''}`
          }));
        } catch { return []; }
      })() : async () => [],
    ];

    const results = (await Promise.allSettled(tasks))
      .flatMap(p => (p.status === 'fulfilled' ? p.value : []));

    // Score + group
    results.forEach(r => r._score = scoreRow(q, r._rankText, r.updated_at));
    const privateOffers = results.filter(r => r.kind === 'private_offer').sort((a,b)=>b._score-a._score).slice(0,12);
    const publicOffers  = results.filter(r => r.kind === 'public_offer').sort((a,b)=>b._score-a._score).slice(0,8);
    const profiles      = results.filter(r => r.kind === 'profile').sort((a,b)=>b._score-a._score).slice(0,8);
    const blogPosts     = results.filter(r => r.kind === 'blog_post').sort((a,b)=>b._score-a-_score).slice(0,8);
    const forumPosts    = results.filter(r => r.kind === 'forum_post').sort((a,b)=>b._score-a._score).slice(0,8);

    // Flatten for keyboard nav
    flatResults = [...privateOffers, ...publicOffers, ...profiles, ...blogPosts, ...forumPosts];

    // Render
    elResults.innerHTML = [
      renderSection('Private Offers', privateOffers),
      renderSection('Public Offers', publicOffers),
      renderSection('People', profiles),
      ENABLE_BLOG  && renderSection('Blog Posts', blogPosts),
      ENABLE_FORUM && renderSection('Forum Posts', forumPosts),
    ].filter(Boolean).join('') || `<div class="search-section-title" style="padding:12px">No results</div>`;

    // Delegated click: works for all current/future rows
    elResults.addEventListener('click', (e) => {
      const row = e.target.closest('.search-item');
      if (!row) return;
      const url = row.dataset.link;
      if (!url) return;
      if (e.metaKey || e.ctrlKey) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
    });

    // Hover sync for visual highlight
    elResults.addEventListener('mouseover', (e) => {
      const rows = [...elResults.querySelectorAll('.search-item')];
      const row = e.target.closest('.search-item');
      if (!row) return;
      rows.forEach(r => r.setAttribute('aria-selected','false'));
      row.setAttribute('aria-selected','true');
    });

    // Default selection
    activeIndex = flatResults.length ? 0 : -1;
    const first = elResults.querySelector('.search-item');
    if (first) first.setAttribute('aria-selected', 'true');

    openPopover();
  } catch {
    elResults.innerHTML = `<div class="search-section-title" style="padding:12px">No results</div>`;
    openPopover();
  }
}, 200);

// Input wiring
elInput.addEventListener('input', (e) => runSearch(e.target.value));
elInput.addEventListener('focus', () => { if (flatResults.length) openPopover(); });

} // end guard
