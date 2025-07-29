// public/js/sponseeLogic.js
import { supabase } from './supabaseClient.js';

// ----- RENDER GOLD STARS -----
function renderStars(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += `<span class="star${i <= rating ? ' gold-star' : ''}">${i <= rating ? '★' : '☆'}</span>`;
  }
  return out;
}

async function updateCategoryStars(category, elementId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const sponseeEmail = session.user.email;

  // Get all offer ids
  const { data: offers } = await supabase
    .from('private_offers')
    .select('id')
    .eq('sponsee_email', sponseeEmail);

  if (!offers || offers.length === 0) {
    const starsEl = document.getElementById(elementId);
    if (starsEl) starsEl.innerHTML = renderStars(0);
    return;
  }
  const offerIds = offers.map(o => o.id);

  // Fetch all category reviews at once
  let allCategoryRatings = [];
  for (let i = 0; i < offerIds.length; i += 100) {
    const batchIds = offerIds.slice(i, i + 100);
    const { data: reviews } = await supabase
      .from('private_offer_reviews')
      .select(category)
      .in('offer_id', batchIds)
      .eq('reviewer_role', 'sponsor');
    if (reviews) allCategoryRatings = allCategoryRatings.concat(reviews);
  }
  const starsEl = document.getElementById(elementId);
  if (!allCategoryRatings.length) {
    if (starsEl) starsEl.innerHTML = renderStars(0);
    return;
  }
  const avg = allCategoryRatings.reduce((sum, r) => sum + (r[category] || 0), 0) / allCategoryRatings.length;
  if (starsEl) starsEl.innerHTML = renderStars(Math.round(avg));
}

// ----- SUMMARY STAT CARDS -----
async function updateSummaryStats() {
  // Set "loading..." state to avoid blank cards
  document.getElementById('active-sponsorships').textContent = '…';
  document.getElementById('completed-deals').textContent = '…';
  document.getElementById('total-earnings').textContent = '…';

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) {
    document.getElementById('active-sponsorships').textContent = '0';
    document.getElementById('completed-deals').textContent = '0';
    document.getElementById('total-earnings').textContent = '$0';
    return;
  }
  const sponsee_email = session.user.email;

  const { data: offers, error: offerError } = await supabase
    .from('private_offers')
    .select('status, offer_amount')
    .eq('sponsee_email', sponsee_email);

  if (offerError || !offers) {
    document.getElementById('active-sponsorships').textContent = '0';
    document.getElementById('completed-deals').textContent = '0';
    document.getElementById('total-earnings').textContent = '$0';
    return;
  }

  // Stat Cards
  const active = offers.filter(o =>
    ['accepted', 'pending', 'in_progress', 'live'].includes(o.status)
  );
  document.getElementById('active-sponsorships').textContent = active.length ?? 0;

  const completed = offers.filter(o =>
    ['completed', 'review_completed'].includes(o.status)
  );
  document.getElementById('completed-deals').textContent = completed.length ?? 0;

  const validIncome = offers.filter(o => !['rejected', 'Offer Cancelled'].includes(o.status));
  const totalEarnings = validIncome.reduce((sum, o) => sum + (o.offer_amount || 0), 0);
  document.getElementById('total-earnings').textContent = `$${totalEarnings.toFixed(2)}`;

  // ---- LIFETIME SUCCESS RATIO ----
  const successfulOffers = offers.filter(o =>
    ['accepted', 'in_progress', 'live', 'review_completed', 'completed'].includes(o.status)
  ).length;
  const rejectedOffers = offers.filter(o =>
    ['rejected', 'Offer Cancelled'].includes(o.status)
  ).length;
  const totalOffers = offers.length;
  let ratioText = '—';
  if (totalOffers > 0) {
    ratioText = `${successfulOffers} : ${rejectedOffers}`;
    ratioText += ` (${Math.round((successfulOffers / totalOffers) * 100)}% success)`;
  }
  const ratioEl = document.getElementById('success-ratio');
  if (ratioEl) ratioEl.textContent = ratioText;
}

