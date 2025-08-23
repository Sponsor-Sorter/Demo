// public/js/sponseeLogic.js
import { supabase } from './supabaseClient.js';

/* =========================
   Helpers
========================= */
// ----- RENDER GOLD STARS -----
function renderStars(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += `<span class="star${i <= rating ? ' gold-star' : ''}">${i <= rating ? '★' : '☆'}</span>`;
  }
  return out;
}

// Format seconds as H:MM:SS or M:SS
function fmtDuration(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return null;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* =========================
   Category Stars
========================= */
async function updateCategoryStars(category, elementId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const sponseeEmail = session.user.email;

  // Get all offer ids
  const { data: offers } = await supabase
    .from('private_offers')
    .select('id')
    .eq('sponsee_email', sponseeEmail);

  const starsEl = document.getElementById(elementId);

  if (!offers || offers.length === 0) {
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

  if (!allCategoryRatings.length) {
    if (starsEl) starsEl.innerHTML = renderStars(0);
    return;
  }
  const avg = allCategoryRatings.reduce((sum, r) => sum + (r[category] || 0), 0) / allCategoryRatings.length;
  if (starsEl) starsEl.innerHTML = renderStars(Math.round(avg));
}

/* =========================
   Summary Stat Cards
========================= */
async function updateSummaryStats() {
  // Set "loading..." state
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

  // Lifetime success ratio
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

/* =========================
   Recent Activity
========================= */
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

  // Batch fetch sponsor pics
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

  const rows = [];
  for (const offer of offers) {
    if (offer.status === 'review_completed') continue;
    const sponsorPicUrl = sponsorPics[offer.sponsor_username] || 'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';

    rows.push(`
      <tr>
        <td style="text-align: center;">
          <img src="${sponsorPicUrl}" onerror="this.src='./logos.png'" alt="Sponsor Pic" style="width: 36px; height: 36px; border-radius: 50%; display: block; margin: 0 auto 5px;">
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
    visibleRows.forEach(row => (tableBody.innerHTML += row));
    let btn = document.getElementById('expand-recent-btn');
    if (!btn && rows.length > 10) {
      btn = document.createElement('button');
      btn.id = 'expand-recent-btn';
      btn.style.marginTop = '10px';
      btn.textContent = 'Show More';
      btn.onclick = () => {
        collapsed = !collapsed;
        btn.textContent = collapsed ? 'Show More' : 'Show Less';
        renderTable();
      };
      tableBody.parentElement.appendChild(btn);
    } else if (btn && rows.length <= 10) {
      btn.remove();
    } else if (btn) {
      btn.textContent = collapsed ? 'Show More' : 'Show Less';
    }
  }
  renderTable();
}

/* =========================
   Archived / History
========================= */
async function loadArchivedDeals() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) return;
  const userEmail = sessionData.session.user.email;

  const { data: offers, error } = await supabase
    .from('private_offers')
    .select('id, sponsor_username, offer_amount, created_at, live_date, deadline')
    .eq('archived', true)
    .eq('sponsee_email', userEmail)
    .order('created_at', { ascending: false });

  const archivedTableBody = document.getElementById('archived-table-body');
  if (!archivedTableBody) return;
  archivedTableBody.innerHTML = '';

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

  // Batch sponsor pics
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

  // Batch reviews
  const offerIds = offers.map(o => o.id);
  let reviewsByOffer = {};
  if (offerIds.length > 0) {
    const { data: reviews } = await supabase
      .from('private_offer_reviews')
      .select('offer_id, reviewer_role, overall')
      .in('offer_id', offerIds);
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
    const profilePicUrl =
      sponsorPics[offer.sponsor_username] ||
      'https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png';

    // Ratings
    let sponsorRatingDisplay = '—';
    if (reviewsByOffer[offer.id] && reviewsByOffer[offer.id]['sponsor']) {
      sponsorRatingDisplay = renderStars(Math.round(reviewsByOffer[offer.id]['sponsor']));
    }

    let sponseeRatingDisplay = '—';
    if (reviewsByOffer[offer.id] && reviewsByOffer[offer.id]['sponsee']) {
      sponseeRatingDisplay = renderStars(Math.round(reviewsByOffer[offer.id]['sponsee']));
    }

    rows.push(`
      <tr data-offer-id="${offer.id}">
        <td style="text-align: center;">
          <img src="${profilePicUrl}" onerror="this.src='./logos.png'" alt="Profile Pic" style="width: 40px; height: 40px; border-radius: 50%; display: block; margin: 0 auto 5px;">
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
    archivedTableBody.innerHTML = '';
    const visibleRows = collapsed ? rows.slice(0, 10) : rows;
    visibleRows.forEach(row => (archivedTableBody.innerHTML += row));
    let btn = document.getElementById('expand-archived-btn');
    if (!btn && rows.length > 10) {
      btn = document.createElement('button');
      btn.id = 'expand-archived-btn';
      btn.style.marginTop = '10px';
      btn.textContent = 'Show More';
      btn.onclick = () => {
        collapsed = !collapsed;
        btn.textContent = collapsed ? 'Show More' : 'Show Less';
        renderTable();
      };
      archivedTableBody.parentElement.appendChild(btn);
    } else if (btn && rows.length <= 10) {
      btn.remove();
    } else if (btn) {
      btn.textContent = collapsed ? 'Show More' : 'Show Less';
    }
  }
  renderTable();
}

/* =========================
   Overall Stars (Profile)
========================= */
async function updateOverallStars() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const sponseeEmail = session.user.email;

  const { data: offers, error: offerError } = await supabase
    .from('private_offers')
    .select('id')
    .eq('sponsee_email', sponseeEmail);

  const starsEl = document.getElementById('average-stars');

  if (offerError || !offers || offers.length === 0) {
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

  if (!allSponsorReviews.length) {
    if (starsEl) starsEl.innerHTML = renderStars(0);
    return;
  }
  const avg = allSponsorReviews.reduce((sum, r) => sum + (r.overall || 0), 0) / allSponsorReviews.length;
  if (starsEl) starsEl.innerHTML = renderStars(Math.round(avg));
}

/* =========================
   YouTube Stats
========================= */
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
    document.getElementById('yt-channel-desc').innerText = (data.snippet.description || '').slice(0, 120) + (data.snippet.description?.length > 120 ? '…' : '');
    document.getElementById('yt-subs').innerText = data.stats.subscriberCount;
    document.getElementById('yt-views').innerText = data.stats.viewCount;
    document.getElementById('yt-videos').innerText = data.stats.videoCount;
    document.getElementById('yt-profile-pic').src = data.snippet.thumbnails?.default?.url || 'youtubelogo.png';
    document.getElementById('yt-created').innerText = (new Date(data.snippet.publishedAt)).toLocaleDateString();

    // Banner
    if (data.branding?.image?.bannerExternalUrl) {
      document.getElementById('yt-banner').src = data.branding.image.bannerExternalUrl;
      document.getElementById('yt-banner-row').style.display = '';
    } else {
      document.getElementById('yt-banner-row').style.display = 'none';
    }

    // Latest video (optional)
    if (data.lastVideo) {
      document.getElementById('yt-last-video-title').innerText = data.lastVideo.title;
      document.getElementById('yt-last-video-link').href = 'https://youtube.com/watch?v=' + data.lastVideo.id;
      document.getElementById('yt-last-video-published').innerText = (new Date(data.lastVideo.publishedAt)).toLocaleDateString();
      document.getElementById('yt-last-video-thumb').src = data.lastVideo.thumbnail;
      document.getElementById('yt-last-video-views').innerText = data.lastVideo.views || '-';
      document.getElementById('yt-last-video-row').style.display = '';
    } else {
      document.getElementById('yt-last-video-row').style.display = 'none';
    }
  } else {
    // Not connected / error
    document.getElementById('yt-channel-title').innerText = 'Not linked or error.';
    document.getElementById('yt-channel-desc').innerText = '';
    document.getElementById('yt-subs').innerText = '-';
    document.getElementById('yt-views').innerText = '-';
    document.getElementById('yt-videos').innerText = '-';
    document.getElementById('yt-profile-pic').src = 'youtubelogo.png';
    document.getElementById('yt-created').innerText = '-';
    document.getElementById('yt-banner-row').style.display = 'none';
    document.getElementById('yt-last-video-row').style.display = 'none';
  }
}

/* =========================
   Twitch Stats
========================= */
// Normalize Twitch thumbnail URL tokens to a concrete size (also works for VODs)
function normalizeTwitchThumb(u) {
  if (!u) return null;
  return u.replace('%{width}x%{height}', '320x180').replace('{width}x{height}', '320x180');
}

// Set thumbnail safely: no-referrer + graceful fallback
function setTwitchThumb(imgEl, url, fallbackUrl) {
  const finalUrl = normalizeTwitchThumb(url) || fallbackUrl || 'twitchlogo.png';
  imgEl.setAttribute('referrerpolicy', 'no-referrer');
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = fallbackUrl || 'twitchlogo.png';
  };
  imgEl.src = finalUrl;
}

