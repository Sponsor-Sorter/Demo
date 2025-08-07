import { supabase } from '/public/js/supabaseClient.js';

const MATCH_FN_URL = 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/calculate_match_scores';
const container = document.getElementById('recommendedMatches');
const helpLabel = document.getElementById('help-accounts-label');

// Platform badge helper (shared across site)
function extractPlatformBadges(socialHandles) {
  if (!socialHandles) return '';
  let handlesObj = socialHandles;
  if (typeof handlesObj === 'string') {
    try { handlesObj = JSON.parse(handlesObj); } catch { return ''; }
  }
  const platformLogos = {
    instagram: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/1200px-Instagram_logo_2022.svg.png',
    tiktok: 'tiktoklogo.png',
    youtube: 'youtubelogo.png',
    twitter: 'twitterlogo.png',
    facebook: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
    twitch: 'twitchlogo.png',
    snapchat: 'snaplogo.png',
  };
  const platformsArray = Object.keys(handlesObj).filter(platform => {
    const handle = handlesObj[platform];
    return handle && handle.trim() !== '';
  });
  if (platformsArray.length === 0) return '';
  return platformsArray.map(p => {
    const logoSrc = platformLogos[p.toLowerCase()];
    return logoSrc
      ? `<img src="${logoSrc}" alt="${p}" title="${p}" class="platform-logo-icon" style="height:21px;vertical-align:middle;">`
      : `<span class="platform-badge">${p}</span>`;
  }).join(' ');
}

// Card rendering for recommended sponsees (for SPONSORS)
function renderSponseeCard(profile, match) {
  const div = document.createElement('div');
  div.className = 'user-profile';
  const imgSrc = profile.profile_pic
    ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${profile.profile_pic}`
    : 'logos.png';
  const platformsHTML = extractPlatformBadges(profile.social_handles);

  div.innerHTML = `
    <figure>
      <img src="${imgSrc}" alt="${profile.username}" class="profile-pic">
      <div class="platforms-row">${platformsHTML}</div>
    </figure>
    <div class="user-profile-content">
      <figcaption><strong>${escapeHTML(profile.username)}</strong><br>
      ${escapeHTML(profile.contenttype) || ''}<br>
      ${escapeHTML(profile.location) || ''}</figcaption>
      <div class="recmatch-score-row"><b>Match Score:</b> ${match.match_score}/100</div>
      <div class="recmatch-explanation"><em>${escapeHTML(match.explanation)}</em></div>
      <button class="view-profile">View Profile</button>
      <button class="make-offer-btn" data-username="${profile.username}">Make Offer</button>
    </div>
  `;
  div.querySelector('.view-profile').addEventListener('click', () => {
    window.location.href = `viewprofile.html?username=${encodeURIComponent(profile.username)}`;
  });
  div.querySelector('.make-offer-btn').addEventListener('click', () => {
    window.location.href = `newoffer.html?username=${encodeURIComponent(profile.username)}`;
  });
  return div;
}

// Card rendering for recommended offers (for SPONSEES) - async
async function renderOfferCard(offer, match, alreadyApplied = false) {
  let sponsorLogo = 'logos.png';
  if (offer.sponsor_username) {
    try {
      const { data: sponsorProfile } = await supabase
        .from('users_extended_data')
        .select('profile_pic')
        .eq('username', offer.sponsor_username)
        .maybeSingle();
      if (sponsorProfile && sponsorProfile.profile_pic) {
        sponsorLogo = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsorProfile.profile_pic}`;
      } else if (offer.offer_images && offer.offer_images.length && typeof offer.offer_images[0] === "string") {
        sponsorLogo = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${offer.offer_images[0]}`;
      }
    } catch { /* fallback */ }
  } else if (offer.offer_images && offer.offer_images.length && typeof offer.offer_images[0] === "string") {
    sponsorLogo = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${offer.offer_images[0]}`;
  }

  const div = document.createElement('div');
  div.className = 'user-profile';

  const companyOrSponsor = offer.sponsor_company || offer.sponsor_username || 'Sponsor';
  const platformBadges = Array.isArray(offer.platforms) && offer.platforms.length
    ? offer.platforms.map(p => {
        const logos = {
          youtube: 'youtubelogo.png',
          instagram: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/1200px-Instagram_logo_2022.svg.png',
          tiktok: 'tiktoklogo.png',
          twitter: 'twitterlogo.png',
          facebook: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
          twitch: 'twitchlogo.png',
          snapchat: 'snaplogo.png'
        };
        const logo = logos[p.toLowerCase()];
        return logo
          ? `<img src="${logo}" alt="${p}" title="${p}" class="platform-logo-icon" style="height:21px;vertical-align:middle;">`
          : `<span class="platform-badge">${p}</span>`;
      }).join(' ')
    : '';

  div.innerHTML = `
    <figure>
      <img src="${sponsorLogo}" alt="${companyOrSponsor}" class="profile-pic">
      <div class="platforms-row">${platformBadges}</div>
    </figure>
    <div class="user-profile-content">
      <figcaption>
        <strong>${escapeHTML(offer.offer_title)}</strong><br>
        ${escapeHTML(companyOrSponsor)}<br>
        $${offer.offer_amount ?? '-'}
      </figcaption>
      <div class="recmatch-score-row"><b>Match Score:</b> ${match.match_score}/100</div>
      <div class="recmatch-explanation"><em>${escapeHTML(match.explanation)}</em></div>
      <button class="view-offer">View Offer</button>
      <button class="apply-offer-btn" data-offer-id="${offer.id}" ${alreadyApplied ? 'disabled style="background:#888;opacity:0.7;cursor:not-allowed;"' : ''}>
        ${alreadyApplied ? 'Applied' : 'Apply'}
      </button>
    </div>
  `;
  div.querySelector('.view-offer').addEventListener('click', () => {
    if (window.showOfferDetailsModal) window.showOfferDetailsModal(offer);
    else alert('Offer details modal is not available.');
  });
  if (!alreadyApplied) {
    div.querySelector('.apply-offer-btn').addEventListener('click', () => {
      if (window.showApplyModal) window.showApplyModal(offer);
      else alert('Apply modal is not available.');
    });
  }
  return div;
}

