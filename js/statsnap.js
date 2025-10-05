// ./js/statsnap.js
//
// Lightweight snapshot helper:
// - Normalizes URL & detects platform
// - On LIVE success: saves/refreshes snapshot only when metrics changed
// - On LIVE failure: returns cached snapshot (if any) for display
//
// Usage:
//   import { statsnapSaveAfterSuccess, statsnapFallback } from './js/statsnap.js';
//
//   try {
//     const { metrics, raw } = await fetchLiveStatsSomewhere(url); // your existing call
//     await statsnapSaveAfterSuccess({ originalUrl: url, platformHint: 'youtube', offerId, liveMetrics: metrics, raw });
//     render(metrics, 'live');
//   } catch (e) {
//     const fb = await statsnapFallback({ originalUrl: url, platformHint: 'youtube' });
//     if (fb) render(fb.metrics, 'snapshot'); else showUnavailable();
//   }
//
// Paths: follow project rule (relative ./js/*)

import { supabase } from './supabaseClient.js';

/* ------------ URL normalization & platform detection ------------ */
function stripTrackingParams(u) {
  const drop = new Set([
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
    'gclid','fbclid','igshid','mc_cid','mc_eid'
  ]);
  [...u.searchParams.keys()].forEach(k => {
    if (k.startsWith('utm_') || drop.has(k)) u.searchParams.delete(k);
  });
}
function sortSearchParams(u) {
  const entries = [...u.searchParams.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  u.search = '';
  for (const [k,v] of entries) u.searchParams.append(k,v);
}
function canonicalYouTube(u) {
  const h = u.hostname.toLowerCase();
  let id = null;
  if (h.includes('youtu.be')) {
    id = u.pathname.replace(/^\/+/, '').split('/')[0] || null;
  } else if (h.includes('youtube.com')) {
    const p = u.pathname;
    if (p.startsWith('/shorts/')) id = p.split('/')[2] || null;
    if (!id) id = u.searchParams.get('v');
  }
  if (id) {
    const n = new URL('https://www.youtube.com/watch');
    n.searchParams.set('v', id);
    return n;
  }
  return u;
}
export function normalizeUrl(original) {
  let u;
  try { u = new URL(original); } catch { return String(original || '').trim(); }
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  stripTrackingParams(u);
  sortSearchParams(u);
  if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
    u = canonicalYouTube(u);
  }
  if (u.pathname !== '/' && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/,'');
  }
  return u.toString();
}
export function detectPlatform(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
    if (h.includes('tiktok.com')) return 'tiktok';
    if (h.includes('instagram.com')) return 'instagram';
    if (h.includes('facebook.com')) return 'facebook';
    if (h.includes('twitch.tv')) return 'twitch';
  } catch {}
  return 'unknown';
}

/* --------------------- hashing for change-detect --------------------- */
function stableStringify(obj){
  if (obj==null) return 'null';
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  if (typeof obj==='object'){
    const keys = Object.keys(obj).sort();
    return `{${keys.map(k=>JSON.stringify(k)+':'+stableStringify(obj[k])).join(',')}}`;
  }
  return JSON.stringify(obj);
}
async function sha256Hex(txt){
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(txt);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  // tiny fallback (non-crypto)
  let h=5381; for (let i=0;i<txt.length;i++) h=((h<<5)+h)^txt.charCodeAt(i);
  return ('00000000'+(h>>>0).toString(16)).slice(-8);
}

/* -------------------------- DB helpers -------------------------- */
async function getSnapshotRow(normalized_url, platform){
  const { data, error } = await supabase
    .from('stats_snapshot')
    .select('*')
    .eq('normalized_url', normalized_url)
    .eq('platform', platform)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
async function upsertSnapshot(payload){
  const { data, error } = await supabase
    .from('stats_snapshot')
    .upsert(payload, { onConflict: 'normalized_url,platform' })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* -------------------------- Public API -------------------------- */
/**
 * Call immediately after your LIVE fetch succeeds.
 * @param {object} p
 * @param {string} p.originalUrl
 * @param {string=} p.platformHint
 * @param {string=} p.offerId
 * @param {object} p.liveMetrics  e.g. { views, likes, comments, ... }
 * @param {object=} p.raw         full raw payload from your live call
 */
export async function statsnapSaveAfterSuccess({ originalUrl, platformHint, offerId = null, liveMetrics, raw }){
  const normalized_url = normalizeUrl(originalUrl);
  const platform = platformHint || detectPlatform(normalized_url);
  const forHash = { platform, url: normalized_url, metrics: liveMetrics || {} };
  const metrics_hash = await sha256Hex(stableStringify(forHash));
  const now = new Date().toISOString();

  // who updated?
  const { data: s } = await supabase.auth.getSession();
  const updated_by = s?.session?.user?.id || null;

  try {
    const existing = await getSnapshotRow(normalized_url, platform);
    if (!existing || existing.metrics_hash !== metrics_hash) {
      return await upsertSnapshot({
        normalized_url,
        platform,
        offer_id: existing?.offer_id ?? offerId,
        last_stats: raw ?? { metrics: liveMetrics || {} },
        metrics_hash,
        last_success_at: now,
        last_checked_at: now,
        last_error: null,
        updated_by
      });
    } else {
      // touch checked time (no metrics change)
      return await upsertSnapshot({
        normalized_url,
        platform,
        offer_id: existing.offer_id ?? offerId,
        last_stats: existing.last_stats,
        metrics_hash: existing.metrics_hash,
        last_success_at: existing.last_success_at,
        last_checked_at: now,
        last_error: null,
        updated_by
      });
    }
  } catch (e) {
    console.warn('[statsnapSaveAfterSuccess] upsert failed:', e);
    return null; // non-blocking
  }
}

/**
 * Call when your LIVE fetch fails; returns cached stats if available.
 * @param {object} p
 * @param {string} p.originalUrl
 * @param {string=} p.platformHint
 * @returns {null|{metrics:object, raw:object, platform:string, normalized_url:string, snapshotRow:object}}
 */
export async function statsnapFallback({ originalUrl, platformHint }){
  const normalized_url = normalizeUrl(originalUrl);
  const platform = platformHint || detectPlatform(normalized_url);
  const checkedAt = new Date().toISOString();

  try {
    const row = await getSnapshotRow(normalized_url, platform);
    if (!row?.last_stats) return null;

    // Derive a light metrics object for convenience (map common fields)
    const raw = row.last_stats || {};
    const metrics = {
      views: Number(raw?.viewCount ?? raw?.views ?? raw?.statistics?.viewCount ?? 0) || 0,
      likes: Number(raw?.likeCount ?? raw?.likes ?? raw?.statistics?.likeCount ?? 0) || 0,
      comments: Number(raw?.commentCount ?? raw?.comments ?? raw?.statistics?.commentCount ?? 0) || 0
    };

    // touch checked + record that we served snapshot (optional)
    await upsertSnapshot({
      normalized_url,
      platform,
      offer_id: row.offer_id ?? null,
      last_stats: row.last_stats,
      metrics_hash: row.metrics_hash,
      last_success_at: row.last_success_at,
      last_checked_at: checkedAt,
      last_error: row.last_error || 'served from snapshot (live fetch failed upstream)',
      updated_by: row.updated_by ?? null
    });

    return { metrics, raw, snapshotRow: row, platform, normalized_url };
  } catch (e) {
    console.warn('[statsnapFallback] read failed:', e);
    return null;
  }
}
