import { supabase } from './supabaseClient.js';
import { notifyOfferUpdate } from './alerts.js';

if (!window.sponsorOfferPage) window.sponsorOfferPage = 1;
if (!window.sponsorOfferStatusFilter) window.sponsorOfferStatusFilter = "";
if (!window.sponseePublicOfferPage) window.sponseePublicOfferPage = 1;
if (!window.sponseePublicOfferStatusFilter) window.sponseePublicOfferStatusFilter = "";

function renderPlatformLogos(platforms = []) {
  if (!Array.isArray(platforms) || platforms.length === 0) return '';
  const logos = {
    youtube: 'youtubelogo.png',
    instagram: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/1200px-Instagram_logo_2022.svg.png',
    tiktok: 'tiktoklogo.png',
    twitter: 'twitterlogo.png',
    facebook: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
    twitch: 'twitchlogo.png',
    snapchat: 'snaplogo.png'
  };
  let html = '<div style="display:inline-block;text-align:center;width:100%;">';
  for (let i = 0; i < platforms.length; i += 4) {
    html += '<div style="margin:3px 0;">';
    html += platforms.slice(i, i+4).map(p =>
      `<img src="${logos[p] || ''}" alt="${p}" style="width:22px;height:22px;vertical-align:middle;margin-right:5px;border-radius:6px;" title="${p}">`
    ).join('');
    html += '</div>';
  }
  html += '</div>';
  return html;
}

const STRIPE_BACKEND = "https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/stripe-checkout";


async function getActiveSponsor() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data, error: err2 } = await supabase
    .from('users_extended_data')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (err2) return null;
  return { ...data, email: user.email, id: user.id, user_id: user.id };
}

async function getApplicantStats(offerId) {
  const { count: total = 0 } = await supabase
    .from('public_offer_applications')
    .select('*', { count: 'exact', head: true })
    .eq('offer_id', offerId);
  const { count: accepted = 0 } = await supabase
    .from('public_offer_applications')
    .select('*', { count: 'exact', head: true })
    .eq('offer_id', offerId)
    .eq('status', 'accepted');
  return { total, accepted };
}