// ----- RECENT ACTIVITY TABLE -----
async function loadRecentActivity() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    alert("You must be logged in.");
    window.location.href = '/login.html';
    return;
  }

  const sponseeEmail = session.user.email;
  const { data: offers, error: offerError } = await supabase
    .from('private_offers')
    .select('id, sponsor_username, status, offer_amount, created_at, deadline, creation_date, live_date')
    .eq('sponsee_email', sponseeEmail)
    .order('created_at', { ascending: false });

  const tableBody = document.getElementById('activity-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const oldBtn = document.getElementById('expand-recent-btn');
  if (oldBtn) oldBtn.remove();

  if (offerError || !offers || offers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7">No recent activity yet.</td></tr>';
    return;
  }

  // Get unique sponsor usernames for batch fetch
  const sponsorUsernames = [...new Set(offers.map(o => o.sponsor_username).filter(Boolean))];
  let sponsorPics = {};
  if (sponsorUsernames.length > 0) {
    const { data: sponsors } = await supabase
      .from('users_extended_data')
      .select('username, profile_pic')
      .in('username', sponsorUsernames);
    if (sponsors && Array.isArray(sponsors)) {
      sponsorPics = sponsors.reduce((acc, s) => {
        acc[s.username] = s.profile_pic
          ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${s.profile_pic}`
          : 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';
        return acc;
      }, {});
    }
  }

  // Filter out review_completed status
  const rows = [];
  for (const offer of offers) {
    if (offer.status === 'review_completed') continue;
    const sponsorPicUrl = sponsorPics[offer.sponsor_username] || 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';

    rows.push(`
      <tr>
        <td style="text-align: center;">
          <img src="${sponsorPicUrl}" onerror="this.src='/public/logos.png'" alt="Sponsor Pic" style="width: 36px; height: 36px; border-radius: 50%; display: block; margin: 0 auto 5px;">
          ${offer.sponsor_username}
        </td>
        <td style="color: ${
          offer.status === 'pending' ? 'orange' :
          offer.status === 'accepted' ? 'green' :
          offer.status === 'live' ? 'blue' :
          offer.status === 'completed' ? 'gray' :
          ['rejected', 'Offer Cancelled'].includes(offer.status) ? 'red' :
          'inherit'
        }">${offer.status}</td>
        <td>$${Number(offer.offer_amount).toFixed(2)}</td>
        <td>${offer.created_at ? new Date(offer.created_at).toLocaleDateString() : '—'}</td>
        <td>${offer.deadline ? new Date(offer.deadline + 'T00:00:00Z').toLocaleDateString() : 'N/A'}</td>
        <td>${offer.creation_date ? new Date(offer.creation_date + 'T00:00:00Z').toLocaleDateString() : 'N/A'}</td>
        <td>${offer.live_date ? new Date(offer.live_date).toLocaleDateString() : '—'}</td>
      </tr>
    `);
  }

  let collapsed = true;
  function renderTable() {
    tableBody.innerHTML = '';
    const visibleRows = collapsed ? rows.slice(0, 10) : rows;
    visibleRows.forEach(row => tableBody.innerHTML += row);
    let btn = document.getElementById('expand-recent-btn');
    if (!btn && rows.length > 10) {
      btn = document.createElement('button');
      btn.id = 'expand-recent-btn';
      btn.style.marginTop = "10px";
      btn.textContent = "Show More";
      btn.onclick = () => {
        collapsed = !collapsed;
        btn.textContent = collapsed ? "Show More" : "Show Less";
        renderTable();
      };
      tableBody.parentElement.appendChild(btn);
    } else if (btn && rows.length <= 10) {
      btn.remove();
    } else if (btn) {
      btn.textContent = collapsed ? "Show More" : "Show Less";
    }
  }
  renderTable();
}

// ----- ARCHIVED/HISTORY TABLE -----
async function loadArchivedDeals() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) return;
  const userEmail = sessionData.session.user.email;

  const { data: offers, error } = await supabase
    .from("private_offers")
    .select("id, sponsor_username, offer_amount, created_at, live_date, deadline")
    .eq("archived", true)
    .eq("sponsee_email", userEmail)
    .order("created_at", { ascending: false });

  const archivedTableBody = document.getElementById("archived-table-body");
  if (!archivedTableBody) return;
  archivedTableBody.innerHTML = "";

  const oldBtn = document.getElementById('expand-archived-btn');
  if (oldBtn) oldBtn.remove();

  if (error) {
    archivedTableBody.innerHTML = `<tr><td colspan="8" style="color:red;">Failed to load archived deals.</td></tr>`;
    return;
  }
  if (!offers || offers.length === 0) {
    archivedTableBody.innerHTML = `<tr><td colspan="8">No archived deals yet.</td></tr>`;
    return;
  }

  // Get unique sponsor usernames for batch fetch
  const sponsorUsernames = [...new Set(offers.map(o => o.sponsor_username).filter(Boolean))];
  let sponsorPics = {};
  if (sponsorUsernames.length > 0) {
    const { data: sponsors } = await supabase
      .from('users_extended_data')
      .select('username, profile_pic')
      .in('username', sponsorUsernames);
    if (sponsors && Array.isArray(sponsors)) {
      sponsorPics = sponsors.reduce((acc, s) => {
        acc[s.username] = s.profile_pic
          ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${s.profile_pic}`
          : 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';
        return acc;
      }, {});
    }
  }

  // Get all reviews in one go for these offer ids
  const offerIds = offers.map(o => o.id);
  let reviewsByOffer = {};
  if (offerIds.length > 0) {
    const { data: reviews } = await supabase
      .from("private_offer_reviews")
      .select("offer_id, reviewer_role, overall")
      .in("offer_id", offerIds);
    if (reviews && Array.isArray(reviews)) {
      reviewsByOffer = reviews.reduce((acc, r) => {
        if (!acc[r.offer_id]) acc[r.offer_id] = {};
        acc[r.offer_id][r.reviewer_role] = r.overall;
        return acc;
      }, {});
    }
  }

  const rows = [];
  for (const offer of offers) {
    const profilePicUrl = sponsorPics[offer.sponsor_username] || 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';

    // Ratings
    let sponsorRatingDisplay = "—";
    if (reviewsByOffer[offer.id] && reviewsByOffer[offer.id]['sponsor']) {
      sponsorRatingDisplay = renderStars(Math.round(reviewsByOffer[offer.id]['sponsor']));
    }

    let sponseeRatingDisplay = "—";
    if (reviewsByOffer[offer.id] && reviewsByOffer[offer.id]['sponsee']) {
      sponseeRatingDisplay = renderStars(Math.round(reviewsByOffer[offer.id]['sponsee']));
    }

    rows.push(`
      <tr data-offer-id="${offer.id}">
        <td style="text-align: center;">
          <img src="${profilePicUrl}" onerror="this.src='/public/logos.png'" alt="Profile Pic" style="width: 40px; height: 40px; border-radius: 50%; display: block; margin: 0 auto 5px;">
          ${offer.sponsor_username}
        </td>
        <td>$${Number(offer.offer_amount).toFixed(2)}</td>
        <td>${offer.created_at ? new Date(offer.created_at).toLocaleDateString() : '—'}</td>
        <td>${offer.live_date ? new Date(offer.live_date + 'T00:00:00Z').toLocaleDateString() : '—'}</td>
        <td>${offer.deadline ? new Date(offer.deadline + 'T00:00:00Z').toLocaleDateString() : '—'}</td>
        <td>${sponsorRatingDisplay}</td>
        <td>${sponseeRatingDisplay}</td>
      </tr>
    `);
  }

  let collapsed = true;
  function renderTable() {
    archivedTableBody.innerHTML = "";
    const visibleRows = collapsed ? rows.slice(0, 10) : rows;
    visibleRows.forEach(row => archivedTableBody.innerHTML += row);
    let btn = document.getElementById('expand-archived-btn');
    if (!btn && rows.length > 10) {
      btn = document.createElement('button');
      btn.id = 'expand-archived-btn';
      btn.style.marginTop = "10px";
      btn.textContent = "Show More";
      btn.onclick = () => {
        collapsed = !collapsed;
        btn.textContent = collapsed ? "Show More" : "Show Less";
        renderTable();
      };
      archivedTableBody.parentElement.appendChild(btn);
    } else if (btn && rows.length <= 10) {
      btn.remove();
    } else if (btn) {
      btn.textContent = collapsed ? "Show More" : "Show Less";
    }
  }
  renderTable();
}