// Loading/error helpers
function showLoading() {
  container.innerHTML = '<div class="loading-recmatch">Loading recommendations…</div>';
}
function showError(msg) {
  container.innerHTML = `<div class="error-recmatch" style="color:#b00;">${msg}</div>`;
}

// Utility
function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, s =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]
  );
}

// =========== MAIN LOGIC ===========

document.addEventListener('DOMContentLoaded', async () => {
  container.innerHTML = '';
  showLoading();

  // Get session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return showError('You must be logged in to see recommendations.');

  // Fetch profile and determine type
  const { data: profile, error: profErr } = await supabase
    .from('users_extended_data')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (profErr || !profile) return showError('Could not fetch user profile.');

  // Only allow these two values for userType
  const userType = profile.userType;
  if (userType !== 'sponsor' && userType !== 'besponsored') {
    return showError('Account type not set.');
  }

  // Set help block label
  if (helpLabel) helpLabel.textContent = userType === 'besponsored'
    ? "sponsorship opportunities"
    : "creators/influencers";

  // Prepare payload for recommendations
  let payload = {};
  if (userType === 'besponsored') payload = { sponsee_id: profile.user_id, limit: 5 };
  else payload = { sponsor_id: profile.user_id, limit: 5 };

  // Fetch recommendations from Edge Function
  let matches;
  try {
    const resp = await fetch(MATCH_FN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const result = await resp.json();
    if (!resp.ok || !result.matches || result.matches.length === 0)
      return showError('No recommendations found yet. Try updating your profile/interests!');
    matches = result.matches;
  } catch (e) {
    return showError('Could not load recommendations.');
  }

  // Fetch details for match targets
  const idsToFetch = new Set();
  matches.forEach(match => {
    idsToFetch.add(userType === 'besponsored' ? match.offer_id : match.sponsee_id);
  });

  let details = {};
  if (userType === 'besponsored') {
    const { data: offers } = await supabase
      .from('public_offers')
      .select('*')
      .in('id', Array.from(idsToFetch));
    (offers || []).forEach(offer => { details[offer.id] = offer; });
  } else {
    const { data: sponsees } = await supabase
      .from('users_extended_data')
      .select('user_id, username, contenttype, location, profile_pic, social_handles')
      .in('user_id', Array.from(idsToFetch));
    (sponsees || []).forEach(profile => { details[profile.user_id] = profile; });
  }

  // For sponsee: get applications to know which offers have already been applied for
  let alreadyAppliedMap = {};
  if (userType === 'besponsored' && Object.keys(details).length) {
    const { data: applications } = await supabase
      .from('public_offer_applications')
      .select('offer_id')
      .eq('sponsee_id', profile.user_id)
      .in('offer_id', Object.keys(details));
    (applications || []).forEach(app => { alreadyAppliedMap[app.offer_id] = true; });
  }

  // Render matches (use async/await for offers)
  container.innerHTML = '';
  if (userType === 'besponsored') {
    for (const match of matches) {
      const offer = details[match.offer_id];
      if (!offer) continue;
      const card = await renderOfferCard(offer, match, alreadyAppliedMap[offer.id]);
      container.appendChild(card);
    }
  } else {
    for (const match of matches) {
      const sponsee = details[match.sponsee_id];
      if (!sponsee) continue;
      const card = renderSponseeCard(sponsee, match);
      container.appendChild(card);
    }
  }
});
