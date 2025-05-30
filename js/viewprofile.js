import { supabase } from './supabaseClient.js';

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const offerId = urlParams.get('offer_id');

  if (!offerId) {
    alert("No offer ID provided.");
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    alert("You must be logged in.");
    window.location.href = '/login.html';
    return;
  }

  const userId = session.user.id;

  // Load offer info
  const { data: offer, error } = await supabase
    .from('private_offers')
    .select('*')
    .eq('id', offerId)
    .single();

  if (error || !offer) {
    document.getElementById('offer-details').textContent = "Failed to load offer.";
    console.error(error);
    return;
  }

  document.getElementById('offer-details').innerHTML = `
    <h2>${offer.offer_title}</h2>
    <p><strong>Description:</strong> ${offer.offer_description}</p>
    <p><strong>Status:</strong> ${offer.status}</p>
    <p><strong>Stage:</strong> ${offer.stage}</p>
  `;

  document.getElementById('submit-review').addEventListener('click', async () => {
    const rating = parseInt(document.getElementById('rating').value);
    const comment = document.getElementById('comment').value;
    const reviewerRole = 'sponsee'; // or sponsor based on page

    if (!rating || rating < 1 || rating > 5) {
      alert("Please enter a valid rating between 1 and 5.");
      return;
    }

    const { error: insertError } = await supabase.from('private_offer_reviews').insert([{
      offer_id: offerId,
      reviewer_id: userId,
      reviewer_role: reviewerRole,
      rating,
      review_text: comment
    }]);

    if (insertError) {
      alert("Failed to submit review.");
      console.error(insertError);
      return;
    }

    alert("Review submitted!");
    window.location.href = '/dashboardsponsee.html';
  });
});