// ----- OVERALL STAR RATING (Profile) -----
async function updateOverallStars() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const sponseeEmail = session.user.email;

  // Get all offers where this user was the sponsee
  const { data: offers, error: offerError } = await supabase
    .from('private_offers')
    .select('id')
    .eq('sponsee_email', sponseeEmail);
  if (offerError || !offers || offers.length === 0) {
    const starsEl = document.getElementById('average-stars');
    if (starsEl) starsEl.innerHTML = renderStars(0);
    return;
  }
  const offerIds = offers.map(o => o.id);

  // Fetch all sponsor reviews in batch
  let allSponsorReviews = [];
  for (let i = 0; i < offerIds.length; i += 100) {
    const batchIds = offerIds.slice(i, i + 100);
    const { data: reviews, error: reviewError } = await supabase
      .from('private_offer_reviews')
      .select('overall')
      .in('offer_id', batchIds)
      .eq('reviewer_role', 'sponsor');
    if (reviewError) continue;
    allSponsorReviews = allSponsorReviews.concat(reviews);
  }
  const starsEl = document.getElementById('average-stars');
  if (!allSponsorReviews.length) {
    if (starsEl) starsEl.innerHTML = renderStars(0);
    return;
  }
  const avg = allSponsorReviews.reduce((sum, r) => sum + (r.overall || 0), 0) / allSponsorReviews.length;
  if (starsEl) starsEl.innerHTML = renderStars(Math.round(avg));
}

