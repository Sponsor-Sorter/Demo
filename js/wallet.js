// ./js/wallet.js
// Sponsee Wallet UI + Withdraw flow
// - Shows wallet balance (users_extended_data.wallet)
// - Deducts pending payout requests from display
// - Opens modal to submit a withdrawal request (inserts into `payouts`)
// - Exposes updateSponseeWallet globally for non-module callers

import { supabase } from './supabaseClient.js';

let currentWalletAmount = 0;           // True wallet amount from DB
let pendingSponseePayouts = [];        // Pending payout requests for this sponsee

/** Safely formats numbers into $X.XX */
function fmtMoney(n) {
  const v = Number(n || 0);
  return `$${v.toFixed(2)}`;
}

/** Update the .wallet element with available balance and controls */
export async function updateSponseeWallet() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return;
    const sponsee_id = session.user.id;

    // 1) Fetch wallet balance
    const { data, error: walletError } = await supabase
      .from('users_extended_data')
      .select('wallet')
      .eq('user_id', sponsee_id)
      .single();

    if (walletError) throw walletError;
    currentWalletAmount = Number(data?.wallet) || 0;

    // 2) Fetch pending payouts (withdrawal requests)
    const { data: payouts, error: payoutErr } = await supabase
      .from('payouts')
      .select('id, payout_amount, payout_method, created_at, status')
      .eq('sponsee_id', sponsee_id)
      .eq('payout_user_role', 'sponsee')
      .eq('status', 'pending');

    if (payoutErr) throw payoutErr;

    pendingSponseePayouts = payouts || [];
    const pendingAmount = pendingSponseePayouts.reduce(
      (sum, row) => sum + Number(row.payout_amount || 0), 0
    );
    const displayWallet = currentWalletAmount - pendingAmount;

    // 3) Render
    const walletEl = document.querySelector('.wallet');
    if (!walletEl) return;

    const hasPending = pendingSponseePayouts.length > 0;
    const walletNumColor = hasPending ? '#ffae34' : '#17974a';
    const tooltipMsg = hasPending
      ? 'Pending withdrawal – waiting for admin approval'
      : 'Available for withdrawal';

    const warningHtml = (displayWallet < 0)
      ? `<div style="color:#ff5555;font-weight:bold;font-size:.9em;margin-top:6px;">
           ⚠️ Warning: Your pending payout will be <span style="color:#ffae34">rejected</span> due to insufficient funds.
         </div>`
      : '';

    walletEl.innerHTML = `
      Wallet: <span style="color:${walletNumColor};font-weight:600;">${fmtMoney(displayWallet)}</span>
      <span class="info-icon" data-tooltip="${tooltipMsg}" style="color:white;cursor:pointer;margin-left:8px;">🛈</span>
      <span class="withdraw-icon" title="Withdraw funds" style="margin-left:12px;cursor:pointer;display:inline-block;">
        <svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 0 24 24" fill="#fff" style="vertical-align:middle;">
          <path d="M2 7v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zm2 0h16v10H4V7zm3 4h2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z"/>
        </svg>
      </span>
      ${warningHtml}
    `;
  } catch (err) {
    console.warn('updateSponseeWallet failed:', err);
  }
}

