// public/js/sponsorLogic.js
import { supabase } from './supabaseClient.js';

// ----- REMOVE OFFER (with comments) -----
export async function handleRemoveOffer(offerId) {
  if (!offerId) {
    alert("Invalid offer ID.");
    return;
  }
  const confirmed = window.confirm("Are you sure you want to permanently delete this offer and all related comments?");
  if (!confirmed) return;
  try {
    const { error: commentDeleteError } = await supabase
      .from('private_offer_comments')
      .delete()
      .eq('offer_id', offerId);
    if (commentDeleteError) throw new Error(`Failed to delete comments: ${commentDeleteError.message}`);
    const { error: offerDeleteError } = await supabase
      .from('private_offers')
      .delete()
      .eq('id', offerId);
    if (offerDeleteError) throw new Error(`Failed to delete offer: ${offerDeleteError.message}`);
    alert("Offer and related comments deleted successfully.");
    return true;
  } catch (err) {
    console.error(err);
    alert(`Error removing offer: ${err.message}`);
    return false;
  }
}

// ----- RENDER GOLD STARS -----
function renderStars(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += `<span class="star${i <= rating ? ' gold-star' : ''}">${i <= rating ? '★' : '☆'}</span>`;
  }
  return out;
}

// ----- CATEGORY STAR RATINGS (Profile, SPONSOR SIDE) -----
async function updateSponsorCategoryStars(category, elementId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const sponsorEmail = session.user.email;

  const { data: offers } = await supabase
    .from('private_offers')
    .select('id')
    .eq('sponsor_email', sponsorEmail);

  if (!offers || offers.length === 0) {
    const starsEl = document.getElementById(elementId);
    if (starsEl) starsEl.innerHTML = renderStars(0);
    return;
  }
  const offerIds = offers.map(o => o.id);

  let allCategoryRatings = [];
  for (let i = 0; i < offerIds.length; i += 100) {
    const batchIds = offerIds.slice(i, i + 100);
    const { data: reviews } = await supabase
      .from('private_offer_reviews')
      .select(category)
      .in('offer_id', batchIds)
      .eq('reviewer_role', 'sponsee');
    if (reviews) allCategoryRatings = allCategoryRatings.concat(reviews);
  }
  const starsEl = document.getElementById(elementId);
  if (!allCategoryRatings.length) {
    if (starsEl) starsEl.innerHTML = renderStars(0);
    return;
  }
  const avg = allCategoryRatings.reduce((sum, r) => sum + (r[category] || 0), 0) / allCategoryRatings.length;
  if (starsEl) starsEl.innerHTML = renderStars(Math.round(avg));
}

let currentWalletAmount = 0; // Actual wallet amount from DB
let pendingSponsorPayouts = []; // Track all pending sponsor payouts

async function updateSponsorWallet() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) return;
  const sponsor_id = session.user.id;

  // 1. Get wallet amount
  const { data, error: walletError } = await supabase
    .from('users_extended_data')
    .select('wallet')
    .eq('user_id', sponsor_id)
    .single();
  currentWalletAmount = Number(data?.wallet) || 0;

  // 2. Get ALL pending sponsor payouts for this sponsor
  const { data: payouts, error: payoutErr } = await supabase
    .from('payouts')
    .select('id,payout_amount,payout_method,created_at,status')
    .eq('sponsee_id', sponsor_id)
    .eq('payout_user_role', 'sponsor')
    .eq('status', 'pending');
  pendingSponsorPayouts = payouts || [];
  const pendingAmount = pendingSponsorPayouts.reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
  const displayWallet = currentWalletAmount - pendingAmount;

  let walletNumColor = (pendingSponsorPayouts.length > 0) ? '#ffae34' : '#17974a';
  let tooltipMsg = pendingSponsorPayouts.length > 0
    ? 'Pending withdrawal – waiting for admin approval'
    : 'Available for withdrawal or another Offer';

  let warningHtml = '';
  if (displayWallet < 0) {
    warningHtml = `<div style="color:#ff5555;font-weight:bold;font-size:.9em;margin-top:6px;">
      ⚠️ Warning: Your pending payout will be <span style="color:#ffae34">rejected</span> due to insufficient funds.
    </div>`;
  }

  if (!walletError && data && document.querySelector('.wallet')) {
    document.querySelector('.wallet').innerHTML = `
      Wallet: <span style="color:${walletNumColor};font-weight:600;">$${displayWallet.toFixed(2)}</span>
      <span class="info-icon" data-tooltip="${tooltipMsg}" style="color: white; cursor: pointer; margin-left:8px;">🛈</span>
      <span class="withdraw-icon" title="Withdraw funds" style="margin-left:12px;cursor:pointer;display:inline-block;">
        <svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 0 24 24" fill="#fff" style="vertical-align:middle;">
          <path d="M2 7v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zm2 0h16v10H4V7zm3 4h2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z"/>
        </svg>
      </span>
      ${warningHtml}
    `;
  }
}

