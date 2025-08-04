import { supabase } from '/public/js/supabaseClient.js';

// These must match your Supabase settings:
const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
const PROFILE_BUCKET = 'logos';

function getProfilePicUrl(profile_pic) {
  if (!profile_pic) return 'logos.png';
  if (profile_pic.startsWith('http')) return profile_pic;
  return `${SUPABASE_URL}/storage/v1/object/public/${PROFILE_BUCKET}/${encodeURIComponent(profile_pic)}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSystemHealth();
  await loadSocialProof();
  await loadLeaderboards();
});

async function loadSystemHealth() {
  try {
    const { data: offers } = await supabase
      .from('private_offers')
      .select('id,stage')
      .eq('active', true)
      .eq('archived', false);

    document.getElementById('live-offer-count').textContent = offers?.length ?? '—';

    const stageCount = {};
    offers?.forEach(o => {
      stageCount[o.stage] = (stageCount[o.stage] || 0) + 1;
    });
    document.getElementById('offer-stages').textContent =
      Object.entries(stageCount).map(([stage, count]) => `Stage ${stage}: ${count}`).join(', ') || '—';

    const { data: users } = await supabase
      .from('users_extended_data')
      .select('user_id')
      .eq('banned', false);

    document.getElementById('user-count').textContent = users?.length ?? '—';

    // --- Total payouts: payouts.payout_amount, sum all rows ---
    const { data: payouts } = await supabase
      .from('payouts')
      .select('payout_amount');

    let totalPayout = 0;
    if (payouts && Array.isArray(payouts)) {
      totalPayout = payouts.reduce((sum, p) => sum + (parseFloat(p.payout_amount) || 0), 0);
    }
    document.getElementById('total-payouts').textContent = totalPayout
      ? totalPayout.toLocaleString('en-AU', { maximumFractionDigits: 2 })
      : '—';

    document.getElementById('system-status').textContent = "Online";
    document.getElementById('system-status').style.color = "#6ede87";
    document.getElementById('last-updated').textContent = new Date().toLocaleString();
  } catch (e) {
    document.getElementById('live-offer-count').textContent = '—';
    document.getElementById('offer-stages').textContent = '—';
    document.getElementById('user-count').textContent = '—';
    document.getElementById('total-payouts').textContent = '—';
    document.getElementById('system-status').textContent = 'Online';
    document.getElementById('last-updated').textContent = new Date().toLocaleString();
  }
}

async function loadSocialProof() {
  try {
    const { data: completedOffers } = await supabase
      .from('private_offers')
      .select('sponsee_username, sponsee_id, offer_title, live_date')
      .eq('stage', 5)
      .order('live_date', { ascending: false })
      .limit(5);

    let winnersHTML = "<h3 style='color:#36a2eb;'>Recent Winners</h3>";
    if (completedOffers && completedOffers.length) {
      winnersHTML += '<ul style="margin:0;padding-left:18px;">';
      for (const o of completedOffers) {
        const username = o.sponsee_username || 'Unknown';
        const liveDate = o.live_date ? new Date(o.live_date).toLocaleDateString() : '';
        winnersHTML += `<li><strong>${username}</strong> &mdash; <span style="color:#f6c62e;">${o.offer_title}</span> <span style="color:#bbb;font-size:0.98em;">(${liveDate})</span></li>`;
      }
      winnersHTML += '</ul>';
    } else {
      winnersHTML += "<div style='color:#bbb;'>No recent completed offers yet.</div>";
    }
    document.getElementById('recent-winners').innerHTML = winnersHTML;
  } catch (e) {
    document.getElementById('recent-winners').innerHTML = "<h3 style='color:#36a2eb;'>Recent Winners</h3><div style='color:#bbb;'>Could not load data.</div>";
  }

  try {
    const { data: reviews } = await supabase
      .from('private_offer_reviews')
      .select('reviewer_id, rating, review_text, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    let reviewerIds = reviews?.map(r => r.reviewer_id).filter(Boolean) || [];
    let reviewerMap = {};
    if (reviewerIds.length) {
      const { data: profiles } = await supabase
        .from('users_extended_data')
        .select('user_id, username, profile_pic')
        .in('user_id', reviewerIds);
      profiles?.forEach(p => { reviewerMap[p.user_id] = p; });
    }

    let reviewsHTML = "<h3 style='color:#f6c62e;'>Recent Reviews</h3>";
    if (reviews && reviews.length) {
      reviewsHTML += '<ul style="margin:0;padding-left:18px;">';
      for (const r of reviews) {
        const reviewer = reviewerMap[r.reviewer_id] || {};
        reviewsHTML += `<li>
          <span title="${reviewer.username || ''}" style="margin-right:8px;">
            <img src="${getProfilePicUrl(reviewer.profile_pic)}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;" onerror="this.onerror=null;this.src='logos.png';">
          </span>
          <strong>${reviewer.username || 'User'}</strong> <span style="color:#6ede87;">${'★'.repeat(r.rating)}</span>
          &mdash; <span style="color:#fff;">${r.review_text ? r.review_text.slice(0, 95) : ''}</span>
          <span style="color:#bbb;font-size:0.98em;">(${new Date(r.created_at).toLocaleDateString()})</span>
        </li>`;
      }
      reviewsHTML += '</ul>';
    } else {
      reviewsHTML += "<div style='color:#bbb;'>No reviews yet.</div>";
    }
    document.getElementById('recent-reviews').innerHTML = reviewsHTML;
  } catch (e) {
    document.getElementById('recent-reviews').innerHTML = "<h3 style='color:#f6c62e;'>Recent Reviews</h3><div style='color:#bbb;'>Could not load data.</div>";
  }

  try {
    const { data: sponsorOffers } = await supabase
      .from('private_offers')
      .select('sponsor_id, sponsor_username')
      .not('sponsor_id', 'is', null);

    let sponsorCount = {};
    sponsorOffers?.forEach(o => {
      if (o.sponsor_id) {
        sponsorCount[o.sponsor_id] = sponsorCount[o.sponsor_id] || { count: 0, username: o.sponsor_username };
        sponsorCount[o.sponsor_id].count++;
      }
    });
    let topSponsors = Object.entries(sponsorCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);

    let sponsorIds = topSponsors.map(([id, val]) => id);
    let sponsorMap = {};
    if (sponsorIds.length) {
      const { data: sponsors } = await supabase
        .from('users_extended_data')
        .select('user_id, username, profile_pic')
        .in('user_id', sponsorIds);
      sponsors?.forEach(p => { sponsorMap[p.user_id] = p; });
    }
    let sponsorsHTML = "<h3 style='color:#36a2eb;'>Featured Sponsors</h3>";
    if (topSponsors.length) {
      sponsorsHTML += "<ul style='margin:0;padding-left:18px;'>";
      topSponsors.forEach(([id, val]) => {
        const s = sponsorMap[id] || {};
        sponsorsHTML += `<li>
          <img src="${getProfilePicUrl(s.profile_pic)}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;" onerror="this.onerror=null;this.src='logos.png';">
          <strong>${s.username || val.username || 'Sponsor'}</strong>
          <span style="color:#bbb;">(${val.count} offers)</span>
        </li>`;
      });
      sponsorsHTML += "</ul>";
    } else {
      sponsorsHTML += "<div style='color:#bbb;'>Coming soon</div>";
    }
    document.getElementById('featured-sponsors').innerHTML = sponsorsHTML;
  } catch (e) {
    document.getElementById('featured-sponsors').innerHTML = "<h3 style='color:#36a2eb;'>Featured Sponsors</h3><div style='color:#bbb;'>Could not load data.</div>";
  }

  try {
    const { data: sponseeOffers } = await supabase
      .from('private_offers')
      .select('sponsee_id, sponsee_username, stage')
      .eq('stage', 5)
      .not('sponsee_id', 'is', null);

    let sponseeCount = {};
    sponseeOffers?.forEach(o => {
      if (o.sponsee_id) {
        sponseeCount[o.sponsee_id] = sponseeCount[o.sponsee_id] || { count: 0, username: o.sponsee_username };
        sponseeCount[o.sponsee_id].count++;
      }
    });
    let topSponsees = Object.entries(sponseeCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);

    let sponseeIds = topSponsees.map(([id, val]) => id);
    let sponseeMap = {};
    if (sponseeIds.length) {
      const { data: sponsees } = await supabase
        .from('users_extended_data')
        .select('user_id, username, profile_pic')
        .in('user_id', sponseeIds);
      sponsees?.forEach(p => { sponseeMap[p.user_id] = p; });
    }
    let sponseesHTML = "<h3 style='color:#f6c62e;'>Featured Sponsees</h3>";
    if (topSponsees.length) {
      sponseesHTML += "<ul style='margin:0;padding-left:18px;'>";
      topSponsees.forEach(([id, val]) => {
        const s = sponseeMap[id] || {};
        sponseesHTML += `<li>
          <img src="${getProfilePicUrl(s.profile_pic)}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;" onerror="this.onerror=null;this.src='logos.png';">
          <strong>${s.username || val.username || 'Sponsee'}</strong>
          <span style="color:#bbb;">(${val.count} wins)</span>
        </li>`;
      });
      sponseesHTML += "</ul>";
    } else {
      sponseesHTML += "<div style='color:#bbb;'>Coming soon</div>";
    }
    document.getElementById('featured-sponsees').innerHTML = sponseesHTML;
  } catch (e) {
    document.getElementById('featured-sponsees').innerHTML = "<h3 style='color:#f6c62e;'>Featured Sponsees</h3><div style='color:#bbb;'>Could not load data.</div>";
  }
}

async function loadLeaderboards() {
  // --- Top Earners ---
  try {
    const { data: payouts } = await supabase
      .from('payouts')
      .select('sponsee_id, payout_amount');

    let earnings = {};
    payouts?.forEach(p => {
      if (p.sponsee_id) {
        earnings[p.sponsee_id] = (earnings[p.sponsee_id] || 0) + (parseFloat(p.payout_amount) || 0);
      }
    });

    const topEarners = Object.entries(earnings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let topEarnerIds = topEarners.map(([id]) => id);
    let earnerMap = {};
    if (topEarnerIds.length) {
      const { data: earners } = await supabase
        .from('users_extended_data')
        .select('user_id, username, profile_pic')
        .in('user_id', topEarnerIds);
      earners?.forEach(p => { earnerMap[p.user_id] = p; });
    }

    let earnersHTML = "<h3 style='color:#36a2eb;'>Top Earners</h3><ol style='margin-left:18px;'>";
    for (let [uid, amount] of topEarners) {
      const user = earnerMap[uid] || {};
      earnersHTML += `<li>
        <img src="${getProfilePicUrl(user.profile_pic)}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;" onerror="this.onerror=null;this.src='logos.png';">
        <strong>${user.username || 'User'}</strong>
        <span style="color:#6ede87;">$${amount.toLocaleString('en-AU', {maximumFractionDigits:2})}</span>
      </li>`;
    }
    earnersHTML += "</ol>";
    document.getElementById('top-earners').innerHTML = earnersHTML;
  } catch (e) {
    document.getElementById('top-earners').innerHTML = "<h3 style='color:#36a2eb;'>Top Earners</h3><div style='color:#bbb;'>Could not load data.</div>";
  }

  // --- Most Completed Offers ---
  try {
    const { data: completedOffers } = await supabase
      .from('private_offers')
      .select('sponsee_id, sponsee_username, stage')
      .eq('stage', 5)
      .not('sponsee_id', 'is', null);

    let completionCount = {};
    completedOffers?.forEach(o => {
      completionCount[o.sponsee_id] = (completionCount[o.sponsee_id] || 0) + 1;
    });
    const mostCompleted = Object.entries(completionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let completedIds = mostCompleted.map(([id]) => id);
    let completedMap = {};
    if (completedIds.length) {
      const { data: profiles } = await supabase
        .from('users_extended_data')
        .select('user_id, username, profile_pic')
        .in('user_id', completedIds);
      profiles?.forEach(p => { completedMap[p.user_id] = p; });
    }

    let completedHTML = "<h3 style='color:#f6c62e;'>Most Completed Offers</h3><ol style='margin-left:18px;'>";
    for (let [uid, count] of mostCompleted) {
      const user = completedMap[uid] || {};
      completedHTML += `<li>
        <img src="${getProfilePicUrl(user.profile_pic)}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;" onerror="this.onerror=null;this.src='logos.png';">
        <strong>${user.username || 'User'}</strong>
        <span style="color:#bbb;">${count} wins</span>
      </li>`;
    }
    completedHTML += "</ol>";
    document.getElementById('most-completed').innerHTML = completedHTML;
  } catch (e) {
    document.getElementById('most-completed').innerHTML = "<h3 style='color:#f6c62e;'>Most Completed Offers</h3><div style='color:#bbb;'>Could not load data.</div>";
  }

  // --- Top Rated Users (by reviews received, join review.offer_id -> private_offers.sponsee_id) ---
  try {
    const { data: reviews } = await supabase
      .from('private_offer_reviews')
      .select('offer_id, rating')
      .not('offer_id', 'is', null);

    // Get all offer_ids to batch fetch sponsee_id
    const offerIds = [...new Set(reviews?.map(r => r.offer_id).filter(Boolean))];
    let offerMap = {};
    if (offerIds.length) {
      const { data: offers } = await supabase
        .from('private_offers')
        .select('id, sponsee_id')
        .in('id', offerIds);
      offers?.forEach(o => { offerMap[o.id] = o.sponsee_id; });
    }

    // Aggregate ratings by sponsee_id
    let ratings = {};
    reviews?.forEach(r => {
      const sponseeId = offerMap[r.offer_id];
      if (!sponseeId || r.rating == null) return;
      ratings[sponseeId] = ratings[sponseeId] || [];
      ratings[sponseeId].push(r.rating);
    });

    // Compute average for each sponsee
    let avgRatings = Object.entries(ratings)
      .map(([uid, arr]) => [uid, arr.reduce((a, b) => a + b, 0) / arr.length])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let ratedIds = avgRatings.map(([id]) => id);
    let ratedMap = {};
    if (ratedIds.length) {
      const { data: profiles } = await supabase
        .from('users_extended_data')
        .select('user_id, username, profile_pic')
        .in('user_id', ratedIds);
      profiles?.forEach(p => { ratedMap[p.user_id] = p; });
    }

    let ratedHTML = "<h3 style='color:#36a2eb;'>Top Rated Users</h3><ol style='margin-left:18px;'>";
    for (let [uid, avg] of avgRatings) {
      const user = ratedMap[uid] || {};
      ratedHTML += `<li>
        <img src="${getProfilePicUrl(user.profile_pic)}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;" onerror="this.onerror=null;this.src='logos.png';">
        <strong>${user.username || 'User'}</strong>
        <span style="color:#f6c62e;">Avg ★${avg.toFixed(2)}</span>
      </li>`;
    }
    ratedHTML += "</ol>";
    document.getElementById('top-rated').innerHTML = ratedHTML;
  } catch (e) {
    document.getElementById('top-rated').innerHTML = "<h3 style='color:#36a2eb;'>Top Rated Users</h3><div style='color:#bbb;'>Could not load data.</div>";
  }

  // --- Referral Leaders (where referrer_id === reward_for) ---
  try {
    const { data: referrals } = await supabase
      .from('referral_rewards')
      .select('referrer_id, reward_for');

    let counts = {};
    referrals?.forEach(r => {
      if (r.referrer_id && r.reward_for && r.referrer_id === r.reward_for) {
        counts[r.referrer_id] = (counts[r.referrer_id] || 0) + 1;
      }
    });

    const leaders = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    let leaderIds = leaders.map(([id]) => id);
    let leaderMap = {};
    if (leaderIds.length) {
      const { data: profiles } = await supabase
        .from('users_extended_data')
        .select('user_id, username, profile_pic')
        .in('user_id', leaderIds);
      profiles?.forEach(p => { leaderMap[p.user_id] = p; });
    }

    let referralHTML = "<h3 style='color:#f6c62e;'>Referral Leaders</h3><ol style='margin-left:18px;'>";
    for (let [uid, count] of leaders) {
      const user = leaderMap[uid] || {};
      referralHTML += `<li>
        <img src="${getProfilePicUrl(user.profile_pic)}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;" onerror="this.onerror=null;this.src='logos.png';">
        <strong>${user.username || 'User'}</strong>
        <span style="color:#6ede87;">${count} successful referrals</span>
      </li>`;
    }
    referralHTML += "</ol>";
    document.getElementById('referral-leaders').innerHTML = referralHTML;
  } catch (e) {
    document.getElementById('referral-leaders').innerHTML = "<h3 style='color:#f6c62e;'>Referral Leaders</h3><div style='color:#bbb;'>Could not load data.</div>";
  }
}
