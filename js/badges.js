// /public/js/badges.js

import { supabase } from '/public/js/supabaseClient.js'

/**
 * Injects all unlocked badges (bronze, silver, gold) for review-completed offers.
 * Usage: injectUserBadge(userEmail, selector, emailField)
 *  - userEmail: email address of user (sponsor or sponsee)
 *  - selector: querySelector for the badge slot (e.g., "#profile-badge-slot")
 *  - emailField: "sponsor_email" or "sponsee_email" (default is "sponsor_email")
 */
export async function injectUserBadge(userEmail, selector, emailField = 'sponsor_email') {
  let reviewCompletedCount = 0;

  try {
    // Get the count of offers where this user is involved and review is completed
    const { count, error } = await supabase
      .from('private_offers')
      .select('*', { count: 'exact', head: true })
      .eq(emailField, userEmail)
      .eq('status', 'review_completed');

    if (error) throw error;

    reviewCompletedCount = count || 0;
  } catch (e) {
    console.warn('Could not load badge:', e);
  }

  // Prepare badges array
  let badges = [];
  if (reviewCompletedCount >= 1)  badges.push('bronze');
  if (reviewCompletedCount >= 5)  badges.push('silver');
  if (reviewCompletedCount >= 10) badges.push('gold');

  let badgeHTML = '';
  if (badges.length) {
    badgeHTML = badges.map(level => {
      const label = level.charAt(0).toUpperCase() + level.slice(1);
      return `<span class="badge badge-${level}" title="${label} Verified"></span>`;
    }).join(' ')
    + `<span class="badge-count" style="margin-left:5px; font-size:13px; vertical-align:middle;">${reviewCompletedCount}</span>`;
  }

  const badgeSlot = document.querySelector(selector);
  if (badgeSlot) badgeSlot.innerHTML = badgeHTML;
}
