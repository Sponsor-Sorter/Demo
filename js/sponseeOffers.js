// public/js/sponseeOffers.js
import { supabase } from './supabaseClient.js';
import {
  notifyComment,
  notifyOfferStatus,
  notifyOfferUpdate,
  notifyPayout
} from './alerts.js';
import './userReports.js';
import { famBotModerateWithModal } from './FamBot.js';

// ---------- Free-plan helpers ----------

// Count "active" sponsorships for the current sponsee.
// Here we treat stages 2–4 as active (accepted / submitted / live).
async function getCurrentSponseeActiveOfferCount() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return 0;

    const { count, error } = await supabase
      .from('private_offers')
      .select('id', { count: 'exact', head: true })
      .eq('sponsee_email', email)
      .in('stage', [2, 3, 4]);

    if (error) {
      console.warn('Could not fetch active offers for free-plan check:', error);
      return 0;
    }
    return count || 0;
  } catch (err) {
    console.warn('Error checking active offers for free-plan:', err);
    return 0;
  }
}


// ⬇️ NEW: snapshot helpers (no extra API calls)
import { statsnapSaveAfterSuccess, statsnapFallback } from './statsnap.js';

let allSponseeOffers = [];
let currentPage = 1;
const offersPerPage = 5;
let currentFilter = "all";

/* ===================== URL/Date helpers (match sponsor) ===================== */
function pairUrlsAndDates(offer) {
  // Combine live_urls[] with url_dates[] by index, fallback to legacy live_url/live_date
  const urls = Array.isArray(offer?.live_urls)
    ? offer.live_urls
    : (offer?.live_url ? [offer.live_url] : []);
  const dates = Array.isArray(offer?.url_dates)
    ? offer.url_dates
    : (offer?.live_date ? [offer.live_date] : []);
  const max = Math.max(urls.length, dates.length);
  const pairs = [];
  for (let i = 0; i < max; i++) {
    const u = urls[i] ?? null;
    const d = dates[i] ?? null;
    if (u) pairs.push({ url: u, date: d });
  }
  return pairs;
}
function earliestDate(dates) {
  if (!Array.isArray(dates) || !dates.length) return null;
  const sorted = dates
    .filter(Boolean)
    .map(d => new Date(d).toISOString().slice(0, 10))
    .sort();
  return sorted[0] || null;
}
/* =========================================================================== */

// Map a URL's hostname to a normalized platform key
function detectPlatformFromURL(u) {
  try {
    const host = new URL(u).hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('tiktok.com') || host.includes('vm.tiktok.com') || host.includes('vt.tiktok.com')) return 'tiktok';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('twitch.tv')) return 'twitch';
    if (host.includes('facebook.com') || host === 'fb.watch' || host.endsWith('.fb.watch')) return 'facebook';
    if (host.includes('twitter.com') || host === 'x.com') return 'twitter';
    if (host.includes('snapchat.com')) return 'snapchat';

    return null;
  } catch {
    return null;
  }
}

/* ============== Platform badges (domain-matched, not index-based) =============== */
function renderPlatformBadges(platforms, urlPairs = []) {
  if (!platforms) return '';
  if (typeof platforms === 'string') {
    try { platforms = JSON.parse(platforms); } catch { platforms = []; }
  }
  if (!Array.isArray(platforms)) return '';

  // Build a lookup: { platformKey -> first matching URL }
  const urlByPlatform = {};
  for (const p of (urlPairs || [])) {
    const key = p?.url ? detectPlatformFromURL(p.url) : null;
    if (key && !urlByPlatform[key]) urlByPlatform[key] = p.url;
  }

  const platformLogos = {
    instagram: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/1200px-Instagram_logo_2022.svg.png',
    tiktok: 'tiktoklogo.png',
    youtube: 'youtubelogo.png',
    twitter: 'twitterlogo.png',
    facebook: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
    twitch: 'twitchlogo.png',
    snapchat: 'snaplogo.png',
  };

  // Optional: if NOTHING matched (e.g. no URLs yet) and lengths line up,
  // you can fallback to the old index mapping to keep prior behavior.
  const needIndexFallback = Object.keys(urlByPlatform).length === 0 && Array.isArray(urlPairs) && urlPairs.length === platforms.length;

  return platforms.map((platform, i) => {
    const key = (platform || '').toLowerCase().trim();
    const logo = platformLogos[key] || '';
    if (!logo) return '';

    const link = urlByPlatform[key] || (needIndexFallback ? (urlPairs[i]?.url || null) : null);

    const badgeImg = `<img src="${logo}" alt="${platform}" style="height:20px;width:20px;vertical-align:middle;">`;
    return link
      ? `<a href="${link}" target="_blank" class="social-badge" 
             style="display:inline-block;background:#f4f7ff;border-radius:8px;
             padding:2px 5px;margin-right:4px;text-decoration:none;">${badgeImg}</a>`
      : `<span class="social-badge" 
             style="display:inline-block;background:#f4f7ff;border-radius:8px;
             padding:2px 5px;margin-right:4px;">${badgeImg}</span>`;
  }).join(' ');
}

// Parse platforms robustly (kept from your version)
function parsePlatforms(platforms) {
  if (!platforms) return [];
  if (Array.isArray(platforms)) return platforms;
  if (typeof platforms === 'string') {
    try {
      const p = JSON.parse(platforms);
      if (Array.isArray(p)) return p;
    } catch {
      return platforms.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Auth and user/session fetch
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    alert("You must be logged in to view this page.");
    window.location.href = './login.html';
    return;
  }
  const sponsee_email = session.user.email;
  const sponsee_id = session.user.id;

  let sponsee_username = '';
  try {
    const { data: sponseeUserData } = await supabase
      .from('users_extended_data')
      .select('username')
      .eq('user_id', sponsee_id)
      .single();
    sponsee_username = sponseeUserData?.username || session.user.user_metadata.username || 'Unknown';
  } catch {
    sponsee_username = session.user.user_metadata.username || 'Unknown';
  }

  // 2. DOM nodes
  const listingContainer = document.getElementById('listing-container');
  const offerTabs = document.getElementById('offer-tabs');
  const paginationLabel = document.getElementById('pagination-label');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const totalLabel = document.getElementById('sponsee-offer-total-label');

  // 3. Tab Buttons (with default ALL tab active)
  offerTabs.innerHTML = `
    <button data-filter="all" class="tab-btn active">All</button>
    <button data-filter="pending" class="tab-btn">Pending</button>
    <button data-filter="accepted" class="tab-btn">Accepted</button>
    <button data-filter="stage-3" class="tab-btn">In Progress</button>
    <button data-filter="stage-4" class="tab-btn">Live</button>
    <button data-filter="stage-5" class="tab-btn">Completed</button>
    <button data-filter="rejected" class="tab-btn">Rejected / Cancelled</button>
    <button data-filter="other" class="tab-btn">Other</button>
  `;

  // --- Events for TABS
  offerTabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-btn')) return;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    currentPage = 1;
    currentFilter = e.target.dataset.filter;
    renderSponseeOffersByFilter();
  });

  // --- Pagination
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderSponseeOffersByFilter();
    }
  });
  nextPageBtn.addEventListener('click', () => {
    if (currentPage < window._totalPages) {
      currentPage++;
      renderSponseeOffersByFilter();
    }
  });

  // 4. LOAD offers and always render "All" tab on page load
  async function loadSponseeOffers() {
    listingContainer.innerHTML = '<p>Loading sponsorship offers...</p>';
    const { data: offers, error } = await supabase
      .from('private_offers')
      .select('*')
      .eq('sponsee_email', sponsee_email);

    if (error) {
      listingContainer.innerHTML = `<p style="color:red;">Error loading offers: ${error.message}</p>`;
      return;
    }
    allSponseeOffers = (offers || []);
    currentPage = 1;
    currentFilter = "all";
    // Set All tab active
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.tab-btn[data-filter="all"]')?.classList.add('active');
    renderSponseeOffersByFilter();
  }

  // 5. Main render (by filter + page)
  async function renderSponseeOffersByFilter() {
    listingContainer.innerHTML = '';
    // FILTER OUT ARCHIVED OFFERS GLOBALLY!
    let nonArchivedOffers = allSponseeOffers.filter(offer => !offer.archived);
    let filteredOffers = [];
    if (currentFilter === 'all') filteredOffers = nonArchivedOffers;
    else if (currentFilter === 'pending') filteredOffers = nonArchivedOffers.filter(offer => offer.status === 'pending');
    else if (currentFilter === 'accepted') filteredOffers = nonArchivedOffers.filter(offer => offer.status === 'accepted');
    else if (currentFilter === 'stage-3') filteredOffers = nonArchivedOffers.filter(offer => offer.stage === 3);
    else if (currentFilter === 'stage-4') filteredOffers = nonArchivedOffers.filter(offer => offer.stage === 4);
    else if (currentFilter === 'stage-5') {
      filteredOffers = nonArchivedOffers.filter(offer =>
        (Number(offer.stage) === 5) ||
        (offer.status && (
          offer.status === 'completed' ||
          offer.status === 'review_completed' ||
          offer.status === 'review-completed'
        ))
      );
    }
    else if (currentFilter === 'rejected') filteredOffers = nonArchivedOffers.filter(offer =>
      ['rejected', 'Offer Cancelled'].includes(offer.status)
    );
    else if (currentFilter === 'other') filteredOffers = nonArchivedOffers.filter(offer =>
      !['pending', 'accepted', 'in_progress', 'live', 'completed', 'rejected', 'Offer Cancelled', 'review-completed', 'review_completed'].includes(offer.status) &&
      ![1,2,3,4,5].includes(offer.stage)
    );

    const totalOffers = filteredOffers.length;
    window._totalPages = Math.max(1, Math.ceil(totalOffers / offersPerPage));
    if (currentPage > window._totalPages) currentPage = window._totalPages;
    const start = (currentPage - 1) * offersPerPage;
    const end = start + offersPerPage;
    const paginatedOffers = filteredOffers.slice(start, end);

    paginationLabel.textContent = `Page ${totalOffers === 0 ? 0 : currentPage} of ${window._totalPages}`;
    prevPageBtn.disabled = (currentPage <= 1);
    nextPageBtn.disabled = (currentPage >= window._totalPages);
    totalLabel.textContent = `Total Offers: ${totalOffers}`;

    if (paginatedOffers.length === 0) {
      listingContainer.innerHTML = '<p>No offers found for this filter/page.</p>';
    } else {
      for (const offer of paginatedOffers) {
        if (offer.status === 'review_completed' && offer.stage === 5) {
          const { data: sponseeReview } = await supabase
            .from('private_offer_reviews')
            .select('id')
            .eq('offer_id', offer.id)
            .eq('reviewer_id', sponsee_id)
            .maybeSingle();
          if (!sponseeReview) {
            await renderSingleOfferCard(offer, false);
          }
        } else {
          await renderSingleOfferCard(offer, false);
        }
      }
    }
  }

  function renderPaginationControls(totalOffers, totalPages) {
    const controls = document.getElementById('pagination-controls');
    const totalLabel = document.getElementById('sponsee-offer-total-label');
    if (!controls || !totalLabel) return;

    controls.innerHTML = `
      <button id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Prev</button>
      <span id="page-info" style="margin:0 10px;">Page ${totalOffers === 0 ? 0 : currentPage} of ${totalPages}</span>
      <button id="next-page" ${currentPage === totalPages || totalOffers === 0 ? 'disabled' : ''}>Next &raquo;</button>
    `;
    totalLabel.textContent = `Total Offers: ${totalOffers}`;

    controls.querySelector('#prev-page')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderSponseeOffersByFilter(document.querySelector('.tab-btn.active')?.dataset.filter || "all");
      }
    });
    controls.querySelector('#next-page')?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderSponseeOffersByFilter(document.querySelector('.tab-btn.active')?.dataset.filter || "all");
      }
    });
  }

  async function getSponsorId(username) {
    try {
      const { data } = await supabase
        .from('users_extended_data')
        .select('user_id')
        .eq('username', username)
        .single();
      return data?.user_id || '';
    } catch { return ''; }
  }

  // ============== Group Offer: compute current per-member share ==============
