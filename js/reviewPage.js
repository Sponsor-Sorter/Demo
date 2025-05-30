import { supabase } from './supabaseClient.js';
import { notifyReview } from './alerts.js'; // Make sure this is correct

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const offerId = urlParams.get("offer_id");

  // --- Star rating helpers (left-to-right coloring) ---
  function createStarRating(element) {
    let value = 0;
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.innerHTML = '★';
      star.dataset.value = i;

      star.addEventListener('mouseenter', () => highlightStars(element, i));
      star.addEventListener('mouseleave', () => highlightStars(element, value));
      star.addEventListener('click', () => {
        value = i;
        highlightStars(element, value);
        element.setAttribute('data-selected', value);
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

  function getStarValue(category) {
    const el = document.querySelector(`.star-rating[data-category='${category}']`);
    return parseInt(el?.getAttribute('data-selected')) || 0;
  }

  document.querySelectorAll('.star-rating').forEach(starRating => createStarRating(starRating));

  // --- Auth check ---
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    alert("Please login to continue.");
    window.location.href = '/login.html';
    return;
  }
  const userId = session.user.id;
  const userEmail = session.user.email;

  // --- Load offer ---
  const { data: offer, error: offerError } = await supabase
    .from("private_offers")
    .select("*")
    .eq("id", offerId)
    .single();
  if (offerError || !offer) {
    alert("Offer not found.");
    return;
  }

  // --- Load sponsor profile ---
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
    document.getElementById("sponsor-pic").src =
      `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsorData.profile_pic}`;
  }

  // --- Load sponsee profile ---
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
    document.getElementById("sponsee-pic").src =
      `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponseeData.profile_pic}`;
  }

  // --- Fill offer details ---
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

  // --- Robust reviewer username fetch ---
  async function fetchReviewerUsername(user_id) {
    if (!user_id) return userEmail;
    const { data, error } = await supabase
      .from("users_extended_data")
      .select("username")
      .eq("user_id", user_id)
      .single();
    return data?.username || userEmail;
  }

  // --- Review submission handler ---
  document.getElementById("submit-review").addEventListener("click", async () => {
    const communication = getStarValue('communication');
    const punctuality = getStarValue('punctuality');
    const work_output = getStarValue('work_output');
    const overall = getStarValue('overall');
    const reviewText = document.getElementById("review-text").value;

    if (
      !communication || communication < 1 || communication > 5 ||
      !punctuality || punctuality < 1 || punctuality > 5 ||
      !work_output || work_output < 1 || work_output > 5 ||
      !overall || overall < 1 || overall > 5
    ) {
      alert("All ratings must be between 1 and 5.");
      return;
    }

    // Use email to detect reviewer role
    let reviewer_role;
    let redirectPath;
    if (userEmail === offer.sponsor_email) {
      reviewer_role = 'sponsor';
      redirectPath = "dashboardsponsor.html";
    } else if (userEmail === offer.sponsee_email) {
      reviewer_role = 'sponsee';
      redirectPath = "dashboardsponsee.html";
    } else {
      reviewer_role = null;
    }

    if (!reviewer_role) {
      alert("Could not determine your role for this offer. Please contact support.");
      return;
    }

    // 1. Submit review
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

    // --- NOTIFICATION: Notify the other party they received a review ---
    let to_user_id;
    if (reviewer_role === 'sponsor') {
      to_user_id = sponseeData.user_id;
    } else {
      to_user_id = sponsorData.user_id;
    }
    // Fetch reviewer's username from users_extended_data (robust)
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

    // 2. Update offer status to 'review_completed'
    await supabase
      .from("private_offers")
      .update({ status: "review_completed" })
      .eq("id", offer.id);

    // 3. Check if both sponsor and sponsee have reviewed
    const { data: reviews } = await supabase
      .from("private_offer_reviews")
      .select("reviewer_role")
      .eq("offer_id", offer.id);

    const roles = reviews.map(r => r.reviewer_role);
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
});