async function loadTwitchStats() {
  const twEls = {
    block: document.getElementById('twitch-stats-block'),
    name: document.getElementById('tw-display-name'),
    login: document.getElementById('tw-login'),
    bio: document.getElementById('tw-bio'),
    followers: document.getElementById('tw-followers'),
    created: document.getElementById('tw-created'),
    createdWrap: document.getElementById('tw-created-wrap'),
    live: document.getElementById('tw-live-status'),
    viewersWrap: document.getElementById('tw-viewers-wrap'),
    viewers: document.getElementById('tw-viewers'),
    streamRow: document.getElementById('tw-last-stream-row'),
    streamTitle: document.getElementById('tw-stream-title'),
    streamStarted: document.getElementById('tw-stream-started'),
    streamThumb: document.getElementById('tw-stream-thumb'),
    gameName: document.getElementById('tw-game-name'),
    pic: document.getElementById('tw-profile-pic'),
    // Optional offline VOD stats (only shown if these elements exist in HTML)
    vodViewsWrap: document.getElementById('tw-vod-views-wrap'),
    vodViews: document.getElementById('tw-vod-views'),
    durationWrap: document.getElementById('tw-duration-wrap'),
    duration: document.getElementById('tw-vod-duration'),
  };
  if (!twEls.block) return;

  // Loading state
  twEls.name.textContent = 'Loading…';
  twEls.login.textContent = '(@login)';
  twEls.bio.textContent = '';
  twEls.followers.textContent = '-';
  twEls.created.textContent = '-';
  twEls.live.textContent = '-';
  if (twEls.viewersWrap) twEls.viewersWrap.style.display = 'none';
  twEls.streamRow.style.display = 'none';
  twEls.pic.src = 'twitchlogo.png';
  if (twEls.vodViewsWrap) twEls.vodViewsWrap.style.display = 'none';
  if (twEls.durationWrap) twEls.durationWrap.style.display = 'none';

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-twitch-stats', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    const data = await resp.json();
    if (!resp.ok || !data?.success) throw new Error(data?.error || 'Failed');

    // Accept both shapes: {channel, stats} (older) or {user, stream, followers, last_broadcast} (current)
    const chan = data.channel || data.user || {};
    const followers = (data.stats && data.stats.followers != null)
      ? data.stats.followers
      : (data.followers != null ? data.followers : null);

    const statusStr = (data.stats?.status || data.status || '').toString().toLowerCase();
    let stream = data.stream || {};
    const last = data.last_broadcast || data.lastVod || null;
    const isLive = stream.is_live === true || statusStr === 'live';

    // When offline, prefer last_broadcast details if provided
    if (!isLive && last) {
      stream = {
        title: last.title || stream.title,
        started_at: last.started_at || stream.started_at,
        game_name: last.game_name || stream.game_name,
        thumbnail_url: last.thumbnail_url || stream.thumbnail_url,
        vod_views: last.view_count ?? stream.vod_views,
        duration_seconds: last.duration_seconds ?? stream.duration_seconds,
        duration_text: last.duration_text ?? stream.duration_text
      };
    }

    // Main info
    twEls.name.textContent = chan.display_name || chan.displayName || chan.login || 'Unknown';
    twEls.login.textContent = chan.login ? `(@${chan.login})` : '';
    const desc = chan.description || '';
    twEls.bio.textContent = desc.slice(0, 140) + (desc.length > 140 ? '…' : '');
    if (chan.profile_image_url || chan.profileImageUrl) {
      twEls.pic.src = chan.profile_image_url || chan.profileImageUrl;
    }

    if (followers != null) {
      twEls.followers.textContent = Number(followers).toLocaleString();
    }

    if (chan.created_at || chan.createdAt) {
      twEls.created.textContent = new Date(chan.created_at || chan.createdAt).toLocaleDateString();
      twEls.createdWrap.style.display = '';
    } else {
      twEls.createdWrap.style.display = 'none';
    }

    // Stream info
    twEls.live.textContent = isLive ? 'LIVE' : 'Offline';
    twEls.live.style.color = isLive ? '#32e232' : '#ffd';

    if (isLive) {
      // live viewer count
      if (typeof stream.viewer_count === 'number') {
        twEls.viewers.textContent = stream.viewer_count.toLocaleString();
        if (twEls.viewersWrap) twEls.viewersWrap.style.display = '';
      } else if (twEls.viewersWrap) {
        twEls.viewersWrap.style.display = 'none';
      }

      twEls.streamTitle.textContent = stream.title || 'Untitled stream';
      twEls.streamStarted.textContent = stream.started_at
        ? new Date(stream.started_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
        : '';
      twEls.gameName.textContent = stream.game_name || '-';
      setTwitchThumb(twEls.streamThumb, stream.thumbnail_url, chan.profile_image_url || 'twitchlogo.png');
      twEls.streamRow.style.display = '';

      // hide offline-only fields
      if (twEls.vodViewsWrap) twEls.vodViewsWrap.style.display = 'none';
      if (twEls.durationWrap) twEls.durationWrap.style.display = 'none';
    } else if (stream.title || stream.thumbnail_url) {
      // Offline / last broadcast shown
      twEls.streamTitle.textContent = stream.title || 'Last stream';
      twEls.streamStarted.textContent = stream.started_at ? new Date(stream.started_at).toLocaleDateString() : '';
      twEls.gameName.textContent = stream.game_name || '-';
      setTwitchThumb(twEls.streamThumb, stream.thumbnail_url, chan.profile_image_url || 'twitchlogo.png');
      twEls.streamRow.style.display = '';
      if (twEls.viewersWrap) twEls.viewersWrap.style.display = 'none';

      // Show VOD views (if provided)
      const vodViewsVal = (typeof stream.vod_views === 'number')
        ? stream.vod_views
        : (typeof stream.viewer_count === 'number' ? stream.viewer_count : null); // fallback for older shape
      if (twEls.vodViewsWrap) {
        if (vodViewsVal != null) {
          twEls.vodViews.textContent = Number(vodViewsVal).toLocaleString();
          twEls.vodViewsWrap.style.display = '';
        } else {
          twEls.vodViewsWrap.style.display = 'none';
        }
      }

      // Show duration if present
      if (twEls.durationWrap) {
        const durTxt = stream.duration_text || fmtDuration(stream.duration_seconds);
        if (durTxt) {
          twEls.duration.textContent = durTxt;
          twEls.durationWrap.style.display = '';
        } else {
          twEls.durationWrap.style.display = 'none';
        }
      }
    } else {
      twEls.streamRow.style.display = 'none';
      if (twEls.viewersWrap) twEls.viewersWrap.style.display = 'none';
      if (twEls.vodViewsWrap) twEls.vodViewsWrap.style.display = 'none';
      if (twEls.durationWrap) twEls.durationWrap.style.display = 'none';
    }
  } catch {
    // Error state
    twEls.name.textContent = 'Not linked or error.';
    twEls.login.textContent = '';
    twEls.bio.textContent = '';
    twEls.followers.textContent = '-';
    twEls.created.textContent = '-';
    twEls.live.textContent = '-';
    if (twEls.viewersWrap) twEls.viewersWrap.style.display = 'none';
    twEls.streamRow.style.display = 'none';
    if (twEls.vodViewsWrap) twEls.vodViewsWrap.style.display = 'none';
    if (twEls.durationWrap) twEls.durationWrap.style.display = 'none';
    twEls.pic.src = 'twitchlogo.png';
  }
}

