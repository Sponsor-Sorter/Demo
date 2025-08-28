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
window.renderStars = renderStars; // expose for any inline/global use

// Format seconds as H:MM:SS or M:SS
function fmtDuration(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return null;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Format numbers with commas (or dash)
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return '-';
  return Number(n).toLocaleString();
}

// Small helper so one failing call doesn’t break the rest of the dashboard
function safeCall(fn) {
  try { if (typeof fn === 'function') return fn(); }
  catch (e) { console.error(e); }
  return undefined;
}

/* =========================
   Category Stars
========================= */
async function updateCategoryStars(category, elementId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const sponseeEmail = session.user.email;

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

  const active = offers.filter(o => ['accepted', 'pending', 'in_progress', 'live'].includes(o.status));
  document.getElementById('active-sponsorships').textContent = active.length ?? 0;

  const completed = offers.filter(o => ['completed', 'review_completed'].includes(o.status));
  document.getElementById('completed-deals').textContent = completed.length ?? 0;

  const validIncome = offers.filter(o => !['rejected', 'Offer Cancelled'].includes(o.status));
  const totalEarnings = validIncome.reduce((sum, o) => sum + (o.offer_amount || 0), 0);
  document.getElementById('total-earnings').textContent = `$${totalEarnings.toFixed(2)}`;

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
window.updateOverallStars = updateOverallStars; // expose just in case something else calls it

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
    document.getElementById('yt-channel-title').innerText = data.snippet.title;
    document.getElementById('yt-channel-desc').innerText =
      (data.snippet.description || '').slice(0, 120) + (data.snippet.description?.length > 120 ? '…' : '');
    document.getElementById('yt-subs').innerText = data.stats.subscriberCount;
    document.getElementById('yt-views').innerText = data.stats.viewCount;
    document.getElementById('yt-videos').innerText = data.stats.videoCount;
    document.getElementById('yt-profile-pic').src = data.snippet.thumbnails?.default?.url || 'youtubelogo.png';
    document.getElementById('yt-created').innerText = (new Date(data.snippet.publishedAt)).toLocaleDateString();

    if (data.branding?.image?.bannerExternalUrl) {
      document.getElementById('yt-banner').src = data.branding.image.bannerExternalUrl;
      document.getElementById('yt-banner-row').style.display = '';
    } else {
      document.getElementById('yt-banner-row').style.display = 'none';
    }

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
function normalizeTwitchThumb(u) {
  if (!u) return null;
  return u.replace('%{width}x%{height}', '320x180').replace('{width}x{height}', '320x180');
}
function setTwitchThumb(imgEl, url, fallbackUrl) {
  const finalUrl = normalizeTwitchThumb(url) || fallbackUrl || 'twitchlogo.png';
  imgEl.setAttribute('referrerpolicy', 'no-referrer');
  imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fallbackUrl || 'twitchlogo.png'; };
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
    vodViewsWrap: document.getElementById('tw-vod-views-wrap'),
    vodViews: document.getElementById('tw-vod-views'),
    durationWrap: document.getElementById('tw-duration-wrap'),
    duration: document.getElementById('tw-vod-duration'),
  };
  if (!twEls.block) return;

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

    const chan = data.channel || data.user || {};
    const followers = (data.stats && data.stats.followers != null)
      ? data.stats.followers
      : (data.followers != null ? data.followers : null);

    const statusStr = (data.stats?.status || data.status || '').toString().toLowerCase();
    let stream = data.stream || {};
    const last = data.last_broadcast || data.lastVod || null;
    const isLive = stream.is_live === true || statusStr === 'live';

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

    twEls.name.textContent = chan.display_name || chan.displayName || chan.login || 'Unknown';
    twEls.login.textContent = chan.login ? `(@${chan.login})` : '';
    const desc = chan.description || '';
    twEls.bio.textContent = desc.slice(0, 140) + (desc.length > 140 ? '…' : '');
    if (chan.profile_image_url || chan.profileImageUrl) {
      twEls.pic.src = chan.profile_image_url || chan.profileImageUrl;
    }

    if (followers != null) twEls.followers.textContent = Number(followers).toLocaleString();

    if (chan.created_at || chan.createdAt) {
      twEls.created.textContent = new Date(chan.created_at || chan.createdAt).toLocaleDateString();
      twEls.createdWrap.style.display = '';
    } else {
      twEls.createdWrap.style.display = 'none';
    }

    twEls.live.textContent = isLive ? 'LIVE' : 'Offline';
    twEls.live.style.color = isLive ? '#32e232' : '#ffd';

    if (isLive) {
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

      if (twEls.vodViewsWrap) twEls.vodViewsWrap.style.display = 'none';
      if (twEls.durationWrap) twEls.durationWrap.style.display = 'none';
    } else if (stream.title || stream.thumbnail_url) {
      twEls.streamTitle.textContent = stream.title || 'Last stream';
      twEls.streamStarted.textContent = stream.started_at ? new Date(stream.started_at).toLocaleDateString() : '';
      twEls.gameName.textContent = stream.game_name || '-';
      setTwitchThumb(twEls.streamThumb, stream.thumbnail_url, chan.profile_image_url || 'twitchlogo.png');
      twEls.streamRow.style.display = '';
      if (twEls.viewersWrap) twEls.viewersWrap.style.display = 'none';

      const vodViewsVal = (typeof stream.vod_views === 'number')
        ? stream.vod_views
        : (typeof stream.viewer_count === 'number' ? stream.viewer_count : null);
      if (twEls.vodViewsWrap) {
        if (vodViewsVal != null) {
          twEls.vodViews.textContent = Number(vodViewsVal).toLocaleString();
          twEls.vodViewsWrap.style.display = '';
        } else {
          twEls.vodViewsWrap.style.display = 'none';
        }
      }

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
   Instagram Stats
========================= */
function setIGThumb(imgEl, url, fallbackUrl = 'instagramlogo.png') {
  if (!imgEl) return;
  imgEl.setAttribute('referrerpolicy', 'no-referrer');
  imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fallbackUrl; };
  imgEl.src = url || fallbackUrl;
}

