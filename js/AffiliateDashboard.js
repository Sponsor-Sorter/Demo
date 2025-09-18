// ./js/AffiliateDashboard.js
//
// Affiliate dashboard for dashboardsponsee.html
// - Pay to Wallet: flips approved rows -> paid (RLS), then credits wallet
// - Row commission math: $10 * (row.commission %)
// - Read-only "Commission Rate" card (from affiliate_partners.commission_rate)
// - If RLS blocks and user is admin, uses Edge Function to flip approved->paid
// - Sends user a notification that $X was credited to their wallet
// - No triggers. No schema changes.

import { supabase } from './supabaseClient.js';
// Only import notifyPayout for real notifications.
import { notifyPayout } from './alerts.js';

const DEFAULT_SIGNUP_PRICE = 10;

// ----- functions base (referral + mark-paid EF) -----
const functionsBase =
  (supabase && supabase.functionsUrl) ||
  (window?.SUPABASE_FUNCTIONS_URL) ||
  `${supabase?.supabaseUrl || ''}/functions/v1`;

/* ---------------- utils ---------------- */
function setTextScoped(rootId, id, val) {
  const root = document.getElementById(rootId);
  if (!root) return;
  const el = root.querySelector(`#${CSS.escape(id)}`);
  if (el) el.textContent = val;
}
function toNum(v) {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}
function fmtInt(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}
function fmtCurrency(v) {
  const n = Number(v || 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
    : '$0.00';
}
function fmtPct(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—';
}
function buildReferralUrl(code) {
  const base = window?.ENV_PUBLIC_SITE_BASE_URL || window?.location?.origin || 'https://sponsorsorter.com';
  return `${String(base).replace(/\/+$/, '')}/signup.html?ref=${encodeURIComponent(code || '')}`;
}
// skinny toast (no alerts.js dependency)
function toast(message) {
  try {
    const id = 'mini-toast';
    const old = document.getElementById(id);
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = id;
    el.textContent = String(message || '');
    el.style.cssText = `
      position:fixed;left:50%;bottom:24px;transform:translateX(-50%);
      background:#222;color:#fff;padding:10px 14px;border-radius:10px;
      box-shadow:0 6px 22px rgba(0,0,0,.35);z-index:99999;font-size:14px;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  } catch { /* ignore */ }
}

/* ------------- referral link (unchanged) ------------- */
async function getMyReferralLink(accessToken) {
  const res = await fetch(`${functionsBase}/affiliate-get-referral-link`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': supabase?.supabaseKey || '',
    }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) return { link: null };
  return json; // { ok:true, link: { user_id, code } | null }
}

/* ------------- totals (row.commission% of $10) + partner rate ------------- */
async function getAffiliateTotalsFromDB(userId) {
  // also fetch commission_rate so we can show a read-only card
  const { data: partnerRow } = await supabase
    .from('affiliate_partners')
    .select('id, commission_rate')
    .eq('user_id', userId)
    .maybeSingle();
  if (!partnerRow?.id) return {};

  const partnerId = partnerRow.id;
  const partnerRatePct = toNum(partnerRow.commission_rate); // read-only display

  const { data: rows } = await supabase
    .from('affiliate_conversions')
    .select('status, commission, referred_user_id')
    .eq('partner_id', partnerId);

  let total_conversions = 0;
  let total_gmv = 0;
  let pending_commission = 0;
  let approved_commission = 0;
  let paid_commission = 0;

  const seenUsers = new Set();

  for (const r of (rows || [])) {
    total_conversions += 1;
    total_gmv += DEFAULT_SIGNUP_PRICE;
    if (r.referred_user_id) seenUsers.add(r.referred_user_id);

    const pct = toNum(r.commission);
    const earnedUSD = DEFAULT_SIGNUP_PRICE * (pct / 100);

    const st = String(r.status || '').toLowerCase();
    if (st === 'pending')  pending_commission  += earnedUSD;
    if (st === 'approved') approved_commission += earnedUSD;
    if (st === 'paid')     paid_commission     += earnedUSD;
  }

  return {
    partnerId,
    partnerRatePct, // <— read-only commission rate to display
    total_conversions,
    unique_referred_users: seenUsers.size,
    total_gmv,
    pending_commission,
    approved_commission,
    paid_commission
  };
}

/* ------------- EF: mark approved -> paid (admin only) ------------- */
async function markApprovedPaidViaEdge(partnerId, conversionIds = []) {
  const { data: sessWrap } = await supabase.auth.getSession();
  const accessToken = sessWrap?.session?.access_token;
  if (!accessToken) return { ok: false, status: 401, message: 'No session' };

  const res = await fetch(`${functionsBase}/affiliate-mark-approved-paid`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': supabase?.supabaseKey || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      partner_id: partnerId || undefined,
      conversion_ids: Array.isArray(conversionIds) ? conversionIds : []
    })
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.ok === false) {
    return { ok: false, status: res.status, payload };
  }
  return { ok: true, payload };
}

/* ------------- helper: is current user admin? ------------- */
async function isCurrentUserAdmin() {
  const { data: sessWrap } = await supabase.auth.getSession();
  const uid = sessWrap?.session?.user?.id;
  if (!uid) return false;
  const { data } = await supabase
    .from('users_extended_data')
    .select('is_admin')
    .eq('user_id', uid)
    .maybeSingle();
  return !!data?.is_admin;
}

/* ------------- Pay to Wallet (mark first, then credit + notify) ------------- */
async function payApprovedToWallet(userId) {
  // 1) Resolve partner & fetch APPROVED rows with id + commission
  const { data: partnerRow } = await supabase
    .from('affiliate_partners')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!partnerRow?.id) {
    toast('Affiliate partner not found.');
    return false;
  }
  const partnerId = partnerRow.id;

  const { data: approvedRows } = await supabase
    .from('affiliate_conversions')
    .select('id, commission, status')
    .eq('partner_id', partnerId)
    .eq('status', 'approved');

  if (!approvedRows?.length) {
    toast('No approved commissions to pay.');
    return false;
  }

  // 2) Try to flip APPROVED -> PAID via RLS client update
  const ids = approvedRows.map(r => r.id);
  const { data: changed } = await supabase
    .from('affiliate_conversions')
    .update({ status: 'paid' })
    .in('id', ids)
    .eq('status', 'approved')
    .select('id');

  let paidIds = Array.isArray(changed) ? changed.map(r => r.id) : [];

  // 3) If nothing flipped, optionally fallback to EF for admins
  if (!paidIds.length) {
    const admin = await isCurrentUserAdmin();
    if (admin) {
      const ef = await markApprovedPaidViaEdge(partnerId, ids);
      if (ef.ok) {
        const { data: nowPaid } = await supabase
          .from('affiliate_conversions')
          .select('id')
          .in('id', ids)
          .eq('status', 'paid');
        paidIds = (nowPaid || []).map(r => r.id);
      } else {
        toast('Could not mark paid via admin function.');
        return false;
      }
    } else {
      toast('Could not mark paid (permissions). Please contact admin.');
      return false;
    }
  }

  if (!paidIds.length) {
    toast('No rows changed to paid.');
    return false;
  }

  // 4) Credit wallet ONLY for the rows that actually flipped
  const paidMap = new Set(paidIds);
  const rowsWeFlipped = approvedRows.filter(r => paidMap.has(r.id));
  const amountUSD = rowsWeFlipped.reduce((sum, r) => {
    const pct = toNum(r.commission);
    return sum + (DEFAULT_SIGNUP_PRICE * (pct / 100));
  }, 0);

  const { data: sessWrap } = await supabase.auth.getSession();
  const sponsee_id = sessWrap?.session?.user?.id;
  const sponsee_email = sessWrap?.session?.user?.email || null;
  if (!sponsee_id) {
    toast('Not signed in.');
    return false;
  }

  const { data: walletRow, error: wErr } = await supabase
    .from('users_extended_data')
    .select('wallet')
    .eq('user_id', sponsee_id)
    .maybeSingle();

  if (wErr) {
    toast('Failed to load wallet.');
    return false;
  }

  const curr = toNum(walletRow?.wallet);
  const next = curr + amountUSD;

  const { error: upErr } = await supabase
    .from('users_extended_data')
    .update({ wallet: next })
    .eq('user_id', sponsee_id);

  if (upErr) {
    toast('Failed to credit wallet after marking paid.');
    return false;
  }

  // Send wallet credit notification to the current user
  try {
    if (typeof notifyPayout === 'function') {
      await notifyPayout({
        to_user_id: sponsee_id,
        payout_amount: amountUSD.toFixed(2),
        payout_currency: 'USD',
        payout_status: 'credited',
        offer_id: null,
        note: 'Affiliate commission credited to wallet',
        email: sponsee_email
      });
    }
  } catch (e) {
    console.warn('notifyPayout failed (wallet credit):', e);
  }

  toast(`Paid ${fmtCurrency(amountUSD)} to your wallet.`);

  if (typeof window !== 'undefined' && typeof window.updateSponseeWallet === 'function') {
    try { await window.updateSponseeWallet(); } catch { /* ignore */ }
  }
  return true;
}

/* ------------- UI helpers: ensure a read-only Commission Rate card ------------- */
function ensureRateCard(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;

  // If a placeholder already exists, don't inject
  if (root.querySelector('#aff-rate')) return;

  // Try to drop a card into the same container as other total cards.
  // Heuristic: find a sibling card (paid, pending, etc.) and append next to it.
  const anchor =
    root.querySelector('#aff-paid') ||
    root.querySelector('#aff-approved') ||
    root.querySelector('#aff-total-conv') ||
    root;

  // The cards likely live one level up from the text span; default to parent.
  const container = anchor?.parentElement?.parentElement || root;

  const card = document.createElement('div');
  card.style.cssText = `
    display:inline-block;min-width:210px;min-height:84px;margin:10px;
    padding:12px 14px;border-radius:12px;background:#1e1e1e;vertical-align:top;
  `;
  card.innerHTML = `
    <div style="font-size:14px;color:#bbb;text-align:center;">Commission Rate</div>
    <div id="aff-rate" style="margin-top:6px;text-align:center;font-weight:700;color:#42e87c;">—</div>
  `;
  container.appendChild(card);
}

/* ------------- init ------------- */
document.addEventListener('DOMContentLoaded', async () => {
  const DASH_ROOT = 'affiliate-dashboard-section';

  // guard legacy container id
  {
    const dashRootEl = document.getElementById(DASH_ROOT);
    if (dashRootEl) {
      const dashStatsBox = dashRootEl.querySelector('#aff-stats');
      if (dashStatsBox) dashStatsBox.id = 'aff-stats-dashboard';
    }
  }

  const legacyAffSection = document.getElementById('affiliate-section');

  const affSection =
    document.getElementById(DASH_ROOT) ||
    legacyAffSection;

  const affUrlInput =
    document.getElementById('aff-link-input') ||
    document.getElementById('affiliate-ref-url'); // legacy

  const copyBtn =
    document.getElementById('aff-copy-btn') ||
    document.getElementById('affiliate-copy-btn'); // legacy

  const copyOk = document.getElementById('affiliate-copy-ok') || null;

  const modal = document.getElementById('referral-link-modal');
  const openBtn = document.getElementById('show-referral-link-btn');
  const closeBtn = document.getElementById('close-ref-link-modal');
  const modalInput = document.getElementById('my-ref-link');
  const modalCopyBtn = document.getElementById('copy-ref-link-btn');
  const modalCopied = document.getElementById('ref-link-copied-msg');

  const payoutBtn = document.getElementById('aff-request-payout-btn');

  try {
    const { data: sessData } = await supabase.auth.getSession();
    const session = sessData?.session;
    const userId = session?.user?.id;
    if (!session?.access_token || !userId) return;

    // --- Referral link (unchanged) ---
    const linkResp = await getMyReferralLink(session.access_token);
    const code = linkResp?.link?.code || '';
    if (!code) {
      if (openBtn && modal && modalInput) {
        openBtn.addEventListener('click', () => {
          modal.style.display = 'flex';
          modalInput.value = 'No referral link yet. Please contact support.';
          if (modalCopied) modalCopied.style.display = 'none';
        });
      }
      if (closeBtn && modal) closeBtn.addEventListener('click', () => (modal.style.display = 'none'));
    } else {
      if (affSection) affSection.style.display = '';
      const fullUrl = buildReferralUrl(code);
      if (affUrlInput) affUrlInput.value = fullUrl;
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(affUrlInput?.value || fullUrl); }
          catch { toast('Could not copy.'); return; }
          if (copyOk) {
            copyOk.style.display = 'inline';
            setTimeout(() => (copyOk.style.display = 'none'), 1100);
          } else {
            toast('Copied!');
          }
        });
      }
      if (openBtn && modal && modalInput) {
        openBtn.addEventListener('click', () => {
          modal.style.display = 'flex';
          modalInput.value = fullUrl;
          if (modalCopied) modalCopied.style.display = 'none';
        });
      }
      if (closeBtn && modal) closeBtn.addEventListener('click', () => (modal.style.display = 'none'));
      if (modalCopyBtn && modalInput) {
        modalCopyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(modalInput.value);
            if (modalCopied) {
              modalCopied.style.display = 'block';
              setTimeout(() => (modalCopied.style.display = 'none'), 1100);
            }
          } catch { /* ignore */ }
        });
      }
    }

    // --- Totals + read-only rate ---
    const totals = await getAffiliateTotalsFromDB(userId);

    setTextScoped(legacyAffSection ? legacyAffSection.id : DASH_ROOT, 'aff-clicks', fmtInt(totals.clicks));
    setTextScoped(legacyAffSection ? legacyAffSection.id : DASH_ROOT, 'aff-signups', fmtInt(totals.signups));
    setTextScoped(legacyAffSection ? legacyAffSection.id : DASH_ROOT, 'aff-conversions', fmtInt(totals.total_conversions));
    setTextScoped(legacyAffSection ? legacyAffSection.id : DASH_ROOT, 'aff-rewards', fmtCurrency(totals.paid_commission));

    setTextScoped(DASH_ROOT, 'aff-total-conv', fmtInt(totals.total_conversions));
    setTextScoped(DASH_ROOT, 'aff-unique-users', fmtInt(totals.unique_referred_users));
    setTextScoped(DASH_ROOT, 'aff-gmv', fmtCurrency(totals.total_gmv));
    setTextScoped(DASH_ROOT, 'aff-pending', fmtCurrency(totals.pending_commission));
    setTextScoped(DASH_ROOT, 'aff-approved', fmtCurrency(totals.approved_commission));
    setTextScoped(DASH_ROOT, 'aff-paid', fmtCurrency(totals.paid_commission));

    // Ensure a read-only card exists, then set its value
    ensureRateCard(DASH_ROOT);
    setTextScoped(DASH_ROOT, 'aff-rate', fmtPct(totals.partnerRatePct));

    // --- Button: Pay to Wallet ---
    if (payoutBtn) {
      payoutBtn.textContent = 'Pay to Wallet';
      let paying = false;

      payoutBtn.addEventListener('click', async () => {
        if (paying) return;
        paying = true;
        const original = payoutBtn.textContent;
        payoutBtn.textContent = 'Paying…';

        const ok = await payApprovedToWallet(userId);

        payoutBtn.textContent = ok ? 'Paid to Wallet' : original;

        try {
          const updated = await getAffiliateTotalsFromDB(userId);
          setTextScoped(DASH_ROOT, 'aff-pending', fmtCurrency(updated.pending_commission));
          setTextScoped(DASH_ROOT, 'aff-approved', fmtCurrency(updated.approved_commission));
          setTextScoped(DASH_ROOT, 'aff-paid', fmtCurrency(updated.paid_commission));
          setTextScoped(DASH_ROOT, 'aff-rate', fmtPct(updated.partnerRatePct));
        } catch { /* noop */ }

        setTimeout(() => { payoutBtn.textContent = 'Pay to Wallet'; }, 1500);
        paying = false;
      });
    }

  } catch (e) {
    console.warn('[AffiliateDashboard] init failed', e);
  }
});
