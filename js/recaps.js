// Completed campaign reports use the real session; display impersonation is not authorization.
import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';
import { loadCampaignRecap } from './campaignRecapClient.mjs?v=20261018-recap1';

const FIELDS = 'id,offer_title,offer_amount,stage,status,sponsee_id,sponsee_username,sponsee_email,sponsor_id,sponsor_username,sponsor_email';
export function isCompletedForRecap(offer) {
  return Number(offer.stage) === 5 || ['completed','review_completed','review-completed'].includes(String(offer.status || '').toLowerCase());
}
export async function listCompletedRecapOffers(client, user) {
  const ids = [...new Set([user.id, user.user_id].filter(Boolean))];
  const offers = [];
  for (const side of ['sponsor','sponsee']) {
    if (ids.length) {
      const reply = await client.from('private_offers').select(FIELDS).in(`${side}_id`, ids);
      if (reply.error) throw Error('Offers could not be loaded. Please retry.');
      offers.push(...(reply.data || []));
    }
    if (user.email) {
      const reply = await client.from('private_offers').select(FIELDS).eq(`${side}_email`, user.email);
      if (reply.error) throw Error('Offers could not be loaded. Please retry.');
      offers.push(...(reply.data || []));
    }
  }
  return [...new Map(offers.map(offer => [offer.id, offer])).values()].filter(isCompletedForRecap);
}

export function renderRecapChoices(host, offers, user, { generate = id => loadCampaignRecap(supabase, id), onObjectUrl = () => {} } = {}) {
  const table = document.createElement('table');
  table.className = 'invoice-table';
  const caption = document.createElement('caption');
  caption.textContent = 'Completed campaigns. Recaps use saved, unverified observations and do not confirm payment.';
  table.append(caption);
  const head = document.createElement('thead');
  const headers = document.createElement('tr');
  for (const label of ['Other party','Campaign','Agreed amount','Report']) {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; headers.append(cell);
  }
  head.append(headers); table.append(head);
  const body = document.createElement('tbody');
  const ids = [user.id, user.user_id].filter(Boolean);
  for (const offer of offers) {
    const sponsor = ids.includes(offer.sponsor_id) || (!!user.email && user.email === offer.sponsor_email);
    const other = sponsor ? offer.sponsee_username : offer.sponsor_username;
    const amount = offer.offer_amount;
    const number = (typeof amount === 'number' || (typeof amount === 'string' && amount.trim())) ? Number(amount) : NaN;
    const row = document.createElement('tr');
    for (const value of [other || 'Unknown', offer.offer_title || 'Untitled campaign', Number.isFinite(number) && number >= 0 ? '$' + number.toFixed(2) : 'Unknown']) {
      const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
    }
    const action = document.createElement('td');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = 'Generate Recap';
    const status = document.createElement('span'); status.setAttribute('role','status');
    let objectUrl;
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true; button.textContent = 'Generating…'; status.replaceChildren();
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      try {
        const report = await generate(offer.id);
        if (!host.contains(table)) return;
        objectUrl = URL.createObjectURL(new Blob([report.bytes], { type: 'application/pdf' }));
        onObjectUrl(objectUrl);
        const link = document.createElement('a');
        link.href = objectUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open campaign recap PDF';
        status.append(link);
        button.textContent = 'Generate again';
      } catch {
        status.textContent = 'The campaign recap could not be generated. Check your sign-in and try again.';
        button.textContent = 'Retry recap';
      } finally { button.disabled = false; }
    });
    action.append(button, document.createElement('br'), status); row.append(action); body.append(row);
  }
  table.append(body); host.replaceChildren(table);
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  const open = document.getElementById('generate-recap-btn');
  const modal = document.getElementById('recap-modal');
  const close = document.getElementById('close-recap-modal');
  const host = document.getElementById('recap-offer-list');
  if (!open || !modal || !close || !host) return;
  let generation = 0;
  let controller;
  const urls = new Set();
  function cleanup() {
    generation++; controller?.abort();
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear(); host.replaceChildren();
  }
  function dismiss() { cleanup(); modal.style.display = 'none'; }
  open.addEventListener('click', async () => {
    cleanup(); const current = generation; controller = new AbortController();
    modal.style.display = 'flex'; host.textContent = 'Loading…';
    try {
      const user = await getActiveUser();
      if (!user) throw Error('Sign in to view completed campaigns.');
      const offers = await listCompletedRecapOffers(supabase, user);
      if (current !== generation) return;
      if (!offers.length) { host.textContent = 'No completed offers found.'; return; }
      const signal = controller.signal;
      renderRecapChoices(host, offers, user, { generate: id => loadCampaignRecap(supabase, id, { signal }), onObjectUrl: url => urls.add(url) });
    } catch {
      if (current === generation) host.textContent = 'Completed campaigns could not be loaded. Check your sign-in and try again.';
    }
  });
  close.addEventListener('click', dismiss);
  modal.addEventListener('click', event => { if (event.target === modal) dismiss(); });
});
