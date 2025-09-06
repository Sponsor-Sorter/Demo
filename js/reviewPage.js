// ./js/reviewPage.js
import { supabase } from './supabaseClient.js';
import { notifyReview } from './alerts.js'; // unchanged
import { famBotModerateWithModal } from './FamBot.js'; // unchanged

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const offerId = urlParams.get("offer_id");

  // --- Inline LTR star layout fix (page-scoped, no global CSS edits) ---
  (function injectStarLTRStyles() {
    const id = 'ss-inline-star-ltr-fix';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      /* Force star rows to lay out left-to-right on this page only */
      .star-rating {
        display: inline-flex !important;
        flex-direction: row !important;
        direction: ltr !important;
      }
    `;
    document.head.appendChild(style);
  })();

  // ---------- Shared star helpers (LTR fill) ----------
  function createStarRating(element, options = {}) {
    // options.namespace lets us create isolated star blocks (e.g., "testimonial")
    const ns = options.namespace || '';
    let value = 0;

    element.setAttribute('data-selected', '0');
    element.classList.add('star-rating');

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.innerHTML = '★';
      star.dataset.value = String(i);
      if (ns) star.dataset.ns = ns;

      star.addEventListener('mouseenter', () => highlightStars(element, i));
      star.addEventListener('mouseleave', () => highlightStars(element, value));
      star.addEventListener('click', () => {
        value = i;
        highlightStars(element, value);
        element.setAttribute('data-selected', String(value));
      });

      element.appendChild(star);
    }
  }

  function highlightStars(element, count) {
    const stars = element.querySelectorAll('span');
    stars.forEach(star => {
      star.classList.remove('selected');
      if (parseInt(star.dataset.value) <= count) {
        star.classList.add('selected');
      }
    });
  }

  function getStarValueByCategory(category) {
    const el = document.querySelector(`.star-rating[data-category='${category}']`);
    return parseInt(el?.getAttribute('data-selected')) || 0;
  }

  // initialize existing star inputs on page (your 4 categories)
  document.querySelectorAll('.star-rating').forEach(starRating => createStarRating(starRating));

  // ---------- Auth ----------
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    alert("Please login to continue.");
    window.location.href = './login.html';
    return;
  }
  const userId = session.user.id;
  const userEmail = session.user.email;

  // Helper: get username for current user (for user_reviews insert)
  async function getCurrentUsername() {
    const { data, error } = await supabase
      .from("users_extended_data")
      .select("username")
      .eq("user_id", userId)
      .single();
    return data?.username || userEmail || 'Anonymous';
  }

  // ---------- Load offer ----------
  const { data: offer, error: offerError } = await supabase
    .from("private_offers")
    .select("*")
    .eq("id", offerId)
    .single();
  if (offerError || !offer) {
    alert("Offer not found.");
    return;
  }

  // ---------- Load sponsor profile ----------
  const { data: sponsorData } = await supabase
    .from("users_extended_data")
    .select("*")
    .eq("email", offer.sponsor_email)
    .single();
  if (sponsorData) {
    document.getElementById("sponsor-username").innerText = sponsorData.username || 'N/A';
    document.getElementById("sponsor-email").innerText = sponsorData.email || 'N/A';
    document.getElementById("sponsor-company").innerText = sponsorData.company_name || 'N/A';
    document.getElementById("sponsor-location").innerText = sponsorData.location || 'N/A';
    document.getElementById("sponsor-about").innerText = sponsorData.about_yourself || 'N/A';
    if (sponsorData.profile_pic) {
      document.getElementById("sponsor-pic").src =
        `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsorData.profile_pic}`;
    }
  }

  // ---------- Load sponsee profile ----------
  const { data: sponseeData } = await supabase
    .from("users_extended_data")
    .select("*")
    .eq("email", offer.sponsee_email)
    .single();
  if (sponseeData) {
    document.getElementById("sponsee-username").innerText = sponseeData.username || 'N/A';
    document.getElementById("sponsee-email").innerText = sponseeData.email || 'N/A';
    document.getElementById("sponsee-location").innerText = sponseeData.location || 'N/A';
    document.getElementById("sponsee-about").innerText = sponseeData.about_yourself || 'N/A';
    if (sponseeData.profile_pic) {
      document.getElementById("sponsee-pic").src =
        `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponseeData.profile_pic}`;
    }
  }

  // ---------- Fill offer details ----------
  document.getElementById("offer-title").innerText = offer.offer_title || 'N/A';
  document.getElementById("offer-description").innerText = offer.offer_description || 'N/A';
  document.getElementById("offer-amount").innerText = offer.offer_amount || 'N/A';
  document.getElementById("deliverable-type").innerText = offer.deliverable_type || 'N/A';
  document.getElementById("offer-status").innerText = offer.status || 'N/A';
  document.getElementById("offer-live-date").innerText = offer.live_date || 'N/A';
  document.getElementById("offer-created-at").innerText = offer.created_at || 'N/A';
  document.getElementById("offer-deadline").innerText = offer.deadline || 'N/A';
  document.getElementById("duration").innerText = offer.sponsorship_duration || 'N/A';
  document.getElementById("offer-live-url").href = offer.live_url || '#';
  document.getElementById("offer-instruction").innerText = offer.instructions || '';
  document.getElementById("payment_schedule").innerText = offer.payment_schedule || '';

  // ---------- Robust reviewer username fetch (existing) ----------
  async function fetchReviewerUsername(user_id) {
    if (!user_id) return userEmail;
    const { data } = await supabase
      .from("users_extended_data")
      .select("username")
      .eq("user_id", user_id)
      .single();
    return data?.username || userEmail;
  }

  // ---------- Submit OFFER review (existing) ----------
  document.getElementById("submit-review").addEventListener("click", async () => {
    const communication = getStarValueByCategory('communication');
    const punctuality  = getStarValueByCategory('punctuality');
    const work_output  = getStarValueByCategory('work_output');
    const overall      = getStarValueByCategory('overall');
    const reviewText   = document.getElementById("review-text").value;

    if (
      !communication || communication < 1 || communication > 5 ||
      !punctuality  || punctuality  < 1 || punctuality  > 5 ||
      !work_output  || work_output  < 1 || work_output  > 5 ||
      !overall      || overall      < 1 || overall      > 5
    ) {
      alert("All ratings must be between 1 and 5.");
      return;
    }

    // Determine role by email
    let reviewer_role;
    let redirectPath;
    if (userEmail === offer.sponsor_email) {
      reviewer_role = 'sponsor';
      redirectPath = "./dashboardsponsor.html";
    } else if (userEmail === offer.sponsee_email) {
      reviewer_role = 'sponsee';
      redirectPath = "./dashboardsponsee.html";
    } else {
      reviewer_role = null;
    }

    if (!reviewer_role) {
      alert("Could not determine your role for this offer. Please contact support.");
      return;
    }

    // --- FAMBOT moderation for the offer review text ---
    const jwt = session?.access_token;
    if (!jwt) {
      alert("Not authenticated. Please log in again.");
      return;
    }
    const modResult = await famBotModerateWithModal({
      user_id: userId,
      content: reviewText,
      jwt,
      type: 'review'
    });
    if (!modResult.allowed) return;

    // 1) Insert offer review
    const { error: insertError } = await supabase
      .from("private_offer_reviews")
      .insert({
        offer_id: offer.id,
        reviewer_id: userId,
        reviewer_role,
        communication,
        punctuality,
        work_output,
        overall,
        review_text: reviewText
      });
    if (insertError) {
      alert("Failed to submit review.");
      console.error(insertError);
      return;
    }

    // 2) Notify other party
    let to_user_id;
    if (reviewer_role === 'sponsor') {
      to_user_id = sponseeData?.user_id;
    } else {
      to_user_id = sponsorData?.user_id;
    }
    const reviewer_username = await fetchReviewerUsername(userId);

    try {
      await notifyReview({
        offer_id: offer.id,
        to_user_id,
        reviewer_username,
        role: reviewer_role
      });
    } catch (e) {
      console.warn('Notification insert failed (review)', e);
    }

    // 3) Update/close out offer as before
    await supabase
      .from("private_offers")
      .update({ status: "review_completed" })
      .eq("id", offer.id);

    const { data: reviews } = await supabase
      .from("private_offer_reviews")
      .select("reviewer_role")
      .eq("offer_id", offer.id);

    const roles = (reviews || []).map(r => r.reviewer_role);
    if (roles.includes('sponsor') && roles.includes('sponsee')) {
      await supabase
        .from("private_offers")
        .update({ status: "review_completed", archived: true })
        .eq("id", offer.id);
      await supabase
        .from("private_offer_comments")
        .delete()
        .eq("offer_id", offer.id);

      alert("Thank you! Both parties have reviewed. This offer has been archived.");
      window.location.href = redirectPath;
    } else {
      alert("Review submitted successfully! Waiting for the other party to complete their review.");
      document.getElementById("submit-review").disabled = true;
      window.location.href = redirectPath;
    }
  });

  // =====================================================================
  //             Automated Testimonial Collection (NEW)
  // =====================================================================

  // LocalStorage key to throttle prompting without schema changes
  const LS_KEY = `ss_seen_testimonial_prompt_${userId}`;

  // Quickly create and show the modal (no external CSS dependency)
  function buildTestimonialModal() {
    // container
    const overlay = document.createElement('div');
    overlay.id = 'testimonial-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;

    const modal = document.createElement('div');
    modal.id = 'testimonial-modal';
    modal.style.cssText = `
      width: min(92vw, 520px); background: #1f1f1f; color: #fff;
      border-radius: 16px; padding: 20px 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border: 1px solid #3a3a3a;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    `;

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px">
        <h3 style="margin:0;font-size:1.1rem">Enjoying Sponsor Sorter?</h3>
        <button id="testimonial-close" aria-label="Close" style="background:transparent;border:none;color:#bbb;font-size:20px;cursor:pointer;box-shadow:none">×</button>
      </div>
      <p style="margin:0 0 10px;color:#ccc;font-size:0.95rem">
        We'd love a quick rating and a short testimonial. It helps us improve and supports the community.
      </p>

      <div id="testimonial-stars" class="star-rating" style="
        display:flex;gap:6px;justify-content:center;font-size:24px;margin:6px 0 4px 0;user-select:none;
      "></div>

      <textarea id="testimonial-text" rows="4" placeholder="What do you like? What could be better?" style="
        width:100%;resize:vertical;border-radius:10px;border:1px solid #3a3a3a;background:#111;color:#eee;padding:10px;font-size:0.95rem;margin-top:8px;
      "></textarea>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button id="testimonial-later" style="
          background:#333;border:1px solid #4a4a4a;color:#ddd;border-radius:10px;padding:8px 12px;cursor:pointer;
        ">Maybe later</button>
        <button id="testimonial-submit" style="
          background:linear-gradient(135deg,#74f0ff,#a18cff);border:none;color:#000;font-weight:600;border-radius:10px;padding:8px 12px;cursor:pointer;
          box-shadow: 0 0 12px #74f0ff50;
        ">Submit</button>
      </div>
      <style>
        #testimonial-modal .star-rating span{ cursor:pointer; transition: transform .08s ease; }
        #testimonial-modal .star-rating span:hover{ transform: translateY(-1px) scale(1.06); }
        #testimonial-modal .star-rating span.selected{ color: #ffd36b; }
      </style>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // init star block only for testimonial stars
    const starHost = modal.querySelector('#testimonial-stars');
    createStarRating(starHost, { namespace: 'testimonial' });

    // wire up buttons
    modal.querySelector('#testimonial-close').addEventListener('click', () => {
      overlay.remove();
      // throttle for a day to avoid repeated nudges
      throttlePrompt();
    });
    modal.querySelector('#testimonial-later').addEventListener('click', () => {
      overlay.remove();
      throttlePrompt();
    });
    modal.querySelector('#testimonial-submit').addEventListener('click', onSubmitTestimonial);
  }

  function getTestimonialStarValue() {
    const el = document.querySelector('#testimonial-stars.star-rating');
    return parseInt(el?.getAttribute('data-selected')) || 0;
  }

  function throttlePrompt(days = 1) {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    try { localStorage.setItem(LS_KEY, String(until)); } catch {}
  }

  function shouldSkipPromptByThrottle() {
    try {
      const until = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
      return Number.isFinite(until) && Date.now() < until;
    } catch { return false; }
  }

  async function onSubmitTestimonial() {
    const overlay = document.getElementById('testimonial-overlay');
    const rating = getTestimonialStarValue();
    const text = (document.getElementById('testimonial-text').value || '').trim();

    if (!rating || rating < 1 || rating > 5) {
      alert('Please choose a rating from 1 to 5.');
      return;
    }
    if (text.length < 5) {
      alert('Please add a short comment (5+ characters).');
      return;
    }

    // Moderate testimonial text
    const jwt = (await supabase.auth.getSession()).data?.session?.access_token;
    if (!jwt) {
      alert('Not authenticated. Please log in again.');
      return;
    }
    const modResult = await famBotModerateWithModal({
      user_id: userId,
      content: text,
      jwt,
      type: 'testimonial'
    });
    if (!modResult.allowed) return;

    // Prepare insert to public.user_reviews (matches your schema)
    const username = await getCurrentUsername();

    const { error: urErr } = await supabase
      .from('user_reviews')
      .insert({
        user_id: userId,
        username,
        rating,
        review_text: text
        // created_at defaults to now()
      });

    if (urErr) {
      console.error('Failed to insert testimonial:', urErr);
      alert('Sorry, we could not save your testimonial right now.');
      return;
    }

    // success UX
    alert('Thanks for the feedback! ❤️');
    overlay?.remove();
    throttlePrompt(90); // don’t ask again for a long time
  }

  // On load: check if user has already left a testimonial
  async function maybePromptForTestimonial() {
    // optional throttle so we don't annoy users multiple times in a session/day
    if (shouldSkipPromptByThrottle()) return;

    const { data, error } = await supabase
      .from('user_reviews')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      console.warn('user_reviews check failed:', error);
      return; // on error, fail closed (don’t show)
    }

    const hasReview = Array.isArray(data) && data.length > 0;
    if (!hasReview) {
      // small delay so it doesn't collide with other alerts on page entry
      setTimeout(buildTestimonialModal, 600);
    }
  }

  // Kick off the testimonial check after primary offer UI is set
  maybePromptForTestimonial();
});
