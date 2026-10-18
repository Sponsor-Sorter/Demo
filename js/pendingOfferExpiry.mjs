export function sydneyDate(now = Date.now()) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('The current date could not be confirmed.');
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function validDeadline(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function pendingOfferAvailability(offer, now = Date.now()) {
  const result = (canAccept, reason, message = null) => ({ canAccept, reason, message });
  if (Number(offer?.stage) !== 1) return result(false, 'not_pending');
  if (offer.expired_at != null) return result(false, 'expired', 'This offer has expired and can no longer be accepted. No refund is confirmed by this status.');
  if (offer.status !== 'pending') return result(false, 'not_pending');
  if (offer.active !== true || offer.archived !== false) return result(false, 'unavailable', 'This offer is not available for acceptance. Reload it or contact support.');
  if (!validDeadline(offer.deadline)) return result(false, 'invalid_deadline', 'The offer deadline could not be confirmed. This offer cannot be accepted; contact your sponsor or support.');
  let today;
  try { today = sydneyDate(now); }
  catch { return result(false, 'date_unavailable', 'The current date could not be confirmed. Reload before accepting this offer.'); }
  if (offer.deadline < today) return result(false, 'deadline_passed', 'The offer deadline has passed in Australia/Sydney. This offer can no longer be accepted. Refund status is handled separately.');
  return result(true, 'available', `This offer can be accepted through ${offer.deadline}, Australia/Sydney time. The server confirms availability when you accept.`);
}

// Read only. The server independently serializes the final pending→accepted transition.
export async function readPendingAcceptance(client, offerId, now) {
  const { data, error } = await client.from('private_offers')
    .select('id,stage,status,active,archived,expired_at,deadline').eq('id', offerId).single();
  if (error || !data || String(data.id) !== String(offerId)) throw new Error('Offer availability could not be confirmed. Reload before accepting.');
  return pendingOfferAvailability(data, now === undefined ? Date.now() : now);
}

export function mountPendingExpiryNotice(card, offer) {
  const state = pendingOfferAvailability(offer);
  if (!state.message || card.querySelector('.pending-expiry-notice')) return;
  const notice = document.createElement('aside');
  notice.className = 'pending-expiry-notice';
  notice.setAttribute('role', 'status');
  notice.style.cssText = 'padding:12px;margin:10px 0;border:1px solid #487285;border-radius:8px;overflow-wrap:anywhere;';
  notice.textContent = state.message;
  (card.querySelector('.card-bottom') || card).prepend(notice);
}
