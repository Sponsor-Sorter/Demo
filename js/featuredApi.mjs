export const featuredEndpoint = 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/assign-featured-star';

export async function requestFeatured({ action, body, token, fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        if (body && !token) throw new Error('Please sign in to continue.');
        const response = await fetchImpl(featuredEndpoint + (action ? `?action=${encodeURIComponent(action)}` : ''), {
          method: body ? 'POST' : 'GET', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await response.json();
        if (!response.ok || !data || data.ok !== true || Array.isArray(data)) throw new Error('Featured accounts are temporarily unavailable.');
        return data;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Featured request timed out. Check its status before trying again.')); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function activeFeaturedSlots(payload, origin, now = Date.now()) {
  if (!Array.isArray(payload?.slots)) throw new Error('Featured account list is unavailable.');
  const seen = new Set();
  return payload.slots.filter(slot => {
    if (!Number.isInteger(slot?.slot_index) || slot.slot_index < 1 || seen.has(slot.slot_index) || !slot.user_id || !slot.profile?.username) return false;
    if (!(Date.parse(slot.starts_at) <= now && Date.parse(slot.ends_at) > now)) return false;
    try {
      const url = new URL(slot.profile_url, origin);
      if (url.origin !== origin || url.pathname !== '/u/index.html' || !url.searchParams.get('u')) return false;
    } catch { return false; }
    seen.add(slot.slot_index);
    return true;
  }).sort((a, b) => a.slot_index - b.slot_index);
}
