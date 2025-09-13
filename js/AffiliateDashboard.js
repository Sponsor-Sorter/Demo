// ./js/AffiliateDashboard.js
//
// Read-only affiliate wiring for dashboardsponsee.html
// - Keeps your existing IDs (aff-*), including the modal ones
// - Reads referral link via your existing Edge Fn (unchanged)
// - Reads totals directly from public.affiliate_conversions
//   * Commission = (commission_rate% from affiliate_partners) * price
//   * price = row.amount OR $10 default if null
// - "Request Payout" stays ENABLED at all times (no disabling)
//   (We use a local 'requesting' flag to prevent duplicate submits)
//
// No triggers. No schema changes in-db triggers.

import { supabase } from './supabaseClient.js';
import { notifyOfferUpdate as toast } from './alerts.js';

// Functions base (kept for link-only)
const functionsBase =
  (supabase && supabase.functionsUrl) ||
  (window?.SUPABASE_FUNCTIONS_URL) ||
  `${supabase?.supabaseUrl || ''}/functions/v1`;

/* ------------ utils ------------ */
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
function buildReferralUrl(code) {
  const base = window?.ENV_PUBLIC_SITE_BASE_URL || window?.location?.origin || 'https://sponsorsorter.com';
  return `${String(base).replace(/\/+$/, '')}/?ref=${encodeURIComponent(code || '')}`;
}

// Read-only: get the caller's referral link (unchanged)
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

/* ------------ read totals straight from DB (rate-based commission) ------------ */
async function getAffiliateTotalsFromDB(userId) {
  const DEFAULT_SIGNUP_PRICE = 10;

  // 1) Resolve partner_id + commission_rate for this user
  const { data: partnerRow, error: pErr } = await supabase
    .from('affiliate_partners')
    .select('id, commission_rate')
    .eq('user_id', userId)
    .maybeSingle();

  if (pErr) {
    console.warn('[AffiliateDashboard] partner lookup failed', pErr);
    return {};
  }
  if (!partnerRow?.id) return {};

  const partnerId = partnerRow.id;
  const ratePct = toNum(partnerRow.commission_rate); // e.g. 10 => 10%
  // const rate = ratePct / 100; // not used directly; inline below

  // 2) Pull all conversions for this partner (only needed columns)
  const { data: rows, error: cErr } = await supabase
    .from('affiliate_conversions')
    .select('status, amount, referred_user_id')
    .eq('partner_id', partnerId);

  if (cErr) {
    console.warn('[AffiliateDashboard] conversions select failed', cErr);
    return {};
  }
  if (!rows?.length) {
    return {
      partnerId,
      ratePct,
      total_conversions: 0,
      unique_referred_users: 0,
      total_gmv: 0,
      pending_commission: 0,
      approved_commission: 0,
      paid_commission: 0
    };
  }

  // 3) Aggregate — commission derived from rate * price
  let total_conversions = 0;
  let total_gmv = 0;
  let pending_commission = 0;
  let approved_commission = 0;
  let paid_commission = 0;

  const seenUsers = new Set();

  for (const r of rows) {
    total_conversions += 1;

    // price per conversion: prefer row.amount, else fallback to $10
    const price = toNum(r.amount) || DEFAULT_SIGNUP_PRICE;
    total_gmv += price;

    if (r.referred_user_id) seenUsers.add(r.referred_user_id);

    const commissionForThisRow = price * (ratePct / 100);

    switch (String(r.status || '').toLowerCase()) {
      case 'pending':  pending_commission  += commissionForThisRow; break;
      case 'approved': approved_commission += commissionForThisRow; break;
      case 'paid':     paid_commission     += commissionForThisRow; break;
      default: break;
    }
  }

  return {
    partnerId,
    ratePct,
    total_conversions,
    unique_referred_users: seenUsers.size,
    total_gmv,
    pending_commission,
    approved_commission,
    paid_commission
  };
}

/* ------------ payout helpers ------------ */
// Never disable; only adjust label
function setPayoutBtnLabel(btn, label) {
  if (!btn) return;
  if (label) btn.textContent = label;
}