/* =========================
   DOMContentLoaded
========================= */
document.addEventListener('DOMContentLoaded', async () => {
  updateSummaryStats();
  loadRecentActivity();
  loadArchivedDeals();
  updateOverallStars();
  updateCategoryStars('communication', 'communication-stars');
  updateCategoryStars('punctuality', 'punctuality-stars');
  updateCategoryStars('work_output', 'work-output-stars');

  // Only show/fetch platform stats if user is connected
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  let youtubeConnected = false;
  let twitchConnected = false;
  try {
    const { data: userData } = await supabase
      .from('users_extended_data')
      .select('youtube_connected, twitch_connected')
      .eq('user_id', userId)
      .single();
    youtubeConnected = !!userData?.youtube_connected;
    twitchConnected = !!userData?.twitch_connected;
  } catch {
    youtubeConnected = false;
    twitchConnected = false;
  }

  // YouTube
  const ytBlock = document.getElementById('youtube-stats-block');
  if (ytBlock) {
    if (youtubeConnected) {
      ytBlock.style.display = 'block';
      loadYouTubeStats();
    } else {
      ytBlock.style.display = 'none';
    }
  }

  // Twitch
  const twBlock = document.getElementById('twitch-stats-block');
  if (twBlock) {
    if (twitchConnected) {
      twBlock.style.display = 'block';
      loadTwitchStats();
    } else {
      twBlock.style.display = 'none';
    }
  }
});