async function renderSponsorOfferCard(offer) {
  let sponsorLogo = 'logos.png';
  let sponsor_company = offer.sponsor_company || '';
  try {
    const { data: sponsor } = await supabase
      .from('users_extended_data')
      .select('profile_pic, company_name')
      .eq('username', offer.sponsor_username)
      .single();
    if (sponsor && sponsor.profile_pic)
      sponsorLogo = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsor.profile_pic}`;
    if (sponsor && sponsor.company_name)
      sponsor_company = sponsor.company_name;
  } catch {}
  const { total, accepted } = await getApplicantStats(offer.id);
  let constraintsHtml = '';
  if (offer.min_followers) constraintsHtml += `<strong>Min Followers:</strong> ${offer.min_followers} <br>`;
  const platformsRow = `<div style="margin:7px 0 0 0;text-align:center;">${renderPlatformLogos(offer.platforms)}</div>`;
  const detailsId = `details-${offer.id}`;
  const imagesId = `images-${offer.id}`;
  const shareUrl = `${window.location.origin}/publicOfferDetail.html?id=${offer.id}`;

  // Main card container
  const div = document.createElement('div');
  div.className = 'public-offer-card';
  div.setAttribute('data-offer-id', offer.id);
  div.style = `
    background: #232323;
    border-radius: 14px;
    padding: 18px 20px 16px 20px;
    margin: 24px 0 0 0;
    max-width: 730px;
    margin-left: auto; margin-right: auto;
    box-shadow: 0 2px 10px #0006;
    border: 1.2px solid #26263a;
    overflow-wrap: anywhere;
    position: relative;
  `;

  div.innerHTML = `
    <!-- Share Dropdown Button (Top Right) -->
    <div style="position:absolute;top:15px;right:20px;z-index:2;">
      <button class="share-main-btn" style="z-index:1!important;background:none;border:none;cursor:pointer;padding:6px;box-shadow:none;">
        <svg width="28" height="28" viewBox="0 0 24 24" style="fill:#36a2eb;"><path d="M18 8.59V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.59l3.29 3.3a1 1 0 0 0 1.42-1.42l-5-5a1 1 0 0 0-1.42 0l-5 5a1 1 0 1 0 1.42 1.42L18 15.41V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v3.59l-3.3-3.3A1 1 0 0 0 13.3 5.7l5 5a1 1 0 0 0 1.4 0l5-5a1 1 0 1 0-1.42-1.42L18 8.59z"/></svg>
      </button>
      <div class="share-dropdown" 
      ">
        <button class="share-btn copy" data-link="${shareUrl}" style="
          background:none;
          border:none;
          color:#eaf6ff;
          padding:7px 5px;
          text-align:left;
          width:100%;
          font-size:1.08em;
          box-shadow:none;
          cursor:pointer;
          display:flex;
          align-items:center;
          gap:11px;
          transition:background 0.16s;
        ">
          <svg width="19" height="19" viewBox="0 0 20 20"><path fill="currentColor" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8.828A2 2 0 0 0 15.414 8l-5.828-5.828A2 2 0 0 0 8.828 2H6zm0 2h2.828A2 2 0 0 1 10 4.172V9a1 1 0 0 0 1 1h4v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm4 1.414L15.586 9H11V3.414z"/></svg>
          Copy Link
        </button>
        <a class="share-btn x" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Check out this sponsorship offer on Sponsor Sorter!')}" style="
          background:none;
          border:none;
          color:#1da1f2;
          padding:7px 5px;
          text-align:left;
          width:100%;
          font-size:1.08em;
          cursor:pointer;
          display:flex;
          align-items:center;
          gap:11px;
          transition:background 0.16s;
          text-decoration:none;
        ">
          <svg width="19" height="19" viewBox="0 0 24 24"><path fill="currentColor" d="M22 5.924a8.188 8.188 0 0 1-2.357.646A4.116 4.116 0 0 0 21.448 4.1a8.223 8.223 0 0 1-2.606.996A4.107 4.107 0 0 0 15.448 3c-2.266 0-4.104 1.838-4.104 4.104 0 .32.036.632.105.931C7.728 7.876 4.1 6.124 1.671 3.149c-.353.607-.556 1.312-.556 2.066 0 1.426.726 2.683 1.832 3.421a4.092 4.092 0 0 1-1.858-.514v.052c0 1.993 1.418 3.655 3.298 4.035a4.099 4.099 0 0 1-1.853.07c.522 1.631 2.037 2.819 3.833 2.851A8.233 8.233 0 0 1 2 19.545c-.646 0-1.277-.038-1.894-.111A11.59 11.59 0 0 0 8.026 21c7.547 0 11.675-6.255 11.675-11.675 0-.178-.004-.355-.012-.531A8.368 8.368 0 0 0 22 5.924z"/></svg>
          Share on X
        </a>
        <a class="share-btn linkedin" target="_blank" rel="noopener" href="https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}" style="
          background:none;
          border:none;
          color:#29b6f6;
          
          text-align:left;
          width:100%;
          font-size:1.08em;
          cursor:pointer;
          display:flex;
          align-items:center;
          transition:background 0.16s;
          text-decoration:none;
        ">
          <svg width="19" height="19" viewBox="0 0 24 24"><path fill="currentColor" d="M20.447 20.452H17.2V15.4c0-1.206-.022-2.759-1.683-2.759-1.684 0-1.941 1.318-1.941 2.676v5.136H10.329V9h3.123v1.561h.044c.434-.82 1.494-1.683 3.073-1.683 3.285 0 3.89 2.163 3.89 4.978v6.596zM5.337 7.433A1.833 1.833 0 1 1 5.335 3.77a1.833 1.833 0 0 1 .002 3.663zm1.761 13.019H3.573V9h3.525v11.452zM22.225 0H1.771C.792 0 0 .771 0 1.723v20.549C0 23.229.792 24 1.771 24h20.451C23.209 24 24 23.229 24 22.271V1.723C24 .771 23.209 0 22.225 0z"/></svg>
          Share on LinkedIn
        </a>
      </div>
    </div>
    <!-- Rest of your card, unchanged -->
    <div style="display: flex; align-items: flex-start; gap: 24px;">
      <div style="flex-shrink: 0; text-align: center;">
        <img src="${sponsorLogo}" alt="Sponsor Logo" style="width:65px;height:65px;border-radius:50%;border:2px solid #18181c;background:#fff;object-fit:cover;margin-bottom:8px;">
        <div style="margin-top:7px; font-size:0.99em;">
          <div style="margin-bottom:4px;"><strong>By:</strong> ${offer.sponsor_username}</div>
          <div style="margin-bottom:3px;"><strong>At:</strong> ${sponsor_company || '-'}</div>
        </div>
        ${platformsRow}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:1.23em;font-weight:700;margin-bottom:2px;">Offer: ${offer.offer_title}</div>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin:2px 0 5px 0;">
          <div><strong>Status:</strong> ${offer.status}</div>
          <div><strong>Amount:</strong> $${offer.offer_amount}</div>
          <div><strong>Date:</strong> ${offer.creation_date ? new Date(offer.creation_date).toLocaleDateString() : '-'}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin-bottom:2px;">
          <div><strong>Deadline:</strong> ${offer.deadline ? new Date(offer.deadline).toLocaleDateString() : '-'}</div>
          <div><strong>Payment Schedule:</strong> ${offer.payment_schedule || '-'}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin-bottom:2px;">
          <div><strong>Audience Country:</strong> ${offer.audience_country || '-'}</div>
          <div><strong>Duration:</strong> ${offer.sponsorship_duration || '-'}</div>
        </div>
        <div style="font-size:1.03em;margin-bottom:5px;">
          <strong>Applicants:</strong> ${total} applied / ${accepted} accepted${offer.max_applicants ? ' / Max: ' + offer.max_applicants : ''}
        </div>
        ${constraintsHtml ? `<div style="font-size:0.96em;margin-bottom:5px;">${constraintsHtml}</div>` : ''}
        <div style="margin:9px 0 0 0;display:flex;gap:10px;">
          <button style="flex:1 1 0;background:#13b257;color:#fff;font-weight:600;padding:7px 0;border-radius:7px;border:none;cursor:pointer;min-width:0;" data-offerid="${offer.id}" class="view-applicants-btn">View Applicants</button>
          <button style="flex:1 1 0;background:#4061b3;color:#fff;font-weight:600;padding:7px 0;border-radius:7px;border:none;cursor:pointer;min-width:0;" class="view-details-btn" data-detailsid="${detailsId}">View Details</button>
          <button style="flex:1 1 0;background:#684ad1;color:#fff;font-weight:600;padding:7px 0;border-radius:7px;border:none;cursor:pointer;min-width:0;" class="view-images-btn" data-imagesid="${imagesId}">View Images</button>
          <button style="flex:1 1 0;background:#c90b3e;color:#fff;font-weight:600;padding:7px 0;border-radius:7px;border:none;cursor:pointer;min-width:0;" class="remove-offer-btn" data-offerid="${offer.id}">Remove Offer</button>
        </div>
        <div id="${detailsId}" class="public-offer-details" style="display:none;margin:10px 0 0 0;">
          <strong>Description:</strong> ${offer.offer_description || ''}<br>
          <strong>Instructions:</strong> ${offer.instructions || ''}<br>
          <strong>Job Type:</strong> ${offer.job_type || ''}<br>
          <strong>Deliverable:</strong> ${offer.deliverable_type || ''}
        </div>
        <div id="${imagesId}" class="public-offer-images" style="display:none;margin:10px 0 0 0;">
          ${(offer.offer_images && offer.offer_images.length)
            ? offer.offer_images.map(img =>
                `<img src="${supabase.storage.from('offers').getPublicUrl(img).data.publicUrl}" alt="Offer Image" style="width:90px;height:62px;object-fit:cover;border-radius:7px;border:1.2px solid #26263a;margin-right:7px;margin-bottom:7px;">`
              ).join('')
            : '<i>No offer images.</i>'
          }
        </div>
      </div>
    </div>
  `;

  // Dropdown logic:
  const shareMainBtn = div.querySelector('.share-main-btn');
  const shareDropdown = div.querySelector('.share-dropdown');
  shareMainBtn.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.share-dropdown').forEach(dd => {
      if (dd !== shareDropdown) dd.style.display = 'none';
    });
    shareDropdown.style.display = shareDropdown.style.display === 'block' ? 'none' : 'block';
  };
  document.addEventListener('click', function closeShare(e) {
    if (!div.contains(e.target)) shareDropdown.style.display = 'none';
  });

  // Copy button
  shareDropdown.querySelector('.copy').onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.innerText = 'Copied!';
      setTimeout(() => {
        this.innerHTML = `<svg width="19" height="19" viewBox="0 0 20 20"><path fill="currentColor" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8.828A2 2 0 0 0 15.414 8l-5.828-5.828A2 2 0 0 0 8.828 2H6zm0 2h2.828A2 2 0 0 1 10 4.172V9a1 1 0 0 0 1 1h4v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm4 1.414L15.586 9H11V3.414z"/></svg> Copy Link`;
      }, 1200);
    });
  };

  div.querySelector('.view-applicants-btn').onclick = () => showApplicantsModal(offer.id);
  div.querySelector('.view-details-btn').onclick = () => {
    const details = div.querySelector(`#${detailsId}`);
    details.style.display = details.style.display === 'block' ? 'none' : 'block';
  };
  div.querySelector('.view-images-btn').onclick = () => {
    const images = div.querySelector(`#${imagesId}`);
    images.style.display = images.style.display === 'block' ? 'none' : 'block';
  };
  div.querySelector('.remove-offer-btn').onclick = () => {
    if (confirm("Are you sure you want to remove this offer? This cannot be undone.")) {
      removePublicOffer(offer.id, div);
    }
  };
  return div;
}



