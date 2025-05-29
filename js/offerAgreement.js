// /public/js/offerAgreement.js
export function generateOfferAgreement(offer, sponsor, sponsee) {
  return `
    <div class="offer-agreement">
      <h3>Sponsorship Offer Agreement</h3>
      <p><strong>Sponsor:</strong> ${sponsor.username} (${sponsor.email})</p>
      <p><strong>Sponsee:</strong> ${sponsee.username} (${sponsee.email})</p>
      <p><strong>Offer Title:</strong> ${offer.offerTitle}</p>
      <p><strong>Deliverable:</strong> ${offer.deliverableType}</p>
      <p><strong>Job Type:</strong> ${offer.jobType}</p>
      <p><strong>Description:</strong><br>${(offer.offerDescription || '').replace(/\n/g, '<br>')}</p>
      <p><strong>Platforms:</strong> ${(offer.platforms || []).join(', ')}</p>
      <p><strong>Payment:</strong> $${offer.price} (${offer.payment})</p>
      <p><strong>Start Date:</strong> ${offer.startDate || '[On Acceptance]'}</p>
      <p><strong>Deadline:</strong> ${offer.deadline}</p>
      <p><strong>Duration:</strong> ${offer.sponsorshipDuration}</p>
      <br>
      <p>By ticking the box below, both parties agree to the above terms and Sponsor Sorter rules.</p>
    </div>
  `;
}
