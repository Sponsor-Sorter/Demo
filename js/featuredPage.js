// ./js/featuredPage.js
import { supabase } from './supabaseClient.js';
import { injectUserBadge } from './badges.js';

/** CONFIG **/
const STORAGE_LOGOS = 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/';
const FALLBACK_IMG = './logos.png';
// Base for public dashboard URL (see public shareable dashboard thread)
const PUBLIC_DASHBOARD_BASE = './u/index.html?u=';

/** DOM helpers **/
const $ = (id) => document.getElementById(id);
const heroHeading = $('hero-heading');
const heroSub     = $('hero-sub');
const slotLabel   = $('slot-label');

const usernameEl  = $('username');
const rolePill    = $('role-pill');
const profilePic  = $('profile-pic');
const locationEl  = $('location');
const aboutEl     = $('about');
const companyEl   = $('company');
const platformsEl = $('platforms');

const ctaOffer    = $('cta-offer');
const ctaView     = $('cta-view');
// Optional placeholder in HTML; if absent, we’ll create it next to the other CTAs
const ctaPublic   = $('cta-public');

const otherWrap   = $('other-featured');
const emptyState  = $('empty-state');
const profileCard = $('profile-card');
const badgesRow   = $('badges');

/** Utils **/
const safe = (v, fb = '—') => (v ?? fb);
const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

/* Style ensure for clickable platform chips */
let platformStyleInjected = false;
function ensurePlatformChipStyles() {
  if (platformStyleInjected) return;
  const st = document.createElement('style');
  st.textContent = `
    .platform-badges a.platform-chip,
    .platform-badges span.platform-chip {
      display:inline-block; border-radius:999px; padding:4px 10px; font-size:.85em;
      background:#5e5e5e; color:#fff; text-decoration:none;
    }
    .platform-badges a.platform-chip:hover { filter:brightness(1.05); }
  `;
  document.head.appendChild(st);
  platformStyleInjected = true;
}

function imgUrlFromProfilePic(pic) {
  if (!pic) return FALLBACK_IMG;
  return isHttp(pic) ? pic : (STORAGE_LOGOS + pic);
}