async function loadInstagramStats() {
  const igEls = {
    block: document.getElementById('instagram-stats-block'),
    pic: document.getElementById('ig-profile-pic'),
    username: document.getElementById('ig-username'),
    accountType: document.getElementById('ig-account-type'),
    bio: document.getElementById('ig-bio'),
    followers: document.getElementById('ig-followers'),
    following: document.getElementById('ig-following'),
    posts: document.getElementById('ig-posts'),
    engRate: document.getElementById('ig-eng-rate'),
    updatedWrap: document.getElementById('ig-updated-wrap'),
    updated: document.getElementById('ig-updated'),
    impressions7d: document.getElementById('ig-impressions-7d'),
    reach7d: document.getElementById('ig-reach-7d'),
    profileViews7d: document.getElementById('ig-profile-views-7d'),

    // Latest post section
    lastRow: document.getElementById('ig-last-media-row'),
    lastLink: document.getElementById('ig-last-media-link'),
    lastCaption: document.getElementById('ig-last-media-caption'),
    lastPublished: document.getElementById('ig-last-media-published'),
    lastThumb: document.getElementById('ig-last-media-thumb'),
    lastLikes: document.getElementById('ig-last-media-likes'),
    lastComments: document.getElementById('ig-last-media-comments'),
    lastViewsWrap: document.getElementById('ig-last-media-views-wrap'),
    lastViews: document.getElementById('ig-last-media-views'),
    lastInsightsRow: document.getElementById('ig-last-post-insights'),
    lastImpr: document.getElementById('ig-last-impr'),
    lastReach: document.getElementById('ig-last-reach'),
    lastSaved: document.getElementById('ig-last-saved'),
    lastViews2Wrap: document.getElementById('ig-last-views-wrap'),
    lastViews2: document.getElementById('ig-last-views'),

    // Top post section (support both current + richer future markup)
    topRow: document.getElementById('ig-top-post-row') || document.getElementById('ig-top-media-row'),
    topLink: document.getElementById('ig-top-post-link') || document.getElementById('ig-top-media-link'),
    topCaption: document.getElementById('ig-top-post-caption') || document.getElementById('ig-top-media-caption'),
    topEngagement: document.getElementById('ig-top-post-engagement') || document.getElementById('ig-top-media-eng'),
    topThumb: document.getElementById('ig-top-post-thumb') || document.getElementById('ig-top-media-thumb'),
    // optional like/comment/views fields if present in HTML
    topLikes: document.getElementById('ig-top-media-likes') || document.getElementById('ig-top-post-likes'),
    topComments: document.getElementById('ig-top-media-comments') || document.getElementById('ig-top-post-comments'),
    topViewsWrap: document.getElementById('ig-top-media-views-wrap') || document.getElementById('ig-top-post-views-wrap'),
    topViews: document.getElementById('ig-top-media-views') || document.getElementById('ig-top-post-views'),
  };
  if (!igEls.block) return;

  // Loading/default state
  igEls.username.textContent = 'Loading…';
  igEls.accountType.style.display = 'none';
  igEls.bio.style.display = 'none';
  igEls.followers.textContent = '-';
  igEls.following.textContent = '-';
  igEls.posts.textContent = '-';
  if (igEls.engRate) igEls.engRate.textContent = '-';
  igEls.updated.textContent = '-';
  igEls.impressions7d.textContent = '-';
  igEls.reach7d.textContent = '-';
  igEls.profileViews7d.textContent = '-';
  if (igEls.lastRow) igEls.lastRow.style.display = 'none';
  if (igEls.topRow) igEls.topRow.style.display = 'none';
  if (igEls.lastInsightsRow) igEls.lastInsightsRow.style.display = 'none';
  igEls.pic.src = 'instagramlogo.png';

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-instagram-stats', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_days: 7 })
    });
    const payload = await resp.json();
    if (!resp.ok || !payload?.ok) throw new Error(payload?.error || 'Failed');

    const profile = payload.profile || {};
    const recent = Array.isArray(payload.recent_media) ? payload.recent_media : [];
    const rollups = payload.rollups || {};
    const fetchedAt = payload.fetched_at || Date.now();

    // Profile
    igEls.username.textContent = profile.username || 'Unknown';
    if (profile.account_type) {
      igEls.accountType.textContent = `(${profile.account_type})`;
      igEls.accountType.style.display = '';
    }
    const bio = profile.biography || profile.bio || '';
    if (bio) {
      igEls.bio.textContent = bio.length > 140 ? bio.slice(0, 140) + '…' : bio;
      igEls.bio.style.display = '';
    }
    if (profile.profile_picture_url) {
      setIGThumb(igEls.pic, profile.profile_picture_url, 'instagramlogo.png');
    }

    igEls.followers.textContent = fmtNum(profile.followers_count);
    igEls.following.textContent = fmtNum(profile.follows_count);
    igEls.posts.textContent = fmtNum(profile.media_count);
    if (igEls.engRate) {
      const er = rollups.last_12_avg_engagement_rate;
      igEls.engRate.textContent = (er || er === 0) ? `${(er * 100).toFixed(2)}%` : '-';
    }

    if (fetchedAt) {
      igEls.updated.textContent = new Date(fetchedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      igEls.updatedWrap.style.display = '';
    } else {
      igEls.updatedWrap.style.display = 'none';
    }

    // Account insights (7d)
    if (payload.insights_7d || payload.insights) {
      const ins = payload.insights_7d || payload.insights;
      igEls.impressions7d.textContent = fmtNum(ins.impressions);
      igEls.reach7d.textContent = fmtNum(ins.reach);
      igEls.profileViews7d.textContent = fmtNum(ins.profile_views);
    }

    // Latest post
    if (recent.length > 0 && igEls.lastRow) {
      recent.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      const last = recent[0];

      igEls.lastCaption.textContent = last.caption || 'Latest post';
      igEls.lastLink.href = last.permalink || '#';
      igEls.lastPublished.textContent = last.timestamp ? new Date(last.timestamp).toLocaleDateString() : '';
      setIGThumb(igEls.lastThumb, last.media_url || last.thumbnail_url || null, 'instagramlogo.png');

      igEls.lastLikes.textContent = fmtNum(last.like_count);
      igEls.lastComments.textContent = fmtNum(last.comments_count);

      if (igEls.lastViewsWrap) {
        if (last.video_views != null) {
          igEls.lastViews.textContent = fmtNum(last.video_views);
          igEls.lastViewsWrap.style.display = '';
        } else {
          igEls.lastViewsWrap.style.display = 'none';
        }
      }

      if (payload.last_media_insights) {
        const li = payload.last_media_insights;
        if (igEls.lastInsightsRow) {
          if (igEls.lastImpr) igEls.lastImpr.textContent = fmtNum(li.impressions);
          if (igEls.lastReach) igEls.lastReach.textContent = fmtNum(li.reach);
          if (igEls.lastSaved) igEls.lastSaved.textContent = fmtNum(li.saved);
          if (igEls.lastViews2Wrap) {
            if (li.video_views != null) {
              igEls.lastViews2.textContent = fmtNum(li.video_views);
              igEls.lastViews2Wrap.style.display = '';
            } else {
              igEls.lastViews2Wrap.style.display = 'none';
            }
          }
          igEls.lastInsightsRow.style.display = '';
        }
      } else if (igEls.lastInsightsRow) {
        igEls.lastInsightsRow.style.display = 'none';
      }

      igEls.lastRow.style.display = '';
    } else if (igEls.lastRow) {
      igEls.lastRow.style.display = 'none';
    }

    // Top recent post (by likes+comments)
    if (recent.length > 0 && igEls.topRow) {
      const topFromServer =
        payload.top_recent_media || payload.top_recent_post || payload.topPost || null;

      let top = topFromServer;
      if (!top) {
        let best = null;
        let bestScore = -1;
        for (const m of recent) {
          const score = (Number(m.like_count) || 0) + (Number(m.comments_count) || 0);
          if (score > bestScore) { best = m; bestScore = score; }
        }
        top = best;
      }

      if (top) {
        // main fields
        if (igEls.topCaption) igEls.topCaption.textContent = top.caption || 'Top post';
        if (igEls.topLink) igEls.topLink.href = top.permalink || '#';
        if (igEls.topThumb) setIGThumb(igEls.topThumb, top.media_url || top.thumbnail_url || null, 'instagramlogo.png');

        const eng = (Number(top.like_count) || 0) + (Number(top.comments_count) || 0);
        if (igEls.topEngagement) igEls.topEngagement.textContent = ` ${fmtNum(eng)}`;

        // optional like/comment/views fields if they exist in HTML
        if (igEls.topLikes) igEls.topLikes.textContent = fmtNum(top.like_count);
        if (igEls.topComments) igEls.topComments.textContent = fmtNum(top.comments_count);
        if (igEls.topViewsWrap) {
          if (top.video_views != null) {
            if (igEls.topViews) igEls.topViews.textContent = fmtNum(top.video_views);
            igEls.topViewsWrap.style.display = '';
          } else {
            igEls.topViewsWrap.style.display = 'none';
          }
        }

        igEls.topRow.style.display = '';
      } else {
        igEls.topRow.style.display = 'none';
      }
    }
  } catch {
    igEls.username.textContent = 'Not linked or error.';
    igEls.accountType.style.display = 'none';
    igEls.bio.style.display = 'none';
    igEls.followers.textContent = '-';
    igEls.following.textContent = '-';
    igEls.posts.textContent = '-';
    if (igEls.engRate) igEls.engRate.textContent = '-';
    igEls.updated.textContent = '-';
    igEls.impressions7d.textContent = '-';
    igEls.reach7d.textContent = '-';
    igEls.profileViews7d.textContent = '-';
    if (igEls.lastRow) igEls.lastRow.style.display = 'none';
    if (igEls.topRow) igEls.topRow.style.display = 'none';
    if (igEls.lastInsightsRow) igEls.lastInsightsRow.style.display = 'none';
    igEls.pic.src = 'instagramlogo.png';
  }
}

