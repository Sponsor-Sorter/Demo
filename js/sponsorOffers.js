// public/js/sponsorOffers.js
import { supabase } from './supabaseClient.js';
import { handleRemoveOffer } from './sponsorLogic.js';
import { notifyComment, notifyOfferUpdate } from './alerts.js';
import './userReports.js'; // Import the reporting logic
import { famBotModerateWithModal } from './FamBot.js';

let allSponsorOffers = [];
let sponsor_username = '';
let sponsor_email = '';
let sponsor_id = '';
let reviewedOfferIds = [];

// Helper to check reviewed offers at stage 5
async function fetchReviewedOfferIds(stage5Offers, userId) {
  if (!stage5Offers.length) return [];
  const { data: reviews, error } = await supabase
    .from('private_offer_reviews')
    .select('offer_id')
    .in('offer_id', stage5Offers)
    .eq('reviewer_id', userId);
  if (error || !reviews) return [];
  return reviews.map(r => r.offer_id);
}

// Always fetch username for notifications and comments
async function getCurrentSponsorUsername(user_id) {
  if (!user_id) return 'Sponsor';
  const { data } = await supabase
    .from('users_extended_data')
    .select('username')
    .eq('user_id', user_id)
    .single();
  return data?.username || 'Sponsor';
}

// --- Platform badge rendering ---
function renderPlatformBadges(platforms) {
  if (!platforms) return '';
  if (typeof platforms === 'string') {
    try { platforms = JSON.parse(platforms); } catch { platforms = []; }
  }
  if (!Array.isArray(platforms)) return '';
  const platformLogos = {
    instagram: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/1200px-Instagram_logo_2022.svg.png',
    tiktok: 'tiktoklogo.png',
    youtube: 'youtubelogo.png',
    twitter: 'twitterlogo.png',
    facebook: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
    twitch: 'twitchlogo.png',
    snapchat: 'snaplogo.png',
  };
  return platforms.map(platform => {
    const logo = platformLogos[platform.toLowerCase()] || '';
    return logo
      ? `<span class="social-badge" style="display:inline-block;background:#f4f7ff;border-radius:8px;padding:2px 5px;margin-right:4px;">
          <img src="${logo}" alt="${platform}" style="height:20px;width:20px;vertical-align:middle;">
        </span>`
      : '';
  }).join(' ');
}