function parseSlotParam() {
  const p = new URLSearchParams(window.location.search);
  const n = Number(p.get('slot'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function timeWindowOk(s) {
  const now = Date.now();
  const startOk = !s.starts_at || Date.parse(s.starts_at) <= now;
  const endOk   = !s.ends_at || Date.parse(s.ends_at) >= now;
  return startOk && endOk && !!s.user_id;
}

// Replace the old roleLabel with this:
function roleLabel(userType) {
  const t = String(userType || '').trim().toLowerCase();
  if (t === 'sponsor') return 'Sponsor';
  // Treat these as the creator side
  if (t === 'sponsee' || t === 'besponsored' || t === 'be sponsored' || t === 'to be sponsored') {
    return 'Sponsee';
  }
  // Fallbacks
  if (t.includes('sponsee')) return 'Sponsee';
  if (t.includes('sponsor')) return 'Sponsor';
  return 'Sponsee';
}


// Replace the old offersEmailFieldFor with this:
function offersEmailFieldFor(userType) {
  const t = String(userType || '').trim().toLowerCase();
  return t === 'sponsor' ? 'sponsor_email' : 'sponsee_email';
}


/* ===== Social links ===== */
function normalizeKey(key) {
  if (!key) return '';
  const k = String(key).trim().toLowerCase();
  if (k === 'x') return 'twitter';
  if (k === 'ig') return 'instagram';
  if (k === 'tt') return 'tiktok';
  if (k === 'fb') return 'facebook';
  if (k === 'yt') return 'youtube';
  if (k === 'li') return 'linkedin';
  if (k === 'gh') return 'github';
  return k.replace(/\s+/g, '');
}

function cleanHandle(v) {
  if (!v && v !== 0) return '';
  let s = String(v).trim();
  if (isHttp(s)) return s; // already a URL
  // Strip leading @ and trailing slashes/spaces
  s = s.replace(/^@+/, '').replace(/\/+$/, '');
  return s;
}

function urlForPlatform(key, handle) {
  const k = normalizeKey(key);
  const h = cleanHandle(handle);
  if (!h) return null;
  if (isHttp(h)) return h;

  switch (k) {
    case 'youtube':
      // Channel ID vs handle
      if (/^UC[0-9A-Za-z_-]{22}$/.test(h)) return `https://www.youtube.com/channel/${h}`;
      if (h.startsWith('channel/')) return `https://www.youtube.com/${h}`;
      if (h.startsWith('c/')) return `https://www.youtube.com/${h}`;
      return `https://www.youtube.com/@${h}`;
    case 'twitch':
      return `https://www.twitch.tv/${h}`;
    case 'instagram':
      return `https://www.instagram.com/${h}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${h}`;
    case 'twitter':
      return `https://twitter.com/${h}`;
    case 'facebook':
      return `https://www.facebook.com/${h}`;
    case 'snapchat':
    case 'snap':
      return `https://www.snapchat.com/add/${h}`;
    case 'threads':
      return `https://www.threads.net/@${h}`;
    case 'linkedin':
      // Default to /in/; if they pass full path, allow it
      if (/^company\//i.test(h)) return `https://www.linkedin.com/${h}`;
      if (/^in\//i.test(h)) return `https://www.linkedin.com/${h}`;
      return `https://www.linkedin.com/in/${h}`;
    case 'github':
      return `https://github.com/${h}`;
    case 'website':
    case 'site':
    case 'url':
      return h.startsWith('www.') ? `https://${h}` : (isHttp(h) ? h : `https://${h}`);
    default:
      // Unknown platform: best effort → if looks like url path, prefix, else noop
      if (h.includes('.') || h.includes('/')) {
        return h.startsWith('http') ? h : `https://${h}`;
      }
      return null;
  }
}

function prettyPlatformName(key) {
  const k = normalizeKey(key);
  const map = {
    youtube: 'YouTube',
    twitch: 'Twitch',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    twitter: 'Twitter/X',
    facebook: 'Facebook',
    snapchat: 'Snapchat',
    snap: 'Snapchat',
    threads: 'Threads',
    linkedin: 'LinkedIn',
    github: 'GitHub',
    website: 'Website',
    site: 'Website',
    url: 'Website'
  };
  return map[k] || key?.toString() || 'Profile';
}

function renderPlatforms(platforms, socialHandles) {
  ensurePlatformChipStyles();
  platformsEl.innerHTML = '';

  // Normalize handles object (it might arrive as a JSON string)
  let handlesObj = {};
  if (socialHandles && typeof socialHandles === 'string') {
    try { handlesObj = JSON.parse(socialHandles); } catch { handlesObj = {}; }
  } else if (socialHandles && typeof socialHandles === 'object') {
    handlesObj = socialHandles;
  }

  const seen = new Set();
  const chips = [];

  // 1) Build from handles first (they’re linkable)
  for (const [rawKey, rawVal] of Object.entries(handlesObj)) {
    const key = normalizeKey(rawKey);
    const href = urlForPlatform(key, rawVal);
    const label = prettyPlatformName(key);
    if (!label || seen.has(key)) continue;
    chips.push({ label, href });
    seen.add(key);
  }

  // 2) Add from platforms array when not already present (may be non-link)
  if (Array.isArray(platforms)) {
    for (const p of platforms) {
      const key = normalizeKey(p);
      if (!key || seen.has(key)) continue;
      chips.push({ label: prettyPlatformName(key), href: null });
      seen.add(key);
    }
  }

  if (!chips.length) {
    platformsEl.innerHTML = '<span class="muted">—</span>';
    return;
  }

  // 3) Render
  for (const chip of chips.slice(0, 12)) {
    if (chip.href) {
      const a = document.createElement('a');
      a.className = 'platform-chip';
      a.href = chip.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = chip.label;
      platformsEl.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.className = 'platform-chip';
      span.textContent = chip.label;
      platformsEl.appendChild(span);
    }
  }
}

/** Data **/
async function fetchActiveSlots() {
  const { data, error } = await supabase
    .from('featured_slots')
    .select('slot_index,user_id,label,starts_at,ends_at')
    .order('slot_index', { ascending: true });

  if (error) {
    console.warn('featured_slots error:', error);
    return [];
  }
  return (data || []).filter(timeWindowOk);
}

async function fetchUserPublic(userId) {
  // NOTE: include email for badges.js and social_handles for links
  let user = null;
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('user_id, email, username, company_name, location, about_yourself, userType, platforms, social_handles, profile_pic, created_at')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!error && data) user = data;

  if (user && !user.username) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (prof?.username) user.username = prof.username;
  }

  return user;
}

// Pull the full row once (defensive) to detect a variety of flag names without schema coupling
async function fetchUserPublicFlags(userId) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('users_extended_data flags error:', error);
    return null;
  }
  return data || null;
}

function hasPublicDashboardFlag(row) {
  if (!row || typeof row !== 'object') return false;

  // Common/likely flag names we support
  const candidates = [
    'public_dashboard_enabled',
    'public_profile_enabled',
    'public_share_enabled',
    'public_enabled',
    'public_page_enabled',
    'public_dashboard',
    'share_profile_publicly',
    'public_profile',
    'public_page'
  ];

  for (const key of candidates) {
    if (key in row) {
      const v = row[key];
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (['true', 'yes', '1', 'enabled', 'on'].includes(s)) return true;
      }
    }
  }

  // Optional nested structures some implementations use
  const nested = row.privacy || row.public_settings || null;
  if (nested && typeof nested === 'object') {
    const nv = nested.public_dashboard ?? nested.public_profile ?? nested.enabled;
    return !!nv;
  }

  return false;
}