/* =========================
   Facebook (Pages) Stats
========================= */
function setFBThumb(imgEl, url, fallbackUrl = 'facebooklogo.png') {
  if (!imgEl) return;
  imgEl.setAttribute('referrerpolicy', 'no-referrer');
  imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fallbackUrl; };
  imgEl.src = url || fallbackUrl;
}

async function loadFacebookStats() {
  const fbEls = {
    block: document.getElementById('facebook-stats-block'),
    name: document.getElementById('fb-page-name'),
    category: document.getElementById('fb-page-category'),
    about: document.getElementById('fb-about'),
    pic: document.getElementById('fb-profile-pic'),
    followers: document.getElementById('fb-followers'),
    likes: document.getElementById('fb-likes'),
    reach28: document.getElementById('fb-reach-28d'),
    impressions28: document.getElementById('fb-impressions-28d'),
    engaged28: document.getElementById('fb-engaged-28d'),
    updatedWrap: document.getElementById('fb-updated-wrap'),
    updated: document.getElementById('fb-updated'),

    lastRow: document.getElementById('fb-last-post-row'),
    lastMsg: document.getElementById('fb-last-post-message'),
    lastWhen: document.getElementById('fb-last-post-created'),
    lastLink: document.getElementById('fb-last-post-link'),
    lastThumb: document.getElementById('fb-last-post-thumb')
  };
  if (!fbEls.block) return; // no card in DOM -> nothing to do

  // Loading/default
  if (fbEls.name) fbEls.name.textContent = 'Loading…';
  if (fbEls.category) fbEls.category.style.display = 'none';
  if (fbEls.about) fbEls.about.style.display = 'none';
  if (fbEls.followers) fbEls.followers.textContent = '-';
  if (fbEls.likes) fbEls.likes.textContent = '-';
  if (fbEls.reach28) fbEls.reach28.textContent = '-';
  if (fbEls.impressions28) fbEls.impressions28.textContent = '-';
  if (fbEls.engaged28) fbEls.engaged28.textContent = '-';
  if (fbEls.updated) fbEls.updated.textContent = '-';
  if (fbEls.lastRow) fbEls.lastRow.style.display = 'none';
  if (fbEls.pic) fbEls.pic.src = 'facebooklogo.png';

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/get-facebook-page-insights', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      // body optional; you can pass { period_days: 28 } if your function supports it
      body: JSON.stringify({ period_days: 28 })
    });
    const payload = await resp.json();

    if (!resp.ok || (!payload?.ok && !payload?.success)) throw new Error(payload?.error || 'Failed');

    // Page object
    const page = payload.page || payload.page_info || payload.fb_page || {};
    if (fbEls.name) fbEls.name.textContent = page.name || page.page_name || 'Facebook Page';
    if (fbEls.category && (page.category || page.category_list?.[0]?.name)) {
      fbEls.category.textContent = `(${page.category || page.category_list?.[0]?.name})`;
      fbEls.category.style.display = '';
    }
    const picUrl = page.picture_url || page.picture?.data?.url || null;
    if (fbEls.pic) setFBThumb(fbEls.pic, picUrl, 'facebooklogo.png');

    if (fbEls.about && (page.about || page.description)) {
      const txt = (page.about || page.description || '').toString();
      fbEls.about.textContent = txt.length > 140 ? txt.slice(0, 140) + '…' : txt;
      fbEls.about.style.display = '';
    }

    const followers = page.followers_count ?? page.fan_count ?? page.likes ?? null;
    const likes = page.fan_count ?? page.likes ?? null;
    if (fbEls.followers && followers != null) fbEls.followers.textContent = fmtNum(followers);
    if (fbEls.likes && likes != null) fbEls.likes.textContent = fmtNum(likes);

    // Insights (28d rollup)
    const ins = payload.insights_28d || payload.insights || payload.page_insights || {};
    if (fbEls.reach28 && ins.reach != null) fbEls.reach28.textContent = fmtNum(ins.reach);
    if (fbEls.impressions28 && ins.impressions != null) fbEls.impressions28.textContent = fmtNum(ins.impressions);
    if (fbEls.engaged28 && (ins.page_engaged_users != null || ins.engaged != null)) {
      fbEls.engaged28.textContent = fmtNum(ins.page_engaged_users ?? ins.engaged);
    }

    const fetchedAt = payload.fetched_at || Date.now();
    if (fbEls.updated && fbEls.updatedWrap) {
      fbEls.updated.textContent = new Date(fetchedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      fbEls.updatedWrap.style.display = '';
    }

    // Last post (if the function returns one)
    const last = payload.last_post || payload.latest_post || payload.recent_post || null;
    if (last && fbEls.lastRow) {
      if (fbEls.lastMsg) fbEls.lastMsg.textContent = (last.message || last.caption || 'Latest post').toString().slice(0, 140) + ((last.message || last.caption || '').length > 140 ? '…' : '');
      if (fbEls.lastWhen) fbEls.lastWhen.textContent = last.created_time ? new Date(last.created_time).toLocaleDateString() : '';
      if (fbEls.lastLink) fbEls.lastLink.href = last.permalink_url || '#';
      if (fbEls.lastThumb) setFBThumb(fbEls.lastThumb, last.full_picture || last.picture || null, 'facebooklogo.png');
      fbEls.lastRow.style.display = '';
    }
  } catch (e) {
    if (fbEls.name) fbEls.name.textContent = 'Not linked or error.';
    if (fbEls.category) fbEls.category.style.display = 'none';
    if (fbEls.about) fbEls.about.style.display = 'none';
    if (fbEls.followers) fbEls.followers.textContent = '-';
    if (fbEls.likes) fbEls.likes.textContent = '-';
    if (fbEls.reach28) fbEls.reach28.textContent = '-';
    if (fbEls.impressions28) fbEls.impressions28.textContent = '-';
    if (fbEls.engaged28) fbEls.engaged28.textContent = '-';
    if (fbEls.updated) fbEls.updated.textContent = '-';
    if (fbEls.lastRow) fbEls.lastRow.style.display = 'none';
    if (fbEls.pic) fbEls.pic.src = 'facebooklogo.png';
  }
}

