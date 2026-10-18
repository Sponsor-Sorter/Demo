import { sydneyDate } from './pendingOfferExpiry.mjs';
export { sydneyDate };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requests = new Map();
const messages = {
  FUNDING_REVIEW_REQUIRED: 'Funding for this public application needs review. No application was accepted and no private offer or payment was created. Contact support.',
  OFFER_UNAVAILABLE: 'This public offer is closed or its Sydney deadline has passed. Your application history is retained.',
  APPLICATION_UNAVAILABLE: 'This application is no longer pending. Reload its current status.',
  OFFER_FULL: 'This public offer has no remaining places.',
  ALREADY_APPLIED: 'You have already applied for this public offer.',
  MONTHLY_APPLICATION_LIMIT: 'Free accounts can submit 10 public applications per Sydney calendar month. Removing an application does not reset this limit.',
  CREATOR_ACTIVE_LIMIT: 'This creator has reached the Free plan active sponsorship limit.',
  CURRENT_SESSION_REQUIRED: 'Sign in again before submitting this request.',
  OFFER_OWNER_REQUIRED: 'Only the current sponsor can review this application.',
  CREATOR_REQUIRED: 'A verified creator account is required to apply.',
  CREATOR_UNAVAILABLE: 'This creator is currently unavailable for acceptance.',
  REQUEST_ID_REUSED: 'This request could not be confirmed. Reload and contact support.',
};
export function publicOfferMessage(code) {
  return messages[code] || 'The public offer request could not be confirmed. Reload its current status before trying again.';
}
export function publicOfferAvailability(offer, now = Date.now()) {
  const unavailable = message => ({ available: false, message });
  if (offer?.status === 'expired') return unavailable('Public listing expired. Applications and accepted private work are retained. This status does not confirm a refund.');
  if (offer?.status !== 'open') return unavailable('Public listing closed. Application history and accepted private work are retained.');
  const value = offer.deadline;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return unavailable('The public listing deadline could not be confirmed. Applications and acceptance are unavailable.');
  try { if (value < sydneyDate(now)) return unavailable('The public listing deadline has passed in Australia/Sydney. Applications and accepted private work are retained. This does not confirm a refund.'); }
  catch { return unavailable('The current date could not be confirmed. Reload before applying.'); }
  return { available: true, message: '' };
}

// One whole deadline, no automatic retry. The same in-memory action retains its
// request UUID after an ambiguous response; server replay prevents duplicate work.
export async function publicOfferRequest(client, operation, targetId, text = '', options = {}) {
  if (!['apply', 'accept'].includes(operation) || !UUID.test(targetId) || typeof text !== 'string' || [...text].length > 450) throw new Error('Invalid public application request.');
  const controller = new AbortController();
  let expired = false;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { expired = true; controller.abort(); reject(new Error('The outcome is unconfirmed. Check your application status before retrying. No automatic retry was made.')); }, options.timeoutMs ?? 25000);
  });
  const task = async () => {
    const { data, error } = await client.auth.getSession();
    if (expired) throw new Error('Request timed out.');
    const session = data?.session;
    if (error || !UUID.test(session?.user?.id) || !session?.access_token) throw new Error(publicOfferMessage('CURRENT_SESSION_REQUIRED'));
    const key = JSON.stringify([session.user.id, operation, targetId, text]);
    let requestId = requests.get(key);
    if (!requestId) { requestId = crypto.randomUUID(); requests.set(key, requestId); }
    if (expired) throw new Error('Request timed out.');
    const args = operation === 'apply'
      ? { p_offer_id: targetId, p_application_text: text, p_request_id: requestId }
      : { p_application_id: targetId, p_request_id: requestId };
    const response = await client.rpc(operation === 'apply' ? 'apply_to_public_offer' : 'accept_public_offer_application', args).abortSignal(controller.signal);
    if (expired) throw new Error('Request timed out.');
    if (response.error) {
      const code = Object.hasOwn(messages, response.error.message) ? response.error.message : response.error.code === '42501' ? 'CURRENT_SESSION_REQUIRED' : null;
      throw new Error(publicOfferMessage(code));
    }
    const result = response.data;
    if (!result || typeof result.ok !== 'boolean' || (result.ok && !UUID.test(result.application_id)) || (!result.ok && typeof result.code !== 'string')) throw new Error(publicOfferMessage());
    return result;
  };
  try { return await Promise.race([task(), timeout]); }
  finally { clearTimeout(timer); }
}
