import { supabase } from '/public/js/supabaseClient.js';

let allSponseeOffers = []; 

document.addEventListener("DOMContentLoaded", async () => {
  // Get the current session

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session || !session.user) {
    alert("You must be logged in to view this page.");
    window.location.href = '/login.html';
    return;
  }

  const offerTabs = document.getElementById('offer-tabs');
if (offerTabs) {
  offerTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('button');
    if (!tab) return;
    const status = tab.dataset.status;
    const stage = parseInt(tab.dataset.stage);
    renderSponseeOffersByFilter(status, stage);
  });
}


  

  const sponsee_email = session.user.email;
  const sponsee_id = session.user.id;
  const sponsee_username = session.user.user_metadata.username; 

  if (offerTabs) {
    offerTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('button');
      if (!tab) return;
      const status = tab.dataset.status;
      const stage = parseInt(tab.dataset.stage);
      renderSponseeOffersByFilter(status, stage);
    });
  }

// Get the logged-in user's username
  const listingContainer = document.getElementById('listing-container');

  // Load all offers made *to* this sponsee
  async function loadSponseeOffers() {
    listingContainer.innerHTML = '<p>Loading active sponsorship offers...</p>';

    const { data: offers, error } = await supabase
      .from('private_offers')
      .select('*')
      .eq('sponsee_email', sponsee_email)
      .in('status', ['pending', 'accepted', 'in_progress', 'live', 'completed']);

    if (error) {
      listingContainer.innerHTML = `<p style="color:red;">Error loading offers: ${error.message}</p>`;
      return;
    }

    if (!offers || offers.length === 0) {
      listingContainer.innerHTML = '<p>No active sponsorship offers yet.</p>';
      return;
    }
    allSponseeOffers = offers;
    listingContainer.innerHTML = ''; // clear loading text

    for (const offer of offers) {
      // Fetch sponsor profile pic and ID
      const { data: sponsor, error: sponsorError } = await supabase
        .from('users_extended_data')
        .select('profile_pic, id, username') // Fetching profile_pic, id (sponsor_id), and username
        .eq('username', offer.sponsor_username)
        .single();

      let sponsorPicUrl = 'logos.png';
      if (sponsor && sponsor.profile_pic) {
        sponsorPicUrl = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsor.profile_pic}`;
      }
      

      const listing = document.createElement('div');
      listing.className = 'listing-stage';
      listing.dataset.offerId = offer.id;
      listing.dataset.sponsorUsername = offer.sponsor_username;  // Store sponsor_username in dataset
      listing.dataset.sponseeUsername = offer.sponsee_username;  // Store sponsee_username in dataset
      listing.dataset.sponsorId = sponsor.id;  // Store sponsor_id in dataset
      listing.dataset.sponsorEmail = offer.sponsor_email;  // Store sponsor_email in dataset

      let stageHeader = '';
      if (offer.stage == 1) {
        stageHeader = `<h3>Stage 1: Offer Received</h3><div class="progress-container"><div class="progress-bar" style="width: 20%;"></div></div>`;
      } else if (offer.stage == 2) {
        stageHeader = `<h3>Stage 2: Offer Accepted</h3><div class="progress-container"><div class="progress-bar" style="width: 40%;"></div></div>`;
      } else if (offer.stage == 3) {
        stageHeader = `<h3>Stage 3: Creating</h3><div class="progress-container"><div class="progress-bar" style="width: 60%;"></div></div>`;
      } else if (offer.stage == 4) {
        stageHeader = `<h3>Stage 4: Content Live</h3><div class="progress-container"><div class="progress-bar" style="width: 80%;"></div></div>`;
      } else if (offer.stage == 5) {
        stageHeader = `<h3>Stage 5: Sponsorship Completed - Review</h3><div class="progress-container"><div class="progress-bar" style="width: 100%; background-color: green;"></div></div>`;
      }
      
        const actionButtons = (offer.stage == 2)
        ? `
          <div class="creation-scheduling">
            <label for="creation-date-${offer.id}"><strong>Select Creation Date:</strong></label><br>
            <input type="date" id="creation-date-${offer.id}" class="creation-date">
            <button class="creation-now-btn">Created by</button>
          </div>
        `
        : (offer.stage == 3)
            ? `
            <div class="live-scheduling">
                <label for="live-date-${offer.id}"><strong>Select Live Date:</strong></label><br>
                <input type="date" id="live-date-${offer.id}" class="live-date"><br>
                <label for="live-url-${offer.id}"><strong>Link to Live Content:</strong></label><br>
                <input type="url" id="live-url-${offer.id}" class="live-url" placeholder="https://example.com/content"><br>
                <button class="live-now-btn">Live</button>
            </div>
            `
         : (offer.stage == 4)
  ? `
    <div class="stage-4-actions">
      <button class="payment-received-btn">Payment Received</button>
    </div>
  `
  : (offer.stage == 5)
  ? `
    <div class="stage-5-summary">
      <p><strong>✅ Sponsorship complete. Thank you!</strong></p>
    </div>
<button class="review" data-offer-id="${offer.id}">Leave Review</button>

    
  `
        : `
          <p>
            <button class="confirm-offer">Confirm Offer</button>
            <button class="reject-offer">Reject Offer</button>
          </p>
          
        `;
        
document.body.addEventListener('click', (e) => {
          if (e.target.classList.contains('review')) {
            const offerId = e.target.dataset.offerId;
            if (offerId) {
              window.location.href = `/public/review.html?offer_id=${offerId}`;
            }
          }
        });
        
      

      listing.innerHTML = `
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

            ${actionButtons}
          </div>
        </div>
      `;
      listingContainer.appendChild(listing);
    }
  }

  // Handle button clicks
  listingContainer.addEventListener('click', async (e) => {
    const offerCard = e.target.closest('.listing-stage');
    if (!offerCard) return;
    const offerId = offerCard.dataset.offerId;
    const sponsorUsername = offerCard.dataset.sponsorUsername; // Get sponsor_username from dataset
    const sponseeUsername = offerCard.dataset.sponseeUsername; // Get sponsee_username from dataset
    const sponsorId = offerCard.dataset.sponsorId; // Get sponsor_id from dataset
    const sponsorEmail = offerCard.dataset.sponsorEmail; // Get sponsor_email from dataset
    const cardBottom = offerCard.querySelector('.card-bottom');

    const detailsSection = cardBottom.querySelector('.details-section');
    const imagesSection = cardBottom.querySelector('.images-section');
    const commentsSection = cardBottom.querySelector('.comments-section');
    const thumbnailsContainer = imagesSection.querySelector('.image-thumbnails');
if (!cardBottom) {
  cardBottom = document.createElement('div');
  cardBottom.className = 'card-bottom';
  card.appendChild(cardBottom);
}

    function hideAllSections() {
      detailsSection.style.display = 'none';
      imagesSection.style.display = 'none';
      commentsSection.style.display = 'none';
    }

    // Handle "Creating now" button click
if (e.target.classList.contains('creation-now-btn')) {
    const dateInput = offerCard.querySelector('.creation-date');
    const selectedDate = dateInput.value;
  
    if (!selectedDate) {
      alert("Please select a date before proceeding.");
      return;
    }
  
    const confirmed = window.confirm(`You are agreeing, on ${selectedDate}. The content promised will be live. (Posted online)?`);
    if (!confirmed) return;
  
    const { error } = await supabase
      .from('private_offers')
      .update({ stage: 3, creation_date: selectedDate }) // Assuming you have a 'creation_date' column
            .update({ stage: 3, creation_date: selectedDate }) // Assuming you have a 'creation_date' column

      .eq('id', offerId);
  
    if (error) {
      alert(`Failed to update stage: ${error.message}`);
    } else {
      alert("Stage updated to Stage 3.");
      loadSponseeOffers(); // Reload to reflect changes
    }
  }

  // Handle "Live" button click for Stage 3
  if (e.target.classList.contains('live-now-btn')) {
    const dateInput = offerCard.querySelector('.live-date');
    const urlInput = offerCard.querySelector('.live-url');
    const selectedDate = dateInput.value;
    const liveUrl = urlInput.value.trim();
  
    if (!selectedDate || !liveUrl) {
      alert("Please select a live date and enter a live URL before proceeding.");
      return;
    }
  
    const confirmed = window.confirm(`Gone live on ${selectedDate} with URL: n${liveUrl} nProceed?`);
    if (!confirmed) return;
  
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
  
    if (error) {
      alert(`Failed to go live: ${error.message}`);
    } else {
      alert("Offer is now live (Stage 4).");
      loadSponseeOffers();
    }
  }
  
  // Handle "Payment Received" for Stage 4
if (e.target.classList.contains('payment-received-btn')) {
    if (window.confirm("Confirm that payment has been received?")) {
      const { error } = await supabase
        .from('private_offers')
        .update({ stage: 5 })
        .eq('id', offerId);
  
      if (error) {
        alert(`Failed to mark payment received: ${error.message}`);
      } else {
        alert("Payment received. Stage 5 reached.");
        loadSponseeOffers();
      }
    }
  }
  
  

    // Expand details
    if (e.target.classList.contains('expand-btn')) {
      const isVisible = detailsSection.style.display === 'block';
      hideAllSections();
      detailsSection.style.display = isVisible ? 'none' : 'block';
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
        const imageUrls = imageFilenames.map(filename => {
          return supabase
            .storage
            .from('offers')
            .getPublicUrl(filename)
            .data
            .publicUrl;
        });

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
    }

    // View/add comments
    if (e.target.classList.contains('offer-Comments')) {
      const isVisible = commentsSection.style.display === 'block';
      hideAllSections();
      if (!isVisible) {
        commentsSection.style.display = 'block';

        const existingComments = commentsSection.querySelector('.existing-comments');
        existingComments.innerHTML = '<p>All Comments Loaded...</p>';

        const { data: comments, error } = await supabase
          .from('private_offer_comments')
          .select('*')
          .eq('offer_id', offerId)
          .order('created_at', { ascending: true });

        if (error) {
          existingComments.innerHTML = '<p>Failed to load comments.</p>';
        } else if (!comments || comments.length === 0) {
          existingComments.innerHTML = '<p>Ask any Questions here.</p>';
        } else {
          for (const comment of comments) {
            const displayName = comment.sender || 'Anonymous'; // Use sender column for display

            const commentEl = document.createElement('p');
            commentEl.innerHTML = `<strong>${displayName}:</strong> ${comment.comment_text} <em>(${new Date(comment.created_at).toLocaleString()})</em>`;
            existingComments.appendChild(commentEl);
          }
        }
      }
    }
   


    function renderSponseeOffersByFilter(filter) {
        const listingContainer = document.getElementById('listing-container');
        listingContainer.innerHTML = '';
      
        const filteredOffers = allSponseeOffers.filter(offer => {
          if (filter === 'all') return true;
          if (filter === 'stage-3') return offer.stage === 3;
          if (filter === 'stage-4') return offer.stage === 4;
          if (filter === 'stage-5') return offer.stage === 5;
          if (filter === 'rejected') return ['rejected', 'Offer Cancelled'].includes(offer.status);
          return offer.status === filter;
        });
      
        if (filteredOffers.length === 0) {
          listingContainer.innerHTML = '<p>No more Offers.</p>';
          return;
        }
      
        filteredOffers.forEach(renderSingleOffer); // reuse your existing render function
      }
      

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
        const user_email = userData.user.email;
      
        // Get the sender's username from the offer data
        const sender = sponseeUsername; // This can be either sponsee or sponsor depending on context
      
        const { error } = await supabase
          .from('private_offer_comments')
          .insert([{
            offer_id: offerId,
            user_id: user_id,
            sponsor_id: sponsorId,  // Insert sponsor_id
            sponsor_email: sponsorEmail,  // Insert sponsor_email
            sponsee_id: sponsee_id,
            sponsee_email: sponsee_email,
            sender: sender,  // Use the sender fetched from the private_offers table
            comment_text: commentText
          }]);
      
        if (error) {
          console.error(error);
          alert('Failed to submit comment.');
        } else {
          textarea.value = '';
          alert('Comment submitted!');
      
          // ✅ Reload comments automatically after submit
          const existingComments = commentsSection.querySelector('.existing-comments');
          existingComments.innerHTML = '<p>Reloading comments...</p>';
      
          const { data: updatedComments, error: loadError } = await supabase
            .from('private_offer_comments')
            .select('*')
            .eq('offer_id', offerId)
            .order('created_at', { ascending: true });
      
          if (loadError) {
            existingComments.innerHTML = '<p>Failed to reload comments.</p>';
          } else if (!updatedComments || updatedComments.length === 0) {
            existingComments.innerHTML = '<p>No comments yet.</p>';
          } else {
            existingComments.innerHTML = '';
            for (const comment of updatedComments) {
              const displayName = comment.sender || 'Anonymous'; // Use sender column for display
      
              const commentEl = document.createElement('p');
              commentEl.innerHTML = `<strong>${displayName}:</strong> ${comment.comment_text} <em>(${new Date(comment.created_at).toLocaleString()})</em>`;
              existingComments.appendChild(commentEl);
            }
          }
        }
      }
      
    // Confirm offer
    if (e.target.classList.contains('confirm-offer')) {
      if (window.confirm("Are you sure you want to accept this offer?")) {
        const { error } = await supabase
          .from('private_offers')
          .update({ status: 'accepted', stage: 2 })
          .eq('id', offerId);
        if (error) {
          alert(`Error accepting offer: ${error.message}`);
        } else {
          alert('Offer accepted!');
          loadSponseeOffers();
        }
      }
    }

    // Reject offer
    if (e.target.classList.contains('reject-offer')) {
      if (window.confirm("Are you sure you want to reject this offer? This action cannot be undone.")) {
        const { error } = await supabase
          .from('private_offers')
          .update({ status: 'rejected' })
          .eq('id', offerId);
        if (error) {
          alert(`Error rejecting offer: ${error.message}`);
        } else {
          alert('Offer rejected.');
          loadSponseeOffers();
        }
      }
    }

    function renderSponseeOffersByFilter(filter) {
        const listingContainer = document.getElementById('listing-container');
        listingContainer.innerHTML = '';
      
        const filteredOffers = allSponseeOffers.filter(offer => {
          if (filter === 'all') return true;
          if (filter === 'stage-3') return offer.stage === 3;
          if (filter === 'stage-4') return offer.stage === 4;
          if (filter === 'stage-5') return offer.stage === 5;
          if (filter === 'rejected') return ['rejected', 'Offer Cancelled'].includes(offer.status);
          return offer.status === filter;
        });
      
        if (filteredOffers.length === 0) {
          listingContainer.innerHTML = '<p>No more offers found for this filter.</p>';
          return;
        }
      
        filteredOffers.forEach(renderSingleOffer);
      }
      
     

  });

 

  // Initial load
  await loadSponseeOffers();
});



async function renderSingleOffer(offer) {
  const listingContainer = document.getElementById('listing-container');

  const { data: sponsor } = await supabase
    .from('users_extended_data')
    .select('profile_pic, id, username')
    .eq('username', offer.sponsor_username)
    .single();

  let sponsorPicUrl = 'logos.png';
  if (sponsor?.profile_pic) {
    sponsorPicUrl = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsor.profile_pic}`;
  }

  const listing = document.createElement('div');
  listing.className = 'listing-stage';
  listing.dataset.offerId = offer.id;
  listing.dataset.sponsorUsername = offer.sponsor_username;
  listing.dataset.sponseeUsername = offer.sponsee_username;
  listing.dataset.sponsorId = sponsor.id;
  listing.dataset.sponsorEmail = offer.sponsor_email;

  let stageHeader = '';
  const progress = [20, 40, 60, 80, 100][offer.stage - 1] || 0;
  const stageText = [
    'Stage 1: Offer Received',
    'Stage 2: Offer Accepted',
    'Stage 3: Creating',
    'Stage 4: Content Live',
    'Stage 5: Sponsorship Completed - Review'
  ][offer.stage - 1] || 'Unknown Stage';

  const progressColor = offer.stage === 5 ? 'background-color: green;' : '';
  stageHeader =`<h3>${stageText}</h3><div class="progress-container"><div class="progress-bar" style="width: ${progress}%; ${progressColor}"></div></div> `;

  listing.innerHTML = `
    <div class="card-content">
      <div class="card-top">
        <div class="logo-container">
          <img src=" ${sponsorPicUrl}" alt="Sponsor Profile Pic" class="stage-logo">
          <p><strong>From:</strong>  ${offer.sponsor_username}</p>
          <p><strong>At:</strong>  ${offer.sponsor_company}</p>
        </div>
        <div class="stage-content">
           ${stageHeader}
          <div class="offer-details-row">
            <div class="offer-left">
              <p><strong>Offer Title:</strong>  ${offer.offer_title}</p>
              <p><strong>Status:</strong> <span style="color: ${
  offer.status === 'pending' ? 'orange' :
  offer.status === 'accepted' ? 'green' :
  offer.status === 'live' ? 'blue' :
  ['rejected', 'Offer Cancelled'].includes(offer.status) ? 'red' :
  'inherit'
}">${offer.status}</span></p>
              <p><strong>Date:</strong>  ${new Date(offer.created_at).toLocaleDateString()}</p>
              ${offer.creation_date ?  `<p><strong>Creation Date:</strong>  ${new Date(offer.creation_date).toLocaleDateString()}</p> ` : ''}
              ${offer.live_date ?  `<p><strong>Live Date:</strong>  ${new Date(offer.live_date).toLocaleDateString()}</p> ` : ''}
              ${offer.live_url ?  `<p><strong>Live URL:</strong> <a href=" ${offer.live_url}" target="_blank"> ${offer.live_url}</a></p> ` : ''}
            </div>
            <div class="offer-right">
              <p><strong>Amount:</strong> $ ${offer.offer_amount}</p>
              <p><strong>Payment Schedule:</strong>  ${offer.payment_schedule}</p>
              <p><strong>Duration:</strong>  ${offer.sponsorship_duration}</p>
            </div>
          </div>
        </div>
      </div>
    </div> `;

  listingContainer.appendChild(listing);
}