async function removePublicOffer(offerId, cardDiv) {
  const { error } = await supabase
    .from('public_offers')
    .delete()
    .eq('id', offerId);
  if (error) {
    alert("Failed to remove offer: " + (error.message || "Unknown error"));
    return;
  }
  if (cardDiv) cardDiv.remove();
  alert("Offer removed.");
  if (typeof renderSponsorPublicOffers === "function") renderSponsorPublicOffers();
}

async function showApplicantsModal(offerId) {
  const { data: applicants, error } = await supabase
    .from('public_offer_applications')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false });

  let modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100vw'; modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.75)';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div style="background:#232333;padding:30px 24px 18px 24px;max-width:540px;border-radius:18px;box-shadow:0 6px 32px #000a;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);min-width:360px;">
      <h2>Applicants for Offer</h2>
      <div id="applicants-list"></div>
      <div style="text-align:right;">
        <button id="close-modal" style="margin-top:18px;background:#888;color:#fff;padding:7px 16px;border-radius:7px;border:none;cursor:pointer;">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('close-modal').onclick = () => modal.remove();

  const list = modal.querySelector('#applicants-list');
  if (error || !applicants || !applicants.length) {
    list.innerHTML = '<p>No applicants for this offer yet.</p>';
    return;
  }

  for (const a of applicants) {
    let sponseeData = {};
    if (a.sponsee_id) {
      const { data } = await supabase
        .from('users_extended_data')
        .select('username, profile_pic')
        .eq('user_id', a.sponsee_id)
        .single();
      sponseeData = data || {};
    }
    let applicationText = a.application_text ? `<div style="margin:8px 0;font-size:0.98em;"><strong>Message:</strong> ${a.application_text}</div>` : '';
    let acceptBtnHtml = '';
    if (a.status === 'accepted') {
      acceptBtnHtml = `<button disabled style="background:#13b257;color:#fff;padding:5px 16px;border-radius:7px;border:none;cursor:not-allowed;">Accepted</button>`;
    } else {
      acceptBtnHtml = `<button style="background:#13b257;color:#fff;padding:5px 16px;border-radius:7px;border:none;cursor:pointer;" onclick="this.disabled=true;this.innerText='Accepted';window.acceptApplicant('${a.id}', this)">Accept</button>`;
    }
    let withdrawBtnHtml = `<button style="background:#c90b3e;color:#fff;padding:5px 14px;border-radius:7px;border:none;cursor:pointer;margin-left:5px;" onclick="window.deleteApplicant('${a.id}', this)" ${a.status === "withdrawn" ? "disabled" : ""}>Remove</button>`;

    const rowId = `app-row-${a.id}`;
    list.innerHTML += `
      <div id="${rowId}" style="display:flex;align-items:center;gap:18px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #393963;">
        <div style="text-align:center;">
          <img src="${sponseeData.profile_pic ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponseeData.profile_pic}` : 'logos.png'}" alt="Pic" style="width:54px;height:54px;border-radius:50%;border:1.5px solid #18181c;object-fit:cover;">
          <div style="font-size:0.92em;color:#c9c9c9;margin-top:3px;">${a.sponsee_username}</div>
        </div>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:1.05em;color:${
            a.status === 'accepted' ? '#13b257' :
            a.status === 'withdrawn' ? '#c90b3e' :
            a.status === 'pending' ? '#ff9800' : '#fff'
          };margin-bottom:5px;">
            ${a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : ''}
          </div>
          ${applicationText}
        </div>
        <button style="background:#4061b3;color:#fff;padding:5px 12px;border-radius:7px;border:none;cursor:pointer;margin-right:7px;" onclick="window.location.href='viewprofile.html?username=${encodeURIComponent(a.sponsee_username)}'">View Profile</button>
        ${acceptBtnHtml}
        ${withdrawBtnHtml}
      </div>
    `;
  }
}

window.acceptApplicant = async function(appId, btn) {
  // 1. Mark as accepted
  const { error: updateError } = await supabase
    .from('public_offer_applications')
    .update({ status: 'accepted' })
    .eq('id', appId);
  if (updateError) {
    alert('Failed to update application status: ' + updateError.message);
    return;
  }

  // 2. Get application + offer
  let { data: app, error: appError } = await supabase
    .from('public_offer_applications')
    .select('*, public_offers(*)')
    .eq('id', appId)
    .single();
  if (appError || !app) {
    alert('Could not find application!');
    return;
  }

  // 3. Try get sponsee's correct user_id
  let sponseeUserId = null, sponseeUsername = '', sponseeEmail = '';
  // (a) Try direct from application
  if (app.sponsee_id) sponseeUserId = app.sponsee_id;

  // (b) Query users_extended_data by sponsee_id as user_id
  let sponseeRow = null;
  if (sponseeUserId) {
    const { data: userData } = await supabase
      .from('users_extended_data')
      .select('user_id, username, email')
      .eq('user_id', sponseeUserId)
      .maybeSingle();
    if (userData) {
      sponseeUserId = userData.user_id;
      sponseeUsername = userData.username;
      sponseeEmail = userData.email;
      sponseeRow = userData;
    }
  }
  // (c) If not found, fallback to application fields (should only happen on very old records)
  if (!sponseeUserId && app.sponsee_username) {
    const { data: userData } = await supabase
      .from('users_extended_data')
      .select('user_id, username, email')
      .eq('username', app.sponsee_username)
      .maybeSingle();
    if (userData) {
      sponseeUserId = userData.user_id;
      sponseeUsername = userData.username;
      sponseeEmail = userData.email;
      sponseeRow = userData;
    }
  }
  if (!sponseeUserId) {
    alert("Cannot determine sponsee user_id! Please check that user exists.");
    return;
  }

  // 4. Sponsor details
  const sponsor = await getActiveSponsor();
  if (!sponsor) {
    alert("Can't verify sponsor identity.");
    return;
  }
  const offer = app.public_offers;

  // 5. Prevent duplicate private offer thread
  const { data: existing } = await supabase
    .from('private_offers')
    .select('id')
    .eq('sponsor_id', sponsor.user_id)
    .eq('sponsee_email', sponseeEmail)
    .eq('offer_title', offer.offer_title);
  if (existing && existing.length > 0) {
    btn.innerText = "Accepted";
    btn.disabled = true;
    alert("You have already accepted this applicant for this offer.");
    return;
  }

  // 6. Prepare insert object
  const insertObj = {
    sponsor_email: sponsor.email,
    sponsor_company: sponsor.company_name || offer.sponsor_company || '',
    sponsor_id: sponsor.user_id,
    sponsor_username: sponsor.username,
    sponsee_username: sponseeUsername || app.sponsee_username || '',
    sponsee_email: sponseeEmail || app.sponsee_email || '',
    sponsee_id: sponseeUserId,
    offer_title: offer.offer_title,
    offer_description: offer.offer_description,
    offer_amount: offer.offer_amount,
    offer_images: offer.offer_images,
    active: true,
    stage: 2,
    created_at: new Date().toISOString(),
    deadline: offer.deadline,
    deliverable_type: offer.deliverable_type,
    instructions: offer.instructions,
    job_type: offer.job_type,
    optional_file: offer.optional_file,
    payment_schedule: offer.payment_schedule,
    sponsorship_duration: offer.sponsorship_duration,
    status: 'accepted',
    creation_date: new Date().toISOString().slice(0,10),
    platforms: offer.platforms,
    sponsee_live_confirmed: false,
    sponsor_live_confirmed: false,
    live_date: null,
    live_url: null,
    archived: false
  };

  // 7. Insert private offer thread
  const { data: newOfferRows, error: insertError } = await supabase
    .from('private_offers')
    .insert([insertObj])
    .select('id');
  if (insertError) {
    alert('Failed to create private offer: ' + insertError.message);
    return;
  }
  const insertedPrivateOfferId = newOfferRows && newOfferRows[0] ? newOfferRows[0].id : null;
  btn.innerText = "Accepted";
  btn.disabled = true;
  alert('Private offer thread created successfully!');

  // 8. Notify sponsee
  if (insertedPrivateOfferId && sponseeUserId) {
    await notifyOfferUpdate({
      to_user_id: sponseeUserId,
      offer_id: insertedPrivateOfferId,
      type: 'offer_acceptance',
      title: 'Offer Accepted!',
      message: `Congratulations! You have been accepted for "${insertObj.offer_title}".`
    });
  }

  // 9. If offer is now full, remove public offer and notify sponsor
  const { count: acceptedCount, error: countError } = await supabase
    .from('public_offer_applications')
    .select('*', { count: 'exact', head: true })
    .eq('offer_id', offer.id)
    .eq('status', 'accepted');
  const maxApplicants = offer.max_applicants || 0;
  if (!countError && acceptedCount >= maxApplicants && maxApplicants > 0) {
    await notifyOfferUpdate({
      to_user_id: sponsor.user_id,
      offer_id: offer.id,
      type: 'public_offer_full',
      title: 'Offer Filled',
      message: `Your public offer "${offer.offer_title}" has reached the maximum number of accepted applicants and has now been removed.`
    });
    removePublicOffer(offer.id);
    if (typeof renderSponsorPublicOffers === "function") renderSponsorPublicOffers();
  }
};

window.deleteApplicant = async function(appId, btn) {
  if (!confirm("Are you sure you want to withdraw and delete this application? This cannot be undone.")) return;
  btn.disabled = true;
  btn.innerText = "Deleting...";
  const rowDiv = document.getElementById(`app-row-${appId}`);
  const { error } = await supabase
    .from('public_offer_applications')
    .delete()
    .eq('id', appId);
  if (!error) {
    if (rowDiv) rowDiv.remove();
  } else {
    alert('Failed to delete application.');
    btn.innerText = "Error";
    btn.disabled = false;
  }
};

// Update in renderSponsorPublicOffers()
export async function renderSponsorPublicOffers(containerId = "offers-container") {
  const sponsor = await getActiveSponsor();
  if (!sponsor) return;
  const pageSize = 5;
  const filter = window.sponsorOfferStatusFilter;
  // Calculate totalCount for correct pagination
  let totalCount = 0;
  if (!filter) {
    const { count } = await supabase
      .from('public_offers')
      .select('*', { count: 'exact', head: true })
      .eq('sponsor_id', sponsor.user_id);
    totalCount = count || 0;
  } else {
    const { count } = await supabase
      .from('public_offers')
      .select('*', { count: 'exact', head: true })
      .eq('sponsor_id', sponsor.user_id)
      .eq('status', filter);
    totalCount = count || 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize)); // Always at least 1 page
  let page = window.sponsorOfferPage;
  if (!page || isNaN(page)) page = 1;
  page = Math.max(1, Math.min(page, totalPages));
  window.sponsorOfferPage = page; // Sync

  let query = supabase
    .from('public_offers')
    .select('*')
    .eq('sponsor_id', sponsor.user_id)
    .order('creation_date', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (filter) query = query.eq('status', filter);
  const { data: offers, error } = await query;

  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (error || !offers || !offers.length) {
    container.innerHTML = `<div style="padding:18px 8px;">No public offers found.</div>`;
  } else {
    for (const offer of offers) {
      container.appendChild(await renderSponsorOfferCard(offer));
    }
  }

  // Pagination controls and label
  const prevBtn = document.getElementById("sponsor-offer-prev-page");
  const nextBtn = document.getElementById("sponsor-offer-next-page");
  const pageLabel = document.getElementById("sponsor-offer-pagination-label");
  const totalLabel = document.getElementById("public-offer-total-label");

  if (pageLabel) pageLabel.textContent = `Page ${page} / ${totalPages}`;
  if (totalLabel) {
    totalLabel.textContent = `Total Public Offers: ${totalCount}`;
    totalLabel.style.display = 'inline';
  }
  if (prevBtn) prevBtn.disabled = page === 1;
  if (nextBtn) nextBtn.disabled = (page >= totalPages);
}



export async function renderSponseePublicOffers(containerId = "sponsee-public-offers-container") {
  const page = window.sponseePublicOfferPage;
  const pageSize = 5;
  const filter = window.sponseePublicOfferStatusFilter;
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "<p>Loading your public offer applications...</p>";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    container.innerHTML = '<p style="color:red;">Not logged in.</p>';
    return;
  }
  let query = supabase
    .from("public_offer_applications")
    .select("*, public_offers(*)")
    .eq("sponsee_id", user.id)
    .order("created_at", { ascending: false })
    .range((page-1)*pageSize, page*pageSize-1);
  if (filter) query = query.eq("status", filter);
  const { data: apps, error } = await query;

  // Get total count for pagination
  let totalCount = 0;
  if (!filter) {
    const { count } = await supabase
      .from("public_offer_applications")
      .select("*", { count: "exact", head: true })
      .eq("sponsee_id", user.id);
    totalCount = count || 0;
  } else {
    const { count } = await supabase
      .from("public_offer_applications")
      .select("*", { count: "exact", head: true })
      .eq("sponsee_id", user.id)
      .eq("status", filter);
    totalCount = count || 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize)); // Always at least 1 page
  const prevBtn = document.getElementById("public-offer-prev-page");
  const nextBtn = document.getElementById("public-offer-next-page");
  const pageLabel = document.getElementById("public-offer-pagination-label");
  const totalLabel = document.getElementById("public-offer-total-label");
  if (pageLabel) pageLabel.textContent = `Page ${page} / ${totalPages}`;
  if (totalLabel) totalLabel.textContent = `Total Public Offers: ${totalCount}`;
  if (prevBtn) prevBtn.disabled = page === 1;
  if (nextBtn) nextBtn.disabled = (page >= totalPages);

  if (error || !apps || !apps.length) {
    container.innerHTML = "<p>No public offers found for this page/filter.</p>";
    return;
  }
  container.innerHTML = "";
  for (const app of apps) {
    const offer = app.public_offers;
    if (!offer) continue;
    // This renders the correct application card (NOT sponsor card!)
    container.appendChild(await renderSponseePublicOfferAppCard(app, offer));
  }
}

// Helper for sponsee side
async function renderSponseePublicOfferAppCard(app, offer) {
  let sponsorLogo = "logos.png";
  try {
    const { data: sponsor } = await supabase
      .from("users_extended_data")
      .select("profile_pic")
      .eq("username", offer.sponsor_username)
      .single();
    if (sponsor && sponsor.profile_pic)
      sponsorLogo = `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${sponsor.profile_pic}`;
  } catch {}
  const platformsRow = `<div style="margin:7px 0 0 0;text-align:center;">${renderPlatformLogos(offer.platforms)}</div>`;
  const detailsId = `details-${app.id}`;
  const imagesId = `images-${app.id}`;
  let constraintsHtml = '';
  if (offer.min_followers) constraintsHtml += `<strong>Min Followers:</strong> ${offer.min_followers} <br>`;
  const div = document.createElement("div");
  div.className = "public-offer-card";
  div.style.background = "#232323";
  div.style.borderRadius = "14px";
  div.style.padding = "18px 20px 16px 20px";
  div.style.margin = "24px 0 0 0";
  div.style.maxWidth = "730px";
  div.style.marginLeft = "auto";
  div.style.marginRight = "auto";
  div.style.boxShadow = "0 2px 10px #0006";
  div.style.border = "1.2px solid #26263a";
  div.style.overflowWrap = "anywhere";
  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:24px;">
      <div style="flex-shrink:0;text-align:center;">
        <img src="${sponsorLogo}" alt="Sponsor Logo" style="width:65px;height:65px;border-radius:50%;border:2px solid #18181c;background:#222;object-fit:cover;margin-bottom:8px;">
        <div style="margin-top:7px;font-size:0.99em;">
          <div style="margin-bottom:4px;"><strong>By:</strong> ${offer.sponsor_username}</div>
          <div style="margin-bottom:3px;"><strong>At:</strong> ${offer.sponsor_company || '-'}</div>
          <button class="view-profile-btn" style="margin-top:7px;background:#4061b3;color:#fff;padding:4px 15px;border-radius:7px;border:none;cursor:pointer;">View Profile</button>
        </div>
        ${platformsRow}
      </div>
      <div style="flex:1; min-width:0;">
        <span style="font-size:1.18em;font-weight:700;">Offer: ${offer.offer_title}</span>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin:2px 0 5px 0;">
          <div><strong>Status:</strong> ${app.status || "pending"}</div>
          <div><strong>Amount:</strong> $${offer.offer_amount}</div>
          <div><strong>Date:</strong> ${offer.creation_date ? new Date(offer.creation_date).toLocaleDateString() : '-'}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin-bottom:2px;">
          <div><strong>Deadline:</strong> ${offer.deadline ? new Date(offer.deadline).toLocaleDateString() : '-'}</div>
          <div><strong>Payment Schedule:</strong> ${offer.payment_schedule || '-'}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin-bottom:2px;">
          <div><strong>Audience Country:</strong> ${offer.audience_country || '-'}</div>
          <div><strong>Duration:</strong> ${offer.sponsorship_duration || '-'}</div>
        </div>
        ${constraintsHtml ? `<div style="font-size:0.96em;margin-bottom:5px;">${constraintsHtml}</div>` : ''}
        <div style="margin:9px 0 0 0; display:flex; gap:10px;">
          <button class="view-details-btn" style="background:#4061b3;color:#fff;padding:7px 0;border-radius:7px;border:none;cursor:pointer;flex:1 1 0;" data-detailsid="${detailsId}">View Details</button>
          <button class="view-images-btn" style="background:#684ad1;color:#fff;padding:7px 0;border-radius:7px;border:none;cursor:pointer;flex:1 1 0;" data-imagesid="${imagesId}">View Images</button>
          <button class="withdraw-btn" style="background:#c90b3e;color:#fff;padding:7px 0;border-radius:7px;border:none;cursor:pointer;flex:1 1 0;" ${app.status==="withdrawn"?"disabled":""}>
            ${app.status==="withdrawn"?"Withdrawn":"Withdraw"}
          </button>
        </div>
        <div id="${detailsId}" class="public-offer-details" style="display:none;margin:10px 0 0 0;">
          <strong>Description:</strong> ${offer.offer_description || ''}<br>
          <strong>Instructions:</strong> ${offer.instructions || ''}<br>
          <strong>Payment Schedule:</strong> ${offer.payment_schedule || ''}<br>
          <strong>Duration:</strong> ${offer.sponsorship_duration || ''}<br>
          <strong>Deliverable:</strong> ${offer.deliverable_type || ''}
        </div>
        <div id="${imagesId}" class="public-offer-images" style="display:none;margin:10px 0 0 0;">
          ${(offer.offer_images && offer.offer_images.length)
            ? offer.offer_images.map(img =>
              `<img src="${supabase.storage.from('offers').getPublicUrl(img).data.publicUrl}" alt="Offer Image" style="width:90px;height:62px;object-fit:cover;border-radius:7px;border:1.2px solid #26263a;margin-right:7px;margin-bottom:7px;">`
            ).join('')
            : '<i>No offer images.</i>'
          }
        </div>
      </div>
    </div>
  `;
  div.querySelector('.view-profile-btn').onclick = () => {
    window.location.href = `viewprofiles.html?username=${encodeURIComponent(offer.sponsor_username)}`;
  };
  div.querySelector('.view-details-btn').onclick = () => {
    const details = div.querySelector(`#${detailsId}`);
    details.style.display = details.style.display === 'block' ? 'none' : 'block';
  };
  div.querySelector('.view-images-btn').onclick = () => {
    const images = div.querySelector(`#${imagesId}`);
    images.style.display = images.style.display === 'block' ? 'none' : 'block';
  };
  div.querySelector('.withdraw-btn').onclick = async () => {
    if (app.status === "withdrawn") return;
    if (!confirm("Are you sure you want to withdraw your application?")) return;
    const { error } = await supabase
      .from("public_offer_applications")
      .update({ status: "withdrawn" })
      .eq("id", app.id);
    if (!error) {
      renderSponseePublicOffers();
    } else {
      alert("Error withdrawing: " + error.message);
    }
  };
  return div;
}


