// public/js/sponseeOffers.js
import { supabase } from './supabaseClient.js';
import {
  notifyComment,
  notifyOfferStatus,
  notifyOfferUpdate,
  notifyPayout
} from './alerts.js';
import './userReports.js'; // For global report modal logic
import { famBotModerateWithModal } from './FamBot.js';

let allSponseeOffers = []; // Stores all loaded offers

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

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    alert("You must be logged in to view this page.");
    window.location.href = '/login.html';
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

  const listingContainer = document.getElementById('listing-container');
  const offerTabs = document.getElementById('offer-tabs');

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

  offerTabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-btn')) return;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    renderSponseeOffersByFilter(e.target.dataset.filter);
  });

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
    if (allSponseeOffers.length === 0) {
      listingContainer.innerHTML = '<p>No sponsorship offers yet.</p>';
      return;
    }
    renderSponseeOffersByFilter(document.querySelector('.tab-btn.active')?.dataset.filter || "all");
  }

  const knownStatus = [
    'pending', 'accepted', 'in_progress', 'live', 'completed', 'rejected', 'Offer Cancelled', 'review-completed', 'review_completed'
  ];
  const knownStage = [1, 2, 3, 4, 5];

  async function renderSponseeOffersByFilter(filter) {
    listingContainer.innerHTML = '';
    let filteredOffers = [];
    if (filter === 'all') filteredOffers = allSponseeOffers;
    else if (filter === 'pending') filteredOffers = allSponseeOffers.filter(offer => offer.status === 'pending');
    else if (filter === 'accepted') filteredOffers = allSponseeOffers.filter(offer => offer.status === 'accepted');
    else if (filter === 'stage-3') filteredOffers = allSponseeOffers.filter(offer => offer.stage === 3);
    else if (filter === 'stage-4') filteredOffers = allSponseeOffers.filter(offer => offer.stage === 4);
    else if (filter === 'stage-5') filteredOffers = allSponseeOffers.filter(offer => offer.stage === 5);
    else if (filter === 'rejected') filteredOffers = allSponseeOffers.filter(offer =>
      ['rejected', 'Offer Cancelled'].includes(offer.status)
    );
    else if (filter === 'other') filteredOffers = allSponseeOffers.filter(offer =>
      !knownStatus.includes(offer.status) && !knownStage.includes(offer.stage)
    );
    if (filteredOffers.length === 0) {
      listingContainer.innerHTML = '<p>No offers found for this filter.</p>';
      return;
    }
    for (const offer of filteredOffers) {
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
        sponsorPicUrl = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/objectlogos/${sponsor.profile_pic}`;
      }
      sponsor_id = sponsor?.user_id || '';
    } catch { }

    let platformBadgeHtml = '';
    if (offer.platforms && offer.platforms.length) {
      platformBadgeHtml = `
        <div style="margin-bottom:8px;margin-top:4px;">${renderPlatformBadges(offer.platforms)}</div>
      `;
    }

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

    let actionButtons = '';
    if (offer.stage === 1 && offer.status === 'pending') {
      actionButtons = `
        <button class="confirm-offer">Confirm Offer</button>
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
      actionButtons = `
        <div class="live-scheduling">
          <label for="live-date-${offer.id}"><strong>Select Live Date:</strong></label><br>
          <input type="date" id="live-date-${offer.id}" class="live-date"><br>
          <label for="live-url-${offer.id}"><strong>Link to Live Content:</strong></label><br>
          <input type="url" id="live-url-${offer.id}" class="live-url" placeholder="https://example.com/content"><br>
          <button class="live-now-btn">Live</button>
        </div>
      `;
    } else if (offer.stage === 4) {
      if (offer.sponsor_live_confirmed) {
        actionButtons = `
          <div class="stage-4-actions">
            <button class="receive-payment">Accept Payment</button>
          </div>
        `;
      } else {
        actionButtons = `
          <div class="stage-4-actions">
            <button class="receive-payment" disabled style="opacity:0.65;cursor:not-allowed;">Waiting for Sponsor Confirmation</button>
          </div>
          <small style="color:#e87f00;font-size:0.98em;">Waiting for sponsor to confirm content is live.</small>
        `;
      }
    } else if (offer.stage === 5) {
      actionButtons = `
        <div class="stage-5-summary">
          <p><strong>✅ Sponsorship complete. Thank you!</strong></p>
        </div>
        <button class="review" data-offer-id="${offer.id}">Leave Review</button>
      `;
    }

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

    const card = document.createElement('div');
    card.className = 'listing-stage';
    card.dataset.offerId = offer.id;
    card.dataset.sponsorUsername = offer.sponsor_username;
    card.dataset.sponseeUsername = sponsee_username;
    card.dataset.sponsorId = sponsor_id;
    card.dataset.sponsorEmail = offer.sponsor_email;

    card.innerHTML = `
      <div class="card-content" style="position:relative;">
        ${reportBtnHtml}
        <div class="card-top">
          <div class="logo-container">
            <img src="${sponsorPicUrl}" alt="Sponsor Profile Pic" class="stage-logo profile-link" data-username="${offer.sponsor_username}">
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
                ${offer.stage >= 4 && offer.live_date ? `<p><strong>Live Date:</strong> ${new Date(offer.live_date).toLocaleDateString()}</p>` : ''}
                ${offer.stage >= 4 && offer.live_url ? `<p><strong>Live URL:</strong> <a href="${offer.live_url}" target="_blank">${offer.live_url}</a></p>` : ''}
              </div>
              <div class="offer-right">
                <p><strong>Amount:</strong> $${offer.offer_amount}</p>
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

    function hideAllSections() {
      detailsSection.style.display = 'none';
      imagesSection.style.display = 'none';
      commentsSection.style.display = 'none';
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

   if (e.target.classList.contains('submit-comment')) {
  const textarea = commentsSection.querySelector('.comment-input');
  const commentText = textarea.value.trim();
  if (!commentText) {
    alert('Comment cannot be empty.');
    return;
  }
  // Get JWT for the current user session
  const { data: { session } } = await supabase.auth.getSession();
  const user_id = session?.user?.id;
  const jwt = session?.access_token;
  if (!jwt || !user_id) {
    alert("Not authenticated. Please log in again.");
    return;
  }
  // Moderation step
  const modResult = await famBotModerateWithModal({
    user_id,
    content: commentText,
    jwt,
    type: 'comment'
  });
  if (!modResult.allowed) return; // Block if flagged

  // If passed moderation, insert comment
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
      if (window.confirm("Are you sure you want to accept this offer?")) {
        const { error } = await supabase
          .from('private_offers')
          .update({ status: 'accepted', stage: 2 })
          .eq('id', offerId);
        if (error) alert(`Error accepting offer: ${error.message}`);
        else {
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

    if (e.target.classList.contains('live-now-btn')) {
      const dateInput = offerCard.querySelector('.live-date');
      const urlInput = offerCard.querySelector('.live-url');
      const selectedDate = dateInput.value;
      const liveUrl = urlInput.value.trim();
      if (!selectedDate || !liveUrl) {
        alert("Please select a live date and enter a live URL before proceeding.");
        return;
      }
      if (!window.confirm(`Gone live on ${selectedDate} with URL:\n${liveUrl}\nProceed?`)) return;
      const { error } = await supabase
        .from('private_offers')
        .update({
          stage: 4,
          status: 'live',
          live_date: selectedDate,
          sponsee_live_confirmed: true,
          live_url: liveUrl
        })
        .eq('id', offerId);
      if (error) alert(`Failed to go live: ${error.message}`);
      else {
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
      let modal = document.createElement('div');
      modal.innerHTML = `
        <div class="modal-backdrop" style="position:fixed;inset:0;background:#0009;z-index:9001;"></div>
        <div class="modal-content" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
          background:#fff;padding:25px;border-radius:10px;z-index:9002;min-width:320px;max-width:95vw;">
          <h3 style="margin-top:0">Payout Information</h3>
          <label><strong>Payout Method:</strong>
            <select id="payout-method" style="margin-left:7px;padding:3px 8px;">
              <option value="">Select</option>
              <option value="Bank">Bank Transfer</option>
              <option value="PayPal">PayPal</option>
              <option value="Stripe">Stripe</option>
            </select>
          </label>
          <div style="margin:10px 0 5px 0;">
            <label><strong>Payout Reference:</strong></label>
            <input id="payout-reference" style="width:100%;padding:5px;" placeholder="e.g. bank: BSB-ACC, PayPal email, Stripe Connect">
          </div>
          <div style="margin-top:18px;display:flex;gap:10px;">
            <button id="confirm-payout" style="background:#28a745;color:#fff;">Confirm</button>
            <button id="cancel-payout" style="background:#ddd;">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#cancel-payout').onclick = () => modal.remove();

      modal.querySelector('#confirm-payout').onclick = async () => {
        const method = modal.querySelector('#payout-method').value;
        const reference = modal.querySelector('#payout-reference').value.trim();
        if (!method || !reference) {
          alert("Please select a payout method and enter the reference details.");
          return;
        }
        const { error: updateError } = await supabase
          .from('private_offers')
          .update({ stage: 5 })
          .eq('id', offerId);
        if (updateError) {
          alert(`Failed to mark payment received: ${updateError.message}`);
          return;
        }
        const { data: existingPayouts, error: payoutError } = await supabase
          .from('payouts')
          .select('id')
          .eq('offer_id', offerId)
          .limit(1);
        if (!payoutError && (!existingPayouts || existingPayouts.length === 0)) {
          const offerAmount = offerCard.querySelector('.offer-right').textContent.match(/\$(\d+(\.\d+)?)/)?.[1] || "0";
          await supabase.from('payouts').insert([{
            offer_id: offerId,
            sponsee_id: sponsee_id,
            sponsee_email: sponsee_email,
            payout_amount: offerAmount,
            payout_method: method,
            payout_reference: reference,
            status: 'pending'
          }]);
        }
        await notifyOfferUpdate({
          to_user_id: sponsorId,
          offer_id: offerId,
          type: 'payment_received',
          title: 'Payment Marked as Received',
          message: `${sponsee_username} marked payment as received.`
        });
        await notifyPayout({
          to_user_id: sponsee_id,
          payout_amount: offerCard.querySelector('.offer-right').textContent.match(/\$\d+/)?.[0] || 'Amount',
          payout_currency: 'USD',
          payout_status: 'pending',
          offer_id: offerId
        });
        modal.remove();
        await loadSponseeOffers();
      };
      return;
    }

    if (e.target.classList.contains('review')) {
      const offerId = e.target.dataset.offerId;
      if (offerId) window.location.href = `review.html?offer_id=${offerId}`;
      return;
    }
  });

  await loadSponseeOffers();
});

// Make all profile logos with .profile-link open the user's profile
document.addEventListener('click', function(e) {
  const profileImg = e.target.closest('.profile-link');
  if (profileImg && profileImg.dataset.username) {
    window.location.href = `./viewprofile.html?username=${encodeURIComponent(profileImg.dataset.username)}`;
  }
});