function renderSponseeOffersByFilter(filter) {
  const listingContainer = document.getElementById('listing-container');
  listingContainer.innerHTML = '';

  const filteredOffers = allSponseeOffers.filter(offer => {
    if (filter === 'all') return true;
    if (filter === 'stage-3') return offer.stage === 3;
    if (filter === 'stage-4') return offer.stage === 4;
    if (filter === 'stage-5') return offer.stage === 5;
    if (filter === 'rejected') return ['rejected', 'Offer Cancelled'].includes(offer.status);
    return offer.status === filter;
  });

  if (filteredOffers.length === 0) {
    listingContainer.innerHTML = '<p>No more offers found for this filter.</p>';
    return;
  }

  filteredOffers.forEach(renderSingleOffer);
}

document.getElementById('offer-tabs').innerHTML = `
  <button data-filter="all" class="tab-btn active">All</button>
  <button data-filter="pending" class="tab-btn">Pending</button>
  <button data-filter="accepted" class="tab-btn">Accepted</button>
  <button data-filter="stage-3" class="tab-btn">In Progress</button>
  <button data-filter="stage-4" class="tab-btn">Live</button>
  <button data-filter="stage-5" class="tab-btn">Completed</button>
  <button data-filter="rejected" class="tab-btn">Rejected / Cancelled</button>
`;

document.getElementById('offer-tabs').addEventListener('click', (e) => {
  if (!e.target.classList.contains('tab-btn')) return;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
  renderSponseeOffersByFilter(e.target.dataset.filter);
});
