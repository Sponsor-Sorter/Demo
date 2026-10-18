const NAMES = { youtube: 'YouTube', twitch: 'Twitch', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' };
const hiddenChildren = new WeakMap();
export function publicProviderAvailable(info) {
  return info?.connected === true && info.available === true && info.state === 'available';
}
export function publicTwitchStatus(info) {
  if (!publicProviderAvailable(info) || typeof info.is_live !== 'boolean') return 'Unknown';
  return info.is_live ? 'Live now' : 'Offline';
}
export function publicCount(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
export function publicSnapshotTime(payload) {
  if (typeof payload?.fetched_at !== 'string') return null;
  const time = Date.parse(payload.fetched_at);
  return Number.isFinite(time) ? payload.fetched_at : null;
}
export function publicSnapshotLabel(payload, now = Date.now()) {
  const stamp = publicSnapshotTime(payload);
  const time = stamp && Date.parse(stamp);
  if (!stamp || !Number.isFinite(now) || time > now + 60000) return 'Snapshot time unknown.';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  const age = minutes < 1 ? 'less than a minute old' : `${minutes} minute${minutes === 1 ? '' : 's'} old`;
  return `${payload.cache_hit === true ? 'Cached snapshot' : 'Snapshot'} fetched ${new Date(time).toLocaleString(undefined, { timeZoneName: 'short' })} · ${age}.`;
}
export function publicAudienceSummary(payload) {
  let knownTotal = 0, connected = 0, unknown = payload?.ok !== true;
  for (const provider of Object.keys(NAMES)) {
    const info = payload?.[provider];
    if (!info || typeof info.connected !== 'boolean') { unknown = true; continue; }
    if (!info.connected) continue;
    connected++;
    const value = publicProviderAvailable(info) ? publicCount(provider === 'youtube'
      ? info.subscriber_count ?? info.subscribers ?? info.follower_count ?? info.followers
      : info.follower_count ?? info.followers) : null;
    if (value === null) unknown = true;
    else knownTotal += value;
  }
  return { connected, total: unknown ? null : knownTotal, knownTotal, unknown };
}
// Hide legacy values/media as a unit when their availability is unconfirmed.
// Keep the connection flag distinct from whether public statistics are available.
export function presentPublicProvider(card, provider, info, payload, now = Date.now()) {
  if (!card) return false;
  let notice = Array.from(card.children).find(child => child.dataset?.publicProviderNotice === 'true');
  if (!notice) {
    notice = card.ownerDocument.createElement('p');
    notice.dataset.publicProviderNotice = 'true';
    notice.setAttribute('role', 'status');
    card.appendChild(notice);
  }
  const available = payload?.ok === true && publicProviderAvailable(info);
  card.style.display = info?.connected === false ? 'none' : '';
  if (!available) {
    if (!hiddenChildren.has(card)) hiddenChildren.set(card, Array.from(card.children).filter(child => child !== notice).map(child => [child, child.style.display]));
    for (const [child] of hiddenChildren.get(card)) child.style.display = 'none';
  } else if (hiddenChildren.has(card)) {
    for (const [child, display] of hiddenChildren.get(card)) child.style.display = display;
    hiddenChildren.delete(card);
  }
  const state = info?.connected === true ? 'Linked' : info?.connected === false ? 'Not linked' : 'Connection status unknown';
  const availability = available ? 'Public statistics available.' : info?.state === 'meta_pending'
    ? 'Public statistics unknown: Meta review pending. The connection is preserved.'
    : 'Public statistics unavailable; values and live status are unknown.';
  notice.textContent = `${NAMES[provider] || 'Platform'} · ${state}. ${availability} ${publicSnapshotLabel(payload, now)}`;
  return available;
}
// Public endpoint: SDK supplies the publishable key/current session if present.
// No forced refresh, provider credentials, retry or reconnection is requested.
export async function readPublicStats(client, username, options = {}) {
  if (typeof username !== 'string' || !username.trim() || username.length > 120) throw Error('Public statistics unavailable.');
  const controller = new AbortController(); let timer; let expired = false;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { expired = true; controller.abort(); reject(Error('Public statistics unavailable.')); }, options.timeoutMs ?? 25000); });
  const task = async () => {
    const reply = await client.functions.invoke('get-profile-live-stats', { body: { username }, signal: controller.signal });
    if (expired || reply?.error || (reply?.response && !reply.response.ok)) throw Error();
    const payload = reply?.data;
    if (payload?.ok !== true || typeof payload.partial !== 'boolean' || typeof payload.complete !== 'boolean' || typeof payload.cache_hit !== 'boolean' || !publicSnapshotTime(payload)) throw Error();
    return payload;
  };
  try { return await Promise.race([task(), deadline]); }
  catch { throw Error('Public statistics unavailable.'); }
  finally { clearTimeout(timer); }
}