// --- Main offer rendering ---
async function renderSingleOffer(offer) {
  const listingContainer = document.getElementById('listing-container');
  const { data: sponsee } = await supabase
    .from('users_extended_data')
    .select('profile_pic, id, username, user_id')
    .eq('username', offer.sponsee_username)
    .single();

  let sponseePicUrl = 'logos.png';
  if (sponsee && sponsee.profile_pic) {
    sponseePicUrl = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsee.profile_pic}`;
  }

  const listing = document.createElement('div');
  listing.className = 'listing-stage';
  listing.dataset.offerId = offer.id;
  listing.dataset.sponseeUsername = sponsee?.username || offer.sponsee_username;
  listing.dataset.sponseeId = sponsee?.id || '';
  listing.dataset.sponseeUserId = sponsee?.user_id || '';
  listing.dataset.sponseeEmail = offer.sponsee_email;

  let stageHeader = '';
  if (offer.stage === 1) stageHeader = `<h3>Stage 1: Offer Sent</h3><div class="progress-container"><div class="progress-bar" style="width: 20%;"></div></div>`;
  else if (offer.stage === 2) stageHeader = `<h3>Stage 2: Offer Accepted</h3><div class="progress-container"><div class="progress-bar" style="width: 40%;"></div></div>`;
  else if (offer.stage === 3) stageHeader = `<h3>Stage 3: In Creation</h3><div class="progress-container"><div class="progress-bar" style="width: 60%;"></div></div>`;
  else if (offer.stage === 4) stageHeader = `<h3>Stage 4: Content Live</h3><div class="progress-container"><div class="progress-bar" style="width: 80%;"></div></div>`;
  else if (offer.stage === 5) stageHeader = `<h3>Stage 5: Sponsorship Completed</h3><div class="progress-container"><div class="progress-bar" style="width: 100%; background-color: green;"></div></div>
<button class="review" data-offer-id="${offer.id}">Leave Review</button>`;

  document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('review')) {
      const offerId = e.target.dataset.offerId;
      if (offerId) {
        window.location.href = `/public/review.html?offer_id=${offerId}`;
      }
    }
  });

  let actionButton = '';
  if (offer.stage === 1 && offer.status !== 'Offer Cancelled' && offer.status !== 'rejected') {
    actionButton = '<button class="cancel-offer-btn">Cancel Offer</button>';
  } else if (['rejected', 'Offer Cancelled'].includes(offer.status)) {
    actionButton = '<button class="delete-offer-btn">Remove Offer</button>';
  }

  // --- Platforms (badge logos only) ---
  let platformBadgeHtml = '';
  if (offer.platforms && offer.platforms.length) {
    platformBadgeHtml = renderPlatformBadges(offer.platforms);
  }

  // ========== REPORT BUTTON (OFFER) ==========
  const reportBtnHtml = `
    <button 
      class="report-btn" 
      style="
        position:absolute; 
        top:-27px; 
        left:-30px; 
        background:none; 
        border:none !important; 
        outline: none !important;
        box-shadow: none !important;
        cursor:pointer; 
        color:#e03232; 
        font-size:1.25em; 
        z-index:4;
      "
      title="Report Offer"
      onclick="window.openReportModal('offer', '${offer.id}')"
    >🚩</button>
  `;

  listing.innerHTML = `
    <div class="card-content" style="position:relative;">
      ${reportBtnHtml}
      <div class="card-top">
        <div class="logo-container">
          <img src="${sponseePicUrl}" onerror="this.src='/public/logos.png'" alt="Sponsee Profile Pic" class="stage-logo">
          <p><strong>To:</strong> ${sponsee?.username || offer.sponsee_username}</p>
          <div><strong>Platforms:</strong> ${platformBadgeHtml}</div>
        </div>
        <div class="stage-content">
          ${stageHeader}
          <div class="offer-details-row">
            <div class="offer-left">
              <p><strong>Offer Title:</strong> ${offer.offer_title}</p>
              <p><strong>Date Sent:</strong> ${new Date(offer.created_at).toLocaleDateString()}</p>
              <p><strong>Deadline:</strong> ${new Date(offer.deadline).toLocaleDateString()}</p>
              ${offer.stage >= 3 && offer.creation_date ? `<p><strong>Creation Date:</strong> ${new Date(offer.creation_date).toLocaleDateString()}</p>` : ''}
              ${offer.stage >= 4 && offer.live_date ? `<p><strong>Live Date:</strong> ${new Date(offer.live_date).toLocaleDateString()}</p>` : ''}
              ${offer.stage >= 4 && offer.live_url ? `<p><strong>Live URL:</strong> <a href="${offer.live_url}" target="_blank">${offer.live_url}</a></p>` : ''}
            </div>
            <div class="offer-right">
              <p><strong>Amount:</strong> $${offer.offer_amount}</p>
              <p><strong>Payment Schedule:</strong> ${offer.payment_schedule}</p>
              <p><strong>Duration:</strong> ${offer.sponsorship_duration}</p>
              <p><strong>Status:</strong> <span style="color: ${
                offer.status === 'pending' ? 'orange' :
                offer.status === 'accepted' ? 'green' :
                offer.status === 'live' ? 'blue' :
                offer.status === 'review_completed' ? 'purple' :
                ['Offer Cancelled', 'rejected'].includes(offer.status) ? 'red' :
                'inherit'}">${offer.status}</span></p>
            </div>
          </div>
        </div>
      </div>
      <div class="card-bottom" data-offer-id="${offer.id}">
        <button class="offer-Comments">Comments</button>
        <button class="offer-img">Offer Images</button>
        <button class="expand-btn">View Details</button>
        <button class="data-summary-btn">Data Summary</button>
        ${actionButton}
        ${offer.stage === 4 && !offer.sponsor_live_confirm ? '<button class="confirm-live-btn">Confirm Live Content</button>' : ''}
        <div class="details-section" style="display: none;">
          <p><fieldset><legend><strong>Description:</strong></legend>${offer.offer_description}</fieldset></p>
          <div class="job-deliverable-row">
            <span><strong>Job Type:</strong> ${offer.job_type}</span>
            <span><strong>Deliverable Type:</strong> ${offer.deliverable_type}</span>
          </div>
          <p><fieldset><legend><strong>Instructions:</strong></legend>${offer.instructions}</fieldset></p>
        </div>
        <div class="images-section" style="display: none; gap: 20px; padding: 10px">
          <div class="image-viewer" style="flex: 1; text-align: center;">
            <img class="main-image" src="" alt="Selected Image" style="max-width: 100%; height: 350px; border: 1px solid #ccc; border-radius: 8px">
            <div style="margin-top: 15px;">
              <button class="prev-image">Previous</button>
              <button class="next-image">Next</button>
            </div>
          </div>
          <div class="image-thumbnails" style="width: 60px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 8px"></div>
        </div>
        <div class="comments-section" style="display: none;">
          <div class="existing-comments"></div>
          <textarea placeholder="Write a comment..." class="comment-input"></textarea><br>
          <button class="submit-comment">Submit Comment</button>
        </div>
        <div class="data-summary-section" style="display:none;"></div>
      </div>
    </div>
  `;

  listingContainer.appendChild(listing);
}

function renderOffersByFilter(filter) {
  const listingContainer = document.getElementById('listing-container');
  listingContainer.innerHTML = '';

  let filteredOffers = allSponsorOffers.filter(offer => {
    if (filter === 'all') return true;
    if (filter === 'stage-3') return offer.stage === 3;
    if (filter === 'stage-4') return offer.stage === 4;
    if (filter === 'stage-5') return offer.stage === 5;
    if (filter === 'rejected') return ['rejected', 'Offer Cancelled'].includes(offer.status);
    return offer.status === filter;
  });

  filteredOffers = filteredOffers.filter(offer => {
    if (offer.stage === 5 && reviewedOfferIds.includes(offer.id)) return false;
    return true;
  });

  if (filteredOffers.length === 0) {
    listingContainer.innerHTML = '<p>No offers found for this filter.</p>';
    return;
  }

  filteredOffers.forEach(renderSingleOffer);
}

// --- Helper: YouTube videoId extraction ---
function extractYouTubeVideoId(url) {
  try {
    const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|watch)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  } catch { return null; }
}
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

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    alert("You must be logged in to view this page.");
    window.location.href = '/login.html';
    return;
  }
  sponsor_email = session.user.email;
  sponsor_id = session.user.id;

  sponsor_username = await getCurrentSponsorUsername(sponsor_id);

  async function updateSponsorWallet() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return;
    const sponsor_id = session.user.id;
    const { data, error: walletError } = await supabase
      .from('users_extended_data')
      .select('wallet')
      .eq('user_id', sponsor_id)
      .single();
    if (!walletError && data && document.querySelector('.wallet')) {
      document.querySelector('.wallet').innerHTML = `Wallet: $${Number(data.wallet).toFixed(2)}
        <span class="info-icon" data-tooltip="For refund Money" style="color: white;">🛈</span>`;
    }
  }

  const { data: offers, error } = await supabase
    .from('private_offers')
    .select('*')
    .eq('sponsor_email', sponsor_email)
    .in('status', ['pending', 'accepted', 'in_progress', 'live', 'completed', 'Offer Cancelled', 'rejected', "review_completed" ]);

  if (error || !offers) {
    document.getElementById('listing-container').innerHTML = `<p style="color:red;">Error loading offers: ${error?.message}</p>`;
    return;
  }

  allSponsorOffers = offers;
  const stage5OfferIds = offers.filter(o => o.stage === 5).map(o => o.id);
  reviewedOfferIds = await fetchReviewedOfferIds(stage5OfferIds, sponsor_id);

  renderOffersByFilter('all');

  const tabContainer = document.getElementById('offer-tabs');
  tabContainer.innerHTML = `
    <button data-filter="all" class="tab-btn active">All</button>
    <button data-filter="pending" class="tab-btn">Pending</button>
    <button data-filter="accepted" class="tab-btn">Accepted</button>
    <button data-filter="stage-3" class="tab-btn">In Progress</button>
    <button data-filter="stage-4" class="tab-btn">Live</button>
    <button data-filter="stage-5" class="tab-btn">Completed</button>
    <button data-filter="rejected" class="tab-btn">Rejected / Cancelled</button>
  `;

  tabContainer.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-btn')) return;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    renderOffersByFilter(e.target.dataset.filter);
  });

  document.getElementById('listing-container').addEventListener('click', async (e) => {
    const offerCard = e.target.closest('.listing-stage');
    if (!offerCard) return;

    const offerId = offerCard.dataset.offerId;
    const sponseeId = offerCard.dataset.sponseeId;
    const sponseeUserId = offerCard.dataset.sponseeUserId;
    const sponseeEmail = offerCard.dataset.sponseeEmail;
    const cardBottom = offerCard.querySelector('.card-bottom');
    const detailsSection = cardBottom.querySelector('.details-section');
    const imagesSection = cardBottom.querySelector('.images-section');
    const commentsSection = cardBottom.querySelector('.comments-section');
    const thumbnailsContainer = imagesSection.querySelector('.image-thumbnails');
    const dataSummarySection = cardBottom.querySelector('.data-summary-section');

    const hideAllSections = () => {
      detailsSection.style.display = 'none';
      imagesSection.style.display = 'none';
      commentsSection.style.display = 'none';
      if (dataSummarySection) {
        dataSummarySection.style.display = 'none';
        dataSummarySection.innerHTML = '';
      }
    };

    if (e.target.classList.contains('expand-btn')) {
      const isVisible = detailsSection.style.display === 'block';
      hideAllSections();
      detailsSection.style.display = isVisible ? 'none' : 'block';
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
        if (offerError || !offerData?.offer_images?.length) {
          thumbnailsContainer.innerHTML = '<p>Failed to load images.</p>';
          return;
        }
        const imageUrls = offerData.offer_images.map(filename =>
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
            thumb.style.border = i === index ? '2px solid #007BFF' : '1px solid #ccc';
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
          thumb.style.borderRadius = '4px';
          thumb.addEventListener('click', () => showImage(index));
          thumbnailsContainer.appendChild(thumb);
        });
        if (imageUrls.length > 0) showImage(0);
        prevBtn.onclick = () => showImage((currentIndex - 1 + imageUrls.length) % imageUrls.length);
        nextBtn.onclick = () => showImage((currentIndex + 1) % imageUrls.length);
      }
    }

    // --- DATA SUMMARY BUTTON HANDLER ---
    if (e.target.classList.contains('data-summary-btn')) {
      hideAllSections();
      if (!dataSummarySection) return;
      const isVisible = dataSummarySection.style.display === 'block';
      if (!isVisible) {
        dataSummarySection.innerHTML = "<div style='color:#fff;'>Loading video stats...</div>";
        dataSummarySection.style.display = 'block';

        // Try reading live URL from offerCard or DOM
        let liveUrl = offerCard.dataset.liveUrl || '';
        if (!liveUrl) {
          const liveLink = offerCard.querySelector('.offer-left a');
          liveUrl = liveLink ? liveLink.href : '';
        }

        if (!liveUrl.includes('youtube.com') && !liveUrl.includes('youtu.be')) {
          dataSummarySection.innerHTML = "<span style='color:#faa;'>No YouTube video URL found in Live URL.</span>";
          return;
        }
        let videoId = extractYouTubeVideoId(liveUrl);
        console.log('Live URL:', liveUrl, 'Extracted videoId:', videoId);
        if (!videoId) {
          dataSummarySection.innerHTML = "<span style='color:#faa;'>Invalid or unrecognized YouTube URL.</span>";
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        const jwt = session?.access_token;
        try {
          // Pass both userId (sponseeUserId) and offerId for edge function security
          const body = {
            videoId,
            userId: sponseeUserId,
            offerId
          };
          const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-youtube-video-stats', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const stats = await resp.json();
          if (stats && stats.success) {
            const thumbnail = stats.video.snippet.thumbnails?.medium?.url || '';
            const duration = parseISO8601Duration(stats.video.contentDetails.duration);
            dataSummarySection.innerHTML = `
  <div style="
    background: none;
    border-radius: 15px;
    box-shadow: none;
    padding: 26px 30px;
    margin: 0 auto;
    max-width: 520px;
    color: #f6f6f6;
    font-size: 1.09em;
    text-align: left;
    ">
    <div style="display:flex;align-items:center;gap:18px;font-size:1.17em;margin-bottom:12px;">
      ${thumbnail ? `<img src="${thumbnail}" alt="Thumbnail" style="width:78px;height:55px;border-radius:7px;box-shadow:0 1px 8px #0004;object-fit:cover;">` : ''}
      <div>
        <b style="color:#ffe75b;"><span style="font-size:1.3em;">🎥</span> ${stats.video.snippet.title}</b>
        <div style="font-size:0.8em;margin-top:3px;"><span style="background:none;padding:2px 7px;border-radius:6px;color:#ffe;">Video duration ⏱ ${duration}</span></div>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:24px 32px;">
      <div><b>📅 Published:</b><br>${new Date(stats.video.snippet.publishedAt).toLocaleDateString()}</div>
      <div><b>👀 Views:</b><br>${stats.video.statistics.viewCount}</div>
      <div><b>👍 Likes:</b><br>${stats.video.statistics.likeCount || '-'}</div>
      <div><b>💬 Comments:</b><br>${stats.video.statistics.commentCount || '-'}</div>
    </div>
    <div style="margin-top:12px;">
      <b>📝 Description:</b>
      <div style="margin-top:4px;background:#18181a;border-radius:7px;padding:11px 13px;max-height:80px;overflow:auto;font-size:0.97em;color:#d7d7d7;">
        ${stats.video.snippet.description ? stats.video.snippet.description.replace(/\n/g, '<br>') : '<i>No description.</i>'}
      </div>
    </div>
    <div style="margin-top:10px;text-align:right;">
      <a href="https://youtube.com/watch?v=${stats.video.id}" target="_blank" style="color:#36aaff;text-decoration:underline;font-size:0.96em;">Open on YouTube ↗</a>
    </div>
  </div>
