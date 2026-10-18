// ./js/wallet.js
// Unified Wallet (Sponsee + Sponsor)
// - Shows wallet balance (users_extended_data.wallet)
// - Deducts pending/approved/processing payout requests from display
// - Modal to submit a payout request into `payouts`
// - Destination dropdown: Stripe (automatic) or PayPal (up to 3 days)
// - Stripe payout setup uses the owner-authenticated Connect contract.
// - Return URLs trigger a fresh status check; they do not prove payout readiness.
// - Exposes updateWallet() globally (and legacy alias updateSponseeWallet)

import { supabase } from './supabaseClient.js';
import { connectAccount, connectPayoutReady, connectStatusMessage, connectErrorMessage, connectStripeUrl } from './connectAccount.mjs?v=20261018-connect2';

const MIN_PAYOUT = 10; // $10 minimum; adjust if needed

let currentWalletAmount = 0;     // Wallet amount from DB (raw)
let pendingPayouts = [];         // All pending/approved/processing payout requests for this user
let currentUser = null;          // auth user
let userRole = 'sponsee';        // 'sponsee' | 'sponsor' (resolved from users_extended_data.userType)
let paypalEmail = '';            // from users_extended_data
let stripeAccountId = '';        // users_extended_data.stripe_connect_account_id
let destinationRefresh = 0;
let stripeConnection = null;
let stripeStatus = null;         // latest account status from Edge Function

