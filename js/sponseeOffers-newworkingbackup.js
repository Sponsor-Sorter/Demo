// public/js/sponseeOffers.js
import { supabase } from '/public/js/supabaseClient.js';
import {
  notifyComment,
  notifyOfferStatus,
  notifyOfferUpdate,
  notifyPayout
} from '/public/js/alerts.js';

let allSponseeOffers = []; // Stores all loaded offers

document.addEventListener("DOMContentLoaded", async () => {
  // Auth check
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    alert("You must be logged in to view this page.");
    window.location.href = '/login.html';
    return;
  }

  const sponsee_email = session.user.email;
  const sponsee_id = session.user.id;
  const sponsee_username = session.user.user_metadata.username;

  const listingContainer = document.getElementById('listing-container');
  const offerTabs = document.getElementById('offer-tabs');

  // Setup tab UI (always visible)
  offerTabs.innerHTML = `
    <button data-filter="all" class="tab-btn active">All</button>
    <button data-filter="pending" class="tab-btn">Pending</button>
    <button data-filter="accepted" class="tab-btn">Accepted</button>
    <button data-filter="stage-3" class="tab-btn">In Progress</button>
    <button data-filter="stage-4" class="tab-btn">Live</button>
    <button data-filter="stage-5" class="tab-btn">Completed</button>
    <button data-filter="rejected" class="tab-btn">Rejected / Cancelled</button>
  `;

  // Tab click handler
  offerTabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-btn')) return;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    renderSponseeOffersByFilter(e.target.dataset.filter);
  });

  // Main loader
  async function loadSponseeOffers() {
    listingContainer.innerHTML = '<p>Loading sponsorship offers...</p>';
    const { data: offers, error } = await supabase
      .from('private_offers')
      .select('*')
      .eq('sponsee_email', sponsee_email)
      .in('status', ['pending', 'accepted', 'in_progress', 'live', 'completed', 'rejected', 'Offer Cancelled']);

    if (error) {
      listingContainer.innerHTML = `<p style="color:red;">Error loading offers: ${error.message}</p>`;
      return;
    }
    if (!offers || offers.length === 0) {
      listingContainer.innerHTML = '<p>No sponsorship offers yet.</p>';
      allSponseeOffers = [];
      return;
    }
    allSponseeOffers = offers;
    renderSponseeOffersByFilter(document.querySelector('.tab-btn.active')?.dataset.filter || "all");
  }

  // Render offers filtered by tab
  function renderSponseeOffersByFilter(filter) {
    listingContainer.innerHTML = '';
    const filteredOffers = allSponseeOffers.filter(offer => {
      if (filter === 'all') return true;
      if (filter === 'pending') return offer.status === 'pending';
      if (filter === 'accepted') return offer.status === 'accepted';
      if (filter === 'stage-3') return offer.stage === 3;
      if (filter === 'stage-4') return offer.stage === 4;
      if (filter === 'stage-5') return offer.stage === 5;
      if (filter === 'rejected') return ['rejected', 'Offer Cancelled'].includes(offer.status);
      return offer.status === filter;
    });
    if (filteredOffers.length === 0) {
      listingContainer.innerHTML = '<p>No offers found for this filter.</p>';
      return;
    }
    filteredOffers.forEach(renderSingleOfferCard);
  }

  // Renders a single offer card, all UI and logic
  async function renderSingleOfferCard(offer) {
    // Get sponsor profile pic
    let sponsorPicUrl = 'logos.png';
    let sponsor_id = '';
    try {
      const { data: sponsor } = await supabase
        .from('users_extended_data')
        .select('profile_pic, id, username')
        .eq('username', offer.sponsor_username)
        .single();
      if (sponsor && sponsor.profile_pic) {
        sponsorPicUrl = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsor.profile_pic}`;
      }
      sponsor_id = sponsor?.id || '';
    } catch { /* fallback to default pic */ }

    // Progress header
    const stageProgress = [20, 40, 60, 80, 100][offer.stage - 1] || 0;
    const stageLabels = [
      'Stage 1: Offer Received',
      'Stage 2: Offer Accepted',
      'Stage 3: Creating',
      'Stage 4: Content Live',
      'Stage 5: Sponsorship Completed - Review'
    ];
    const progressColor = offer.stage === 5 ? 'background-color: green;' : '';
    const stageHeader = `<h3>${stageLabels[offer.stage - 1] || 'Unknown Stage'}</h3>
      <div class="progress-container">
        <div class="progress-bar" style="width: ${stageProgress}%; ${progressColor}"></div>
      </div>`;

    // Stage action buttons
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
      actionButtons = `
        <div class="stage-4-actions">
          <button class="payment-received-btn">Payment Received</button>
        </div>
      `;
    } else if (offer.stage === 5) {
      actionButtons = `
        <div class="stage-5-summary">
          <p><strong>✅ Sponsorship complete. Thank you!</strong></p>
        </div>
        <button class="review" data-offer-id="${offer.id}">Leave Review</button>
      `;
    }

    // Card
    const card = document.createElement('div');
    card.className = 'listing-stage';
    card.dataset.offerId = offer.id;
    card.dataset.sponsorUsername = offer.sponsor_username;
    card.dataset.sponseeUsername = offer.sponsee_username;
    card.dataset.sponsorId = sponsor_id;
    card.dataset.sponsorEmail = offer.sponsor_email;

    card.innerHTML = `
      <div class="card-content">
        <div class="card-top">
          <div class="logo-container">
            <img src="${sponsorPicUrl}" alt="Sponsor Profile Pic" class="stage-logo">
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

  // Main event delegation for ALL card interactions
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

    // --- Section togglers ---
    const detailsSection = cardBottom.querySelector('.details-section');
    const imagesSection = cardBottom.querySelector('.images-section');
    const commentsSection = cardBottom.querySelector('.comments-section');
    const thumbnailsContainer = imagesSection.querySelector('.image-thumbnails');

    function hideAllSections() {
      detailsSection.style.display = 'none';
      imagesSection.style.display = 'none';
      commentsSection.style.display = 'none';
    }

    // Expand details
    if (e.target.classList.contains('expand-btn')) {
      const isVisible = detailsSection.style.display === 'block';
      hideAllSections();
      detailsSection.style.display = isVisible ? 'none' : 'block';
      return;
    }

    // View images
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

    // View/add comments
    if (e.target.classList.contains('offer-Comments')) {
      const isVisible = commentsSection.style.display === 'block';
      hideAllSections();
      if (!isVisible) {
        commentsSection.style.display = 'block';
        await reloadOfferComments();
      }
      return;
    }

    // Submit comment
    if (e.target.classList.contains('submit-comment')) {
      const textarea = commentsSection.querySelector('.comment-input');
      const commentText = textarea.value.trim();
      if (!commentText) {
        alert('Comment cannot be empty.');
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        alert('Could not fetch user.');
        return;
      }
      const user_id = userData.user.id;
      const sender = sponseeUsername;

      // Insert comment
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

        // Notify sponsor about comment
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

    // Helper to reload comments
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
          const commentEl = document.createElement('p');
          commentEl.innerHTML = `<strong>${displayName}:</strong> ${comment.comment_text} <em>(${new Date(comment.created_at).toLocaleString()})</em>`;
          existingComments.appendChild(commentEl);
        }
      }
    }

    // --- OFFER STAGE BUTTONS ---

    // Confirm offer
    if (e.target.classList.contains('confirm-offer')) {
      if (window.confirm("Are you sure you want to accept this offer?")) {
        const { error } = await supabase
          .from('private_offers')
          .update({ status: 'accepted', stage: 2 })
          .eq('id', offerId);
        if (error) alert(`Error accepting offer: ${error.message}`);
        else {
          // Notify sponsor about accepted offer
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

    // Reject offer
    if (e.target.classList.contains('reject-offer')) {
      if (window.confirm("Are you sure you want to reject this offer? This action cannot be undone.")) {
        const { error } = await supabase
          .from('private_offers')
          .update({ status: 'rejected' })
          .eq('id', offerId);
        if (error) alert(`Error rejecting offer: ${error.message}`);
        else {
          // Notify sponsor about rejected offer
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

    // Set creation date
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

    // Go live
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

    // Payment received
    if (e.target.classList.contains('payment-received-btn')) {
      if (window.confirm("Confirm that payment has been received?")) {
        const { error } = await supabase
          .from('private_offers')
          .update({ stage: 5 })
          .eq('id', offerId);
        if (error) alert(`Failed to mark payment received: ${error.message}`);
        else {
          // Notifies sponsor and triggers payout alert
          await notifyOfferUpdate({
            to_user_id: sponsorId,
            offer_id: offerId,
            type: 'payment_received',
            title: 'Payment Marked as Received',
            message: `${sponsee_username} marked payment as received.`
          });
          // This payout is a placeholder; you might trigger this after admin/manual approval
          await notifyPayout({
            to_user_id: sponsee_id,
            payout_amount: offerCard.querySelector('.offer-right').textContent.match(/\$\d+/)?.[0] || 'Amount',
            payout_currency: 'USD',
            payout_status: 'completed',
            offer_id: offerId
          });
          await loadSponseeOffers();
        }
      }
      return;
    }

    // Leave review
    if (e.target.classList.contains('review')) {
      const offerId = e.target.dataset.offerId;
      if (offerId) window.location.href = `/public/review.html?offer_id=${offerId}`;
      return;
    }
  });

  // Initial load
  await loadSponseeOffers();
});
