const UNAVAILABLE = Object.freeze({ status: 'unavailable' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Signup checks never apply member strikes or account penalties.
export async function moderateSignupWithFamBot(client, content, { request_id } = {}) {
  if (!client?.functions || typeof client.functions.invoke !== 'function' || typeof content !== 'string') return UNAVAILABLE;
  const normalized = content.normalize('NFC').trim();
  if (!normalized || [...normalized].length > 12000) return UNAVAILABLE;
  const requestId = request_id ?? globalThis.crypto?.randomUUID?.();
  if (typeof requestId !== 'string' || !UUID.test(requestId)) return UNAVAILABLE;
  const body = { user_id: null, content: normalized, request_id: requestId };
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 65536) return UNAVAILABLE;
  const controller = new AbortController();
  let timer;
  try {
    // The deadline also covers SDK response parsing and clients that ignore abort.
    const deadline = new Promise(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(null); }, 25000);
    });
    const reply = await Promise.race([
      Promise.resolve().then(() => client.functions.invoke('FamBotSignup', { body, signal: controller.signal })),
      deadline,
    ]);
    const data = reply?.data;
    if (!reply || reply.error || !data || typeof data !== 'object' || Array.isArray(data) ||
        data.ok !== true || typeof data.flagged !== 'boolean' || data.allowed !== !data.flagged ||
        data.account_penalty !== false || !Array.isArray(data.flaggedCategories) ||
        !data.flaggedCategories.every(category => typeof category === 'string') ||
        typeof data.check_id !== 'string' || !UUID.test(data.check_id) ||
        data.policy_version !== 'signup-moderation-v1' || typeof data.replayed !== 'boolean') return UNAVAILABLE;
    return { status: data.flagged ? 'blocked' : 'allowed', result: data };
  } catch {
    return UNAVAILABLE;
  } finally {
    clearTimeout(timer);
  }
}