/* ---------------- utilities ---------------- */
function fmtMoney(n) {
  const v = Number(n || 0);
  return `$${v.toFixed(2)}`;
}
function cescape(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
function functionsBase() {
  // prefer configured functionsUrl, fallback to supabaseUrl/functions/v1
  return supabase.functionsUrl || `${supabase.supabaseUrl}/functions/v1`;
}
function roleFrom(userTypeRaw) {
  const v = String(userTypeRaw || '').toLowerCase();
  // historical values seen: "beSponsored" (sponsee), "sponsor"
  if (v === 'besponsored' || v === 'be sponsored' || v === 'sponsee') return 'sponsee';
  return 'sponsor';
}
function dashboardPathForRole(role) {
  return role === 'sponsor' ? 'dashboardsponsor.html' : 'dashboardsponsee.html';
}
function dashboardReturnUrl() {
  return `${location.origin}/${dashboardPathForRole(userRole)}?tab=payments`;
}

/* ---------- tiny toast ---------- */
function showToast(message, { duration = 3500 } = {}) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style = `
      position: fixed; z-index: 10000; bottom: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 10px;
    `;
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style = `
    background: #1f2730; color: #fff; border: 1px solid #2b3642;
    padding: 12px 14px; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.28);
    font: 500 14px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    opacity: 0; transform: translateY(6px); transition: all .2s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* ---------------- main wallet updater ---------------- */
export async function updateWallet() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return;
    currentUser = session.user;

    // 1) Load extended profile
    const { data: ued, error: uedErr } = await supabase
      .from('users_extended_data')
      .select('user_id, userType, wallet, paypal_email, stripe_connect_account_id')
      .eq('user_id', currentUser.id)
      .single();

    if (uedErr || !ued) return;

    userRole = roleFrom(ued.userType);
    currentWalletAmount = Number(ued.wallet || 0);
    paypalEmail = String(ued.paypal_email || '');
    stripeAccountId = String(ued.stripe_connect_account_id || '');

    // 2) Load current payout requests considered "reserving" funds
    // Treat these statuses as pending against available balance.
    const reserveStatuses = ['pending', 'requested', 'approved', 'processing'];

    let q = supabase
      .from('payouts')
      .select('id, payout_amount, payout_method, created_at, status');

    if (userRole === 'sponsee') {
      q = q.eq('sponsee_id', currentUser.id).eq('payout_user_role', 'sponsee');
    } else {
      q = q.eq('sponsee_id', currentUser.id).eq('payout_user_role', 'sponsor');
    }
    q = q.in('status', reserveStatuses);

    const { data: payouts = [], error: pErr } = await q;
    if (pErr) {
      console.warn('[wallet] payouts fetch failed', pErr);
    }
    pendingPayouts = payouts || [];

    const reserved = pendingPayouts.reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const available = Math.max(0, currentWalletAmount - reserved);

    // 3) Render widget
    const walletEl = document.querySelector('.wallet');
    if (!walletEl) return;

    const hasPending = pendingPayouts.length > 0;
    const walletNumColor = hasPending ? '#ffae34' : '#17974a';
    const tooltipMsg = hasPending
      ? 'Pending withdrawal – awaiting processing'
      : 'Available for withdrawal';

    const warningHtml = (available < 0)
      ? `<div style="color:#ff5555;font-weight:bold;font-size:.9em;margin-top:6px;">
           ⚠️ Warning: Your pending payout will be <span style="color:#ffae34">rejected</span> due to insufficient funds.
         </div>`
      : '';

    walletEl.innerHTML = `
      Wallet: <span style="color:${walletNumColor};font-weight:600;">${fmtMoney(available)}</span>
      <span class="info-icon" data-tooltip="${cescape(tooltipMsg)}" style="color:white;cursor:pointer;margin-left:8px;">🛈</span>
      <span class="withdraw-icon" title="Withdraw funds" style="margin-left:12px;cursor:pointer;display:inline-block;">
        <svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 0 24 24" fill="#fff" style="vertical-align:middle;">
          <path d="M2 7v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zm2 0h16v10H4V7zm3 4h2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z"/>
        </svg>
      </span>
      ${warningHtml}
    `;
  } catch (err) {
    console.warn('updateWallet failed:', err);
  }
}

/* ---------------- modal & submit ---------------- */
async function openWithdrawModal() {
  // remove existing modal
  document.getElementById('withdraw-modal-root')?.remove();

  // quick fetch last payouts (for history list)
  let q = supabase
    .from('payouts')
    .select('payout_amount, payout_method, created_at, status')
    .order('created_at', { ascending: false })
    .limit(10);

  if (userRole === 'sponsee') {
    q = q.eq('sponsee_id', currentUser.id).eq('payout_user_role', 'sponsee');
  } else {
    q = q.eq('sponsee_id', currentUser.id).eq('payout_user_role', 'sponsor');
  }

  const { data: payoutHistory = [] } = await q;

  const reserved = pendingPayouts.reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
  const afterPayoutWallet = Math.max(0, currentWalletAmount - reserved);
  const hasPending = pendingPayouts.length > 0;

  // Helper sections
  const walletHtml = hasPending
    ? `<div style="margin-bottom:4px;">
         True wallet: <span style="color:#ffae34;">${fmtMoney(currentWalletAmount)}</span>
       </div>`
    : '';

  const pendingHtml = hasPending
    ? `<div style="margin-bottom:10px;">
         <strong style="color:#ffae34;">Pending payout requests:</strong>
         <ul style="padding-left:18px;margin-top:4px;">
           ${pendingPayouts.map(p => `
             <li style="color:#ffae34;">
               ${fmtMoney(p.payout_amount)} &nbsp; | &nbsp; ${cescape(p.payout_method || 'Unknown')} 
               <span style="font-size:0.98em;color:#aaa;">(${p.created_at ? (new Date(p.created_at)).toLocaleDateString() : ''})</span>
             </li>
           `).join('')}
         </ul>
       </div>`
    : '';

  const historyHtml = (payoutHistory && payoutHistory.length)
    ? `<div style="margin-top:28px;">
         <div style="font-size:1.05em;margin-bottom:4px;color:#aaa;">Recent Withdrawals</div>
         <table style="width:100%;background:#232323;border-radius:10px;overflow:hidden;font-size:0.98em;">
           <thead>
             <tr style="background:#161616;">
               <th style="padding:5px 6px;">Amount</th>
               <th style="padding:5px 6px;">Method</th>
               <th style="padding:5px 6px;">Date</th>
               <th style="padding:5px 6px;">Status</th>
             </tr>
           </thead>
           <tbody>
             ${payoutHistory.map(row => `
               <tr>
                 <td style="padding:4px 6px;color:${row.status === 'pending' || row.status === 'requested' ? '#ffae34' : (row.status === 'paid' ? '#42e87c' : '#aaa')};">
                   ${fmtMoney(row.payout_amount)}
                 </td>
                 <td style="padding:4px 6px;">${cescape(row.payout_method || '-')}</td>
                 <td style="padding:4px 6px;">${row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</td>
                 <td style="padding:4px 6px;color:${
                   (row.status === 'pending' || row.status === 'requested') ? '#ffae34'
                   : (row.status === 'paid' ? '#42e87c' : '#fc5555')
                 };">${row.status?.charAt(0).toUpperCase() + row.status?.slice(1)}</td>
               </tr>
             `).join('')}
           </tbody>
         </table>
       </div>`
    : '';

  // Modal shell
  const modal = document.createElement('div');
  modal.id = 'withdraw-modal-root';
  modal.style = `
    position: fixed; inset: 0; 
    background: rgba(0,0,0,.35); z-index: 9999;
    display:flex; align-items:center; justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:#1c1c1c;color:#fff;border-radius:18px;min-width:360px;max-width:720px;width:clamp(360px,60vw,720px); padding: 24px 22px 18px; box-shadow: 0 2px 32px #0008;">
      <h2 style="margin-top:0;font-size:1.28em;">Withdraw Funds</h2>
      ${walletHtml}
      ${pendingHtml}
      <div style="margin-bottom:10px;">
        <strong>Available after payout:</strong> <span style="color:#42e87c;">${fmtMoney(afterPayoutWallet)}</span>
      </div>

      <label style="font-size:1em;">Amount to withdraw:</label>
      <input id="withdraw-amount" type="number" min="${MIN_PAYOUT}" step="0.01" style="width:50%;margin-top:10px;margin-bottom:14px;padding:8px;font-size:1.12em;border-radius:8px;border:none;background:#252a25;color:#fff;" />

      <label style="font-size:1em;display:block;margin-top:4px;">Destination:</label>
      <select id="withdraw-destination-select" style="width:100%;margin-top:10px;margin-bottom:10px;padding:10px;border-radius:8px;border:none;background:#252525;color:#fff;">
        <option value="stripe">Stripe payout account</option>
        <option value="paypal">PayPal (up to 3 days)</option>
      </select>

      <div id="destination-panel" style="background:#202020;border:1px solid #2a2a2a;border-radius:10px;padding:12px;margin-bottom:14px;"></div>

      <div style="text-align:right;margin-top:6px;">
        <button id="withdraw-cancel" style="background:#a93333;color:#eee;border:none;font-size:1em;cursor:pointer;margin-right:10px;border-radius:8px;padding:8px 14px;">Cancel</button>
        <button id="withdraw-confirm" style="background:#17974a;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:1em;cursor:pointer;">Withdraw</button>
      </div>

      <div id="withdraw-modal-msg" style="margin-top:12px;min-height:24px;font-size:0.97em;color:#ffb456;"></div>
      ${historyHtml}
    </div>
  `;
  document.body.appendChild(modal);

  const msgDiv = document.getElementById('withdraw-modal-msg');
  const destPanel = document.getElementById('destination-panel');
  const sel = document.getElementById('withdraw-destination-select');

  document.getElementById('withdraw-cancel').onclick = () => modal.remove();

  // Load Stripe status for the panel (non-blocking)
  refreshDestinationPanel(sel.value, destPanel, msgDiv).catch(console.warn);

  sel.addEventListener('change', () => {
    refreshDestinationPanel(sel.value, destPanel, msgDiv).catch(console.warn);
  });

  document.getElementById('withdraw-confirm').onclick = async () => {
    const amt = Number(document.getElementById('withdraw-amount').value);
    const choice = (document.getElementById('withdraw-destination-select')).value;

    if (!amt || amt < MIN_PAYOUT) {
      msgDiv.style.color = '#ffb456';
      msgDiv.textContent = `Enter a valid amount (minimum ${fmtMoney(MIN_PAYOUT)}).`;
      return;
    }
    if (amt > afterPayoutWallet) {
      msgDiv.style.color = '#ffb456';
      msgDiv.textContent = `Unavailable funds. You only have ${fmtMoney(afterPayoutWallet)} available after pending payouts.`;
      return;
    }

    // Destination checks
    let payout_method = '';
    let note = '';
    if (choice === 'stripe') {
      // require connect + (ideally) payouts enabled
      const ready = connectPayoutReady(stripeConnection);
      if (!stripeAccountId || !ready) {
        msgDiv.style.color = '#ff6b6b';
        msgDiv.textContent = 'Stripe Connect not ready. Click "Set up / Fix Stripe" first.';
        return;
      }
      payout_method = 'stripe';
      note = 'Stripe Connect payout';
    } else {
      // PayPal capture
      const input = document.getElementById('paypal-email-input');
      const email = String(input?.value || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msgDiv.style.color = '#ffb456';
        msgDiv.textContent = 'Enter a valid PayPal email.';
        return;
      }
      payout_method = `paypal:${email}`;
      note = 'PayPal withdrawal request';
    }

    // Submit payout request
    const baseRow = {
      payout_amount: amt,
      payout_method,
      status: 'pending',              // matches your current flow ("pending" visible to admin)
      notes: note,
      created_at: new Date().toISOString(),
      offer_id: null
    };
    // Role-specific columns
    if (userRole === 'sponsee') {
      baseRow['sponsee_id'] = currentUser.id;
      baseRow['sponsee_email'] = currentUser.email;
      baseRow['payout_user_role'] = 'sponsee';
    } else {
      baseRow['sponsee_id'] = currentUser.id;
      baseRow['sponsee_email'] = currentUser.email;
      baseRow['payout_user_role'] = 'sponsor';
    }

    const { error: insertError } = await supabase.from('payouts').insert([baseRow]);
    if (insertError) {
      msgDiv.style.color = '#ff6b6b';
      msgDiv.textContent = 'Error submitting request. Please try again or contact support.';
      return;
    }

    msgDiv.style.color = '#41ff88';
    msgDiv.textContent = 'Withdraw request submitted! Admin will process your payout.';
    setTimeout(() => document.getElementById('withdraw-modal-root')?.remove(), 1800);
    setTimeout(updateWallet, 1800);
  };
}

/* ---------- destination panel rendering ---------- */
async function refreshDestinationPanel(choice, destPanel, msgDiv) {
  const refresh = ++destinationRefresh;
  if (choice === 'stripe') {
    destPanel.textContent = 'Checking Stripe payout settings…';
    stripeConnection = null;
    stripeStatus = null;
    let state;
    try {
      state = await fetchStripeStatusSafe();
      if (refresh !== destinationRefresh || !destPanel.isConnected || choice !== document.getElementById('withdraw-destination-select')?.value) return;
      stripeConnection = state;
      stripeStatus = state.status;
      stripeAccountId = state.account_id || '';
    } catch (error) {
      if (refresh !== destinationRefresh || !destPanel.isConnected || choice !== document.getElementById('withdraw-destination-select')?.value) return;
      destPanel.textContent = connectErrorMessage(error);
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = 'Check payout status again';
      retry.addEventListener('click', () => refreshDestinationPanel('stripe', destPanel, msgDiv));
      destPanel.append(document.createElement('br'), retry);
      return;
    }
    const note = document.createElement('p');
    note.textContent = connectStatusMessage(state);
    destPanel.replaceChildren(note);
    if (state.account_id) {
      const account = document.createElement('p'); account.textContent = 'Payout account: ' + state.account_id; destPanel.append(account);
    }
    const explanation = document.createElement('p');
    explanation.textContent = 'This connects a payout account. Manage your Pro subscription separately in Settings. Withdrawal requests do not send money immediately.';
    destPanel.append(explanation);
    const setup = document.createElement('button'); setup.type = 'button'; setup.id = 'btn-open-stripe';
    setup.textContent = state.test_mode ? 'Open test payout setup' : 'Set up / Fix Stripe payouts';
    destPanel.append(setup);
    setup.addEventListener('click', async () => {
      if (setup.disabled) return;
      setup.disabled = true;
      msgDiv.textContent = 'Preparing Stripe payout setup…';
      try {
        const result = await connectAccount(supabase, 'onboarding', { returnUrl: dashboardReturnUrl(), refreshUrl: dashboardReturnUrl() });
        location.assign(connectStripeUrl(result.onboarding_url));
      } catch (error) {
        msgDiv.style.color = '#ffb456'; msgDiv.textContent = connectErrorMessage(error);
      } finally { setup.disabled = false; }
    });

  } else {
    // PayPal panel
    destPanel.innerHTML = `
      <div>
        <div style="font-weight:600;margin-bottom:6px;">PayPal (up to 3 days)</div>
        <div style="font-size:.95em;color:#bbb;">Provide your PayPal email for manual payouts.</div>
        <input id="paypal-email-input" type="email" placeholder="you@example.com"
               value="${cescape(paypalEmail)}"
               style="width:80%;margin-top:10px;padding:10px;border-radius:8px;border:none;background:#252525;color:#fff;" />
        <div style="margin-top:8px;display:flex;gap:8px;">
          <button id="btn-save-paypal" style="background:#2f6be3;border:none;color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;">Save PayPal Email</button>
        </div>
      </div>
    `;
    document.getElementById('btn-save-paypal').onclick = async () => {
      try {
        const email = String(document.getElementById('paypal-email-input').value || '').trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          msgDiv.style.color = '#ffb456';
          msgDiv.textContent = 'Please enter a valid PayPal email.';
          return;
        }
        const { error: upErr } = await supabase
          .from('users_extended_data')
          .update({ paypal_email: email })
          .eq('user_id', currentUser.id);
        if (upErr) throw upErr;
        paypalEmail = email;
        msgDiv.style.color = '#41ff88';
        msgDiv.textContent = 'PayPal email saved.';
      } catch (e) {
        console.warn(e);
        msgDiv.style.color = '#ff6b6b';
        msgDiv.textContent = 'Could not save PayPal email.';
      }
    };
  }
}

/* ---------- stripe status helper ---------- */
async function fetchStripeStatusSafe() {
  return connectAccount(supabase, 'status');
}

/* ---------- event hooks ---------- */
document.addEventListener('click', (e) => {
  if (e.target.closest('.withdraw-icon')) {
    openWithdrawModal();
  }
});
document.addEventListener('DOMContentLoaded', () => {
  // Toast if returning from Stripe with ?tab=payments
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'payments') {
    showToast('Returned from Stripe. Checking your payout account; no withdrawal is confirmed.');
    // Clean the URL so the toast doesn't repeat
    const cleanUrl = location.origin + location.pathname;
    history.replaceState({}, '', cleanUrl);
    // Optionally refresh Stripe status once back
    fetchStripeStatusSafe().then(state => {
      stripeConnection = state; stripeStatus = state.status;
      showToast(connectStatusMessage(state));
    }).catch(error => showToast(connectErrorMessage(error))).finally(updateWallet);
  } else {
    updateWallet();
  }
});

/* ---------- legacy global alias ---------- */
window.updateWallet = updateWallet;
window.updateSponseeWallet = updateWallet; // backward compatibility