async function computeGroupShare(offer) {
  const isGroup =
    offer?.group_offer === true ||
    String(offer?.group_offer).toLowerCase() === 'true' ||
    Number(offer?.group_offer) === 1;

  if (!isGroup) return null;

  const total = Number(offer?.offer_amount) || 0;

  // Try to find a stable grouping key on the row (handle multiple schemas)
  const keyCandidates = [
    'group_offer_id','group_offer_uuid','group_offer_key','group_offer_ref','group_offer_token',
    'group_id','group_uuid','group_ref','group_code',
    'root_offer_id','parent_offer_id','bundle_id','offer_group_id'
  ];
  let keyName = null, keyVal = null;
  for (const k of keyCandidates) {
    if (offer && offer[k] != null && offer[k] !== '') { keyName = k; keyVal = offer[k]; break; }
  }

  // Base query: all private_offers rows for this same group offer
  let q = supabase
    .from('private_offers')
    .select('id, status, stage')
    .eq('group_offer', true);

  if (keyName) {
    q = q.eq(keyName, keyVal);
  } else {
    // Fallback (best-effort): match by same sponsor + same title
    // (keeps it practical when an explicit key isn't present)
    q = q
      .eq('sponsor_username', offer.sponsor_username)
      .eq('sponsor_email', offer.sponsor_email)
      .eq('offer_title', offer.offer_title);
  }

  const { data: rows, error } = await q;
  if (error || !Array.isArray(rows)) {
    return { accepted: 1, share: total }; // safe fallback
  }

  // Count members who are effectively "in" (accepted or beyond)
  const okStatuses = new Set(['accepted','in_progress','live','completed','review_completed','review-completed']);
  const acceptedRows = rows.filter(r => (Number(r.stage) >= 2) || (r.status && okStatuses.has(String(r.status))));
  const accepted = Math.max(acceptedRows.length, 1);

  return { accepted, share: total / accepted };
}


  async function renderSingleOfferCard(offer, forceShowReview = false) {
    let sponsorPicUrl = 'logos.png';
    let sponsor_id = '';
    try {
      const { data: sponsor } = await supabase
        .from('users_extended_data')
        .select('profile_pic, user_id, username')
        .eq('username', offer.sponsor_username)
        .single();
      if (sponsor && sponsor.profile_pic) {
        sponsorPicUrl = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsor.profile_pic}`;
      }
      sponsor_id = sponsor?.user_id || '';
    } catch { }

    // Build platform badges with URL mapping (like sponsor)
    const pairs = pairUrlsAndDates(offer);
    const platformBadgeHtml = (offer.platforms && offer.platforms.length)
      ? `<div style="margin-bottom:8px;margin-top:4px;">${renderPlatformBadges(offer.platforms, pairs)}</div>`
      : '';

    const stageProgress = [20, 40, 60, 80, 100][offer.stage - 1] || 0;
    const stageLabels = [
      'Stage 1: Offer Received',
      'Stage 2: Offer Accepted',
      'Stage 3: Creating',
      'Stage 4: Content Live',
      'Stage 5: Sponsorship Completed - Review'
    ];
    const progressColor = offer.stage === 5 ? 'background-color: green;' : '';
    const stageHeader = `${platformBadgeHtml}<h3>${stageLabels[offer.stage - 1] || 'Unknown Stage'}</h3>
      <div class="progress-container">
        <div class="progress-bar" style="width: ${stageProgress}%; ${progressColor}"></div>
      </div>`;

    // Build Stage-specific actions (sponsee doesn’t delete offers)
    let actionButtons = '';
    if (offer.stage === 1 && offer.status === 'pending') {
      actionButtons = `
        <button class="confirm-offer">Accept Offer</button>
        <button class="reject-offer">Reject Offer</button>
      `;
    } else if (offer.stage === 2 && offer.status === 'accepted') {
      actionButtons = `
        <div class="creation-scheduling">
          <label for="creation-date-${offer.id}"><strong>Select Creation Date:</strong></label><br>
          <input type="date" id="creation-date-${offer.id}" class="creation-date">
          <button class="creation-now-btn">Created by</button>
        </div>
      `;
    } else if (offer.stage === 3) {
      // MULTI-URL INPUTS — one date + url per platform
      const plats = parsePlatforms(offer.platforms);
      const placeholders = {
        youtube: 'https://www.youtube.com/watch?v=...',
        twitch: 'https://www.twitch.tv/videos/123456789',
        instagram: 'https://www.instagram.com/p/....',
        tiktok: 'https://www.tiktok.com/@user/video/....',
        twitter: 'https://x.com/username/status/....',
        facebook: 'https://www.facebook.com/....',
        snapchat: 'https://www.snapchat.com/add/....'
      };

      const inputsHtml = (plats.length ? plats : ['content']).map((p, idx) => `
        <div class="per-url-row" data-index="${idx}" style="margin:10px 0 14px 0;padding:10px;border:1px dashed #444;border-radius:8px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <label for="url-date-${offer.id}-${idx}" style="min-width:140px;"><strong>Live Date${p && p !== 'content' ? ` (${p})` : ''}:</strong></label>
            <input type="date" id="url-date-${offer.id}-${idx}" class="per-url-date" style="flex:0 0 170px;">
          </div>
          <div style="margin-top:6px;">
            <label for="live-url-${offer.id}-${idx}">
              <strong>Link to Live Content${p && p !== 'content' ? ` (${p})` : ''}:</strong>
            </label><br>
            <input
              type="url"
              id="live-url-${offer.id}-${idx}"
              class="per-url-input"
              data-platform="${p || 'content'}"
              placeholder="${placeholders[p?.toLowerCase()] || 'https://example.com/content'}"
              style="width:100%;">
          </div>
        </div>
      `).join('');

      actionButtons = `
        <div class="live-scheduling">
          ${inputsHtml}
          <button class="live-now-btn">Live</button>
        </div>
      `;
    } else if (offer.stage === 4) {
  if (offer.sponsor_live_confirmed) {
    const isGroupOffer =
      offer?.group_offer === true ||
      String(offer?.group_offer).toLowerCase() === 'true' ||
      Number(offer?.group_offer) === 1;

    actionButtons = isGroupOffer ? `
      <div class="stage-4-actions">
        <button class="receive-payment"
                disabled
                data-group-lock="true"
                style="opacity:.5;cursor:not-allowed;"
                title="Group payouts are processed after the group deadline by an admin.">
          Payout after deadline
        </button>
        <small style="display:block;margin-top:6px;color:#bbb;">
          Group offer — payouts are scheduled after the deadline.
        </small>
      </div>
    ` : `
      <div class="stage-4-actions">
        <button class="receive-payment">Accept Payment</button>
      </div>
    `;
  } else {
    actionButtons = `
      <div class="stage-4-actions">
        <button class="receive-payment" disabled style="opacity:.5;cursor:not-allowed;">Waiting for Sponsor Confirmation</button>
      </div>
      <small style="color:#e87f00;font-size:0.98em;">Waiting for sponsor to confirm content is live.</small>
    `;
  }
}
 else if (offer.stage === 5) {
      actionButtons = `
        <div class="stage-5-summary">
          <p><strong>✅ Sponsorship complete. Thank you!</strong></p>
        </div>
        <button class="review" data-offer-id="${offer.id}">Leave Review</button>
      `;
    }

    // Live URL(s) + per-link date display (Stage 4+)
    const firstLiveDate =
      offer.live_date ||
      earliestDate(offer.url_dates) ||
      (pairs.length ? pairs[0].date : null);



    const reportBtnHtml = `
      <button
        class="report-btn"
        style="
          position:absolute;
          top:-27px;
          left:-30px;
          background:none;
          border:none !important;
          outline:none !important;
          box-shadow:none !important;
          cursor:pointer;
          color:#e03232;
          font-size:1.25em;
          z-index:4;
        "
        title="Report Offer"
        onclick="window.openReportModal('offer', '${offer.id}')"
      >🚩</button>
    `;
    // --- Group offer share / payout display ---
let amountHtml = `<p><strong>Amount:</strong> $${Number(offer.offer_amount).toLocaleString()}</p>`;
let payoutAmount = Number(offer.offer_amount) || 0;

if (
  offer?.group_offer === true ||
  String(offer?.group_offer).toLowerCase() === 'true' ||
  Number(offer?.group_offer) === 1
) {
  const shareInfo = await computeGroupShare(offer);
  if (shareInfo) {
    payoutAmount = shareInfo.share;
    amountHtml = `
      <p><strong>Total Amount (Group):</strong> $${Number(offer.offer_amount).toLocaleString()}</p>
      <p><strong>Your current share:</strong>
        $${shareInfo.share.toFixed(2)}
        <small style="color:#bbb;">(${shareInfo.accepted} accepted)</small>
      </p>
    `;
  }
}

    const card = document.createElement('div');
    card.className = 'listing-stage';
    card.dataset.offerId = offer.id;
    card.dataset.payoutAmount = String(payoutAmount);
    card.dataset.sponsorUsername = offer.sponsor_username;
    card.dataset.sponseeUsername = sponsee_username;
    card.dataset.sponsorId = sponsor_id;
    card.dataset.sponsorEmail = offer.sponsor_email;

    // NEW: mark as group offer
const _isGroupOffer =
  offer?.group_offer === true ||
  String(offer?.group_offer).toLowerCase() === 'true' ||
  Number(offer?.group_offer) === 1;
card.dataset.groupOffer = _isGroupOffer ? 'true' : 'NULL';

    card.innerHTML = `
      <div class="card-content" style="position:relative;">
        ${reportBtnHtml}
        <div class="card-top">
          <div class="logo-container">
            <img src="${sponsorPicUrl}" onerror="this.src='./logos.png'" alt="Sponsor Profile Pic" class="stage-logo profile-link" data-username="${offer.sponsor_username}">
            <p><strong>From:</strong> ${offer.sponsor_username}</p>
            <p><strong>At:</strong> ${offer.sponsor_company}</p>
          </div>
          <div class="stage-content">
            ${stageHeader}
            <div class="offer-details-row">
              <div class="offer-left">
                <p><strong>Offer Title:</strong> ${offer.offer_title}</p>
                <p><strong>Status:</strong> <span style="color: ${
                  offer.status === 'pending' ? 'orange' :
                  offer.status === 'accepted' ? 'green' :
                  offer.status === 'live' ? 'blue' :
                  ['rejected', 'Offer Cancelled'].includes(offer.status) ? 'red' :
                  'inherit'
                }">${offer.status}</span></p>
                <p><strong>Date:</strong> ${new Date(offer.created_at).toLocaleDateString()}</p>
                <p><strong>Deadline:</strong> ${new Date(offer.deadline).toLocaleDateString()}</p>
                ${offer.stage >= 3 && offer.creation_date ? `<p><strong>Creation Date:</strong> ${new Date(offer.creation_date).toLocaleDateString()}</p>` : ''}
                ${offer.stage >= 4 && firstLiveDate ? `<p><strong>First Live Date:</strong> ${new Date(firstLiveDate).toLocaleDateString()}</p>` : ''}
              </div>
              <div class="offer-right">
                ${(() => {
  // This string is built before card.innerHTML below — see code right above card creation.
  return amountHtml;
})()}
<p><strong>Payment Schedule:</strong> ${offer.payment_schedule}</p>
<p><strong>Duration:</strong> ${offer.sponsorship_duration}</p>

              </div>
            </div>
          </div>
        </div>
        <div class="card-bottom" data-offer-id="${offer.id}">
          <button class="offer-Comments">Comments</button>
          <button class="offer-img">Offer Images</button>
          <button class="expand-btn">View Details</button>
          ${offer.stage === 4 ? '<button class="data-summary-btn">Data Summary</button>' : ''}
          <div class="details-section" style="display:none;">
            <p><fieldset><legend><strong>Description:</strong></legend>${offer.offer_description}</fieldset></p>
            <div class="job-deliverable-row">
              <span><strong>Job Type:</strong> ${offer.job_type}</span>
              <span><strong>Deliverable Type:</strong> ${offer.deliverable_type}</span>
            </div>
            <p><fieldset><legend><strong>Instructions:</strong></legend>${offer.instructions}</fieldset></p>
          </div>
          <div class="images-section" style="display:none;gap:20px;padding:10px;">
            <div class="image-viewer" style="flex:1;text-align:center;">
              <img class="main-image" src="" alt="Selected Image" style="max-width:100%;height:350px;border:1px solid #ccc;border-radius:8px;">
              <div style="margin-top:15px;">
                <button class="prev-image">Previous</button>
                <button class="next-image">Next</button>
              </div>
            </div>
            <div class="image-thumbnails" style="width:60px;overflow-y:auto;border:1px solid #ddd;padding:10px;border-radius:8px"></div>
          </div>
          <div class="comments-section" style="display:none;">
            <div class="existing-comments"></div>
            <textarea placeholder="Write a comment..." class="comment-input"></textarea><br>
            <button class="submit-comment">Submit Comment</button>
          </div>
          <div class="data-summary-section" style="display:none;"></div>
          ${actionButtons}
        </div>
      </div>
    `;
    listingContainer.appendChild(card);
  }

  listingContainer.addEventListener('click', async (e) => {
    const offerCard = e.target.closest('.listing-stage');
    if (!offerCard) return;
    const offerId = offerCard.dataset.offerId;
    const sponsorUsername = offerCard.dataset.sponsorUsername;
    const sponseeUsername = offerCard.dataset.sponseeUsername;
    const sponsorId = offerCard.dataset.sponsorId;
    const sponsorEmail = offerCard.dataset.sponsorEmail;
    const cardBottom = offerCard.querySelector('.card-bottom');
    if (!cardBottom) return;

    const detailsSection = cardBottom.querySelector('.details-section');
    const imagesSection = cardBottom.querySelector('.images-section');
    const commentsSection = cardBottom.querySelector('.comments-section');
    const thumbnailsContainer = imagesSection.querySelector('.image-thumbnails');
    const dataSummarySection = cardBottom.querySelector('.data-summary-section');

    function hideAllSections() {
      detailsSection.style.display = 'none';
      imagesSection.style.display = 'none';
      commentsSection.style.display = 'none';
      if (dataSummarySection) {
        dataSummarySection.style.display = 'none';
        dataSummarySection.innerHTML = '';
      }
    }

    if (e.target.classList.contains('expand-btn')) {
      const isVisible = detailsSection.style.display === 'block';
      hideAllSections();
      detailsSection.style.display = isVisible ? 'none' : 'block';
      return;
    }

    if (e.target.classList.contains('offer-img')) {
      const isVisible = imagesSection.style.display === 'flex';
      hideAllSections();
      if (!isVisible) {
        imagesSection.style.display = 'flex';
        thumbnailsContainer.innerHTML = '<p>Loading images...</p>';
        const { data: offerData, error: offerError } = await supabase
          .from('private_offers')
          .select('offer_images')
          .eq('id', offerId)
          .single();
        if (offerError || !offerData || !offerData.offer_images) {
          thumbnailsContainer.innerHTML = '<p>Failed to load images.</p>';
          return;
        }
        const imageFilenames = offerData.offer_images;
        const imageUrls = imageFilenames.map(filename =>
          supabase.storage.from('offers').getPublicUrl(filename).data.publicUrl
        );
        const imageViewer = imagesSection.querySelector('.main-image');
        const prevBtn = imagesSection.querySelector('.prev-image');
        const nextBtn = imagesSection.querySelector('.next-image');
        let currentIndex = 0;
        const showImage = (index) => {
          currentIndex = index;
          imageViewer.src = imageUrls[index];
          Array.from(thumbnailsContainer.children).forEach((thumb, i) => {
            thumb.style.border = (i === index) ? '2px solid #007BFF' : '1px solid #ccc';
          });
        };
        thumbnailsContainer.innerHTML = '';
        imageUrls.forEach((url, index) => {
          const thumb = document.createElement('img');
          thumb.src = url;
          thumb.alt = `Image ${index + 1}`;
          thumb.style.width = '100%';
          thumb.style.marginBottom = '10px';
          thumb.style.cursor = 'pointer';
          thumb.style.border = '1px solid #ccc';
          thumb.style.borderRadius = '4px';
          thumb.addEventListener('click', () => showImage(index));
          thumbnailsContainer.appendChild(thumb);
        });
        if (imageUrls.length > 0) showImage(0);
        prevBtn.onclick = () => showImage((currentIndex - 1 + imageUrls.length) % imageUrls.length);
        nextBtn.onclick = () => showImage((currentIndex + 1) % imageUrls.length);
      }
      return;
    }

    if (e.target.classList.contains('offer-Comments')) {
      const isVisible = commentsSection.style.display === 'block';
      hideAllSections();
      if (!isVisible) {
        commentsSection.style.display = 'block';
        await reloadOfferComments();
      }
      return;
    }

    // --- Data Summary (multi-URL; toggle; shows "Loading i of N") ---
    if (e.target.classList.contains('data-summary-btn')) {
      if (!dataSummarySection) return;

      const isVisible = dataSummarySection.style.display === 'block';
      if (isVisible) {
        dataSummarySection.style.display = 'none';
        dataSummarySection.innerHTML = '';
        return;
      }

      hideAllSections();
      dataSummarySection.style.display = 'block';

      const offerObj = allSponseeOffers.find(o => String(o.id) === String(offerId)) || {};
      const pairs = pairUrlsAndDates(offerObj);
      if (!pairs.length) {
        dataSummarySection.innerHTML = "<span style='color:#faa;'>No video URLs found.</span>";
        return;
      }

      // Loading header with progress counter
      const total = pairs.length;
      dataSummarySection.innerHTML = `
        <div id="ds-progress" style="color:#fff;margin-bottom:8px;font-size:0.95em;">
          <span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid #999;border-top-color:#fff;border-radius:50%;margin-right:8px;animation:spin 0.8s linear infinite;"></span>
          Loading <b id="ds-count">1</b> of <b>${total}</b>…
        </div>
        <div id="ds-results"></div>
        <style>@keyframes spin { to { transform: rotate(360deg);} }</style>
      `;
      const countNode = dataSummarySection.querySelector('#ds-count');
      const resultsNode = dataSummarySection.querySelector('#ds-results');

      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;

      const blocks = [];
      let index = 0;
      const wrapRow = (label, value) => `<div><b>${label}</b><br>${value ?? '-'}</div>`;

      for (const { url: link, date } of pairs) {
        index += 1;
        if (countNode) countNode.textContent = String(index);

        const dateBadge = date ? `<div style="font-size:0.92em;margin-top:2px;color:#ddd;">📅 Live Date (set): ${new Date(date).toLocaleDateString()}</div>` : '';

        // === YouTube ===
        if (/youtube\.com|youtu\.be/i.test(link)) {
          const videoId = extractYouTubeVideoId(link);
          if (!videoId) {
            // Try snapshot since live link is invalid
            const fb = await statsnapFallback({ originalUrl: link, platformHint: 'youtube' });
            if (fb) {
              blocks.push(renderSnapshotBlock('youtube', link, fb.metrics, dateBadge, 'Could not parse YouTube URL — showing cached stats.'));
            } else {
              blocks.push(`<div style="color:#faa;">Invalid YouTube URL: ${link}</div>`);
            }
            resultsNode.innerHTML = blocks.join('');
            continue;
          }
          try {
            const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-youtube-video-stats', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoId })
            });
            const stats = await resp.json();

            if (resp.ok && stats?.success) {
              // ✅ Save snapshot
              const metrics = {
                views: Number(stats.video?.statistics?.viewCount) || 0,
                likes: Number(stats.video?.statistics?.likeCount) || 0,
                comments: Number(stats.video?.statistics?.commentCount) || 0
              };
              try {
                await statsnapSaveAfterSuccess({
                  originalUrl: link,
                  platformHint: 'youtube',
                  offerId,
                  liveMetrics: metrics,
                  raw: stats.video
                });
              } catch {}

              const thumb = stats.video.snippet.thumbnails?.medium?.url || stats.video.snippet.thumbnails?.default?.url || '';
              const duration = stats.video.contentDetails?.duration
                ? parseISO8601Duration(stats.video.contentDetails.duration)
                : '';
              blocks.push(`
                <div style="background:none;border-radius:15px;box-shadow:none;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.09em;">
                  <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                    ${thumb ? `<img src="${thumb}" alt="Video thumbnail" style="width:auto;height:80px;border-radius:8px;object-fit:cover;border:1px solid #222;background:#111;margin-right:10px;">` : ''}
                    <div>
                      <b style="color:red;font-size:1.17em;">
                        <img src="youtubelogo.png" style="height:25px;vertical-align:-2px;margin-right:6px;border-radius:8px">
                        ${stats.video.snippet.title}
                      </b>
                      ${duration ? `<div style="font-size:0.96em;color:white;margin-top:2px;">Duration ⏱ ${duration}</div>` : ''}
                      ${dateBadge}
                    </div>
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:24px 32px;">
                    <div><b>📅 Published:</b><br>${new Date(stats.video.snippet.publishedAt).toLocaleDateString()}</div>
                    <div><b>👀 Views:</b><br>${stats.video.statistics.viewCount}</div>
                    <div><b>👍 Likes:</b><br>${stats.video.statistics.likeCount || '-'}</div>
                    <div><b>💬 Comments:</b><br>${stats.video.statistics.commentCount || '-'}</div>
                  </div>
                  <div style="margin-top:10px;text-align:right;">
                    <a href="https://youtube.com/watch?v=${stats.video.id}" target="_blank" style="color:#36aaff;text-decoration:underline;font-size:0.96em;">Open on YouTube ↗</a>
                  </div>
                </div>
              `);
            } else {
              // ❌ Live failed → try snapshot
              const fb = await statsnapFallback({ originalUrl: link, platformHint: 'youtube' });
              if (fb) {
                blocks.push(renderSnapshotBlock('youtube', link, fb.metrics, dateBadge, 'Live fetch failed — showing cached stats.'));
              } else {
                blocks.push(`<div style="color:#faa;">Could not fetch YouTube stats for ${link}.</div>`);
              }
            }
          } catch {
            const fb = await statsnapFallback({ originalUrl: link, platformHint: 'youtube' });
            if (fb) {
              blocks.push(renderSnapshotBlock('youtube', link, fb.metrics, dateBadge, 'Error fetching live — showing cached stats.'));
            } else {
              blocks.push(`<div style="color:#faa;">Error loading YouTube stats for ${link}.</div>`);
            }
          }
          resultsNode.innerHTML = blocks.join('');
          continue;
        }

        // === TikTok ===
        if (/(^|\.)(tiktok\.com)/i.test(link) || /vm\.tiktok\.com|vt\.tiktok\.com/i.test(link)) {
          try {
            const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-tiktok-video-stats', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ video_url: link })
            });
            const tk = await resp.json();

            if (resp.ok && tk?.ok && tk?.found && tk?.video) {
              const v = tk.video || {};
              const thumb = v.cover || 'tiktoklogo.png';
              const created = v.create_time ? epochToDateString(v.create_time) : null;
              const desc = (v.description || '').trim();
              const shortDesc = desc ? (desc.length > 140 ? desc.slice(0, 140) + '…' : desc) : '';
              const vurl = v.url || link;

              const views = Number(v.stats?.view_count ?? 0);
              const likes = Number(v.stats?.like_count ?? 0);
              const comments = Number(v.stats?.comment_count ?? 0);
              const shares = Number(v.stats?.share_count ?? 0);

              // ✅ Save snapshot
              try {
                await statsnapSaveAfterSuccess({
                  originalUrl: link,
                  platformHint: 'tiktok',
                  offerId,
                  liveMetrics: { views, likes, comments, shares },
                  raw: v
                });
              } catch {}

              const viewsTxt = fmtNum(views);
              const likesTxt = fmtNum(likes);
              const commentsTxt = fmtNum(comments);
              const sharesTxt = fmtNum(shares);

              blocks.push(`
                <div style="background:none;border-radius:15px;box-shadow:none;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.09em;">
                  <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                    <img src="${thumb}" referrerpolicy="no-referrer" alt="TikTok video" style="width:auto;height:80px;border-radius:8px;object-fit:cover;border:1px solid #222;background:#111;margin-right:10px;">
                    <div>
                      <b style="color:#ff3b5c;font-size:1.17em;">
                        <img src="tiktoklogo.png" style="height:25px;vertical-align:-2px;margin-right:6px;;border-radius:8px">
                        TikTok Video
                      </b>
                      ${created ? `<div style="font-size:0.96em;color:white;margin-top:2px;">Published ${created}</div>` : ''}
                      ${dateBadge}
                      ${shortDesc ? `<div style="font-size:0.95em;color:#ddd;margin-top:6px;">${shortDesc}</div>` : ''}
                    </div>
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:24px 32px;">
                    <div><b>👀 Views:</b><br>${viewsTxt}</div>
                    <div><b>👍 Likes:</b><br>${likesTxt}</div>
                    <div><b>💬 Comments:</b><br>${commentsTxt}</div>
                    <div><b>🔁 Shares:</b><br>${sharesTxt}</div>
                  </div>
                  <div style="margin-top:10px;text-align:right;">
                    <a href="${vurl}" target="_blank" style="color:#ff3b5c;text-decoration:underline;font-size:0.96em;">Open on TikTok ↗</a>
                  </div>
                </div>
              `);
            } else if (resp.ok && tk?.ok && tk?.found === false) {
              // Try snapshot — maybe it was fetched earlier
              const fb = await statsnapFallback({ originalUrl: link, platformHint: 'tiktok' });
              if (fb) {
                blocks.push(renderSnapshotBlock('tiktok', link, fb.metrics, dateBadge, 'Couldn’t match account — showing cached stats.'));
              } else {
                blocks.push(`<div style="color:#faa;">Couldn’t match this TikTok link to your connected account’s videos: <a href="${link}" target="_blank" style="color:#ff3b5c;">${link}</a></div>`);
              }
            } else {
              const fb = await statsnapFallback({ originalUrl: link, platformHint: 'tiktok' });
              if (fb) {
                blocks.push(renderSnapshotBlock('tiktok', link, fb.metrics, dateBadge, 'Live fetch failed — showing cached stats.'));
              } else {
                blocks.push(`<div style="color:#faa;">Could not fetch TikTok stats for ${link}.</div>`);
              }
            }
          } catch {
            const fb = await statsnapFallback({ originalUrl: link, platformHint: 'tiktok' });
            if (fb) {
              blocks.push(renderSnapshotBlock('tiktok', link, fb.metrics, dateBadge, 'Error fetching live — showing cached stats.'));
            } else {
              blocks.push(`<div style="color:#faa;">Error loading TikTok stats for ${link}.</div>`);
            }
          }
          resultsNode.innerHTML = blocks.join('');
          continue;
        }

        // === Twitch ===
        if (/twitch\.tv/i.test(link)) {
          try {
            const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-twitch-vod-stats', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: link })
            });
            const data = await resp.json();

            const msg = (data?.error || data?.message || data?.detail || '').toLowerCase();
            const vodStatus = (data?.vod?.status || data?.vod?.state || data?.status || '').toLowerCase();
            const looksUnavailable =
              resp.status === 404 ||
              data?.not_found === true ||
              data?.deleted === true ||
              /not[\s-]?found/.test(msg) ||
              /deleted|expired|removed|pruned/.test(msg) ||
              /deleted|expired|removed|pruned/.test(vodStatus);

            if (!resp.ok || !data?.success) {
              if (looksUnavailable) {
                // Try snapshot
                const fb = await statsnapFallback({ originalUrl: link, platformHint: 'twitch' });
                if (fb) {
                  blocks.push(renderSnapshotBlock('twitch', link, fb.metrics, dateBadge, 'VOD unavailable — showing cached stats.'));
                } else {
                  blocks.push(`
                    <div style="background:none;border-radius:15px;box-shadow:none;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.09em;">
                      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                        <img src="twitchlogo.png" style="height:25px;vertical-align:-2px;margin-right:6px;border-radius:5px;">
                        <b style="color:#c9b6ff;font-size:1.05em;">Twitch VOD unavailable</b>
                      </div>
                      <div style="color:#ddd;margin-bottom:6px;">
                        This VOD appears to be deleted or has expired on Twitch, so detailed stats are no longer available.
                        ${dateBadge}
                      </div>
                      <div><a href="${link}" target="_blank" style="color:#a88cff;text-decoration:underline;">Open original link ↗</a></div>
                    </div>
                  `);
                }
              } else {
                const fb = await statsnapFallback({ originalUrl: link, platformHint: 'twitch' });
                if (fb) {
                  blocks.push(renderSnapshotBlock('twitch', link, fb.metrics, dateBadge, 'Live fetch failed — showing cached stats.'));
                } else {
                  blocks.push(`<div style="color:#faa;">Could not fetch Twitch stats for ${link}.</div>`);
                }
              }
            } else {
              const v = data.vod || {};
              const vDeleted =
                v?.deleted === true ||
                /deleted|expired|removed|pruned/.test(String(v?.status || v?.state || ''));

              if (vDeleted) {
                const fb = await statsnapFallback({ originalUrl: link, platformHint: 'twitch' });
                if (fb) {
                  blocks.push(renderSnapshotBlock('twitch', link, fb.metrics, dateBadge, 'VOD removed — showing cached stats.'));
                } else {
                  blocks.push(`
                    <div style="background:none;border-radius:15px;box-shadow:none;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.09em;">
                      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                        <img src="twitchlogo.png" style="height:25px;vertical-align:-2px;margin-right:6px;border-radius:5px;">
                        <b style="color:#c9b6ff;font-size:1.05em;">Twitch VOD unavailable</b>
                      </div>
                      <div style="color:#ddd;margin-bottom:6px;">
                        This VOD was removed or has expired on Twitch. Stats are no longer available.
                        ${dateBadge}
                      </div>
                      <div><a href="${v.url || link}" target="_blank" style="color:#a88cff;text-decoration:underline;">Open original link ↗</a></div>
                    </div>
                  `);
                }
              } else {
                // ✅ Save snapshot
                const metrics = {
                  views: Number(v.view_count ?? 0),
                  likes: 0,
                  comments: 0
                };
                try {
                  await statsnapSaveAfterSuccess({
                    originalUrl: link,
                    platformHint: 'twitch',
                    offerId,
                    liveMetrics: metrics,
                    raw: v
                  });
                } catch {}

                const thumb = normalizeTwitchThumb(v.thumbnail_url) || 'twitchlogo.png';
                const durationText = v.duration?.text || null;
                const creator = v.user_display_name || v.user_login || '-';
                blocks.push(`
                  <div style="background:none;border-radius:15px;box-shadow:none;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.09em;">
                    <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                      <img src="${thumb}" referrerpolicy="no-referrer" alt="VOD thumbnail" style="width:auto;height:80px;border-radius:8px;object-fit:cover;border:1px solid #222;background:#111;margin-right:10px;">
                      <div>
                        <b style="color:#c9b6ff;font-size:1.17em;">
                          <img src="twitchlogo.png" style="height:25px;vertical-align:-2px;margin-right:6px;;border-radius:8px">
                          ${v.title || 'Twitch VOD'}
                        </b>
                        ${durationText ? `<div style="font-size:0.96em;color:white;margin-top:2px;">Duration ⏱ ${durationText}</div>` : ''}
                        ${dateBadge}
                      </div>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:24px 32px;">
                      <div><b>🎮 Game:</b><br>${v.game_name || '-'}</div>
                      <div><b>👤 Creator:</b><br>${creator}</div>
                      <div><b>📅 Created:</b><br>${v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'}</div>
                      <div><b>👀 Views:</b><br>${v.view_count != null ? v.view_count.toLocaleString() : '-'}</div>
                    </div>
                    <div style="margin-top:10px;text-align:right;">
                      <a href="${v.url || link}" target="_blank" style="color:#a88cff;text-decoration:underline;font-size:0.96em;">Open on Twitch ↗</a>
                    </div>
                  </div>
                `);
              }
            }
          } catch {
            const fb = await statsnapFallback({ originalUrl: link, platformHint: 'twitch' });
            if (fb) {
              blocks.push(renderSnapshotBlock('twitch', link, fb.metrics, dateBadge, 'Error fetching live — showing cached stats.'));
            } else {
              blocks.push(`<div style="color:#faa;">Error loading Twitch stats for ${link}.</div>`);
            }
          }
          resultsNode.innerHTML = blocks.join('');
          continue;
        }

        // === Instagram ===
        if (/instagram\.com/i.test(link)) {
          try {
            const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-instagram-media-from-url', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: link })
            });
            const ig = await resp.json();
            if (resp.ok && ig?.ok && ig?.found && ig?.media) {
              const m = ig.media;
              const ins = ig.insights || {};
              const thumb = m.thumbnail_url || m.media_url || 'instagramlogo.png';
              const kind = (m.media_product_type || m.media_type || '').toString().toUpperCase();
              const likes = Number(m.like_count ?? 0);
              const comments = Number(m.comments_count ?? 0);
              const vviews = (m.video_views != null) ? Number(m.video_views) : null;

              // ✅ Save snapshot
              try {
                await statsnapSaveAfterSuccess({
                  originalUrl: link,
                  platformHint: 'instagram',
                  offerId,
                  liveMetrics: {
                    likes,
                    comments,
                    video_views: vviews ?? 0,
                    impressions: Number(ins.impressions ?? 0),
                    reach: Number(ins.reach ?? 0),
                    saved: Number(ins.saved ?? 0),
                    engagement: Number(ins.engagement ?? 0)
                  },
                  raw: { media: m, insights: ins }
                });
              } catch {}

              const cap = (m.caption || '').trim();
              const shortCap = cap ? (cap.length > 120 ? cap.slice(0, 120) + '…' : cap) : '';

              const likesTxt = fmtNum(likes);
              const commentsTxt = fmtNum(comments);
              const viewsTxt = vviews != null ? fmtNum(vviews) : null;

              blocks.push(`
                <div style="background:none;border-radius:15px;box-shadow:none;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.09em;">
                  <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                    <img src="${thumb}" referrerpolicy="no-referrer" alt="Instagram media" style="width:auto;height:80px;border-radius:8px;object-fit:cover;border:1px solid #222;background:#111;margin-right:10px;">
                    <div>
                      <b style="color:#ff8bd2;font-size:1.17em;">
                        <img src="instagramlogo.png" style="height:25px;vertical-align:-2px;margin-right:6px;border-radius:8px">
                        Instagram ${kind || 'Post'}
                      </b>
                      ${m.timestamp ? `<div style="font-size:0.96em;color:white;margin-top:2px;">Published ${new Date(m.timestamp).toLocaleDateString()}</div>` : ''}
                      ${dateBadge}
                      ${shortCap ? `<div style="font-size:0.95em;color:#ddd;margin-top:6px;">${shortCap}</div>` : ''}
                    </div>
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:24px 32px;">
                    <div><b>👍 Likes:</b><br>${likesTxt}</div>
                    <div><b>💬 Comments:</b><br>${commentsTxt}</div>
                    ${viewsTxt ? `<div><b>▶️ Video Views:</b><br>${viewsTxt}</div>` : ''}
                    <div><b>👁️ Impressions:</b><br>${fmtNum(ins.impressions)}</div>
                    <div><b>📣 Reach:</b><br>${fmtNum(ins.reach)}</div>
                    <div><b>💾 Saved:</b><br>${fmtNum(ins.saved)}</div>
                    <div><b>🤝 Engagement:</b><br>${fmtNum(ins.engagement)}</div>
                  </div>
                  <div style="margin-top:10px;text-align:right;">
                    <a href="${m.permalink || link}" target="_blank" style="color:#ff8bd2;text-decoration:underline;font-size:0.96em;">Open on Instagram ↗</a>
                  </div>
                </div>
              `);
            } else if (resp.ok && ig?.ok && ig?.found === false) {
              const fb = await statsnapFallback({ originalUrl: link, platformHint: 'instagram' });
              if (fb) {
                blocks.push(renderSnapshotBlock('instagram', link, fb.metrics, dateBadge, 'Couldn’t match account — showing cached stats.'));
              } else {
                blocks.push(`<div style="color:#faa;">Couldn’t match this Instagram link to your connected account’s media: <a href="${link}" target="_blank" style="color:#ff8bd2;">${link}</a></div>`);
              }
            } else {
              const fb = await statsnapFallback({ originalUrl: link, platformHint: 'instagram' });
              if (fb) {
                blocks.push(renderSnapshotBlock('instagram', link, fb.metrics, dateBadge, 'Live fetch failed — showing cached stats.'));
              } else {
                blocks.push(`<div style="color:#faa;">Could not fetch Instagram stats for ${link}.</div>`);
              }
            }
          } catch {
            const fb = await statsnapFallback({ originalUrl: link, platformHint: 'instagram' });
            if (fb) {
              blocks.push(renderSnapshotBlock('instagram', link, fb.metrics, dateBadge, 'Error fetching live — showing cached stats.'));
            } else {
              blocks.push(`<div style="color:#faa;">Error loading Instagram stats for ${link}.</div>`);
            }
          }
          resultsNode.innerHTML = blocks.join('');
          continue;
        }

        // === Facebook ===
        if (/(facebook\.com|fb\.watch)/i.test(link)) {
          try {
            const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-facebook-post-from-url', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: link })
            });
            const fb = await resp.json();

            if (resp.ok && (fb?.ok || fb?.success)) {
              const p = fb.post || fb.data || {};
              const ins = fb.insights || p.insights || fb.metrics || null;

              // Metrics for snapshot
              const reactions =
                pick(p, 'reactions.summary.total_count', 'reaction_count', 'reactions') ?? fb.reactions_count ?? null;
              const comments =
                pick(p, 'comments.summary.total_count', 'comment_count', 'comments') ?? fb.comments_count ?? null;
              const shares =
                pick(p, 'shares.count', 'share_count', 'shares') ?? fb.shares_count ?? null;

              const impressions = readMetric(ins, ['post_impressions','impressions']);
              const reach = readMetric(ins, ['post_impressions_unique','reach']);
              const engaged = readMetric(ins, ['post_engaged_users','engaged_users']);

              // ✅ Save snapshot
              try {
                await statsnapSaveAfterSuccess({
                  originalUrl: link,
                  platformHint: 'facebook',
                  offerId,
                  liveMetrics: {
                    reactions: Number(reactions ?? 0),
                    comments: Number(comments ?? 0),
                    shares: Number(shares ?? 0),
                    impressions: Number(impressions ?? 0),
                    reach: Number(reach ?? 0),
                    engaged_users: Number(engaged ?? 0)
                  },
                  raw: { post: p, insights: ins }
                });
              } catch {}

              const permalink = p.permalink_url || p.link || link;
              const created = p.created_time || p.created_at || p.created || null;
              const message = (p.message || p.story || '').toString().trim();
              const shortMsg = message ? (message.length > 150 ? message.slice(0,150) + '…' : message) : '';

              const thumb = fbFindImage(p) || 'facebooklogo.png';

              blocks.push(`
                <div style="background:none;border-radius:15px;box-shadow:none;padding:26px 30px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.09em;">
                  <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                    <img src="${thumb}" referrerpolicy="no-referrer" alt="Facebook post" style="width:auto;height:80px;border-radius:8px;object-fit:cover;border:1px solid #222;background:#111;margin-right:10px;">
                    <div>
                      <b style="color:#7fb4ff;font-size:1.17em;">
                        <img src="facebooklogo.png" style="height:25px;vertical-align:-2px;margin-right:6px;;border-radius:8px">
                        Facebook Post
                      </b>
                      ${created ? `<div style="font-size:0.96em;color:white;margin-top:2px;">Published ${new Date(created).toLocaleDateString()}</div>` : ''}
                      ${dateBadge}
                      ${shortMsg ? `<div style="font-size:0.95em;color:#ddd;margin-top:6px;">${shortMsg}</div>` : ''}
                    </div>
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:24px 32px;">
                    ${reactions != null ? `<div><b>👍 Reactions:</b><br>${fmtNum(reactions)}</div>` : ''}
                    ${comments != null ? `<div><b>💬 Comments:</b><br>${fmtNum(comments)}</div>` : ''}
                    ${shares != null ? `<div><b>🔁 Shares:</b><br>${fmtNum(shares)}</div>` : ''}
                    ${impressions != null ? `<div><b>👁️ Impressions:</b><br>${fmtNum(impressions)}</div>` : ''}
                    ${reach != null ? `<div><b>📣 Reach:</b><br>${fmtNum(reach)}</div>` : ''}
                    ${engaged != null ? `<div><b>🤝 Engaged Users:</b><br>${fmtNum(engaged)}</div>` : ''}
                  </div>
                  <div style="margin-top:10px;text-align:right;">
                    <a href="${permalink}" target="_blank" style="color:#7fb4ff;text-decoration:underline;font-size:0.96em;">Open on Facebook ↗</a>
                  </div>
                </div>
              `);
            } else {
              const fbSnap = await statsnapFallback({ originalUrl: link, platformHint: 'facebook' });
              if (fbSnap) {
                blocks.push(renderSnapshotBlock('facebook', link, fbSnap.metrics, dateBadge, 'Live fetch failed — showing cached stats.'));
              } else {
                blocks.push(`<div style="color:#faa;">Could not fetch Facebook post stats for <a href="${link}" target="_blank" style="color:#7fb4ff;">${link}</a>.</div>`);
              }
            }
          } catch {
            const fbSnap = await statsnapFallback({ originalUrl: link, platformHint: 'facebook' });
            if (fbSnap) {
              blocks.push(renderSnapshotBlock('facebook', link, fbSnap.metrics, dateBadge, 'Error fetching live — showing cached stats.'));
            } else {
              blocks.push(`<div style="color:#faa;">Error loading Facebook post stats for ${link}.</div>`);
            }
          }
          resultsNode.innerHTML = blocks.join('');
          continue;
        }

        // Unknown / unsupported link
        blocks.push(`<div style="color:#ccc;">No stats integration for: <a href="${link}" target="_blank" style="color:#9ad;">${link}</a>${date ? ` <em style="color:#ddd;">(${new Date(date).toLocaleDateString()})</em>` : ''}</div>`);
        resultsNode.innerHTML = blocks.join('');
      }

      // Done — remove the loader
      const prog = dataSummarySection.querySelector('#ds-progress');
      if (prog) prog.remove();
      return;
    }

    if (e.target.classList.contains('submit-comment')) {
      const textarea = commentsSection.querySelector('.comment-input');
      const commentText = textarea.value.trim();
      if (!commentText) {
        alert('Comment cannot be empty.');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;
      const jwt = session?.access_token;
      if (!jwt || !user_id) {
        alert("Not authenticated. Please log in again.");
        return;
      }
      const modResult = await famBotModerateWithModal({
        user_id,
        content: commentText,
        jwt,
        type: 'comment'
      });
      if (!modResult.allowed) return;

      const sender = sponsee_username;
      const { error } = await supabase
        .from('private_offer_comments')
        .insert([{
          offer_id: offerId,
          user_id: user_id,
          sponsor_id: sponsorId,
          sponsor_email: sponsorEmail,
          sponsee_id: sponsee_id,
          sponsee_email: sponsee_email,
          sender: sender,
          comment_text: commentText
        }]);
      if (error) {
        alert('Failed to submit comment.');
      } else {
        textarea.value = '';
        await reloadOfferComments();

        await notifyComment({
          offer_id: offerId,
          from_user_id: sponsee_id,
          to_user_id: sponsorId,
          from_username: sender,
          message: commentText
        });
      }
      return;
    }

    async function reloadOfferComments() {
      const existingComments = commentsSection.querySelector('.existing-comments');
      existingComments.innerHTML = '<p>Loading comments...</p>';
      const { data: comments, error } = await supabase
        .from('private_offer_comments')
        .select('*')
        .eq('offer_id', offerId)
        .order('created_at', { ascending: true });
      if (error || !comments || comments.length === 0) {
        existingComments.innerHTML = '<p>No comments yet.</p>';
      } else {
        existingComments.innerHTML = '';
        for (const comment of comments) {
          const displayName = comment.sender || 'Anonymous';
          const reportCommentBtn = `
            <button
              class="report-btn"
              style="background:none;border:none;cursor:pointer;color:#e03232;font-size:1em;margin-left:8px;"
              title="Report Comment"
              onclick="window.openReportModal('comment', '${comment.id}')"
            >🚩</button>
          `;
          const commentEl = document.createElement('p');
          commentEl.innerHTML = `<strong>${displayName}:</strong> ${comment.comment_text} <em>(${new Date(comment.created_at).toLocaleString()})</em> ${reportCommentBtn}`;
          existingComments.appendChild(commentEl);
        }
      }
    }

    if (e.target.classList.contains('confirm-offer')) {

      // -------- Free-plan cap: max 1 active sponsorship --------
      const plan = (window.SS_PLAN_TYPE || '').toLowerCase();
      if (plan === 'free') {
        const activeCount = await getCurrentSponseeActiveOfferCount();
        if (activeCount >= 1) {
          alert(
            'Free Sponsor Sorter accounts can only have one active sponsorship at a time.\n\n' +
            'Complete or finish your current sponsorship, or upgrade to Pro to accept more offers.'
          );
          return; // stop here – do NOT accept this offer
        }
      }
      // ---------------------------------------------------------

      if (window.confirm("Are you sure you want to accept this offer?")) {
        const { error } = await supabase
          .from('private_offers')
          .update({ status: 'accepted', stage: 2 })
          .eq('id', offerId);
        if (error) {
          alert(`Error accepting offer: ${error.message}`);
        } else {
          await notifyOfferStatus({
            offer_id: offerId,
            to_user_id: sponsorId,
            status: 'accepted',
            offer_title: offerCard.querySelector('.offer-left strong').nextSibling.textContent
          });
          await loadSponseeOffers();
        }
      }
      return;
    }

    if (e.target.classList.contains('reject-offer')) {
      if (window.confirm("Are you sure you want to reject this offer? This action cannot be undone.")) {
        const { error } = await supabase
          .from('private_offers')
          .update({ status: 'rejected' })
          .eq('id', offerId);
        if (error) alert(`Error rejecting offer: ${error.message}`);
        else {
          await notifyOfferStatus({
            offer_id: offerId,
            to_user_id: sponsorId,
            status: 'rejected',
            offer_title: offerCard.querySelector('.offer-left strong').nextSibling.textContent
          });
          await loadSponseeOffers();
        }
      }
      return;
    }

    if (e.target.classList.contains('creation-now-btn')) {
      const dateInput = offerCard.querySelector('.creation-date');
      const selectedDate = dateInput.value;
      if (!selectedDate) {
        alert("Please select a date before proceeding.");
        return;
      }
      if (!window.confirm(`You are agreeing, on ${selectedDate}. The content promised will be live. (Posted online)?`)) return;
      const { error } = await supabase
        .from('private_offers')
        .update({ stage: 3, creation_date: selectedDate })
        .eq('id', offerId);
      if (error) alert(`Failed to update stage: ${error.message}`);
      else {
        await notifyOfferUpdate({
          to_user_id: sponsorId,
          offer_id: offerId,
          type: 'creation_date_set',
          title: 'Creation Date Set',
          message: `${sponsee_username} scheduled creation for ${selectedDate}.`
        });
        await loadSponseeOffers();
      }
      return;
    }

    // >>> LIVE NOW with per-URL dates <<<
    if (e.target.classList.contains('live-now-btn')) {
      const rows = Array.from(offerCard.querySelectorAll('.per-url-row'));
      const urls = [];
      const dates = [];

      for (const row of rows) {
        const url = row.querySelector('.per-url-input')?.value.trim();
        const date = row.querySelector('.per-url-date')?.value;
        if (url) {
          if (!date) {
            alert("Each provided URL must have a live date.");
            return;
          }
          urls.push(url);
          dates.push(date);
        }
      }

      if (urls.length === 0) {
        alert("Please enter at least one live URL and its date before proceeding.");
        return;
      }

      const confirmMsg = `Going live with the following:\n\n${urls.map((u, i) => `- ${u}\n  date: ${dates[i]}`).join('\n')}\n\nProceed?`;
      if (!window.confirm(confirmMsg)) return;

      // Compute legacy fields for backward compatibility
      const earliest = dates.slice().sort()[0];
      const firstUrl = urls[0];

      const { error } = await supabase
        .from('private_offers')
        .update({
          stage: 4,
          status: 'live',
          sponsee_live_confirmed: true,
          live_url: firstUrl,            // legacy single value
          live_date: earliest,           // legacy single value
          live_urls: urls,               // new array
          url_dates: dates               // new array
        })
        .eq('id', offerId);

      if (error) {
        alert(`Failed to go live: ${error.message}`);
      } else {
        await notifyOfferUpdate({
          to_user_id: sponsorId,
          offer_id: offerId,
          type: 'content_live',
          title: 'Content is Live!',
          message: `${sponsee_username} has gone live with the sponsored content!`
        });
        await loadSponseeOffers();
      }
      return;
    }

// Accept Payment (triggers payout)
if (e.target.classList.contains('receive-payment')) {
  const isLockedGroup = offerCard?.dataset?.groupOffer === 'true';
  if (isLockedGroup) {
    try {
      notifyPayout?.({
        type: 'info',
        title: 'Group payout',
        message: 'Group offer payouts are processed after the deadline by an admin.'
      });
    } catch (_) {
      alert('Group offer payouts are processed after the deadline by an admin.');
    }
    return; // stop here — no modal, no payout
  }

  let modal = document.createElement('div');
  modal.innerHTML = ` 

    <div class="modal-backdrop" style="position:fixed;inset:0;background:#0009;z-index:9001;"></div>
    <div class="modal-content" style="width:70%;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:#fff;padding:25px;border-radius:10px;z-index:9002;min-width:320px;max-width:95vw;">
      <h3 style="margin-top:0;color:black;">Confirm Payout</h3>
      <p style="color:black;">Do you want to move this payment into your wallet balance?</p>
      <div style="margin-top:18px;display:flex;gap:10px;">
        <button id="confirm-payout" style="background:#28a745;color:#fff;">Confirm</button>
        <button id="cancel-payout" style="background:#ddd;">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#cancel-payout').onclick = () => modal.remove();

  modal.querySelector('#confirm-payout').onclick = async () => {
    const offerAmount = parseFloat(offerCard.dataset.payoutAmount || "0");


    // 1. Mark offer stage = 5
    const { error: updateError } = await supabase
      .from('private_offers')
      .update({ stage: 5 })
      .eq('id', offerId);
    if (updateError) {
      alert(`Failed to mark payment received: ${updateError.message}`);
      return;
    }

    // 2. Credit amount into sponsee wallet
    const { data: walletRow, error: walletFetchErr } = await supabase
      .from('users_extended_data')
      .select('wallet')
      .eq('user_id', sponsee_id)
      .maybeSingle();

    if (walletFetchErr) {
      alert(`Failed to fetch wallet: ${walletFetchErr.message}`);
      return;
    }

    const currentWallet = Number(walletRow?.wallet) || 0;
    const newWallet = currentWallet + offerAmount;

    const { error: walletUpdateErr } = await supabase
      .from('users_extended_data')
      .update({ wallet: newWallet })
      .eq('user_id', sponsee_id);

    if (walletUpdateErr) {
      alert(`Failed to update wallet: ${walletUpdateErr.message}`);
      return;
    }

    // 3. Send notifications
    await notifyOfferUpdate({
      to_user_id: sponsorId,
      offer_id: offerId,
      type: 'payment_received',
      title: 'Payment Marked as Received',
      message: `${sponsee_username} marked payment as received.`
    });

    await notifyPayout({
      to_user_id: sponsee_id,
      payout_amount: `$${offerAmount.toFixed(2)}`,
      payout_currency: 'USD',
      payout_status: 'credited',
      offer_id: offerId
    });

    modal.remove();
    await loadSponseeOffers();
    await updateSponseeWallet(); // refresh wallet display
  };
  return;
}

    if (e.target.classList.contains('review')) {
      const offerId = e.target.dataset.offerId;
      if (offerId) window.location.href = `./review.html?offer_id=${offerId}`;
      return;
    }
  });

  await loadSponseeOffers();
});

