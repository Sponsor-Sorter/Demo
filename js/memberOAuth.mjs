const MESSAGES = {
  OWNER_SESSION_REQUIRED: 'Sign in to your own verified Sponsor Sorter account, then start the connection again.',
  CONNECTION_RATE_LIMIT: 'Too many connection attempts. Wait before starting a new connection from Settings.',
  REAUTHORIZE_REQUIRED: 'This authorization attempt cannot be reused. Start a new connection from Settings.',
  OFFLINE_ACCESS_REQUIRED: 'The provider did not grant the required offline access. Start a new connection from Settings.',
  PROVIDER_SCOPE_REQUIRED: 'The provider did not grant the required permissions. Review the requested permissions when reconnecting.',
  YOUTUBE_CHANNEL_REQUIRED: 'A single YouTube channel must be available for this connection. Check your channel, then reconnect from Settings.',
  PROVIDER_CONFIGURATION_REQUIRED: 'Provider configuration needs review. Contact Sponsor Sorter support.',
  PROVIDER_IDENTITY_INVALID: 'The provider identity could not be verified. No connection success is confirmed.',
  PROVIDER_TOKEN_EXPIRED: 'The provider authorization expired. Start a new connection from Settings.',
  CONNECTION_SAVE_UNCONFIRMED: 'The connection could not be confirmed saved. Check Settings before reconnecting.',
  CONNECTION_OUTCOME_UNCONFIRMED: 'The connection outcome is unconfirmed. Check Settings before starting again. No automatic retry was made.',
  CONNECTION_UNAVAILABLE: 'Connecting this provider is temporarily unavailable. Check Settings and try again later.',
};
export function memberOAuthMessage(code) { return MESSAGES[code] || MESSAGES.CONNECTION_OUTCOME_UNCONFIRMED; }
function fail(code) { const error = Error(memberOAuthMessage(code)); error.code = code; return error; }
export function memberOAuthBody(provider, input) {
  if (!['youtube','twitch'].includes(provider) || !input || Object.keys(input).some(key => !['code','redirect_uri'].includes(key)) ||
      typeof input.code !== 'string' || input.code.length < 1 || input.code.length > 8192 || /\s/.test(input.code)) throw fail('REAUTHORIZE_REQUIRED');
  let url; try { url = new URL(input.redirect_uri); } catch { throw fail('REAUTHORIZE_REQUIRED'); }
  if (url.protocol !== 'https:' || !['sponsorsorter.com','www.sponsorsorter.com'].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash ||
      !['/oauth2callback.html','/Demo/oauth2callback.html'].includes(url.pathname)) throw fail('REAUTHORIZE_REQUIRED');
  return { code: input.code, redirect_uri: url.href };
}
export function validateMemberOAuth(data, provider) {
  if (data?.ok !== true || data.success !== true || data.connected !== true || data.provider !== provider ||
      typeof data.provider_user_id !== 'string' || data.provider_user_id.length < 1 || data.provider_user_id.length > 150 ||
      typeof data.handle !== 'string' || data.handle.length < 1 || data.handle.length > 200 || /[\x00-\x1f\x7f]/.test(data.handle)) throw fail('CONNECTION_OUTCOME_UNCONFIRMED');
  if ((provider === 'youtube' && !/^UC[A-Za-z0-9_-]{22}$/.test(data.provider_user_id)) ||
      (provider === 'twitch' && (!/^[0-9]{1,30}$/.test(data.provider_user_id) || !/^[a-z0-9_]{3,25}$/.test(data.handle)))) throw fail('PROVIDER_IDENTITY_INVALID');
  return { ok: true, success: true, connected: true, provider, provider_user_id: data.provider_user_id, handle: data.handle };
}
// Codes are exchanged once. State validation and URL stripping happen in the
// callback before entering this helper. Deadline includes session and error JSON.
export async function exchangeMemberOAuth(client, provider, input, options = {}) {
  const body = memberOAuthBody(provider, input);
  const controller = new AbortController(); let timer; let expired = false;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { expired = true; controller.abort(); reject(fail('CONNECTION_OUTCOME_UNCONFIRMED')); }, options.timeoutMs ?? 25000); });
  const task = async () => {
    const auth = await client.auth.getSession();
    if (expired) throw fail('CONNECTION_OUTCOME_UNCONFIRMED');
    const session = auth?.data?.session;
    if (auth?.error || !session?.access_token || !session?.user?.id || session.user.is_anonymous === true) throw fail('OWNER_SESSION_REQUIRED');
    const reply = await client.functions.invoke(`${provider}-oauth`, {
      method: 'POST', body, headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal,
    });
    if (expired) throw fail('CONNECTION_OUTCOME_UNCONFIRMED');
    if (reply?.error || (reply?.response && !reply.response.ok)) {
      let details = reply?.data;
      if (!details && reply?.error?.context?.json) try { details = await reply.error.context.json(); } catch {}
      if (expired) throw fail('CONNECTION_OUTCOME_UNCONFIRMED');
      throw fail(Object.hasOwn(MESSAGES, details?.code) ? details.code : 'CONNECTION_OUTCOME_UNCONFIRMED');
    }
    return { ok: true, status: 200, payload: validateMemberOAuth(reply?.data, provider) };
  };
  try { return await Promise.race([task(), deadline]); }
  catch (error) { throw fail(Object.hasOwn(MESSAGES, error?.code) ? error.code : 'CONNECTION_OUTCOME_UNCONFIRMED'); }
  finally { clearTimeout(timer); }
}