/** Render **/
function renderUser(user, slot) {
  if (!user) {
    emptyState.style.display = '';
    profileCard.style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  profileCard.style.display = '';

  heroHeading.textContent = 'Featured Creator';
  slotLabel.textContent = slot?.label ? `Slot ${slot.slot_index} — ${slot.label}` : `Slot ${slot?.slot_index ?? '—'}`;

  usernameEl.textContent = user.username ? `@${user.username}` : '@unknown';
  rolePill.textContent   = roleLabel(user.userType);
  profilePic.src         = imgUrlFromProfilePic(user.profile_pic);
  locationEl.textContent = safe(user.location, '—');
  aboutEl.textContent    = safe(user.about_yourself, '');
  companyEl.textContent  = safe(user.company_name, '—');

  // Platforms → link to socials
  renderPlatforms(user.platforms, user.social_handles);

  // Badges (uses your badges.js)
  badgesRow.innerHTML = '';
  if (user.email) {
    const emailField = offersEmailFieldFor(user.userType);
    injectUserBadge(user.email, '#badges', emailField).catch((e) =>
      console.warn('injectUserBadge failed:', e)
    );
  }

  // CTAs for anon users -> signup/login with redirect + username preselect
  const redirect = encodeURIComponent(window.location.href);
  const handle   = encodeURIComponent(user.username || '');
  ctaOffer.href  = `./signup.html?intent=message&to=${handle}&redirect=${redirect}`;
  ctaView.href   = `./finder.html?user=${handle}`;

  // NEW: Public Dashboard button (only if enabled in users_extended_data)
  ensurePublicDashboardCTA(user).catch((e) => console.warn('public dashboard CTA error:', e));
}

function renderOther(slots, activeSlotIdx) {
  otherWrap.innerHTML = '';
  const items = slots
    .filter(s => s.slot_index !== activeSlotIdx)
    .slice(0, 8);

  if (!items.length) {
    otherWrap.innerHTML = '<div class="muted">No other featured creators right now.</div>';
    return;
  }

  for (const s of items) {
    const row = document.createElement('div');
    row.className = 'mini-item';
    row.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('slot', s.slot_index);
      window.location.href = url.toString();
    });

    const img = document.createElement('img');
    img.src = FALLBACK_IMG;
    const name = document.createElement('div');
    name.textContent = `Slot ${s.slot_index}`;

    row.appendChild(img);
    row.appendChild(name);
    otherWrap.appendChild(row);

    fetchUserPublic(s.user_id).then((u) => {
      if (!u) return;
      name.textContent = u.username ? `@${u.username}` : `Slot ${s.slot_index}`;
      img.src = imgUrlFromProfilePic(u.profile_pic);
    });
  }
}

// Create/show the Public Dashboard CTA if the user has it enabled
async function ensurePublicDashboardCTA(user) {
  // Need both a username (slug) and user_id (for flags)
  if (!user?.user_id || !user?.username) {
    // Hide if pre-existing element
    const pre = $('cta-public');
    if (pre) pre.style.display = 'none';
    return;
  }

  const row = await fetchUserPublicFlags(user.user_id);
  const enabled = hasPublicDashboardFlag(row);

  // Get or create the button
  let btn = $('cta-public') || ctaPublic;
  if (!btn) {
    btn = document.createElement('a');
    btn.id = 'cta-public';
    // Try to inherit styling from existing CTA buttons
    btn.className = (ctaView?.className || ctaOffer?.className || '').trim();
    btn.textContent = 'Public Dashboard';
    btn.style.display = 'none';
    const parent =
      (ctaView && ctaView.parentNode) ||
      (ctaOffer && ctaOffer.parentNode) ||
      profileCard ||
      document.body;
    parent.appendChild(btn);
  }

  if (enabled) {
    btn.href = `${PUBLIC_DASHBOARD_BASE}${encodeURIComponent(user.username)}`;
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
}

/** Main **/
(async function init() {
  try {
    heroSub.textContent = 'Loading featured profile…';
    const slots = await fetchActiveSlots();

    if (!slots.length) {
      renderUser(null, null);
      heroSub.textContent = 'No featured creators at the moment.';
      return;
    }

    let slotIdx = parseSlotParam();
    let slot = null;

    if (slotIdx) {
      slot = slots.find(s => s.slot_index === slotIdx) || null;
    }
    if (!slot) {
      slot = slots[Math.floor(Math.random() * slots.length)];
      slotIdx = slot.slot_index;
    }

    const user = await fetchUserPublic(slot.user_id);
    renderUser(user, slot);
    renderOther(slots, slotIdx);
    heroSub.textContent = 'Click “Message/Offer” to work with them.';

  } catch (e) {
    console.warn('featured page init error:', e);
    renderUser(null, null);
    heroSub.textContent = 'Something went wrong loading this feature.';
  }
})();