// ----------------- Helpers -----------------

// Extract YouTube video ID from any valid URL
function extractYouTubeVideoId(url) {
  try {
    const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|watch)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  } catch { return null; }
}

// Parse ISO8601 duration ("PT7M1S" -> "7m 1s")
function parseISO8601Duration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  const [, h, m, s] = match;
  return [
    h ? `${h}h` : '',
    m ? `${m}m` : '',
    s ? `${s}s` : ''
  ].filter(Boolean).join(' ') || '0s';
}

// Twitch thumbnails sometimes use {width}x{height} / %{width}x%{height}
function normalizeTwitchThumb(u) {
  if (!u) return null;
  return u
    .replace('%{width}x%{height}', '320x180')
    .replace('{width}x{height}', '320x180');
}

// Simple number formatter
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return '-';
  return Number(n).toLocaleString();
}

// Safe deep getter
function pick(obj, ...paths) {
  for (const path of paths) {
    if (!path) continue;
    let cur = obj;
    let ok = true;
    for (const seg of path.split('.')) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, seg)) cur = cur[seg];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null) return cur;
  }
  return null;
}

// Read metric from a "Graph insights" style structure
function readMetric(insights, names = []) {
  if (!insights) return null;

  // object keyed by metric name
  for (const n of names) {
    const v = insights[n];
    if (v !== undefined && v !== null) {
      if (typeof v === 'number') return v;
      if (typeof v === 'object') {
        if (typeof v.value === 'number') return v.value;
        const last = Array.isArray(v.values) ? v.values[v.values.length - 1] : null;
        if (last && typeof last.value === 'number') return last.value;
      }
    }
  }

  // array style [{ name, values: [{ value }] }]
  const arr = Array.isArray(insights) ? insights
    : (Array.isArray(insights?.data) ? insights.data
      : (Array.isArray(insights?.metrics) ? insights.metrics : null));
  if (Array.isArray(arr)) {
    for (const item of arr) {
      const nm = (item && (item.name || item.metric || item.title || '')).toLowerCase();
      if (!nm) continue;
      if (names.some(n => n.toLowerCase() === nm)) {
        const vals = item.values || item.data || item.points || [];
        const last = vals[vals.length - 1];
        let val = last?.value;
        if (val && typeof val === 'object') {
          val = pick(val, 'value', 'page_impressions', 'page_impressions_unique', 'reach');
        }
        if (typeof val === 'number') return val;
      }
    }
  }
  return null;
}

