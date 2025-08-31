// /public/js/followersTotal.js
// Aggregates per-platform followers and persists a per-user total to Supabase
import { supabase } from './supabaseClient.js';

const totals = {
  youtube: 0,
  twitch: 0,
  instagram: 0,
  facebook: 0,
  tiktok: 0,   // future-proof
  twitter: 0   // future-proof
};

function toInt(n) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function sumTotals() {
  return Object.values(totals).reduce((a, b) => a + b, 0);
}

function render() {
  const el = document.getElementById('total-followers');
  if (!el) return;
  el.textContent = sumTotals().toLocaleString();
  el.title = `Combined audience across linked accounts (not deduped)`;
}

/* ---------- persistence (debounced) ---------- */
let persistTimer = null;
let lastPayloadHash = '';
let cachedUsername = null;

async function getUsernameOnce(userId) {
  if (cachedUsername !== null) return cachedUsername;
  const { data } = await supabase
    .from('users_extended_data')
    .select('username')
    .eq('user_id', userId)
    .single();
  cachedUsername = data?.username ?? null;
  return cachedUsername;
}

function hash(obj) {
  try { return JSON.stringify(obj); } catch { return ''; }
}

async function persistFollowersTotals() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return; // not signed in

    const payload = {
      user_id: user.id,
      email: user.email ?? null,
      username: await getUsernameOnce(user.id),
      youtube_followers: totals.youtube,
      twitch_followers: totals.twitch,
      instagram_followers: totals.instagram,
      facebook_followers: totals.facebook,
      tiktok_followers: totals.tiktok,
      twitter_followers: totals.twitter,
      total_followers: sumTotals(),
      last_updated: new Date().toISOString()
    };

    const newHash = hash(payload);
    if (newHash === lastPayloadHash) return; // nothing changed since last write
    lastPayloadHash = newHash;

    // One-row-per-user, so we upsert on user_id
    const { error } = await supabase
      .from('user_social_followers')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      // Don't throw; persistence must never break the UI
      console.warn('followersTotal: upsert failed', error);
    }
  } catch (e) {
    console.warn('followersTotal: persist error', e);
  }
}

function queuePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistFollowersTotals, 1500);
}

/* ---------- public API ---------- */
export function updateFollowersTotal(source, count) {
  totals[source] = toInt(count);
  render();
  queuePersist(); // write shortly after changes settle
}

// Optional manual flush if you ever want to force a write
export async function flushFollowersTotals() {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  await persistFollowersTotals();
}

// Expose for non-module code if needed
window.__followersTotal = {
  update: updateFollowersTotal,
  flush: flushFollowersTotals
};

// Render once on load; if anything sets counts later, render() will update again.
document.addEventListener('DOMContentLoaded', render);