/** Open the withdraw modal and submit a payout request */
async function openSponseeWithdrawModal() {
  // remove any existing modal
  const existing = document.getElementById('withdraw-modal-root');
  if (existing) existing.remove();

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) return;
  const sponsee_id = session.user.id;

  // recent payout history
  const { data: payoutHistory = [] } = await supabase
    .from('payouts')
    .select('payout_amount, payout_method, created_at, status')
    .eq('sponsee_id', sponsee_id)
    .eq('payout_user_role', 'sponsee')
    .order('created_at', { ascending: false })
    .limit(10);

  const pendingAmount = pendingSponseePayouts.reduce(
    (sum, row) => sum + Number(row.payout_amount || 0), 0
  );
  const afterPayoutWallet = currentWalletAmount - pendingAmount;
  const hasPending = pendingSponseePayouts.length > 0;

  const walletHtml = hasPending
    ? `<div style="margin-bottom:4px;">
         True wallet: <span style="color:#ffae34;">${fmtMoney(currentWalletAmount)}</span>
       </div>`
    : '';

  const pendingHtml = hasPending
    ? `<div style="margin-bottom:10px;">
         <strong style="color:#ffae34;">Pending payout requests:</strong>
         <ul style="padding-left:18px;margin-top:4px;">
           ${pendingSponseePayouts.map(p => `
             <li style="color:#ffae34;">
               ${fmtMoney(p.payout_amount)} &nbsp; | &nbsp; ${p.payout_method || 'Unknown'} 
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
                 <td style="padding:4px 6px;color:${row.status === 'pending' ? '#ffae34' : (row.status === 'paid' ? '#42e87c' : '#aaa')};">
                   ${fmtMoney(row.payout_amount)}
                 </td>
                 <td style="padding:4px 6px;">${row.payout_method || '-'}</td>
                 <td style="padding:4px 6px;">${row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</td>
                 <td style="padding:4px 6px;color:${
                   row.status === 'pending' ? '#ffae34' : (row.status === 'paid' ? '#42e87c' : '#fc5555')
                 };">${row.status?.charAt(0).toUpperCase() + row.status?.slice(1)}</td>
               </tr>
             `).join('')}
           </tbody>
         </table>
       </div>`
    : '';

  const modal = document.createElement('div');
  modal.id = 'withdraw-modal-root';
  modal.style = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
    background: rgba(0, 0, 0, 0.3); z-index: 9999; display: flex; align-items: center; justify-content: center;
  `;
  modal.innerHTML = `
    <div style="background:rgb(28, 28, 28); color: #fff; border-radius: 18px; min-width: 340px; max-width:70vw; padding: 28px 24px 18px 24px; box-shadow: 0 2px 32px #0008;">
      <h2 style="margin-top:0;font-size:1.3em;">Withdraw Funds</h2>
      ${walletHtml}
      ${pendingHtml}
      <div style="margin-bottom:10px;">
        <strong>Available after payout:</strong> <span style="color:#42e87c;">${fmtMoney(afterPayoutWallet)}</span>
      </div>
      <label style="font-size:1em;">Amount to withdraw:</label>
      <input id="withdraw-amount" type="number" min="1" step="0.01" style="width:100%;margin-top:10px;margin-bottom:18px;padding:8px;font-size:1.12em;border-radius:8px;border:none;background:#252a25;color:#fff;" />
      <label style="font-size:1em;">Destination (PayPal or Bank):</label>
      <input id="withdraw-destination" type="text" placeholder="Your PayPal email or bank info" style="width:100%;margin-top:10px;margin-bottom:18px;padding:8px;font-size:1.12em;border-radius:8px;border:none;background:#252a25;color:#fff;" />
      <div style="text-align:right;">
        <button id="withdraw-cancel" style="background:red;color:#ccc;border:none;font-size:1em;cursor:pointer;margin-right:10px;">Cancel</button>
        <button id="withdraw-confirm" style="background:#17974a;color:#fff;border:none;padding:8px 22px;border-radius:8px;font-size:1em;cursor:pointer;">Withdraw</button>
      </div>
      <div id="withdraw-modal-msg" style="margin-top:12px;min-height:24px;font-size:0.97em;color:#ffb456;"></div>
      ${historyHtml}
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('withdraw-cancel').onclick = () => modal.remove();

  document.getElementById('withdraw-confirm').onclick = async () => {
    const amt = Number(document.getElementById('withdraw-amount').value);
    const dest = document.getElementById('withdraw-destination').value.trim();
    const msgDiv = document.getElementById('withdraw-modal-msg');

    if (!amt || amt < 1) {
      msgDiv.textContent = 'Enter a valid amount (minimum $1).';
      return;
    }
    if (!dest) {
      msgDiv.textContent = 'Enter a destination (PayPal email or bank).';
      return;
    }
    if (amt > afterPayoutWallet) {
      msgDiv.textContent = `Unavailable funds. You only have ${fmtMoney(afterPayoutWallet)} available after pending payouts.`;
      return;
    }

    // Submit payout request
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return;
    const sponsee_id = session.user.id;
    const sponsee_email = session.user.email;

    const { error: insertError } = await supabase.from('payouts').insert([{
      sponsee_id,
      sponsee_email,
      payout_amount: amt,
      payout_method: dest,
      status: 'pending',
      notes: 'Sponsee wallet withdrawal',
      created_at: new Date().toISOString(),
      payout_user_role: 'sponsee',
      offer_id: null
    }]);

    if (insertError) {
      msgDiv.style.color = '#ff6b6b';
      msgDiv.textContent = 'Error submitting request. Please try again or contact support.';
      return;
    }

    msgDiv.style.color = '#41ff88';
    msgDiv.textContent = 'Withdraw request submitted! Admin will process your payout.';
    setTimeout(() => document.getElementById('withdraw-modal-root')?.remove(), 2000);
    setTimeout(updateSponseeWallet, 2000);
  };
}

// Click handler for the withdraw button in the header summary
document.addEventListener('click', (e) => {
  if (e.target.closest('.withdraw-icon')) {
    openSponseeWithdrawModal();
  }
});

// Initialize wallet on page load
document.addEventListener('DOMContentLoaded', () => {
  updateSponseeWallet();
});

// Expose to global (so non-module scripts like sponseeOffers.js can call it)
window.updateSponseeWallet = updateSponseeWallet;