async function requestPayout() {
  try {
    const { data: sessData, error } = await supabase.auth.getSession();
    if (error) throw error;
    const access_token = sessData?.session?.access_token;
    if (!access_token) throw new Error('No session');

    const res = await fetch(`${functionsBase}/affiliate-request-payout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'apikey': supabase?.supabaseKey || '',
        'Content-Type': 'application/json'
      },
      body: '{}' // not used by the function, but keeps it explicit
    });

    const data = await res.json().catch(() => ({}));
    // show the server reason if it failed
    if (!res.ok || data?.ok === false) {
      const msg = data?.message || data?.details || 'Could not request payout.';
      toast(msg);
      console.log('[affiliate-request-payout] error', { status: res.status, data });
      return false;
    }

    toast(`Payout requested for ${fmtCurrency(data.amount)}.`);
    return true;

  } catch (e) {
    console.warn('[AffiliateDashboard] requestPayout failed', e);
    toast(e?.message || 'Could not request payout.');
    return false;
  }
}


/* ------------ init ------------ */
document.addEventListener('DOMContentLoaded', async () => {
  const DASH_ROOT = 'affiliate-dashboard-section';

  // Protect the dashboard totals box from collisions (keep your old rename)
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

  // payout button (always enabled)
  const payoutBtn = document.getElementById('aff-request-payout-btn');

  try {
    const { data: sessData, error } = await supabase.auth.getSession();
    if (error) throw error;
    const session = sessData?.session;
    const userId = session?.user?.id;
    if (!session?.access_token || !userId) return;

    // --- Referral link (unchanged flow) ---
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
          try {
            await navigator.clipboard.writeText(affUrlInput?.value || fullUrl);
          } catch {
            toast('Could not copy.');
            return;
          }
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

    // --- Totals from DB (rate-based) ---
    const totals = await getAffiliateTotalsFromDB(userId);

    // Legacy small block (Clicks/Signups/Conversions/Rewards) — safe if present
    setTextScoped(legacyAffSection ? legacyAffSection.id : DASH_ROOT, 'aff-clicks', fmtInt(totals.clicks));
    setTextScoped(legacyAffSection ? legacyAffSection.id : DASH_ROOT, 'aff-signups', fmtInt(totals.signups));
    setTextScoped(legacyAffSection ? legacyAffSection.id : DASH_ROOT, 'aff-conversions', fmtInt(totals.total_conversions));
    setTextScoped(legacyAffSection ? legacyAffSection.id : DASH_ROOT, 'aff-rewards', fmtCurrency(totals.paid_commission));

    // Big “Your Totals” card (scoped strictly to #affiliate-dashboard-section)
    setTextScoped(DASH_ROOT, 'aff-total-conv', fmtInt(totals.total_conversions));
    setTextScoped(DASH_ROOT, 'aff-unique-users', fmtInt(totals.unique_referred_users));
    setTextScoped(DASH_ROOT, 'aff-gmv', fmtCurrency(totals.total_gmv));
    setTextScoped(DASH_ROOT, 'aff-pending', fmtCurrency(totals.pending_commission));
    setTextScoped(DASH_ROOT, 'aff-approved', fmtCurrency(totals.approved_commission));
    setTextScoped(DASH_ROOT, 'aff-paid', fmtCurrency(totals.paid_commission));

    // --- Payout button handler (never disabled) ---
    if (payoutBtn) {
      setPayoutBtnLabel(payoutBtn, 'Request Payout');

      let requesting = false;
      payoutBtn.addEventListener('click', async () => {
        if (requesting) return; // ignore rapid double-clicks, but keep button enabled
        requesting = true;
        setPayoutBtnLabel(payoutBtn, 'Requesting…');

        const ok = await requestPayout();

        // Keep it enabled regardless of outcome
        setPayoutBtnLabel(payoutBtn, ok ? 'Requested' : 'Request Payout');
        requesting = false;
      });
    }

  } catch (e) {
    console.warn('[AffiliateDashboard] init failed', e);
  }
});