async function loadYouTubeStats() {
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token;
  const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-youtube-stats', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  const data = await resp.json();
  if (data.success && data.stats) {
    // Main info
    document.getElementById('yt-channel-title').innerText = data.snippet.title;
    document.getElementById('yt-channel-desc').innerText = data.snippet.description?.slice(0, 120) + '…';
    document.getElementById('yt-subs').innerText = data.stats.subscriberCount;
    document.getElementById('yt-views').innerText = data.stats.viewCount;
    document.getElementById('yt-videos').innerText = data.stats.videoCount;
    document.getElementById('yt-profile-pic').src = data.snippet.thumbnails?.default?.url || "youtubelogo.png";
    document.getElementById('yt-created').innerText = (new Date(data.snippet.publishedAt)).toLocaleDateString();

    // Banner
    if (data.branding?.image?.bannerExternalUrl) {
      document.getElementById('yt-banner').src = data.branding.image.bannerExternalUrl;
      document.getElementById('yt-banner-row').style.display = "";
    } else {
      document.getElementById('yt-banner-row').style.display = "none";
    }

    // Latest video (optional, if included in your function)
    if (data.lastVideo) {
      document.getElementById('yt-last-video-title').innerText = data.lastVideo.title;
      document.getElementById('yt-last-video-link').href = "https://youtube.com/watch?v=" + data.lastVideo.id;
      document.getElementById('yt-last-video-published').innerText = (new Date(data.lastVideo.publishedAt)).toLocaleDateString();
      document.getElementById('yt-last-video-thumb').src = data.lastVideo.thumbnail;
      document.getElementById('yt-last-video-views').innerText = data.lastVideo.views || "-";
      document.getElementById('yt-last-video-row').style.display = "";
    } else {
      document.getElementById('yt-last-video-row').style.display = "none";
    }
  } else {
    // Not connected, error, etc
    document.getElementById('yt-channel-title').innerText = "Not linked or error.";
    document.getElementById('yt-channel-desc').innerText = "";
    document.getElementById('yt-subs').innerText = "-";
    document.getElementById('yt-views').innerText = "-";
    document.getElementById('yt-videos').innerText = "-";
    document.getElementById('yt-profile-pic').src = "youtubelogo.png";
    document.getElementById('yt-created').innerText = "-";
    document.getElementById('yt-banner-row').style.display = "none";
    document.getElementById('yt-last-video-row').style.display = "none";
  }
}

// ----- DOMContentLoaded EVENTS -----
document.addEventListener("DOMContentLoaded", async () => {
  updateSummaryStats();
  loadRecentActivity();
  loadArchivedDeals();
  updateOverallStars();
  updateCategoryStars('communication', 'communication-stars');
  updateCategoryStars('punctuality', 'punctuality-stars');
  updateCategoryStars('work_output', 'work-output-stars');

  // -- Only show/fetch YouTube stats if user is connected! --
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  // Fetch youtube_connected for this user
  let youtubeConnected = false;
  try {
    const { data: userData } = await supabase
      .from('users_extended_data')
      .select('youtube_connected')
      .eq('user_id', userId)
      .single();
    youtubeConnected = !!userData?.youtube_connected;
  } catch {
    youtubeConnected = false;
  }

  // Only show/fetch if connected
  const ytBlock = document.getElementById('youtube-stats-block');
  if (ytBlock) {
    if (youtubeConnected) {
      ytBlock.style.display = 'block';
      loadYouTubeStats();
    } else {
      ytBlock.style.display = 'none';
    }
  }
});