// Withdraw Modal Logic
document.addEventListener('click', function (e) {
  if (e.target.closest('.withdraw-icon')) {
    openWithdrawModal();
  }
});

async function openWithdrawModal() {
  // Remove any existing modal first
  const existing = document.getElementById('withdraw-modal-root');
  if (existing) existing.remove();

  // Fetch last 10 payout requests for this user (history)
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) return;
  const sponsor_id = session.user.id;

  // Most recent first
  const { data: payoutHistory = [] } = await supabase
    .from('payouts')
    .select('payout_amount, payout_method, created_at, status')
    .eq('sponsee_id', sponsor_id)
    .eq('payout_user_role', 'sponsor')
    .order('created_at', { ascending: false })
    .limit(10);

  const pendingAmount = pendingSponsorPayouts.reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
  const afterPayoutWallet = currentWalletAmount - pendingAmount;
  const hasPending = pendingSponsorPayouts.length > 0;

  let walletHtml = '';
  if (hasPending) {
    walletHtml = `
      <div style="margin-bottom:4px;">
        True wallet: <span style="color:#ffae34;">$${currentWalletAmount.toFixed(2)}</span>
      </div>
    `;
  }
  let pendingHtml = '';
  if (hasPending) {
    pendingHtml = `
      <div style="margin-bottom:10px;">
        <strong style="color:#ffae34;">Pending payout requests:</strong>
        <ul style="padding-left:18px;margin-top:4px;">
        ${pendingSponsorPayouts.map(p => `
          <li style="color:#ffae34;">
            $${Number(p.payout_amount).toFixed(2)} &nbsp; | &nbsp; ${p.payout_method || 'Unknown method'} 
            <span style="font-size:0.98em;color:#aaa;">(${p.created_at ? (new Date(p.created_at)).toLocaleDateString() : ''})</span>
          </li>
        `).join('')}
        </ul>
      </div>
    `;
  }
  let historyHtml = '';
  if (payoutHistory && payoutHistory.length) {
    historyHtml = `
      <div style="margin-top:28px;">
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
                  $${Number(row.payout_amount).toFixed(2)}
                </td>
                <td style="padding:4px 6px;">${row.payout_method || '-'}</td>
                <td style="padding:4px 6px;">${row.created_at ? (new Date(row.created_at)).toLocaleDateString() : '-'}</td>
                <td style="padding:4px 6px;color:${
                  row.status === 'pending' ? '#ffae34' : (row.status === 'paid' ? '#42e87c' : '#fc5555')
                };">${row.status.charAt(0).toUpperCase() + row.status.slice(1)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

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
      <strong>Available after payout:</strong> <span style="color:#42e87c;">$${afterPayoutWallet.toFixed(2)}</span>
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
      msgDiv.textContent = "Enter a valid amount (minimum $1).";
      return;
    }
    if (!dest) {
      msgDiv.textContent = "Enter a destination (PayPal email or bank).";
      return;
    }
    if (amt > afterPayoutWallet) {
      msgDiv.textContent = `Unavailable funds. You only have $${afterPayoutWallet.toFixed(2)} available after pending payouts.`;
      return;
    }
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return;
    const sponsor_id = session.user.id;
    const sponsor_email = session.user.email;
    const { error: insertError } = await supabase.from('payouts').insert([{
      sponsee_id: sponsor_id,
      sponsee_email: sponsor_email,
      payout_amount: amt,
      payout_method: dest,
      status: 'pending',
      notes: 'Sponsor wallet withdrawal',
      created_at: new Date().toISOString(),
      payout_user_role: 'sponsor',
      offer_id: null
    }]);
    if (insertError) {
      msgDiv.textContent = "Error submitting request. Please try again or contact support.";
      return;
    }
    msgDiv.style.color = "#41ff88";
    msgDiv.textContent = "Withdraw request submitted! Admin will process your payout.";
    setTimeout(() => document.getElementById('withdraw-modal-root')?.remove(), 2000);
    setTimeout(updateSponsorWallet, 2000);
  };
}

// ----- SUMMARY STAT CARDS -----
async function updateSummaryStats() {
  document.getElementById('sponsored-deals').textContent = '…';
  document.getElementById('ongoing-campaigns').textContent = '…';
  document.getElementById('total-spend').textContent = '…';
  document.getElementById('success-ratio').textContent = '…';

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) {
    document.getElementById('sponsored-deals').textContent = '0';
    document.getElementById('ongoing-campaigns').textContent = '0';
    document.getElementById('total-spend').textContent = '$0';
    document.getElementById('success-ratio').textContent = '0:0';
    return;
  }
  const sponsor_email = session.user.email;

  const { data: offers, error: offerError } = await supabase
    .from('private_offers')
    .select('status, offer_amount')
    .eq('sponsor_email', sponsor_email);

  if (offerError || !offers) {
    document.getElementById('sponsored-deals').textContent = '0';
    document.getElementById('ongoing-campaigns').textContent = '0';
    document.getElementById('total-spend').textContent = '$0';
    document.getElementById('success-ratio').textContent = '0:0';
    return;
  }
  document.getElementById('sponsored-deals').textContent = offers.length ?? 0;

  const ongoing = offers.filter(o =>
    ['accepted', 'pending', 'in_progress', 'live'].includes(o.status)
  );
  document.getElementById('ongoing-campaigns').textContent = ongoing.length ?? 0;

  const validSpendOffers = offers.filter(o => !['rejected', 'Offer Cancelled'].includes(o.status));
  const totalSpend = validSpendOffers.reduce((sum, o) => sum + (o.offer_amount || 0), 0);
  document.getElementById('total-spend').textContent = `$${totalSpend.toFixed(2)}`;

  const successfulOffers = offers.filter(o =>
    ['accepted', 'in_progress', 'live', 'review_completed', 'completed'].includes(o.status)
  ).length;
  const totalOffers = offers.length;
  let ratioText = '0:0';
  if (totalOffers > 0) {
    ratioText = `${successfulOffers} / ${totalOffers} (${Math.round((successfulOffers / totalOffers) * 100)}%)`;
  }
  const ratioEl = document.getElementById('success-ratio');
  if (ratioEl) ratioEl.textContent = ratioText;
}

// ----- RECENT (ACTIVE) DEALS TABLE -----
async function loadRecentDeals() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    alert("You must be logged in to view this page.");
    window.location.href = '/login.html';
    return;
  }
  const sponsorEmail = session.user.email;
  const { data: offers, error: offerError } = await supabase
    .from('private_offers')
    .select('sponsee_username, status, offer_amount, created_at, live_date, deadline, archived')
    .eq('sponsor_email', sponsorEmail)
    .eq('archived', false)
    .order('created_at', { ascending: false });

  const tableBody = document.getElementById('deals-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  // Remove old expand button if it exists
  const oldBtn = document.getElementById('expand-deals-btn');
  if (oldBtn) oldBtn.remove();

  if (offerError || !offers || offers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6">No sponsorship deals found.</td></tr>';
    return;
  }

  // Fetch all unique sponsee usernames
  const sponseeUsernames = [...new Set(offers.map(o => o.sponsee_username).filter(Boolean))];
  let profilePicMap = {};
  if (sponseeUsernames.length > 0) {
    const { data: sponseeProfiles } = await supabase
      .from('users_extended_data')
      .select('username, profile_pic')
      .in('username', sponseeUsernames);
    profilePicMap = {};
    for (const s of sponseeProfiles || []) {
      profilePicMap[s.username] = s.profile_pic
        ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${s.profile_pic}`
        : 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';
    }
  }

  const rows = offers.map(offer => {
    const profilePicUrl = profilePicMap[offer.sponsee_username] || 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';
    const statusText = offer.status === 'review_completed' ? 'Reviewed' : offer.status;
    return `
      <tr>
        <td style="text-align: center;">
          <img src="${profilePicUrl}" onerror="this.src='/public/logos.png'" alt="Profile Pic" style="width: 40px; height: 40px; border-radius: 50%; display: block; margin: 0 auto 5px;">
          ${offer.sponsee_username}
        </td>
        <td style="color: ${
          offer.status === 'pending' ? 'orange' :
          offer.status === 'accepted' ? 'green' :
          offer.status === 'live' ? 'blue' :
          offer.status === 'review_completed' ? 'purple' :
          ['rejected', 'Offer Cancelled'].includes(offer.status) ? 'red' :
          'inherit'
        }">${statusText}</td>
        <td>$${Number(offer.offer_amount).toFixed(2)}</td>
        <td>${offer.created_at ? new Date(offer.created_at).toLocaleDateString() : '—'}</td>
        <td>${offer.deadline ? new Date(offer.deadline + 'T00:00:00Z').toLocaleDateString() : '—'}</td>
        <td>${offer.live_date ? new Date(offer.live_date + 'T00:00:00Z').toLocaleDateString() : 'N/A'}</td>
      </tr>
    `;
  });

  let collapsed = true;
  function renderTable() {
    tableBody.innerHTML = '';
    const visibleRows = collapsed ? rows.slice(0, 10) : rows;
    visibleRows.forEach(row => tableBody.innerHTML += row);
    let btn = document.getElementById('expand-deals-btn');
    if (!btn && rows.length > 10) {
      btn = document.createElement('button');
      btn.id = 'expand-deals-btn';
      btn.style.marginTop = "10px";
      btn.textContent = "Show More";
      btn.onclick = () => {
        collapsed = !collapsed;
        btn.textContent = collapsed ? "Show More" : "Show Less";
        renderTable();
      };
      tableBody.parentElement.appendChild(btn);
    } else if (btn && rows.length <= 10) {
      btn.remove();
    } else if (btn) {
      btn.textContent = collapsed ? "Show More" : "Show Less";
    }
  }
  renderTable();
}

