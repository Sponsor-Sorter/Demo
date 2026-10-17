export function needsConfirmationNotice(offer) {
  return Number(offer?.stage) === 4 && !(offer.sponsor_live_confirmed || offer.sponsor_live_confirm);
}

export function confirmationNoticeModel(info, role) {
  if (info?.ok !== true) throw new Error('Confirmation status unavailable');
  if (info.paused) return { text: 'Automatic confirmation is paused while this submission is reviewed.', canRequest: false };
  if (info.auto_confirmed) return { text: 'This submission was automatically confirmed.', canRequest: false };
  if (!info.waiting) return null;
  if (!info.due_at || !Number.isFinite(Date.parse(info.due_at))) throw new Error('Confirmation deadline unavailable');
  const due = new Date(info.due_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return {
    text: `Eligible for automatic confirmation after ${due}; checked daily. A review may pause confirmation.`,
    canRequest: role === 'sponsor',
  };
}

async function timedRpc(client, name, body, timeoutMs = 12000) {
  let timer;
  try {
    const result = await Promise.race([
      client.rpc(name, body),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Confirmation request timed out')), timeoutMs); }),
    ]);
    if (result.error || !result.data || result.data.ok !== true) throw new Error('Confirmation request unavailable');
    return result.data;
  } finally { clearTimeout(timer); }
}

export async function readAutoConfirmation(client, offerId) {
  const info = await timedRpc(client, 'get_offer_auto_confirmation', { p_offer_id: offerId });
  if (String(info.offer_id) !== String(offerId)) throw new Error('Confirmation response mismatch');
  return info;
}

export async function pauseAutoConfirmation(client, offerId, requestId) {
  return timedRpc(client, 'pause_offer_auto_confirmation', { p_offer_id: offerId, p_request_id: requestId });
}

export async function mountAutoConfirmationNotice({ client, card, offer, role }) {
  if (!needsConfirmationNotice(offer) || card.querySelector('.offer-confirmation-notice')) return;
  const notice = document.createElement('aside');
  notice.className = 'offer-confirmation-notice';
  notice.setAttribute('aria-label', 'Content confirmation');
  notice.style.cssText = 'padding:12px;margin:10px 0;border:1px solid #487285;border-radius:8px;background:#101c26;color:#e4eef5;overflow-wrap:anywhere;';
  (card.querySelector('.card-bottom') || card).prepend(notice);
  notice.textContent = 'Checking confirmation timing…';
  try {
    let info = await readAutoConfirmation(client, offer.id);
    if (!card.isConnected) return;
    const render = () => {
      const model = confirmationNoticeModel(info, role);
      notice.replaceChildren();
      if (!model) { notice.remove(); return; }
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = model.text;
      const payment = document.createElement('p');
      payment.textContent = 'Payment release is handled separately.';
      notice.append(status, payment);
      if (!model.canRequest) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Request review';
      button.style.cssText = 'min-height:44px;white-space:normal;';
      let requestId;
      button.addEventListener('click', async event => {
        event.stopPropagation();
        if (button.disabled || !window.confirm('Request review and pause automatic confirmation for this submission?')) return;
        button.disabled = true;
        try {
          requestId ||= crypto.randomUUID();
          const result = await pauseAutoConfirmation(client, offer.id, requestId);
          if (!card.isConnected) return;
          if (result.state === 'paused') { info = { ...info, paused: true }; render(); }
          else if (result.state === 'superseded') {
            status.textContent = 'This submission has changed. Reload the campaign before requesting review.';
          } else throw new Error('Review status unavailable');
        } catch {
          status.textContent = 'The review request could not be confirmed. Reload this campaign to check its status before trying again.';
          button.disabled = false;
        }
      });
      notice.append(button);
    };
    render();
  } catch {
    if (card.isConnected) notice.textContent = 'Confirmation timing is currently unavailable. You can still review the content manually.';
  }
}
