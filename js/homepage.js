// ./js/homepage.js
import { supabase } from './supabaseClient.js';

/* =========================
   UTIL
========================= */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c]));
}

function compactNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(num);
  } catch {
    return String(num);
  }
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '$0';
  return '$' + Math.round(num).toLocaleString();
}

function timeAgo(dateString) {
  const now = new Date();
  const then = new Date(dateString);
  const diff = Math.floor((now - then) / 1000);
  if (!Number.isFinite(diff) || diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* =========================
   LIVE STATS (profiles / offers / reviews)
========================= */
async function loadLiveStats() {
  const usersEl = document.getElementById('stat-users');
  const offersEl = document.getElementById('stat-offers');
  const reviewsEl = document.getElementById('stat-reviews');
  if (!usersEl && !offersEl && !reviewsEl) return;

  if (usersEl) usersEl.textContent = '—';
  if (offersEl) offersEl.textContent = '—';
  if (reviewsEl) reviewsEl.textContent = '—';

  try {
    const [usersRes, offersRes, reviewsRes] = await Promise.all([
      supabase.from('users_extended_data').select('id', { count: 'exact', head: true }),
      supabase.from('private_offers').select('id', { count: 'exact', head: true }),
      supabase.from('private_offer_reviews').select('id', { count: 'exact', head: true })
    ]);

    if (usersEl && typeof usersRes?.count === 'number') usersEl.textContent = compactNumber(usersRes.count);
    if (offersEl && typeof offersRes?.count === 'number') offersEl.textContent = compactNumber(offersRes.count);
    if (reviewsEl && typeof reviewsRes?.count === 'number') reviewsEl.textContent = compactNumber(reviewsRes.count);
  } catch {
    // leave placeholders
  }
}

/* =========================
   ACTIVITY FEED (Side-scrolling)
========================= */
const staticLines = [
  "Open the guest dashboards to see the workflow (no login).",
  "Clear stages, clear deliverables, clear payments.",
  "Build reputation with reviews after completed deals.",
  "Invite a friend — both get a free month.",
  "No spreadsheets. No chaos. Just organized sponsorships."
];

async function fetchActivityLines() {
  let lines = [];

  // Recent offers
  try {
    const { data: offers } = await supabase
      .from('private_offers')
      .select('offer_title, sponsor_company, offer_amount, platforms, created_at')
      .order('created_at', { ascending: false })
      .limit(6);

    if (offers && offers.length) {
      for (let offer of offers) {
        const amount = offer.offer_amount ? `$${Number(offer.offer_amount).toLocaleString()}` : "";
        const platforms = (offer.platforms && offer.platforms.length)
          ? `on ${escapeHtml(offer.platforms.join(", "))}` : "";
        const title = escapeHtml(offer.offer_title || "New Sponsorship Offer");
        const company = escapeHtml(offer.sponsor_company || "A sponsor");
        lines.push(`🔥 ${company} posted "${title}" ${amount} ${platforms} (${timeAgo(offer.created_at)})`);
      }
    }
  } catch {}

  // Recent reviews
  try {
    const { data: reviews } = await supabase
      .from('private_offer_reviews')
      .select('review_text, rating, overall, reviewer_role, reviewer_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (reviews && reviews.length) {
      const ids = Array.from(new Set(reviews.map(r => r.reviewer_id).filter(Boolean)));
      let usernames = {};

      if (ids.length) {
        const { data: userData } = await supabase
          .from('users_extended_data')
          .select('user_id, username')
          .in('user_id', ids);

        if (userData) userData.forEach(u => { usernames[u.user_id] = u.username; });
      }

      for (let r of reviews) {
        let raw = Number.isFinite(Number(r.rating)) && Number(r.rating) > 0 ? Number(r.rating) : Number(r.overall);
        if (!Number.isFinite(raw) || raw <= 0) continue;

        const rating = Math.max(1, Math.min(5, Math.round(raw)));
        const name = usernames[r.reviewer_id] ? `@${escapeHtml(usernames[r.reviewer_id])}` : escapeHtml(r.reviewer_role || "User");
        const reviewText = r.review_text
          ? `"${escapeHtml(r.review_text.substring(0, 60))}${r.review_text.length > 60 ? "..." : ""}"`
          : "";

        const starHtml =
          `<span style="color:#f6c62e;">${"★".repeat(rating)}</span>` +
          `<span style="color:#9aa0a6;opacity:.35;">${"☆".repeat(5 - rating)}</span>`;

        lines.push(`🌟 ${name} left a ${rating}/5 review: ${starHtml} ${reviewText} (${timeAgo(r.created_at)})`);
      }
    }
  } catch {}

  // Append safe lines and shuffle
  lines = lines.concat(staticLines);
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }

  return lines;
}

let tickerRefreshTimer = null;
let tickerResizeTimer = null;

async function renderActivityFeed() {
  const ticker = document.getElementById('activity-ticker');
  if (!ticker) return;

  // Ensure we have a track element
  let track = ticker.querySelector('.activity-track');
  if (!track) {
    ticker.innerHTML = `<div class="activity-track" aria-hidden="true"></div>`;
    track = ticker.querySelector('.activity-track');
  }

  const lines = await fetchActivityLines();
  const base = (lines && lines.length ? lines : staticLines).slice(0, 14);

  const setHtml = base.map(line => `<div class="activity-item">${line}</div>`).join('');

  // Reset first (single set) to measure
  track.style.removeProperty('--ss-scroll-duration');
  track.style.animation = '';
  track.style.justifyContent = 'flex-start';
  track.innerHTML = setHtml;

  // Measure after paint
  requestAnimationFrame(() => {
    const needsScroll = track.scrollWidth > ticker.clientWidth;

    if (!needsScroll) {
      // If it fits, don’t scroll; just center it.
      track.style.animation = 'none';
      track.style.justifyContent = 'center';
      return;
    }

    // Duplicate the set for seamless looping
    track.innerHTML = setHtml + setHtml;
    track.style.justifyContent = 'flex-start';

    requestAnimationFrame(() => {
      // One set width ~= half of track after duplication
      const oneSetWidth = track.scrollWidth / 2;
      const pxPerSecond = 50; // adjust speed here
      const duration = Math.max(18, Math.round(oneSetWidth / pxPerSecond));
      track.style.setProperty('--ss-scroll-duration', `${duration}s`);
    });
  });
}

async function startTicker() {
  await renderActivityFeed();

  // Refresh feed periodically to pick up new offers/reviews
  if (tickerRefreshTimer) clearInterval(tickerRefreshTimer);
  tickerRefreshTimer = setInterval(() => {
    renderActivityFeed();
  }, 65000);

  // Re-measure on resize (debounced)
  window.addEventListener('resize', () => {
    clearTimeout(tickerResizeTimer);
    tickerResizeTimer = setTimeout(() => {
      renderActivityFeed();
    }, 220);
  });
}

/* =========================
   TRUSTED LOGOS
========================= */
async function loadSponsorLogos() {
  const container = document.getElementById('sponsor-logos');
  if (!container) return;

  // Always include these (case-insensitive substring match)
  const PIN_USERNAME_CONTAINS = ['Moikailive'];

  // Exclude these (case-insensitive substring match) — BUT pinned users override this
  const EXCLUDE_USERNAME_CONTAINS = ['test'];

  const TARGET_COUNT = 7;

  try {
    // 1) Fetch pinned users first
    let pinnedQ = supabase
      .from('users_extended_data')
      .select('profile_pic, username')
      .not('username', 'is', null);

    for (const s of PIN_USERNAME_CONTAINS) {
      pinnedQ = pinnedQ.ilike('username', `%${s}%`);
    }

    const { data: pinnedRaw, error: pinnedErr } = await pinnedQ.limit(TARGET_COUNT);
    if (pinnedErr) throw pinnedErr;

    const pinned = (pinnedRaw || []).filter(u => String(u.username || '').trim());

    // If we already have 8 pinned, just show them (optionally shuffle)
    if (pinned.length >= TARGET_COUNT) {
      const selection = pinned
        .sort(() => Math.random() - 0.5)
        .slice(0, TARGET_COUNT);

      container.innerHTML = selection.map(user => {
        const picUrl = user.profile_pic
          ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${user.profile_pic}`
          : './logos.png';

        return `
          <figure>
            <img src="${picUrl}" alt="${escapeHtml(user.username) || 'User'}">
            <figcaption>@${escapeHtml(user.username) || 'User'}</figcaption>
          </figure>
        `;
      }).join('');

      return;
    }

    // 2) Fetch a larger pool for the remaining slots (excluding pinned + excluded patterns)
    let othersQ = supabase
      .from('users_extended_data')
      .select('profile_pic, username')
      .not('username', 'is', null);

    // Exclude anything matching pinned patterns (so we don't duplicate)
    for (const s of PIN_USERNAME_CONTAINS) {
      othersQ = othersQ.not('username', 'ilike', `%${s}%`);
    }

    // Exclude test patterns for the rest
    for (const s of EXCLUDE_USERNAME_CONTAINS) {
      othersQ = othersQ.not('username', 'ilike', `%${s}%`);
    }

    const { data: othersRaw, error: othersErr } = await othersQ.limit(200);
    if (othersErr) throw othersErr;

    const others = (othersRaw || []).filter(u => String(u.username || '').trim());

    // 3) Merge (pinned first), ensure uniqueness by username (case-insensitive)
    const seen = new Set();
    const uniquePinned = [];
    for (const u of pinned) {
      const k = String(u.username).trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        uniquePinned.push(u);
      }
    }

    const shuffledOthers = others.sort(() => Math.random() - 0.5);
    const finalList = [...uniquePinned];

    for (const u of shuffledOthers) {
      if (finalList.length >= TARGET_COUNT) break;
      const k = String(u.username).trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      finalList.push(u);
    }

    if (finalList.length === 0) {
      container.innerHTML = '<p>No creators to show yet.</p>';
      return;
    }

    // 4) Render
    container.innerHTML = finalList.map(user => {
      const picUrl = user.profile_pic
        ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${user.profile_pic}`
        : './logos.png';

      return `
        <figure>
          <img src="${picUrl}" alt="${escapeHtml(user.username) || 'User'}">
          <figcaption>@${escapeHtml(user.username) || 'User'}</figcaption>
        </figure>
      `;
    }).join('');
  } catch {
    container.innerHTML = '<p>No creators to show yet.</p>';
  }
}


/* =========================
   TESTIMONIALS
========================= */
function renderStarsInline(rating) {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  const filled = "&#9733;".repeat(r);
  const empty  = "&#9733;".repeat(5 - r);
  return `
    <span class="stars-row" style="display:inline-flex;gap:2px;line-height:1;vertical-align:middle;">
      <span style="color:#f6c62e;">${filled}</span>
      <span style="color:#9aa0a6;opacity:.35;">${empty}</span>
    </span>`;
}

async function loadTestimonials() {
  try {
    const { data: reviews } = await supabase
      .from('private_offer_reviews')
      .select('review_text, rating, overall, reviewer_role, reviewer_id, created_at')
      .order('created_at', { ascending: false })
      .limit(8);

    const { data: users } = await supabase
      .from('users_extended_data')
      .select('user_id, username, profile_pic');

    const testimonials = [];
    if (reviews && reviews.length) {
      for (let review of reviews) {
        let raw = Number.isFinite(Number(review.rating)) && Number(review.rating) > 0
          ? Number(review.rating)
          : Number(review.overall);

        if (!Number.isFinite(raw) || raw <= 0) continue;
        if (!review.review_text) continue;

        const rating = Math.max(1, Math.min(5, Math.round(raw)));
        const user = users?.find(u => u.user_id === review.reviewer_id);

        testimonials.push({
          text: review.review_text,
          stars: renderStarsInline(rating),
          name: user ? user.username : (review.reviewer_role || 'User'),
          pic: user?.profile_pic
            ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${user.profile_pic}`
            : './logos.png'
        });
      }
    }

    if (!testimonials.length) {
      testimonials.push({
        text: "We’re in early access — real reviews will appear here as soon as the first offers complete.",
        stars: `<span style="opacity:.8;font-size:.95em;">No reviews yet</span>`,
        name: "Sponsor Sorter (Early Access)",
        pic: "./logos.png"
      });
    }

    return testimonials;
  } catch {
    return [{
      text: "We’re in early access — real reviews will appear here as soon as the first offers complete.",
      stars: `<span style="opacity:.8;font-size:.95em;">No reviews yet</span>`,
      name: "Sponsor Sorter (Early Access)",
      pic: "./logos.png"
    }];
  }
}

let currentTestimonial = 0;
let testimonialsArr = [];

function showTestimonial(idx) {
  const t = testimonialsArr[idx];
  const el = document.getElementById('testimonial-content');
  if (!t || !el) return;

  el.innerHTML = `
    <div class="testimonial" style="text-align:left;max-width:420px;margin:0 auto;transition:all .3s;font-size:1.25em;">
      <div style="display:flex;align-items:center;gap:15px;">
        <img src="${t.pic}" alt="${escapeHtml(t.name)}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">
        ${t.stars}
      </div>
      <blockquote style="margin:12px 0 6px 0;min-height:42px;">${escapeHtml(t.text)}</blockquote>
      <cite style="font-size:0.96em;">— ${escapeHtml(t.name)}</cite>
    </div>`;
}

async function initTestimonialCarousel() {
  testimonialsArr = await loadTestimonials();
  showTestimonial(currentTestimonial);

  const prev = document.getElementById('testimonial-prev');
  const next = document.getElementById('testimonial-next');

  if (prev) prev.onclick = () => {
    currentTestimonial = (currentTestimonial - 1 + testimonialsArr.length) % testimonialsArr.length;
    showTestimonial(currentTestimonial);
  };

  if (next) next.onclick = () => {
    currentTestimonial = (currentTestimonial + 1) % testimonialsArr.length;
    showTestimonial(currentTestimonial);
  };

  setInterval(() => {
    currentTestimonial = (currentTestimonial + 1) % testimonialsArr.length;
    showTestimonial(currentTestimonial);
  }, 7800);
}

/* =========================
   SMART CALCULATOR (Icon rail + chips + range + breakdown)
========================= */
const CALC = {
  instagram: {
    label: "Instagram",
    baselineER: 0.03,
    deliverables: [
      { key: "instagram_post", label: "Post", reachRate: 0.22, cpm: [12, 18, 26] },
      { key: "instagram_story", label: "Story", reachRate: 0.10, cpm: [8, 14, 20] },
      { key: "instagram_reel", label: "Reel", reachRate: 0.28, cpm: [14, 22, 34] }
    ],
    viewsLabel: "Average reach per post",
    viewsHint: "Use your typical reach (not followers) for best accuracy."
  },
  tiktok: {
    label: "TikTok",
    baselineER: 0.06,
    deliverables: [
      { key: "tiktok_video", label: "Video", reachRate: 0.45, cpm: [10, 18, 30] }
    ],
    viewsLabel: "Average views per video",
    viewsHint: "TikTok is view-driven. If you know views, use that."
  },
  youtube: {
    label: "YouTube",
    baselineER: 0.04,
    deliverables: [
      { key: "youtube_integration", label: "Integration", reachRate: 0.18, cpm: [18, 28, 45] },
      { key: "youtube_dedicated", label: "Dedicated", reachRate: 0.18, cpm: [24, 38, 60] },
      { key: "youtube_short", label: "Short", reachRate: 0.28, cpm: [12, 18, 30] }
    ],
    viewsLabel: "Average views per video",
    viewsHint: "Use your typical view count for long-form or shorts."
  },
  twitch: {
    label: "Twitch",
    baselineER: 0.05,
    deliverables: [
      { key: "twitch_sponsored_stream", label: "Sponsored stream", viewerHour: [0.8, 1.0, 1.3] },
      { key: "twitch_overlay", label: "Overlay + mention", viewerHour: [0.35, 0.55, 0.75] },
      { key: "twitch_chat_command", label: "Chat command", viewerHour: [0.18, 0.30, 0.45] }
    ],
    viewsLabel: "Average CCV (concurrent viewers)",
    viewsHint: "Enter Avg CCV. We multiply CCV × hours × benchmark."
  },
  facebook: {
    label: "Facebook",
    baselineER: 0.02,
    deliverables: [
      { key: "facebook_post", label: "Post", reachRate: 0.18, cpm: [8, 14, 22] }
    ],
    viewsLabel: "Average reach per post",
    viewsHint: "If you know reach, use it — otherwise we estimate from followers."
  },
  x: {
    label: "X",
    baselineER: 0.015,
    deliverables: [
      { key: "x_post", label: "Post", reachRate: 0.12, cpm: [6, 10, 18] },
      { key: "x_thread", label: "Thread", reachRate: 0.16, cpm: [8, 14, 26] }
    ],
    viewsLabel: "Average impressions per post",
    viewsHint: "If you have analytics impressions, use those."
  },
  snapchat: {
    label: "Snapchat",
    baselineER: 0.04,
    deliverables: [
      { key: "snap_story", label: "Story", reachRate: 0.20, cpm: [8, 14, 24] }
    ],
    viewsLabel: "Average views per story",
    viewsHint: "Snap is view-driven. Put average views if you know it."
  }
};

function setCalcBadge(text) {
  const b = document.getElementById('calc-platform-badge');
  if (b) b.textContent = text;
}

function setViewsLabels(platformKey) {
  const labelEl = document.getElementById('avgViewsLabel');
  const hintEl = document.getElementById('avgViewsHint');
  const p = CALC[platformKey];
  if (!p) return;
  if (labelEl) labelEl.textContent = p.viewsLabel || 'Average views / reach';
  if (hintEl) hintEl.textContent = p.viewsHint || '';
}

function setStreamUi(platformKey) {
  const wrap = document.getElementById('streamHoursWrap');
  if (!wrap) return;
  wrap.style.display = (platformKey === 'twitch') ? 'block' : 'none';
}

function setHidden(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getVal(id) {
  return document.getElementById(id)?.value ?? '';
}

function buildDeliverableChips(platformKey) {
  const row = document.getElementById('calcDeliverables');
  if (!row) return;

  const p = CALC[platformKey];
  row.innerHTML = '';
  if (!p) return;

  const current = getVal('calcDeliverable') || p.deliverables[0]?.key;

  p.deliverables.forEach((d, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calc-chip' + ((current === d.key || (!current && idx === 0)) ? ' is-active' : '');
    btn.textContent = d.label;
    btn.dataset.deliverable = d.key;

    btn.addEventListener('click', () => {
      setHidden('calcDeliverable', d.key);
      row.querySelectorAll('.calc-chip').forEach(ch => ch.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (document.getElementById('earningsResult')?.innerHTML?.trim()) calculateEarningsSmart();
    });

    row.appendChild(btn);
  });

  const keys = p.deliverables.map(x => x.key);
  if (!keys.includes(current) && p.deliverables[0]) {
    setHidden('calcDeliverable', p.deliverables[0].key);
    const first = row.querySelector('.calc-chip');
    if (first) first.classList.add('is-active');
  }
}

function initCalcTabs() {
  const tabs = Array.from(document.querySelectorAll('.calc-tab[data-platform]'));
  if (!tabs.length) return;

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      const key = t.dataset.platform;
      if (!CALC[key]) return;

      tabs.forEach(x => {
        x.classList.remove('is-active');
        x.setAttribute('aria-selected', 'false');
      });

      t.classList.add('is-active');
      t.setAttribute('aria-selected', 'true');

      setHidden('calcPlatform', key);
      setCalcBadge(CALC[key].label);
      setViewsLabels(key);
      setStreamUi(key);
      buildDeliverableChips(key);

      const out = document.getElementById('earningsResult');
      if (out) out.innerHTML = '';
    });
  });

  const key = getVal('calcPlatform') || 'instagram';
  if (CALC[key]) {
    setCalcBadge(CALC[key].label);
    setViewsLabels(key);
    setStreamUi(key);
    buildDeliverableChips(key);
  }
}

function modifierMultipliers() {
  const usage = getVal('usageRights');
  const exclus = getVal('exclusivity');
  const whitelisting = !!document.getElementById('whitelisting')?.checked;
  const rush = !!document.getElementById('rush')?.checked;

  const usageMult = (usage === '30d') ? 1.20 : (usage === '6m') ? 1.45 : (usage === '12m') ? 1.75 : 1.00;
  const exclusMult = (exclus === '7d') ? 1.15 : (exclus === '30d') ? 1.35 : 1.00;
  const whiteMult = whitelisting ? 1.25 : 1.00;
  const rushMult = rush ? 1.15 : 1.00;

  return {
    usageMult,
    exclusMult,
    whiteMult,
    rushMult,
    total: usageMult * exclusMult * whiteMult * rushMult,
    labels: [
      usage !== 'none' ? `Usage rights (${usage})` : null,
      exclus !== 'none' ? `Exclusivity (${exclus})` : null,
      whitelisting ? 'Whitelisting' : null,
      rush ? 'Rush' : null
    ].filter(Boolean)
  };
}

function engagementMultiplier(platformKey, er) {
  const base = CALC[platformKey]?.baselineER ?? 0.03;
  const safeEr = clamp(er, 0.002, 0.20);
  const ratio = safeEr / base;
  return clamp(0.85 + (ratio - 1) * 0.30, 0.75, 1.25);
}

function estimateReach(platformKey, deliverableKey, followers, avgViews) {
  const p = CALC[platformKey];
  if (!p) return 0;

  const views = Number(avgViews) || 0;
  if (views > 0) return views;

  const f = Number(followers) || 0;
  if (f <= 0) return 0;

  const d = p.deliverables.find(x => x.key === deliverableKey);
  const rr = d?.reachRate ?? 0.18;
  return Math.max(0, f * rr);
}

function calcTwitch(platformKey, deliverableKey, ccv, hours, er, mods) {
  const p = CALC[platformKey];
  const d = p?.deliverables.find(x => x.key === deliverableKey);
  if (!d || !d.viewerHour) return null;

  const CCV = Math.max(0, Number(ccv) || 0);
  const H = clamp(hours || 1, 0.25, 12);

  if (CCV <= 0) return { error: 'For Twitch, enter your Avg CCV (concurrent viewers).' };

  const [lowVH, midVH, highVH] = d.viewerHour;

  const erMult = engagementMultiplier(platformKey, er);
  const baseLow = CCV * H * lowVH;
  const baseMid = CCV * H * midVH;
  const baseHigh = CCV * H * highVH;

  const low = baseLow * erMult * mods.total;
  const mid = baseMid * erMult * mods.total;
  const high = baseHigh * erMult * mods.total;

  return {
    reach: CCV,
    reachLabel: `Avg CCV`,
    base: { low: baseLow, mid: baseMid, high: baseHigh },
    final: { low, mid, high },
    model: 'viewer-hour'
  };
}

function calcCpm(platformKey, deliverableKey, followers, avgViews, er, mods) {
  const p = CALC[platformKey];
  const d = p?.deliverables.find(x => x.key === deliverableKey);
  if (!p || !d || !d.cpm) return null;

  const reach = estimateReach(platformKey, deliverableKey, followers, avgViews);
  if (reach <= 0) return { error: 'Enter followers/subscribers or average views/reach.' };

  const [lowCpm, midCpm, highCpm] = d.cpm;

  const erMult = engagementMultiplier(platformKey, er);

  const baseLow = (reach / 1000) * lowCpm;
  const baseMid = (reach / 1000) * midCpm;
  const baseHigh = (reach / 1000) * highCpm;

  const low = baseLow * erMult * mods.total;
  const mid = baseMid * erMult * mods.total;
  const high = baseHigh * erMult * mods.total;

  const floor = 50;
  return {
    reach,
    reachLabel: 'Estimated reach/views',
    base: { low: Math.max(floor, baseLow), mid: Math.max(floor, baseMid), high: Math.max(floor, baseHigh) },
    final: { low: Math.max(floor, low), mid: Math.max(floor, mid), high: Math.max(floor, high) },
    model: 'cpm',
    cpm: { low: lowCpm, mid: midCpm, high: highCpm }
  };
}

function calculateEarningsSmart() {
  const out = document.getElementById('earningsResult');
  if (!out) return;

  const platformKey = getVal('calcPlatform') || 'instagram';
  const deliverableKey = getVal('calcDeliverable') || (CALC[platformKey]?.deliverables[0]?.key || '');
  const followers = Number(getVal('followers') || 0);
  const avgViews = Number(getVal('avgViews') || 0);
  const hours = Number(getVal('streamHours') || 1);

  const erInput = Number(getVal('engagement') || 0);
  const er = erInput > 0 ? clamp(erInput / 100, 0.002, 0.20) : (CALC[platformKey]?.baselineER ?? 0.03);

  const mods = modifierMultipliers();

  let result = null;
  if (platformKey === 'twitch') {
    result = calcTwitch(platformKey, deliverableKey, avgViews, hours, er, mods);
  } else {
    result = calcCpm(platformKey, deliverableKey, followers, avgViews, er, mods);
  }

  if (!result || result.error) {
    out.innerHTML = `<div style="color:#ffb3b3;font-weight:800;">${escapeHtml(result?.error || 'Missing inputs.')}</div>`;
    return;
  }

  const low = result.final.low;
  const mid = result.final.mid;
  const high = result.final.high;

  const modsText = mods.labels.length ? mods.labels.join(', ') : 'None';
  const erPct = Math.round(er * 1000) / 10;

  const deliverableLabel =
    (CALC[platformKey]?.deliverables.find(x => x.key === deliverableKey)?.label) || 'Deliverable';

  const reachText = (result.model === 'viewer-hour')
    ? `${Math.round(result.reach)} ${result.reachLabel} × ${clamp(hours || 1, 0.25, 12)}h`
    : `${Math.round(result.reach).toLocaleString()} ${result.reachLabel}`;

  const baseLine = (result.model === 'viewer-hour')
    ? `Benchmark: $/viewer-hour (varies by stream + niche)`
    : `Benchmark: CPM $${result.cpm.low}–$${result.cpm.high} (mid $${result.cpm.mid})`;

  out.innerHTML = `
    <div class="calc-range">
      <div class="big">${money(low)} – ${money(high)}</div>
      <div class="mid">Typical: <b>${money(mid)}</b></div>
    </div>

    <div class="calc-break">
      <div><b>${escapeHtml(CALC[platformKey]?.label || platformKey)}</b> • <b>${escapeHtml(deliverableLabel)}</b></div>
      <div>Reach input: <b>${escapeHtml(reachText)}</b></div>
      <div>Engagement used: <b>${erPct}%</b> (${erInput > 0 ? 'your input' : 'baseline'})</div>
      <div>Add-ons: <b>${escapeHtml(modsText)}</b></div>
      <div style="margin-top:10px;opacity:.9;">${escapeHtml(baseLine)}</div>
      <div style="margin-top:8px;opacity:.78;font-size:.95em;">
        Tip: Add your average views/reach for best accuracy. Brand category, creative complexity, and audience quality can shift rates up/down.
      </div>
    </div>
  `;
}

/* =========================
   INIT
========================= */
window.addEventListener('DOMContentLoaded', () => {
  // Live stats counters
  loadLiveStats();

  // Activity feed (side-scrolling)
  startTicker();

  // Logos + testimonials
  loadSponsorLogos();
  initTestimonialCarousel();

  // Smart calculator
  initCalcTabs();
  const calcBtn = document.getElementById('calc-earnings-btn');
  if (calcBtn) calcBtn.onclick = calculateEarningsSmart;

  // Optional: auto-recalc on change
  ['followers','avgViews','streamHours','engagement','usageRights','exclusivity','whitelisting','rush'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (document.getElementById('earningsResult')?.innerHTML?.trim()) calculateEarningsSmart();
    });
  });
});
