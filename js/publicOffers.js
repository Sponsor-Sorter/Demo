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
  `;
  div.innerHTML = `
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
  const { error: updateError } = await supabase
    .from('public_offer_applications')
    .update({ status: 'accepted' })
    .eq('id', appId);
  if (updateError) {
    alert('Failed to update application status: ' + updateError.message);
    return;
  }
  let { data: app, error: appError } = await supabase
    .from('public_offer_applications')
    .select('*, public_offers(*)')
    .eq('id', appId)
    .single();
  if (appError || !app) {
    alert('Could not find application!');
    return;
  }
  const { data: sponsee } = await supabase
    .from('users_extended_data')
    .select('email, username, user_id')
    .eq('user_id', app.sponsee_id)
    .single();
  const sponsor = await getActiveSponsor();
  if (!sponsor) {
    alert("Can't verify sponsor identity.");
    return;
  }
  const offer = app.public_offers;
  const sponseeEmail = sponsee ? sponsee.email : '';
  const offerTitle = offer.offer_title;
  const { data: existing } = await supabase
    .from('private_offers')
    .select('id')
    .eq('sponsor_id', sponsor.user_id)
    .eq('sponsee_email', sponseeEmail)
    .eq('offer_title', offerTitle);
  if (existing && existing.length > 0) {
    btn.innerText = "Accepted";
    btn.disabled = true;
    alert("You have already accepted this applicant for this offer.");
    return;
  }
  const insertObj = {
    sponsor_email: sponsor.email,
    sponsor_company: sponsor.company_name || offer.sponsor_company || '',
    sponsor_id: sponsor.user_id,
    sponsor_username: sponsor.username,
    sponsee_username: sponsee ? sponsee.username : app.sponsee_username,
    sponsee_email: sponseeEmail,
    offer_title: offerTitle,
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
  if (insertedPrivateOfferId) {
    await notifyOfferUpdate({
      to_user_id: sponsee.user_id,
      offer_id: insertedPrivateOfferId,
      type: 'offer_acceptance',
      title: 'Offer Accepted!',
      message: `Congratulations! You have been accepted for "${insertObj.offer_title}".`
    });
  }
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

export async function renderSponsorPublicOffers(containerId = "offers-container") {
  const sponsor = await getActiveSponsor();
  if (!sponsor) return;
  const page = window.sponsorOfferPage;
  const pageSize = 10;
  const filter = window.sponsorOfferStatusFilter;
  let query = supabase
    .from('public_offers')
    .select('*')
    .eq('sponsor_id', sponsor.user_id)
    .order('creation_date', { ascending: false })
    .range((page-1)*pageSize, page*pageSize-1);
  if (filter) query = query.eq('status', filter);
  const { data: offers, error } = await query;
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
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (error || !offers || !offers.length) {
    container.innerHTML = `<div style="padding:18px 8px;">No public offers found.</div>`;
    return;
  }
  for (const offer of offers) {
    container.appendChild(await renderSponsorOfferCard(offer));
  }
  const prevBtn = document.getElementById("sponsor-offer-prev-page");
  const nextBtn = document.getElementById("sponsor-offer-next-page");
  const pageLabel = document.getElementById("sponsor-offer-pagination-label");
  if (pageLabel) pageLabel.textContent = `Page ${page}`;
  if (prevBtn) prevBtn.disabled = page === 1;
  if (nextBtn) nextBtn.disabled = (page * pageSize >= totalCount);
}

export async function renderSponseePublicOffers(containerId = "sponsee-public-offers-container") {
  const page = window.sponseePublicOfferPage;
  const pageSize = 10;
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
  const prevBtn = document.getElementById("public-offer-prev-page");
  const nextBtn = document.getElementById("public-offer-next-page");
  const pageLabel = document.getElementById("public-offer-pagination-label");
  if (pageLabel) pageLabel.textContent = `Page ${page}`;
  if (prevBtn) prevBtn.disabled = page === 1;
  if (nextBtn) nextBtn.disabled = (page * pageSize >= totalCount);
  if (error || !apps || !apps.length) {
    container.innerHTML = "<p>No public offers found for this page/filter.</p>";
    return;
  }
  container.innerHTML = "";
  for (const app of apps) {
    const offer = app.public_offers;
    if (!offer) continue;
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
        renderSponseePublicOffers(containerId);
      } else {
        alert("Error withdrawing: " + error.message);
      }
    };
    container.appendChild(div);
  }
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