`;
          } else {
            dataSummarySection.innerHTML = `<span style='color:#faa;'>${stats?.error ? stats.error : 'Could not fetch video stats.'}</span>`;
          }
        } catch (err) {
          dataSummarySection.innerHTML = "<span style='color:#faa;'>Error loading video stats.</span>";
        }
      } else {
        dataSummarySection.style.display = 'none';
        dataSummarySection.innerHTML = '';
      }
      return;
    }

    if (e.target.classList.contains('offer-Comments')) {
      const isVisible = commentsSection.style.display === 'block';
      hideAllSections();
      if (!isVisible) {
        commentsSection.style.display = 'block';
        const existingComments = commentsSection.querySelector('.existing-comments');
        existingComments.innerHTML = '<p>Loading comments...</p>';
        const { data: comments, error } = await supabase
          .from('private_offer_comments')
          .select('*')
          .eq('offer_id', offerId)
          .order('created_at', { ascending: true });
        if (error) {
          existingComments.innerHTML = '<p>Failed to load comments.</p>';
        } else if (!comments.length) {
          existingComments.innerHTML = '<p>No comments yet.</p>';
        } else {
          existingComments.innerHTML = '';
          for (const comment of comments) {
            const reportCommentBtn = `
              <button
                class="report-btn"
                style="background:none;border:none;cursor:pointer;color:#e03232;font-size:1em;margin-left:8px;"
                title="Report Comment"
                onclick="window.openReportModal('comment', '${comment.id}')"
              >🚩</button>
            `;
            const displayName = comment.sender || 'Sponsor';
            const commentEl = document.createElement('p');
            commentEl.innerHTML = `<strong>${displayName}:</strong> ${comment.comment_text} <em>(${new Date(comment.created_at).toLocaleString()})</em> ${reportCommentBtn}`;
            existingComments.appendChild(commentEl);
          }
        }
      }
    }

    if (e.target.classList.contains('submit-comment')) {
      const textarea = commentsSection.querySelector('.comment-input');
      const commentText = textarea.value.trim();
      if (!commentText) return alert('Comment cannot be empty.');

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

      const currentSponsorUsername = await getCurrentSponsorUsername(sponsor_id);

      const { error } = await supabase
        .from('private_offer_comments')
        .insert([{
          offer_id: offerId,
          user_id: sponsor_id,
          sponsor_id: sponsor_id,
          sponsor_email: sponsor_email,
          sponsee_id: sponseeId,
          sponsee_email: sponseeEmail,
          sender: currentSponsorUsername,
          comment_text: commentText
        }]);
      if (error) {
        console.error(error);
        alert('Failed to submit comment.');
      } else {
        textarea.value = '';
        await notifyComment({
          to_user_id: sponseeUserId,
          offer_id: offerId,
          from_username: currentSponsorUsername,
          message: commentText
        });
        renderOffersByFilter('all');
      }
    }

    if (e.target.classList.contains('cancel-offer-btn')) {
      if (window.confirm("Are you sure you want to cancel this offer?")) {
        const offerId = offerCard.dataset.offerId;
        const { data: offer, error: offerErr } = await supabase
          .from('private_offers')
          .select('offer_amount')
          .eq('id', offerId)
          .single();
        if (offerErr || !offer) {
          alert('Could not fetch offer amount for wallet refund.');
          return;
        }
        const { error: cancelErr } = await supabase
          .from('private_offers')
          .update({ status: 'Offer Cancelled' })
          .eq('id', offerId);
        if (cancelErr) {
          alert(`Failed to cancel offer: ${cancelErr.message}`);
          return;
        }
        const { error: walletErr } = await supabase.rpc('increment_wallet_balance', {
          user_id_param: sponsor_id,
          amount_param: offer.offer_amount
        });
        if (walletErr) {
          alert('Failed to credit refund to wallet. Please contact support.');
          return;
        }
        const currentSponsorUsername = await getCurrentSponsorUsername(sponsor_id);
        await notifyOfferUpdate({
          to_user_id: sponseeUserId,
          offer_id: offerId,
          type: 'offer_cancelled',
          title: "Offer Cancelled",
          message: `${currentSponsorUsername} has cancelled the sponsorship offer.`
        });
        alert("Offer cancelled. Amount has been refunded to your wallet.");
        updateSponsorWallet();
        renderOffersByFilter('all');
      }
    }

    if (e.target.classList.contains('delete-offer-btn')) {
      const success = await handleRemoveOffer(offerId);
      if (success) {
        const currentSponsorUsername = await getCurrentSponsorUsername(sponsor_id);
        await notifyOfferUpdate({
          to_user_id: sponseeUserId,
          offer_id: offerId,
          type: 'offer_deleted',
          title: "Offer Deleted",
          message: `${currentSponsorUsername} has deleted the sponsorship offer.`
        });
        offerCard.remove();
        allSponsorOffers = allSponsorOffers.filter(offer => offer.id !== parseInt(offerId));
      }
    }
  });
});