if (typeof window !== "undefined") {
  window.addEventListener('DOMContentLoaded', () => {
    const sfilterSel = document.getElementById("sponsor-offer-status-filter");
    const sprevBtn = document.getElementById("sponsor-offer-prev-page");
    const snextBtn = document.getElementById("sponsor-offer-next-page");
    window.sponsorOfferPage = 1;
    window.sponsorOfferStatusFilter = "";
    if (sfilterSel) {
      sfilterSel.onchange = function() {
        window.sponsorOfferPage = 1;
        window.sponsorOfferStatusFilter = this.value;
        renderSponsorPublicOffers();
      };
    }
    if (sprevBtn) {
      sprevBtn.onclick = () => {
        if (window.sponsorOfferPage > 1) {
          window.sponsorOfferPage--;
          renderSponsorPublicOffers();
        }
      };
    }
    if (snextBtn) {
      snextBtn.onclick = () => {
        window.sponsorOfferPage++;
        renderSponsorPublicOffers();
      };
    }
    const filterSel = document.getElementById("public-offer-status-filter");
    const prevBtn = document.getElementById("public-offer-prev-page");
    const nextBtn = document.getElementById("public-offer-next-page");
    window.sponseePublicOfferPage = 1;
    window.sponseePublicOfferStatusFilter = "";
    if (filterSel) {
      filterSel.onchange = function() {
        window.sponseePublicOfferPage = 1;
        window.sponseePublicOfferStatusFilter = this.value;
        renderSponseePublicOffers();
      };
    }
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (window.sponseePublicOfferPage > 1) {
          window.sponseePublicOfferPage--;
          renderSponseePublicOffers();
        }
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        window.sponseePublicOfferPage++;
        renderSponseePublicOffers();
      };
    }
  });
}

