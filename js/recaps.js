// ./js/recaps.js
import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';

// Project constants (match invoices.js behavior)
const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
const LOGO_BUCKET = 'logos';
const RECAP_FN_URL = `${SUPABASE_URL}/functions/v1/generate_campaign_recap`;

// --- Helper: Multi-key user lookup (same pattern as invoices) ---
function buildUserLookup(users) {
  const map = {};
  for (const u of users) {
    if (u?.id) map[u.id] = u;
    if (u?.user_id) map[u.user_id] = u;
    if (u?.username) map[u.username] = u;
    if (u?.email) map[u.email] = u;
  }
  return map;
}

async function safeInQuery(table, col, vals, fields = '*') {
  if (!Array.isArray(vals) || vals.length === 0) return [];
  try {
    const { data } = await supabase.from(table).select(fields).in(col, vals);
    return data || [];
  } catch {
    return [];
  }
}

function logoUrl(profile_pic) {
  if (!profile_pic) return 'logos.png';
  if (profile_pic.startsWith('http')) return profile_pic;
  return `${SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${encodeURIComponent(profile_pic)}`;
}

// --- Universal Recap Modal Logic (mirrors invoices.js) ---
document.addEventListener('DOMContentLoaded', async () => {
  const openBtn = document.getElementById('generate-recap-btn');
  const modal = document.getElementById('recap-modal');
  const closeBtn = document.getElementById('close-recap-modal');
  const listContainer = document.getElementById('recap-offer-list');
  if (!openBtn || !modal || !closeBtn || !listContainer) return;

  openBtn.addEventListener('click', async () => {
    modal.style.display = 'flex';
    listContainer.innerHTML = 'Loading...';

    // --- Get current user (supports impersonation) ---
    let user = await getActiveUser();
    if (!user || (!user.id && !user.user_id && !user.email)) {
      listContainer.innerHTML = 'Not logged in.';
      return;
    }

    // Build all IDs/emails (legacy-friendly)
    const ids = [user.id, user.user_id].filter(Boolean);
    const userEmail = user.email;

    // --- Fetch offers as Sponsor or Sponsee (same shape as invoices.js) ---
    let sponsorOffers = [], sponseeOffers = [];
    try {
      // As sponsor
      if (ids.length) {
        let { data } = await supabase
          .from('private_offers')
          .select('id, offer_title, offer_amount, stage, status, sponsee_id, sponsee_username, sponsee_email, sponsor_id, sponsor_username, sponsor_email, created_at')
          .in('sponsor_id', ids);
        sponsorOffers = data || [];
      }
      if (userEmail) {
        let { data } = await supabase
          .from('private_offers')
          .select('id, offer_title, offer_amount, stage, status, sponsee_id, sponsee_username, sponsee_email, sponsor_id, sponsor_username, sponsor_email, created_at')
          .eq('sponsor_email', userEmail);
        sponsorOffers = sponsorOffers.concat(data || []);
      }

      // As sponsee
      if (ids.length) {
        let { data } = await supabase
          .from('private_offers')
          .select('id, offer_title, offer_amount, stage, status, sponsee_id, sponsee_username, sponsee_email, sponsor_id, sponsor_username, sponsor_email, created_at')
          .in('sponsee_id', ids);
        sponseeOffers = data || [];
      }
      if (userEmail) {
        let { data } = await supabase
          .from('private_offers')
          .select('id, offer_title, offer_amount, stage, status, sponsee_id, sponsee_username, sponsee_email, sponsor_id, sponsor_username, sponsor_email, created_at')
          .eq('sponsee_email', userEmail);
        sponseeOffers = sponseeOffers.concat(data || []);
      }
    } catch {
      listContainer.innerHTML = '<p>Error fetching offers.</p>';
      return;
    }

    // Merge/dedupe
    let offers = [...sponsorOffers, ...sponseeOffers];
    const seen = new Set();
    offers = offers.filter(o => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });

    // Only completed offers (eligible for recap)
    const completedOffers = offers.filter(offer =>
      Number(offer.stage) === 5 ||
      ['completed', 'review_completed', 'review-completed'].includes((offer.status || '').toLowerCase())
    );

    if (!completedOffers.length) {
      listContainer.innerHTML = '<p>No completed offers found.</p>';
      return;
    }

    // Decide mode for "Other Party" column, same heuristic as invoices.js
    let sponsorCount = completedOffers.filter(o =>
      (ids.includes(o.sponsor_id) || userEmail === o.sponsor_email)
    ).length;
    let sponseeCount = completedOffers.length - sponsorCount;
    let mode = (sponsorCount >= sponseeCount) ? 'sponsor' : 'sponsee';
    let otherPartyCol = mode === 'sponsor' ? 'Sponsee' : 'Sponsor';

    // Build lookups for display avatars/usernames
    const allSponseeIds = completedOffers.map(o => o.sponsee_id).filter(Boolean);
    const allSponseeUsernames = completedOffers.map(o => o.sponsee_username).filter(Boolean);
    const allSponseeEmails = completedOffers.map(o => o.sponsee_email).filter(Boolean);
    const allSponsorIds = completedOffers.map(o => o.sponsor_id).filter(Boolean);
    const allSponsorUsernames = completedOffers.map(o => o.sponsor_username).filter(Boolean);
    const allSponsorEmails = completedOffers.map(o => o.sponsor_email).filter(Boolean);

    let userProfiles = [];
    // Sponsee
    userProfiles.push(...await safeInQuery('users_extended_data', 'user_id', allSponseeIds, 'id, user_id, username, email, profile_pic'));
    userProfiles.push(...await safeInQuery('users_extended_data', 'id', allSponseeIds, 'id, user_id, username, email, profile_pic'));
    userProfiles.push(...await safeInQuery('users_extended_data', 'username', allSponseeUsernames, 'id, user_id, username, email, profile_pic'));
    userProfiles.push(...await safeInQuery('users_extended_data', 'email', allSponseeEmails, 'id, user_id, username, email, profile_pic'));
    // Sponsor
    userProfiles.push(...await safeInQuery('users_extended_data', 'user_id', allSponsorIds, 'id, user_id, username, email, profile_pic'));
    userProfiles.push(...await safeInQuery('users_extended_data', 'id', allSponsorIds, 'id, user_id, username, email, profile_pic'));
    userProfiles.push(...await safeInQuery('users_extended_data', 'username', allSponsorUsernames, 'id, user_id, username, email, profile_pic'));
    userProfiles.push(...await safeInQuery('users_extended_data', 'email', allSponsorEmails, 'id, user_id, username, email, profile_pic'));

    // Deduplicate profiles
    const seenUser = new Set();
    userProfiles = userProfiles.filter(u => {
      const key = `${u.id || ''}|${u.user_id || ''}|${u.username || ''}|${u.email || ''}`;
      if (seenUser.has(key)) return false;
      seenUser.add(key);
      return true;
    });
    const userMap = buildUserLookup(userProfiles);

    // Render table (same aesthetics as invoices)
    const table = document.createElement('table');
    table.className = 'invoice-table'; // reuse same styles
    table.innerHTML = `
      <thead>
        <tr>
          <th>${otherPartyCol}</th>
          <th>Title</th>
          <th>Amount</th>
          <th style="width:140px;"></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    for (const offer of completedOffers) {
      // Resolve "other party"
      let otherUser = {};
      if (mode === 'sponsor') {
        otherUser =
          userMap[offer.sponsee_id] ||
          userMap[offer.sponsee_username] ||
          userMap[offer.sponsee_email] || {};
      } else {
        otherUser =
          userMap[offer.sponsor_id] ||
          userMap[offer.sponsor_username] ||
          userMap[offer.sponsor_email] || {};
      }

      const otherLogo = logoUrl(otherUser.profile_pic);
      const otherUsername =
        otherUser.username ||
        otherUser.email ||
        (mode === 'sponsor' ? offer.sponsee_username : offer.sponsor_username) ||
        'Unknown';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="vertical-align:middle;">
          <img src="${otherLogo}" alt="${otherPartyCol} Logo" style="width:38px;height:38px;object-fit:cover;border-radius:25px;vertical-align:middle;margin-right:7px;">
          <span style="display:inline-block;vertical-align:middle;font-weight:600;">${otherUsername}</span>
        </td>
        <td>${offer.offer_title}</td>
        <td class="amount">$${offer.offer_amount}</td>
        <td></td>
      `;

      const btn = document.createElement('button');
      btn.textContent = 'Generate Recap';
      btn.className = 'btn';
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Generating...';
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const accessToken = session?.access_token;
          const res = await fetch(RECAP_FN_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ offer_id: offer.id })
          });

          let payload = {};
          try { payload = await res.json(); } catch { /* no-op */ }

          // Expect Edge Function to return: { url } on success (same contract as invoices)
          if (payload?.url) {
            window.open(payload.url, '_blank');
            btn.textContent = 'Done ✅';
          } else {
            btn.textContent = 'Error';
            alert(payload?.error || 'Something went wrong generating the recap.');
          }
        } catch (err) {
          btn.textContent = 'Error';
          alert('Something went wrong.');
        }
        btn.disabled = false;
      };

      row.children[3].appendChild(btn);
      tbody.appendChild(row);
    }

    listContainer.innerHTML = '';
    listContainer.appendChild(table);
  });

  closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
});
