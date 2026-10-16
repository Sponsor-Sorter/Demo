// Shared client boundary for the four Instagram/Facebook Content Performance calls.
// No retries; the deadline includes reading the response body.
export const SOCIAL_REQUEST_TIMEOUT_MS = 10000;
function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
export function socialRequestFailureText(error) {
  const messages = {
    SOCIAL_AUTH: 'Your session could not be verified. Sign in again to refresh live stats.',
    SOCIAL_TIMEOUT: 'The live stats request timed out. Please try again later.',
    SOCIAL_RESPONSE: 'The live stats service returned an unreadable response.',
    SOCIAL_NETWORK: 'The live stats service could not be reached.'
  };
  return Object.hasOwn(messages, error?.code) ? messages[error.code] : '';
}
export async function readSocialSession(supabase, { timeoutMs = SOCIAL_REQUEST_TIMEOUT_MS } = {}) {
  let timer;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => supabase.auth.getSession()),
      new Promise((_, reject) => { timer = setTimeout(() => reject(failure('SOCIAL_AUTH')), timeoutMs); })
    ]);
    const token = result?.data?.session?.access_token;
    if (result?.error || typeof token !== 'string' || !token.trim() || ['undefined', 'null'].includes(token.trim())) return { token: null };
    return { token };
  } catch {
    return { token: null };
  } finally {
    clearTimeout(timer);
  }
}
export async function requestSocialMetrics(session, endpoint, body, {
  fetchImpl = globalThis.fetch, timeoutMs = SOCIAL_REQUEST_TIMEOUT_MS
} = {}) {
  if (typeof session?.token !== 'string' || !session.token.trim() || ['undefined', 'null'].includes(session.token.trim())) throw failure('SOCIAL_AUTH');
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(async () => {
        if (controller.signal.aborted) throw failure('SOCIAL_TIMEOUT');
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (response.status === 401 || response.status === 403) throw failure('SOCIAL_AUTH');
        let data;
        try { data = await response.json(); } catch { throw failure('SOCIAL_RESPONSE'); }
        return { ok: response.ok, status: response.status, json: async () => data };
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(failure('SOCIAL_TIMEOUT')); }, timeoutMs);
      })
    ]);
  } catch (error) {
    if (controller.signal.aborted) throw failure('SOCIAL_TIMEOUT');
    if (socialRequestFailureText(error)) throw error;
    throw failure('SOCIAL_NETWORK');
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
export function observedSocialMetric(value) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER ? number : null;
}
export function instagramSnapshotMetrics(media = {}, insights = {}) {
  return {
    likes: observedSocialMetric(media.like_count),
    comments: observedSocialMetric(media.comments_count),
    video_views: observedSocialMetric(media.video_views),
    impressions: observedSocialMetric(insights.impressions),
    reach: observedSocialMetric(insights.reach),
    saved: observedSocialMetric(insights.saved),
    engagement: observedSocialMetric(insights.engagement)
  };
}