export async function notifySponsorOnApplication({ offer_id, sponsee_user_id, sponsee_username }) {
  const { data: offerRow } = await supabase
    .from('public_offers')
    .select('sponsor_id, offer_title, id')
    .eq('id', offer_id)
    .single();
  if (offerRow && offerRow.sponsor_id) {
    await notifyOfferUpdate({
      to_user_id: offerRow.sponsor_id,
      offer_id: offer_id,
      type: 'public_offer_application',
      title: 'New Applicant',
      message: `${sponsee_username} applied for your public offer: "${offerRow.offer_title}".`
    });
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("click", function(e) {
    if (e.target && e.target.classList.contains("share-btn") && e.target.classList.contains("copy")) {
      const link = e.target.getAttribute("data-link");
      navigator.clipboard.writeText(link).then(() => {
        e.target.innerText = "Copied!";
        setTimeout(() => { e.target.innerHTML = `<svg viewBox="0 0 20 20" width="18" height="18"><path fill="currentColor" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8.828A2 2 0 0 0 15.414 8l-5.828-5.828A2 2 0 0 0 8.828 2H6zm0 2h2.828A2 2 0 0 1 10 4.172V9a1 1 0 0 0 1 1h4v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm4 1.414L15.586 9H11V3.414z"/></svg> Copy Link`; }, 1200);
      });
    }
  });
}
