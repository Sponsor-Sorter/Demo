// ./js/featured.js
import { supabase } from './supabaseClient.js';

/* =========================
   Config you can tweak
========================= */
const OVERLAY_ID = 'sparkle-overlay';
const DEFAULT_STAR_COUNT = 100;
const FEATURED_TARGET_PAGE = './featured.html'; // anon viewer page

// Proximity radius (px): slightly larger for touch
const PROXIMITY_PX_DESKTOP = 14;
const PROXIMITY_PX_TOUCH = 28;

/* =========================
   Helpers
========================= */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isTouch() {
  return 'ontouchstart' in window || window.matchMedia?.('(pointer: coarse)').matches;
}

function isInteractiveTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  return !!el.closest('a,button,input,textarea,select,[role="button"],[data-no-star-prox]');
}

function ensureOverlayReady(overlay) {
  // Ensure parent provides positioning context
  const parent = overlay.parentElement || document.body;
  const cs = window.getComputedStyle(parent);
  if (!cs.position || cs.position === 'static') {
    parent.style.position = 'relative';
  }
  // Make overlay cover its parent and float above
  overlay.style.position = 'absolute';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.zIndex = '5';
  overlay.style.pointerEvents = 'none'; // we’ll listen on document; sparkles themselves are clickable

  // Minimal style injection to guarantee clickability/visibility
  const style = document.createElement('style');
  style.textContent = `
    #${OVERLAY_ID} .sparkle {
      position: absolute;
      width: 1px; height: 1px;
      border-radius: 50%;
      background: rgba(254, 254, 253, 0.95);
      pointer-events: auto; /* direct clicks still work */
      cursor: pointer;
    }
    #${OVERLAY_ID} .sparkle.big { width: 2px; height: 2px; }
  `;
  document.head.appendChild(style);
}

/* =========================
   Sparkle builder (your look/feel)
========================= */
function buildSparkles({ count, overlay }) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle' + (Math.random() < 0.18 ? ' big' : '');
    s.setAttribute('role', 'link');
    s.tabIndex = 0; // keyboard-friendly

    // Position 0–100%
    s.style.left = (Math.random() * 100).toFixed(2) + '%';
    s.style.top  = (Math.random() * 100).toFixed(2) + '%';

    // Animation timing (your original custom props)
    s.style.setProperty('--delay', (Math.random() * 4).toFixed(2) + 's');
    s.style.setProperty('--dur',   (3 + Math.random() * 4).toFixed(2) + 's');

    // Glow intensity
    const glow = (1 + Math.random() * 3).toFixed(1);
    s.style.filter = `drop-shadow(0 0 ${glow}px rgba(246,198,46,.9))`;

    overlay.appendChild(s);
    stars.push(s);
  }
  return stars;
}

function assignStarIndices(stars) {
  stars.forEach((el, i) => {
    if (!el.dataset.starIndex) el.dataset.starIndex = String(i + 1);
  });
}

/* =========================
   Navigation
========================= */
function goToSlot(slotIndex) {
  const url = new URL(FEATURED_TARGET_PAGE, window.location.href);
  url.searchParams.set('slot', String(slotIndex));
  window.location.href = url.toString();
}

/* =========================
   Click wiring with fallback
========================= */
function wireDirectClicks(stars, slots) {
  const byIndex = new Map(slots.map(s => [String(s.slot_index), s]));
  const anyAssigned = slots.length > 0;

  for (const star of stars) {
    const idx = star.dataset.starIndex;
    const slot = byIndex.get(idx);

    if (slot?.label) star.title = slot.label;
    else if (anyAssigned) star.title = 'Discover a featured creator ✨';

    const activate = () => {
      if (slot) return goToSlot(slot.slot_index);
      if (anyAssigned) return goToSlot(pickRandom(slots).slot_index);
      // nothing assigned -> do nothing
    };

    star.addEventListener('click', (e) => { e.preventDefault(); activate(); }, { passive: true });
    star.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  }
}

/* =========================
   Proximity clicker
========================= */
function wireProximityClicks(overlay, stars, slots) {
  if (!stars.length) return;
  const rectOverlay = () => overlay.getBoundingClientRect();
  const byIndex = new Map(stars.map(st => [st, st.dataset.starIndex]));
  const slotsByStarIndex = new Map(slots.map(s => [String(s.slot_index), s]));
  const anyAssigned = slots.length > 0;
  const threshold = isTouch() ? PROXIMITY_PX_TOUCH : PROXIMITY_PX_DESKTOP;

  function nearestStar(clientX, clientY) {
    let best = null;
    let bestDist = Infinity;

    for (const st of stars) {
      const r = st.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) { bestDist = d; best = st; }
    }
    return { star: best, dist: bestDist };
  }

  // Capture click anywhere, but only act when click falls within overlay area
  document.addEventListener('click', (e) => {
    // Don’t override obvious interactions
    if (isInteractiveTarget(e.target)) return;

    // Only consider clicks within the overlay’s visible region
    const o = rectOverlay();
    if (e.clientX < o.left || e.clientX > o.right || e.clientY < o.top || e.clientY > o.bottom) {
      return;
    }

    const { star, dist } = nearestStar(e.clientX, e.clientY);
    if (!star || dist > threshold) return; // too far from any star

    const starIndex = byIndex.get(star);
    const slot = slotsByStarIndex.get(starIndex);

    e.preventDefault();

    if (slot) {
      goToSlot(slot.slot_index);
    } else if (anyAssigned) {
      goToSlot(pickRandom(slots).slot_index);
    }
    // else: no active slots → do nothing
  }, true); // capture phase so we can intercept before underlying links
}

/* =========================
   Main
========================= */
(async function initFeatured() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;

  ensureOverlayReady(overlay);

  // Prefetch active slots (anon allowed by RLS)
  let slots = [];
  try {
    const { data, error } = await supabase
      .from('featured_slots')
      .select('slot_index, user_id, label, starts_at, ends_at')
      .order('slot_index', { ascending: true });
    if (error) console.warn('featured_slots fetch error:', error);
    if (Array.isArray(data)) slots = data;
  } catch (err) {
    console.warn('featured_slots fetch failed:', err);
  }

  // Make enough stars to cover highest configured slot_index
  const maxSlotIdx = slots.length ? Math.max(...slots.map(s => s.slot_index)) : 0;
  const count = Math.max(DEFAULT_STAR_COUNT, maxSlotIdx);

  const stars = buildSparkles({ count, overlay });
  assignStarIndices(stars);

  // 1) Direct star clicks (exact hit)
  wireDirectClicks(stars, slots);

  // 2) Proximity clicks within overlay bounds
  wireProximityClicks(overlay, stars, slots);
})();