// ----- ARCHIVED/HISTORY TABLE -----
async function loadArchivedDeals() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) return;
  const userEmail = sessionData.session.user.email;

  const { data: offers, error } = await supabase
    .from("private_offers")
    .select("*")
    .eq("archived", true)
    .or(`sponsor_email.eq.${userEmail},sponsee_email.eq.${userEmail}`)
    .order("created_at", { ascending: false });

  const archivedTableBody = document.getElementById("archived-table-body");
  if (!archivedTableBody) return;
  archivedTableBody.innerHTML = "";

  // Remove old expand button if it exists
  const oldBtn = document.getElementById('expand-archived-btn');
  if (oldBtn) oldBtn.remove();

  if (error) {
    archivedTableBody.innerHTML = `<tr><td colspan="8" style="color:red;">Failed to load archived deals.</td></tr>`;
    return;
  }
  if (!offers || offers.length === 0) {
    archivedTableBody.innerHTML = `<tr><td colspan="8">No archived deals yet.</td></tr>`;
    return;
  }

  // Batch profile pic fetch for all unique sponsees
  const sponseeUsernames = [...new Set(offers.map(o => o.sponsee_username).filter(Boolean))];
  let profilePicMap = {};
  if (sponseeUsernames.length > 0) {
    const { data: sponseeProfiles } = await supabase
      .from('users_extended_data')
      .select('username, profile_pic')
      .in('username', sponseeUsernames);
    profilePicMap = {};
    for (const s of sponseeProfiles || []) {
      profilePicMap[s.username] = s.profile_pic
        ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${s.profile_pic}`
        : 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';
    }
  }

  // Batch all reviews in one go for both sponsor and sponsee roles
  const offerIds = offers.map(o => o.id);
  let sponsorReviewMap = {}, sponseeReviewMap = {};
  if (offerIds.length > 0) {
    const { data: reviews } = await supabase
      .from("private_offer_reviews")
      .select("offer_id, overall, reviewer_role")
      .in("offer_id", offerIds);
    for (const review of reviews || []) {
      if (review.reviewer_role === "sponsor") sponsorReviewMap[review.offer_id] = review.overall;
      if (review.reviewer_role === "sponsee") sponseeReviewMap[review.offer_id] = review.overall;
    }
  }

  const rows = offers.map(offer => {
    const profilePicUrl = profilePicMap[offer.sponsee_username] || 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';
    const sponsorRatingDisplay = sponsorReviewMap[offer.id] !== undefined
      ? renderStars(Math.round(sponsorReviewMap[offer.id])) : "—";
    const sponseeRatingDisplay = sponseeReviewMap[offer.id] !== undefined
      ? renderStars(Math.round(sponseeReviewMap[offer.id])) : "—";
    const statusText = offer.status === 'review_completed' ? 'Reviewed' : offer.status;
    return `
      <tr data-offer-id="${offer.id}">
        <td style="text-align: center;">
          <img src="${profilePicUrl}" onerror="this.src='/public/logos.png'" alt="Profile Pic" style="width: 40px; height: 40px; border-radius: 50%; display: block; margin: 0 auto 5px;">
          ${offer.sponsee_username}
        </td>
        <td>$${Number(offer.offer_amount).toFixed(2)}</td>
        <td>${offer.created_at ? new Date(offer.created_at).toLocaleDateString() : '—'}</td>
        <td>${offer.live_date ? new Date(offer.live_date + 'T00:00:00Z').toLocaleDateString() : '—'}</td>
        <td>${offer.deadline ? new Date(offer.deadline + 'T00:00:00Z').toLocaleDateString() : '—'}</td>
        <td>${sponsorRatingDisplay}</td>
        <td>${sponseeRatingDisplay}</td>
      </tr>
    `;
  });

  let collapsed = true;
  function renderTable() {
    archivedTableBody.innerHTML = "";
    const visibleRows = collapsed ? rows.slice(0, 10) : rows;
    visibleRows.forEach(row => archivedTableBody.innerHTML += row);
    let btn = document.getElementById('expand-archived-btn');
    if (!btn && rows.length > 10) {
      btn = document.createElement('button');
      btn.id = 'expand-archived-btn';
      btn.style.marginTop = "10px";
      btn.textContent = "Show More";
      btn.onclick = () => {
        collapsed = !collapsed;
        btn.textContent = collapsed ? "Show More" : "Show Less";
        renderTable();
      };
      archivedTableBody.parentElement.appendChild(btn);
    } else if (btn && rows.length <= 10) {
      btn.remove();
    } else if (btn) {
      btn.textContent = collapsed ? "Show More" : "Show Less";
    }
  }
  renderTable();
}

// ----- OVERALL STAR RATING (Profile) -----
async function updateOverallStars() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const sponsorId = session.user.id;
  const { data: offers, error: offerError } = await supabase
    .from('private_offers')
    .select('id')
    .eq('sponsor_email', session.user.email);
  if (offerError || !offers || offers.length === 0) {
    document.getElementById('average-stars').innerHTML = renderStars(0);
    return;
  }
  const offerIds = offers.map(o => o.id);
  let allSponseeReviews = [];
  for (let i = 0; i < offerIds.length; i += 100) {
    const batchIds = offerIds.slice(i, i + 100);
    const { data: reviews, error: reviewError } = await supabase
      .from('private_offer_reviews')
      .select('overall')
      .in('offer_id', batchIds)
      .eq('reviewer_role', 'sponsee');
    if (reviewError) continue;
    allSponseeReviews = allSponseeReviews.concat(reviews);
  }
  if (allSponseeReviews.length === 0) {
    document.getElementById('average-stars').innerHTML = renderStars(0);
    return;
  }
  const avg = allSponseeReviews.reduce((sum, r) => sum + (r.overall || 0), 0) / allSponseeReviews.length;
  document.getElementById('average-stars').innerHTML = renderStars(Math.round(avg));
}

// ----- DOMContentLoaded EVENTS -----
document.addEventListener("DOMContentLoaded", () => {
  updateSummaryStats();
  loadRecentDeals();
  loadArchivedDeals();
  updateOverallStars();
  updateSponsorCategoryStars('communication', 'communication-stars');
  updateSponsorCategoryStars('punctuality', 'punctuality-stars');
  updateSponsorCategoryStars('work_output', 'work-output-stars');
  updateSponsorWallet();
});
