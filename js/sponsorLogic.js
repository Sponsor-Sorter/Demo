// public/js/sponsorLogic.js
import { supabase } from '/public/js/supabaseClient.js';

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
});