// Choose the best thumbnail from a Facebook post object
function fbFindImage(p) {
  const cands = [
    p?.thumbnail,
    p?.full_picture,
    p?.picture,
    pick(p, 'attachments.data.0.media.image.src'),
    pick(p, 'attachments.data.0.media.image.url'),
    pick(p, 'attachments.data.0.subattachments.data.0.media.image.src'),
    pick(p, 'attachments.data.0.subattachments.data.0.media.image.url'),
  ];
  for (const u of cands) {
    if (typeof u === 'string' && u) return u;
  }
  return null;
}

// Epoch seconds or ms -> locale date string
function epochToDateString(n) {
  try {
    let ms = Number(n);
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms *= 1000; // seconds -> ms
    return new Date(ms).toLocaleDateString();
  } catch {
    return null;
  }
}

// Render a generic "snapshot" (cached) block for any platform
function renderSnapshotBlock(platform, link, metrics = {}, dateBadge = '', subtitle = '') {
  const logos = {
    youtube: 'youtubelogo.png',
    tiktok: 'tiktoklogo.png',
    instagram: 'instagramlogo.png',
    facebook: 'facebooklogo.png',
    twitch: 'twitchlogo.png'
  };
  const colors = {
    youtube: '#e74c3c',
    tiktok: '#ff3b5c',
    instagram: '#ff8bd2',
    facebook: '#7fb4ff',
    twitch: '#c9b6ff'
  };
  const title = {
    youtube: 'YouTube (cached)',
    tiktok: 'TikTok (cached)',
    instagram: 'Instagram (cached)',
    facebook: 'Facebook (cached)',
    twitch: 'Twitch (cached)'
  }[platform] || 'Cached Stats';

  // show common metrics if present
  const rows = [];
  if (metrics.views != null) rows.push(`<div><b>👀 Views:</b><br>${fmtNum(metrics.views)}</div>`);
  if (metrics.likes != null) rows.push(`<div><b>👍 Likes:</b><br>${fmtNum(metrics.likes)}</div>`);
  if (metrics.comments != null) rows.push(`<div><b>💬 Comments:</b><br>${fmtNum(metrics.comments)}</div>`);
  if (metrics.shares != null) rows.push(`<div><b>🔁 Shares:</b><br>${fmtNum(metrics.shares)}</div>`);
  if (metrics.impressions != null) rows.push(`<div><b>👁️ Impressions:</b><br>${fmtNum(metrics.impressions)}</div>`);
  if (metrics.reach != null) rows.push(`<div><b>📣 Reach:</b><br>${fmtNum(metrics.reach)}</div>`);
  if (metrics.engaged_users != null) rows.push(`<div><b>🤝 Engaged Users:</b><br>${fmtNum(metrics.engaged_users)}</div>`);
  if (metrics.video_views != null) rows.push(`<div><b>▶️ Video Views:</b><br>${fmtNum(metrics.video_views)}</div>`);

  const color = colors[platform] || '#ddd';
  const logo = logos[platform] || '';

  return `
    <div style="background:none;border-radius:15px;box-shadow:none;padding:22px 26px;margin:0 auto 14px;max-width:560px;color:#f6f6f6;font-size:1.02em;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        ${logo ? `<img src="${logo}" style="height:22px;vertical-align:-2px;margin-right:4px;border-radius:6px">` : ''}
        <b style="color:${color};">${title}</b>
      </div>
      ${subtitle ? `<div style="color:#ddd;margin:-2px 0 8px 0;font-size:0.95em;">${subtitle}</div>` : ''}
      ${dateBadge || ''}
      <div style="display:flex;flex-wrap:wrap;gap:18px 26px;margin-top:6px;">
        ${rows.length ? rows.join('') : `<div style="color:#ccc;">No cached metrics available yet.</div>`}
      </div>
      <div style="margin-top:10px;text-align:right;">
        <a href="${link}" target="_blank" style="color:${color};text-decoration:underline;font-size:0.94em;">Open link ↗</a>
      </div>
    </div>
  `;
}

// Make all profile logos with .profile-link open the user's profile
document.addEventListener('click', function(e) {
  const profileImg = e.target.closest('.profile-link');
  if (profileImg && profileImg.dataset.username) {
    window.location.href = `./viewprofile.html?username=${encodeURIComponent(profileImg.dataset.username)}`;
  }
});

//new statsnap.js integration 