/* =========================
   DOMContentLoaded
========================= */
document.addEventListener('DOMContentLoaded', async () => {
  safeCall(updateSummaryStats);
  safeCall(loadRecentActivity);
  safeCall(loadArchivedDeals);
  safeCall(updateOverallStars);          // <- guarded to prevent page crash
  safeCall(() => updateCategoryStars('communication', 'communication-stars'));
  safeCall(() => updateCategoryStars('punctuality', 'punctuality-stars'));
  safeCall(() => updateCategoryStars('work_output', 'work-output-stars'));

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  let youtubeConnected = false;
  let twitchConnected = false;
  let instagramConnected = false;
  let facebookConnected = false;
  try {
    const { data: userData } = await supabase
      .from('users_extended_data')
      .select('youtube_connected, twitch_connected, instagram_connected, facebook_connected')
      .eq('user_id', userId)
      .single();
    youtubeConnected = !!userData?.youtube_connected;
    twitchConnected = !!userData?.twitch_connected;
    instagramConnected = !!userData?.instagram_connected;
    facebookConnected = !!userData?.facebook_connected;
  } catch {
    youtubeConnected = false;
    twitchConnected = false;
    instagramConnected = false;
    facebookConnected = false;
  }

  const ytBlock = document.getElementById('youtube-stats-block');
  if (ytBlock) ytBlock.style.display = youtubeConnected ? 'block' : 'none';
  if (youtubeConnected) safeCall(loadYouTubeStats);

  const twBlock = document.getElementById('twitch-stats-block');
  if (twBlock) twBlock.style.display = twitchConnected ? 'block' : 'none';
  if (twitchConnected) safeCall(loadTwitchStats);

  const igBlock = document.getElementById('instagram-stats-block');
  if (igBlock) igBlock.style.display = instagramConnected ? 'block' : 'none';
  if (instagramConnected) safeCall(loadInstagramStats);

  const fbBlock = document.getElementById('facebook-stats-block');
  if (fbBlock) fbBlock.style.display = facebookConnected ? 'block' : 'none';
  if (facebookConnected) safeCall(loadFacebookStats);

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('instagram') === 'connected' && igBlock) {
      igBlock.style.display = 'block';
      safeCall(loadInstagramStats);
    }
    if (params.get('facebook') === 'connected' && fbBlock) {
      fbBlock.style.display = 'block';
      safeCall(loadFacebookStats);
    }
  } catch {}
});

window.addEventListener('message', (event) => {
  if (event?.data?.instagramConnected) {
    const igBlock = document.getElementById('instagram-stats-block');
    if (igBlock) {
      igBlock.style.display = 'block';
      safeCall(loadInstagramStats);
    }
  }
  if (event?.data?.facebookConnected) {
    const fbBlock = document.getElementById('facebook-stats-block');
    if (fbBlock) {
      fbBlock.style.display = 'block';
      safeCall(loadFacebookStats);
    }
  }
});
