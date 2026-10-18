const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGES = {
  META_DISCONNECT_REVIEW_REQUIRED: 'Instagram and Facebook share a Meta permission grant. Disconnect needs review so another connection is not unintentionally affected. Your connection has been preserved.',
  SIGN_IN_REQUIRED: 'Sign in again before disconnecting a platform.',
  OWNER_REQUIRED: 'Switch back to your own account before disconnecting a platform.',
  PROVIDER_REVOKE_UNCONFIRMED: 'The provider did not confirm revocation. The Website has not confirmed unlinking. Check Settings before trying again.',
  PROVIDER_CONFIGURATION_REQUIRED: 'Platform disconnection needs a server configuration update. Your connection has been preserved. Contact support.',
  OWNER_SESSION_REQUIRED: 'Sign in to your own verified account before disconnecting a platform.',
  DISCONNECT_REVIEW_REQUIRED: 'This disconnect operation needs review. Your Website connection has been preserved. Contact support.',
  UNLINK_REVIEW_REQUIRED: 'The provider and Website connection could not be reconciled. Reload Settings and contact support before reconnecting.',
  DISCONNECT_OUTCOME_UNCONFIRMED: 'The outcome is unconfirmed. Check Settings before trying again. No automatic retry was made.',
  CONNECTION_CHANGED: 'Your connection changed during the request. Reload its current status before trying again.',
  STORAGE_UNAVAILABLE: 'The disconnect request could not be saved safely. Enable browser session storage before trying again.',
  DISCONNECT_UNCONFIRMED: 'Disconnection could not be confirmed. Check the current connection status before trying again. No automatic retry was made.',
};
export function disconnectMessage(code) { return MESSAGES[code] || MESSAGES.DISCONNECT_UNCONFIRMED; }
function fail(code) { const error = new Error(disconnectMessage(code)); error.code = code; return error; }
export function validateDisconnect(data, platform) {
  if (data?.ok !== true || data.platform !== platform || data.db_updated !== true || data.local_unlinked !== true ||
      typeof data.provider_revoked !== 'boolean' || !['revoked_and_unlinked','already_unlinked'].includes(data.state) ||
      (data.state === 'revoked_and_unlinked' && data.provider_revoked !== true)) throw fail('DISCONNECT_UNCONFIRMED');
  return { ok: true, platform, db_updated: true, local_unlinked: true, provider_revoked: data.provider_revoked, state: data.state };
}
// Persist only the operation UUID, scoped to actor and provider. No credentials.
// Keep it after an ambiguous failure; clear only after strict confirmed success.
export async function disconnectProvider(client, platform, expectedActor, options = {}) {
  if (['instagram','facebook'].includes(platform)) throw fail('META_DISCONNECT_REVIEW_REQUIRED');
  if (!['youtube','twitch','tiktok'].includes(platform) || !UUID.test(expectedActor)) throw fail('OWNER_REQUIRED');
  const controller = new AbortController(); let timer; let expired = false;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { expired = true; controller.abort(); reject(fail('DISCONNECT_UNCONFIRMED')); }, options.timeoutMs ?? 25000); });
  const task = async () => {
    const auth = await client.auth.getSession();
    if (expired) throw fail('DISCONNECT_UNCONFIRMED');
    const session = auth?.data?.session;
    if (auth?.error || !session?.access_token || !UUID.test(session?.user?.id)) throw fail('SIGN_IN_REQUIRED');
    if (session.user.id !== expectedActor) throw fail('OWNER_REQUIRED');
    let storage; let requestId;
    const key = `ss-disconnect-v1:${session.user.id}:${platform}`;
    try {
      storage = options.storage ?? globalThis.sessionStorage;
      requestId = storage.getItem(key);
      if (!UUID.test(requestId || '')) { requestId = crypto.randomUUID(); storage.setItem(key, requestId); }
      if (storage.getItem(key) !== requestId) throw Error();
    } catch { throw fail('STORAGE_UNAVAILABLE'); }
    if (expired) throw fail('DISCONNECT_UNCONFIRMED');
    const reply = await client.functions.invoke('revoke_platforms', {
      method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
      body: { platform, request_id: requestId }, signal: controller.signal,
    });
    if (expired) throw fail('DISCONNECT_UNCONFIRMED');
    if (reply?.error || (reply?.response && !reply.response.ok)) {
      let details = reply?.data;
      if (!details && reply?.error?.context?.json) try { details = await reply.error.context.json(); } catch {}
      if (expired) throw fail('DISCONNECT_UNCONFIRMED');
      throw fail(Object.hasOwn(MESSAGES, details?.code) ? details.code : 'DISCONNECT_UNCONFIRMED');
    }
    const result = validateDisconnect(reply?.data, platform);
    try { storage.removeItem(key); } catch { /* Server success remains authoritative. */ }
    return result;
  };
  try { return await Promise.race([task(), deadline]); }
  catch (error) { throw fail(Object.hasOwn(MESSAGES, error?.code) ? error.code : 'DISCONNECT_UNCONFIRMED'); }
  finally { clearTimeout(timer); }
}
