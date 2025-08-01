// ==================== DEMO DATA FOR GUEST MODE PUBLIC OFFERS =====================
const demoPublicOffers = [
  {
    id: 1,
    sponsor_username: "Sponsor",
    sponsor_company: "Acme Demo Co.",
    offer_title: "YouTube Product Shoutout",
    offer_description: "Record a fun YouTube Short showcasing our new product. Bonus for creativity!",
    offer_amount: 120,
    offer_images: ["demooffer1.jpg", "demooffer2.jpg"],
    platforms: ["youtube", "instagram"],
    min_followers: 1000,
    creation_date: "2025-07-21",
    deadline: "2025-08-10",
    job_type: "Short Video",
    deliverable_type: "YouTube Short",
    instructions: "Include #AcmeBrand and mention our site.",
    payment_schedule: "On Completion",
    sponsorship_duration: "1 Week",
    audience_country: "AU",
    status: "open",
    max_applicants: 2,
    applicants: [
      {
        id: 101,
        sponsee_username: "Sponsee",
        profile_pic: "logos.png",
        status: "pending",
        application_text: "I'd love to do this! Big fan of your brand."
      }
    ]
  }
];

let guestCreatedOffers = []; // will hold demo offers made in this session
let activeMockOffer = null; // Only one animated active mock offer at a time
let guestLocation = "Australia"; // Will be set by geolocation API
let guestCity = "";
let guestCountry = "";
let guestIP = "";

const analyticsSent = {};  // Prevents duplicate analytics events

// ==================== GUEST LOCATION HELPER =====================
async function detectGuestLocation() {
  try {
    const resp = await fetch("https://ipapi.co/json");
    if (!resp.ok) throw new Error('Failed to get location');
    const data = await resp.json();
    guestCity = data.city || "";
    guestCountry = data.country_code || "";
    guestIP = data.ip || "";
    guestLocation = [guestCity, guestCountry].filter(Boolean).join(', ') || "Australia";
  } catch (e) {
    guestCity = ""; guestCountry = ""; guestIP = "";
    guestLocation = "Australia";
  }
}

// ===================== GUEST ANALYTICS POST =======================
async function postGuestAnalytics(payload = {}) {
  const key = payload.action_type + '|' + (payload.role || '') + '|' + (payload.platform || '');
  if (analyticsSent[key]) return;  // Prevent duplicate posts for the same event+role+platform
  analyticsSent[key] = true;

  try {
    const meta = {
      userAgent: navigator.userAgent,
      screen: { w: window.innerWidth, h: window.innerHeight },
      referrer: document.referrer,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...payload.meta
    };
    await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/guest_analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: localStorage.guestSessionId || (localStorage.guestSessionId = Math.random().toString(36).slice(2)),
        role: payload.role || role || null,
        action_type: payload.action_type || null,
        platform: payload.platform || null,
        offer_title: payload.offer_title || null,
        offer_description: payload.offer_description || null,
        guest_location_city: guestCity,
        guest_location_country: guestCountry,
        guest_location_ip: guestIP,
        user_agent: navigator.userAgent,
        meta_json: meta
      })
    });
  } catch (e) {
    // Silently ignore analytics errors
  }
}

// ============= DOM/ROLE/PAGE SWITCHING ==========================
const urlParams = new URLSearchParams(window.location.search);
let role = urlParams.get('role');
const sponsorDash = document.getElementById('guest-sponsor-dashboard');
const sponseeDash = document.getElementById('guest-sponsee-dashboard');
const roleSelect = document.getElementById('guest-role-select');
const roleLabel = document.getElementById('current-role-label');
const switchRoleBtn = document.getElementById('switch-role-btn');
const switchRoleTxt = document.getElementById('switch-role-txt');

function updateBannerRole(role) {
  if (!role) {
    roleLabel.textContent = "";
    switchRoleBtn.style.display = "none";
  } else if (role === "sponsor") {
    roleLabel.textContent = "You’re previewing as Sponsor";
    switchRoleTxt.textContent = "Sponsee";
    switchRoleBtn.style.display = "inline-block";
  } else {
    roleLabel.textContent = "You’re previewing as Sponsee";
    switchRoleTxt.textContent = "Sponsor";
    switchRoleBtn.style.display = "inline-block";
  }
}

function showRole(roleToShow) {
  role = roleToShow; // Always update global role var for analytics
  roleSelect.style.display = 'none';
  sponsorDash.style.display = (role === 'sponsor') ? 'block' : 'none';
  sponseeDash.style.display = (role === 'sponsee') ? 'block' : 'none';
  updateBannerRole(role);
  // Use setTimeout to ensure DOM is painted
  setTimeout(() => {
    if (role === 'sponsor') fillSponsorDemo();
    if (role === 'sponsee') fillSponseeDemo();
  }, 0);
}


// ======================= ANALYTICS BOOTSTRAP ==========================
// On page load, detect location first, THEN fire initial page analytics, THEN show dashboard
window.addEventListener('DOMContentLoaded', async () => {
  await detectGuestLocation();
  if (!role) {
    roleSelect.style.display = 'block';
    sponsorDash.style.display = 'none';
    sponseeDash.style.display = 'none';
    updateBannerRole(null);
    postGuestAnalytics({ action_type: "page_load" });
  } else {
    showRole(role);
    postGuestAnalytics({ action_type: "page_load", role });
  }
});

// Manual role switching (fires analytics only on real button click)
switchRoleBtn.addEventListener('click', function() {
  let nextRole = (role === 'sponsor') ? 'sponsee' : 'sponsor';
  postGuestAnalytics({ action_type: "role_switch", role: nextRole, meta: { trigger: 'manualSwitch' } });
  window.location = '?role=' + nextRole;
});

document.getElementById('try-sponsor-btn')?.addEventListener('click', () => {
  postGuestAnalytics({ action_type: "role_switch", role: "sponsor", meta: { trigger: 'tryButton' } });
  window.location = '?role=sponsor';
});
document.getElementById('try-sponsee-btn')?.addEventListener('click', () => {
  postGuestAnalytics({ action_type: "role_switch", role: "sponsee", meta: { trigger: 'tryButton' } });
  window.location = '?role=sponsee';
});

// ============= Date Helpers ==========================
function pad(n) { return n < 10 ? '0' + n : n; }
function setNowDateTimeInput() {
  const now = new Date();
  const dateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  document.getElementById('mock-offer-date').value = dateStr;
  if (document.getElementById('mock-offer-deadline')) {
    document.getElementById('mock-offer-deadline').value = dateStr;
  }
}
window.addEventListener('DOMContentLoaded', setNowDateTimeInput);
document.getElementById('guest-offer-create-form').addEventListener('reset', setNowDateTimeInput);

// ============= Mock Offer Creation ==========================
window.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('guest-offer-create-form');
  if (!form) return;
  form.onsubmit = async function(e) {
    e.preventDefault();
    const title = document.getElementById('mock-offer-title').value.trim();
    const amount = Number(document.getElementById('mock-offer-amount').value);
    const dateSent = document.getElementById('mock-offer-date').value;
    const deadline = document.getElementById('mock-offer-deadline').value || "";
    const desc = document.getElementById('mock-offer-desc').value.trim();
    const platform = document.getElementById('mock-offer-platform').value;
    if (!title || !amount || !dateSent || !desc || !platform) {
      alert("Please fill in all fields.");
      return false;
    }
    const newId = "mock-" + (Date.now());
    guestCreatedOffers.unshift({
      id: newId,
      sponsor_username: "Sponsor",
      sponsor_company: "Acme Demo Co.",
      offer_title: title,
      offer_description: desc,
      offer_amount: amount,
      offer_images: [],
      platforms: [platform],
      min_followers: 0,
      creation_date: dateSent,
      deadline: deadline,
      job_type: "",
      deliverable_type: "",
      instructions: "",
      payment_schedule: "On Completion",
      sponsorship_duration: "",
      audience_country: "AU",
      status: "open",
      max_applicants: 1,
      applicants: [
        {
          id: "mockapp-" + (Date.now()),
          sponsee_username: "Sponsee",
          profile_pic: "logos.png",
          status: "pending",
          application_text: "I'd love to try this campaign!"
        }
      ]
    });

    // Post offer creation analytics (only once per combo)
    postGuestAnalytics({
      role,
      action_type: "offer_created",
      platform,
      offer_title: title,
      offer_description: desc,
      meta: { amount, dateSent, deadline }
    });

    form.reset();
    setNowDateTimeInput();
    renderAllSponsorOffers(newId);
    return false;
  };
});

// ===================== MODAL HELPERS ========================
function showGuestSignupModal(msg) {
  document.getElementById('guest-signup-modal').style.display = 'flex';
  if(msg) document.querySelector('#guest-signup-modal h2').innerText = msg;
}
function hideGuestSignupModal() {
  document.getElementById('guest-signup-modal').style.display = 'none';
}

// ================ PUBLIC OFFER CARD HELPERS ===================
function renderGuestPublicOfferCard(offer, sponseeView = false) {
  const platformsRow = `<div style="margin:7px 0 0 0;text-align:center;">
    ${offer.platforms.map(p =>
      `<img src="${p==='youtube'?'youtubelogo.png':p==='instagram'?'instagramlogo.png':p+'logo.png'}" alt="${p}" style="width:22px;height:22px;vertical-align:middle;margin-right:5px;border-radius:6px;" title="${p}">`
    ).join('')}
  </div>`;
  const detailsId = `guest-details-${offer.id}`;
  const imagesId = `guest-images-${offer.id}`;
  let constraintsHtml = '';
  if (offer.min_followers) constraintsHtml += `<strong>Min Followers:</strong> ${offer.min_followers} <br>`;
  const applicantsHtml = sponseeView ? "" : `<div style="font-size:1.03em;margin-bottom:5px;"><strong>Applicants:</strong> ${offer.applicants.length} / ${offer.max_applicants || "∞"}</div>`;

  const div = document.createElement('div');
  div.className = 'public-offer-card';
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
    <div style="display:flex;align-items:flex-start;gap:24px;">
      <div style="flex-shrink:0;text-align:center;">
        <img src="logos.png" alt="Sponsor Logo" style="width:65px;height:65px;border-radius:50%;border:2px solid #18181c;background:black;object-fit:cover;margin-bottom:8px;">
        <div style="margin-top:7px;font-size:0.99em;">
          <div style="margin-bottom:4px;"><strong>By:</strong> ${offer.sponsor_username}</div>
          <div style="margin-bottom:3px;"><strong>At:</strong> ${offer.sponsor_company}</div>
        </div>
        ${platformsRow}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:1.23em;font-weight:700;margin-bottom:2px;">Offer: ${offer.offer_title}</div>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin:2px 0 5px 0;">
          <div><strong>Status:</strong> ${offer.status}</div>
          <div><strong>Amount:</strong> $${offer.offer_amount}</div>
          <div><strong>Date:</strong> ${new Date(offer.creation_date).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin-bottom:2px;">
          <div><strong>Deadline:</strong> ${offer.deadline ? new Date(offer.deadline).toLocaleDateString() : "-"}</div>
          <div><strong>Payment Schedule:</strong> ${offer.payment_schedule}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:34px 46px;margin-bottom:2px;">
          <div><strong>Audience Country:</strong> ${offer.audience_country}</div>
          <div><strong>Duration:</strong> ${offer.sponsorship_duration}</div>
        </div>
        ${constraintsHtml ? `<div style="font-size:0.96em;margin-bottom:5px;">${constraintsHtml}</div>` : ''}
        ${applicantsHtml}
        <div style="margin:9px 0 0 0;display:flex;gap:10px;">
          ${sponseeView
            ? `<button class="apply-btn" style="background:#13b257;color:#fff;padding:7px 0;border-radius:7px;border:none;cursor:pointer;flex:1 1 0;">Apply</button>
               <button class="withdraw-btn" style="background:#c90b3e;color:#fff;padding:7px 0;border-radius:7px;border:none;cursor:pointer;flex:1 1 0;">Withdraw</button>`
            : `<button style="flex:1 1 0;background:#13b257;color:#fff;padding:7px 0;border-radius:7px;border:none;cursor:pointer;" class="view-applicants-btn">View Applicants</button>`
          }
          <button style="flex:1 1 0;background:#4061b3;color:#fff;padding:7px 0;border-radius:7px;border:none;cursor:pointer;" class="view-details-btn" data-detailsid="${detailsId}">View Details</button>
          <button style="flex:1 1 0;background:#684ad1;color:#fff;padding:7px 0;border-radius:7px;border:none;cursor:pointer;" class="view-images-btn" data-imagesid="${imagesId}">View Images</button>
        </div>
        <div id="${detailsId}" class="public-offer-details" style="display:none;margin:10px 0 0 0;">
          <strong>Description:</strong> ${offer.offer_description}<br>
          <strong>Instructions:</strong> ${offer.instructions}<br>
          <strong>Job Type:</strong> ${offer.job_type}<br>
          <strong>Deliverable:</strong> ${offer.deliverable_type}
        </div>
        <div id="${imagesId}" class="public-offer-images" style="display:none;margin:10px 0 0 0;">
          ${(offer.offer_images && offer.offer_images.length)
            ? offer.offer_images.map(img =>
                `<img src="${img}" alt="Offer Image" style="width:90px;height:62px;object-fit:cover;border-radius:7px;border:1.2px solid #26263a;margin-right:7px;margin-bottom:7px;">`
              ).join('')
            : '<i>No offer images.</i>'
          }
        </div>
      </div>
    </div>
  `;

  div.querySelector('.view-details-btn').onclick = () => {
    const details = div.querySelector(`#${detailsId}`);
    details.style.display = details.style.display === 'block' ? 'none' : 'block';
  };
  div.querySelector('.view-images-btn').onclick = () => {
    const images = div.querySelector(`#${imagesId}`);
    images.style.display = images.style.display === 'block' ? 'none' : 'block';
  };

  if (sponseeView) {
    div.querySelector('.apply-btn').onclick = () => showGuestSignupModal("Create an account to apply!");
    div.querySelector('.withdraw-btn').onclick = () => showGuestSignupModal("You need an account to withdraw an application.");
  } else {
    div.querySelector('.view-applicants-btn').onclick = () => {
      let modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100vw'; modal.style.height = '100vh';
      modal.style.background = 'rgba(0,0,0,0.75)';
      modal.style.zIndex = '9999';

      const isMockOffer = offer.id && String(offer.id).startsWith("mock-");
      const applicant = offer.applicants[0];
      const canAccept = isMockOffer && applicant && applicant.status === "pending";
      modal.innerHTML = `
        <div style="background:#232333;padding:30px 24px 18px 24px;max-width:540px;border-radius:18px;box-shadow:0 6px 32px #000a;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);min-width:360px;">
          <h2>Applicants for Offer</h2>
          <div id="applicants-list">
            ${
              applicant ? `
                <div style="margin-bottom:14px;">
                  <img src="${applicant.profile_pic}" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:7px;">
                  <strong>${applicant.sponsee_username}</strong>
                  <span style="margin-left:9px;color:#17d;">${applicant.status}</span>
                  <div style="font-size:0.98em;margin-top:5px;color:#ddd;">${applicant.application_text}</div>
                  ${canAccept ? '<button id="accept-app-btn" style="margin-top:10px;background:#0c6;color:#fff;padding:7px 14px;border-radius:7px;border:none;cursor:pointer;">Accept Application</button>' : ''}
                </div>
              ` : "<p>No applicants yet.</p>"
            }
          </div>
          <div style="text-align:right;">
            <button id="close-modal" style="margin-top:18px;background:#888;color:#fff;padding:7px 16px;border-radius:7px;border:none;cursor:pointer;">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('close-modal').onclick = () => modal.remove();
      if (canAccept) {
        document.getElementById('accept-app-btn').onclick = function() {
          applicant.status = "accepted";
          offer.status = "accepted";
          activeMockOffer = offer;
          modal.remove();
          animateMockOfferInActiveListings(offer);
          setTimeout(() => {
            const activeCard = document.querySelector('.listing-stage');
            if (activeCard) {
              activeCard.classList.add('highlight-card');
              activeCard.scrollIntoView({ behavior: "smooth", block: "center" });
              setTimeout(() => activeCard.classList.remove('highlight-card'), 1800);
            }
          }, 100);
        };
      }
    };
  }
  return div;
}

function renderStars(el, rating) {
  // rating: 0–5, can be a float (e.g. 3.5)
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars += `<span style="color:#ffc400;font-size:1.1em;">&#9733;</span>`; // filled
    } else if (rating > i - 1) {
      // half star: can use outlined star or filled (since Unicode half-star is not supported everywhere)
      stars += `<span style="color:#ffb700;font-size:1.1em;">&#9733;</span>`;
    } else {
      stars += `<span style="color:#888;font-size:1.1em;">&#9734;</span>`; // empty
    }
  }
  el.innerHTML = stars;
}


// ========== PUBLIC OFFER RENDERERS ==========
function renderGuestSponsorPublicOffers() {
  const container = document.getElementById("offers-container");
  container.innerHTML = "";
  demoPublicOffers.forEach(offer => {
    container.appendChild(renderGuestPublicOfferCard(offer, false));
  });
  document.getElementById("sponsor-offer-pagination-label").textContent = `Page 1 / 1`;
  document.getElementById("public-offer-total-label").textContent = `Total Public Offers: ${demoPublicOffers.length}`;
}
function renderGuestSponseePublicOffers() {
  const container = document.getElementById("sponsee-public-offers-container");
  container.innerHTML = "";
  demoPublicOffers.forEach(offer => {
    container.appendChild(renderGuestPublicOfferCard(offer, true));
  });
  document.getElementById("public-offer-pagination-label").textContent = `Page 1 / 1`;
  document.getElementById("public-offer-total-label").textContent = `Total Public Offers: ${demoPublicOffers.length}`;
}
function renderAllSponsorOffers(highlightId) {
  const container = document.getElementById("offers-container");
  container.innerHTML = "";
  [...guestCreatedOffers, ...demoPublicOffers].forEach(offer => {
    const card = renderGuestPublicOfferCard(offer, false);
    card.dataset.offerId = offer.id;
    container.appendChild(card);
  });
  document.getElementById("sponsor-offer-pagination-label").textContent = `Page 1 / 1`;
  document.getElementById("public-offer-total-label").textContent = `Total Public Offers: ${guestCreatedOffers.length + demoPublicOffers.length}`;
  if (highlightId) {
    setTimeout(() => {
      const card = container.querySelector(`[data-offer-id="${highlightId}"]`);
      if (card) {
        card.classList.add("highlight-card");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => card.classList.remove("highlight-card"), 1600);
      }
    }, 50);
  }
}

// =============== ACTIVE LISTINGS LOGIC (Animated + Static) ===============
function animateMockOfferInActiveListings(offer) {
  let listing = document.getElementById('listing-container');
  if (!listing) return;
  let commentLog = [];
  function addAutoComment(sender, text) {
    const now = new Date();
    const ts = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    commentLog.push({ sender, text, ts });
    const commentsDiv = card.querySelector('.existing-comments');
    if (commentsDiv) {
      const p = document.createElement('p');
      p.innerHTML = `<strong>${sender}:</strong> ${text} <em>(${ts})</em>`;
      commentsDiv.appendChild(p);
      commentsDiv.scrollTop = commentsDiv.scrollHeight;
    }
  }
  listing.innerHTML = '';
  let card = document.createElement('div');
  card.className = "listing-stage";
  card.style.marginBottom = "30px";
  card.innerHTML = `
    <div class="card-content" style="position:relative;">
      <button class="report-btn" style="position:absolute;top:-27px;left:-30px;background:none;border:none;outline:none;box-shadow:none;cursor:pointer;color:#e03232;font-size:1.25em;z-index:4;" title="Report Offer">🚩</button>
      <div class="card-top">
        <div class="logo-container">
          <img src="logos.png" alt="Sponsee Profile Pic" class="stage-logo">
          <p><strong>To:</strong> ${offer.applicants[0].sponsee_username}</p>
          <div><strong>Platforms:</strong>
            ${offer.platforms.map(p => `
              <span class="social-badge" style="display:inline-block;background:#f4f7ff;border-radius:8px;padding:2px 5px;margin-right:4px;">
                <img src="${p==='youtube'?'youtubelogo.png':p==='instagram'?'instagramlogo.png':p+'logo.png'}" alt="${p}" style="height:20px;width:20px;vertical-align:middle;">
              </span>
            `).join('')}
          </div>
        </div>
        <div class="stage-content">
          <div id="mock-offer-stage-header"></div>
          <div class="offer-details-row">
            <div class="offer-left">
              <p><strong>Offer Title:</strong> ${offer.offer_title}</p>
              <p><strong>Date Sent:</strong> ${offer.creation_date}</p>
              <p><strong>Deadline:</strong> ${offer.deadline}</p>
            </div>
            <div class="offer-right">
              <p><strong>Amount:</strong> $${offer.offer_amount}</p>
              <p><strong>Payment Schedule:</strong> ${offer.payment_schedule}</p>
              <p><strong>Status:</strong> <span id="mock-offer-status" style="color:orange;">pending</span></p>
            </div>
          </div>
        </div>
      </div>
      <div class="card-bottom">
        <button class="offer-Comments">Comments</button>
        <button class="expand-btn">View Details</button>
        <div class="details-section" style="display: none;">
          <fieldset><legend><strong>Description:</strong></legend>${offer.offer_description}</fieldset>
        </div>
        <div class="comments-section" style="display: none; width:100%">
          <div class="existing-comments"></div>
          <textarea placeholder="Write a comment..." class="comment-input"></textarea><br>
          <button class="submit-comment">Submit Comment</button>
        </div>
      </div>
    </div>
  `;
  let stage = 1;
  const stages = [
    { header: '<h3>Stage 1: Offer Sent</h3><div class="progress-container"><div class="progress-bar" style="width: 20%;"></div></div>', status: 'pending', statusColor: 'orange' },
    { header: '<h3>Stage 2: Offer Accepted</h3><div class="progress-container"><div class="progress-bar" style="width: 40%;"></div></div>', status: 'accepted', statusColor: 'green' },
    { header: '<h3>Stage 3: In Creation</h3><div class="progress-container"><div class="progress-bar" style="width: 60%;"></div></div>', status: 'in_progress', statusColor: 'blue' },
    { header: '<h3>Stage 4: Content Live</h3><div class="progress-container"><div class="progress-bar" style="width: 80%;"></div></div>', status: 'live', statusColor: '#0088ff' },
    { header: '<h3>Stage 5: Sponsorship Completed</h3><div class="progress-container"><div class="progress-bar" style="width: 100%; background-color: green;"></div></div>', status: 'completed', statusColor: 'purple' }
  ];
  function updateStage() {
    card.querySelector('#mock-offer-stage-header').innerHTML = stages[stage].header;
    const statusSpan = card.querySelector('#mock-offer-status');
    statusSpan.textContent = stages[stage].status;
    statusSpan.style.color = stages[stage].statusColor;
    switch(stage) {
      case 1:
        addAutoComment("Sponsee", "Awesome, offer accepted! I'm excited to start.");
        break;
      case 2:
        addAutoComment("Sponsee", "Content creation is in progress.");
        break;
      case 3:
        addAutoComment("Sponsee", "Content is now live. Please review!");
        addAutoComment("Sponsor", "Great work, I'll check the content now.");
        break;
      case 4:
        addAutoComment("Sponsor", "Payment sent! Thanks for collaborating.");
        break;
    }
  }
  updateStage();
  function nextStageAuto() {
    if (stage < stages.length - 1) {
      setTimeout(() => {
        stage++;
        updateStage();
        nextStageAuto();
      }, 2400);
    } else {
      setTimeout(() => {
        showGuestSignupModal("Want to run real offers like this?");
      }, 1000);
    }
  }
  setTimeout(nextStageAuto, 1800);

  card.querySelector('.expand-btn').onclick = function () {
    const details = card.querySelector('.details-section');
    details.style.display = details.style.display === 'block' ? 'none' : 'block';
    card.querySelector('.comments-section').style.display = 'none';
  };
  card.querySelector('.offer-Comments').onclick = function () {
    const comments = card.querySelector('.comments-section');
    comments.style.display = comments.style.display === 'block' ? 'none' : 'block';
    card.querySelector('.details-section').style.display = 'none';
    comments.querySelector('.submit-comment').onclick = function () {
      const input = comments.querySelector('.comment-input');
      if (!input.value.trim()) return alert('Comment cannot be empty.');
      const newP = document.createElement('p');
      newP.innerHTML = `<strong>Sponsor:</strong> ${input.value} <em>(Now)</em>`;
      comments.querySelector('.existing-comments').appendChild(newP);
      input.value = '';
    };
  };

  listing.appendChild(card);
  card.classList.add("highlight-card");
  setTimeout(() => card.classList.remove("highlight-card"), 1600);
  appendStaticDemoListing();
}

function appendStaticDemoListing() {
  let listing = document.getElementById('listing-container');
  if (!listing) return;
  let card = document.createElement('div');
  card.className = "listing-stage";
  card.style.marginBottom = "30px";
  card.innerHTML = `
    <div class="card-content" style="position:relative;">
      <button class="report-btn" style="position:absolute;top:-27px;left:-30px;background:none;border:none;outline:none;box-shadow:none;cursor:pointer;color:#e03232;font-size:1.25em;z-index:4;" title="Report Offer">🚩</button>
      <div class="card-top">
        <div class="logo-container">
          <img src="logos.png" alt="Sponsee Profile Pic" class="stage-logo">
          <p><strong>To:</strong> Sponsee</p>
          <div><strong>Platforms:</strong>
            <span class="social-badge" style="display:inline-block;background:#f4f7ff;border-radius:8px;padding:2px 5px;margin-right:4px;">
              <img src="youtubelogo.png" alt="YouTube" style="height:20px;width:20px;vertical-align:middle;">
            </span>
            <span class="social-badge" style="display:inline-block;background:#f4f7ff;border-radius:8px;padding:2px 5px;margin-right:4px;">
              <img src="instagramlogo.png" alt="Instagram" style="height:20px;width:20px;vertical-align:middle;">
            </span>
          </div>
        </div>
        <div class="stage-content">
          <div id="guest-offer-stage-header"></div>
          <div class="offer-details-row">
            <div class="offer-left">
              <p><strong>Offer Title:</strong> Demo Brand Collab</p>
              <p><strong>Content Live:</strong> 2025-07-30</p>
              <p><strong>Deadline:</strong> 2025-08-15</p>
            </div>
            <div class="offer-right">
              <p><strong>Amount:</strong> $250</p>
              <p><strong>Payment Schedule:</strong> Upon Completion</p>
              <p><strong>Duration:</strong> 2 Weeks</p>
              <p><strong>Status:</strong> <span id="guest-offer-status" style="color:green;">accepted</span></p>
            </div>
          </div>
        </div>
      </div>
      <div class="card-bottom">
        <button class="offer-Comments">Comments</button>
        <button class="offer-img">Offer Images</button>
        <button class="expand-btn">View Details</button>
        <button id="guest-cancel-offer-btn" style="display:none;">Cancel Offer</button>
        <div class="details-section" style="display: none;">
          <fieldset><legend><strong>Description:</strong></legend>Exciting collab opportunity with Sponsee—short video for product launch.</fieldset>
          <div class="job-deliverable-row">
            <span><strong>Job Type:</strong> Video</span>
            <span><strong>Deliverable Type:</strong> YouTube Short</span>
          </div>
          <fieldset><legend><strong>Instructions:</strong></legend>Film a 60s product showcase and include hashtag #Sponsor in description.</fieldset>
        </div>
        <div class="images-section" style="display: none; gap: 20px; padding: 10px">
          <div class="image-viewer" style="flex: 1; text-align: center;">
            <img class="main-image" src="demooffer1.jpg" alt="Selected Image" style="max-width: 100%; height: 250px; border: 1px solid #ccc; border-radius: 8px">
            <div style="margin-top: 15px;">
              <button class="prev-image">Previous</button>
              <button class="next-image">Next</button>
            </div>
          </div>
          <div class="image-thumbnails" style="width: 60px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 8px">
            <img src="demooffer1.jpg" style="width:100%;margin-bottom:10px;cursor:pointer;border-radius:4px;">
            <img src="demooffer2.jpg" style="width:100%;margin-bottom:10px;cursor:pointer;border-radius:4px;">
          </div>
        </div>
        <div class="comments-section" style="display: none;">
          <div class="existing-comments">
            <p><strong>Sponsee:</strong> Thanks, looking forward to working together! <em>(2025-07-30 10:31)</em></p>
            <p><strong>Sponsor:</strong> Please let us know if you have questions! <em>(2025-07-30 11:02)</em></p>
          </div>
          <textarea placeholder="Write a comment..." class="comment-input"></textarea><br>
          <button class="submit-comment">Submit Comment</button>
        </div>
      </div>
    </div>
  `;
  card.querySelector('#guest-offer-stage-header').innerHTML =
    '<h3>Stage 2: Offer Accepted</h3><div class="progress-container"><div class="progress-bar" style="width: 40%;"></div></div>';
  card.querySelector('.expand-btn').onclick = function () {
    const details = card.querySelector('.details-section');
    details.style.display = details.style.display === 'block' ? 'none' : 'block';
    card.querySelector('.images-section').style.display = 'none';
    card.querySelector('.comments-section').style.display = 'none';
  };
  card.querySelector('.offer-img').onclick = function () {
    const images = card.querySelector('.images-section');
    images.style.display = images.style.display === 'flex' ? 'none' : 'flex';
    card.querySelector('.details-section').style.display = 'none';
    card.querySelector('.comments-section').style.display = 'none';
    const thumbnails = Array.from(card.querySelectorAll('.image-thumbnails img'));
    const viewer = card.querySelector('.main-image');
    let index = 0;
    function showImage(i) {
      index = i;
      viewer.src = thumbnails[i].src;
      thumbnails.forEach((t, ti) => t.style.border = ti === i ? '2px solid #007BFF' : '1px solid #ccc');
    }
    thumbnails.forEach((t, i) => t.onclick = () => showImage(i));
    card.querySelector('.prev-image').onclick = () => showImage((index - 1 + thumbnails.length) % thumbnails.length);
    card.querySelector('.next-image').onclick = () => showImage((index + 1) % thumbnails.length);
    showImage(0);
  };
  card.querySelector('.offer-Comments').onclick = function () {
    const comments = card.querySelector('.comments-section');
    comments.style.display = comments.style.display === 'block' ? 'none' : 'block';
    card.querySelector('.details-section').style.display = 'none';
    card.querySelector('.images-section').style.display = 'none';
    comments.querySelector('.submit-comment').onclick = function () {
      const input = comments.querySelector('.comment-input');
      if (!input.value.trim()) return alert('Comment cannot be empty.');
      const newP = document.createElement('p');
      newP.innerHTML = `<strong>Sponsor:</strong> ${input.value} <em>(Now)</em>`;
      comments.querySelector('.existing-comments').appendChild(newP);
      input.value = '';
    };
  };
  listing.appendChild(card);
}

// ================== SPONSOR DEMO LOGIC (Active Listings + Public Offers) ===============
function fillSponsorDemo() {
  document.getElementById('sponsorName').innerText = "Sponsor";
  document.getElementById("sponsor-email").textContent = "demo@sponsorsorter.com";
  document.getElementById('company').innerText = "Acme Demo Co.";
  document.getElementById("sponsor-location").textContent = guestLocation;
  document.getElementById("profile-pic").src = "logos.png";
  document.getElementById("about-yourself").innerText = "We connect with top creators to build fun campaigns.";
  document.getElementById('sponsored-deals').innerText = "3";
  document.getElementById('ongoing-campaigns').innerText = "2";
  document.getElementById('total-spend').innerText = "$800";
  document.getElementById('success-ratio').innerText = "5:7";
  document.getElementById('wallet').innerText = "$214.50";
    renderStars(document.getElementById('average-stars'), 4);
    renderStars(document.getElementById('communication-stars'), 4);
    renderStars(document.getElementById('punctuality-stars'), 5);
    renderStars(document.getElementById('work-output-stars'), 3);

  let listing = document.getElementById('listing-container');
  if (listing) {
    listing.innerHTML = '';
    if (activeMockOffer) {
      animateMockOfferInActiveListings(activeMockOffer);
    } else {
      appendStaticDemoListing();
    }
  }
  let dealsTable = document.getElementById("deals-table-body");
  if (dealsTable) {
    dealsTable.innerHTML = `
      <tr><td>Sponsee</td><td>In Progress</td><td>$200</td><td>2025-07-24</td><td>2025-08-01</td><td>✔️</td></tr>
      <tr><td>sampleuser</td><td>Live</td><td>$350</td><td>2025-07-12</td><td>2025-07-28</td><td>✔️</td></tr>
    `;
  }
  let archivedTable = document.getElementById("archived-table-body");
  if (archivedTable) {
    archivedTable.innerHTML = `
      <tr><td>oldcreator</td><td>$500</td><td>2025-06-02</td><td>✔️</td><td>2025-06-30</td><td>★★★★★</td><td>★★★★☆</td></tr>
    `;
  }
  renderAllSponsorOffers();
}

// ============= SPONSEE GUEST DEMO LOGIC ======================
function renderGuestSponseeActiveOfferCard(offer, idx = 0) {
  // Stage/Progress logic (match real dashboard look)
  let stageTitle = "Stage 2: Offer Accepted", progress = 40, statusText = "Accepted", statusColor = "green";
  if (offer.status === "in_progress") {
    stageTitle = "Stage 3: In Progress"; progress = 60; statusText = "In Progress"; statusColor = "#0096ff";
  }
  if (offer.status === "live") {
    stageTitle = "Stage 4: Content Live"; progress = 80; statusText = "Live"; statusColor = "#684ad1";
  }
  if (offer.status === "completed") {
    stageTitle = "Stage 5: Sponsorship Completed"; progress = 100; statusText = "Completed"; statusColor = "#7645d3";
  }
  if (offer.status === "pending" || offer.status === "open") {
    stageTitle = "Stage 1: Offer Sent"; progress = 20; statusText = "Pending"; statusColor = "#ffaa00";
  }
  // Format dates
  function formatDate(d) {
    if (!d) return "-";
    if (d instanceof Date) return d.toLocaleDateString();
    return new Date(d).toLocaleDateString();
  }
  // Platform icons
  const platformIcons = {
    youtube: "youtubelogo.png",
    instagram: "instagramlogo.png",
    tiktok: "tiktoklogo.png",
    twitter: "twitterlogo.png",
    facebook: "facebooklogo.png"
  };

  let card = document.createElement('div');
  card.className = "listing-stage";
  card.style.marginBottom = "30px";
  card.innerHTML = `
    <div class="card-content" style="position:relative;">
      <div class="card-top">
        <div class="logo-container">
          <img src="logos.png" alt="Sponsor Profile Pic" class="stage-logo">
          <p><strong>From:</strong> ${offer.sponsor_company}</p>
          <div><strong>Platforms:</strong>
            ${offer.platforms.map(p => `
              <span class="social-badge" style="display:inline-block;background:#f4f7ff;border-radius:8px;padding:2px 5px;margin-right:4px;">
                <img src="${platformIcons[p] || 'logos.png'}" alt="${p}" style="height:20px;width:20px;vertical-align:middle;">
              </span>
            `).join('')}
          </div>
        </div>
        <div class="stage-content">
          <div style="text-align:center;margin-bottom:8px;margin-top:18px">
            <h3 style="margin:0;font-size:1.22em;">${stageTitle}</h3>
            <div class="progress-container" style="height:9px;background:#444;border-radius:7px;width:98%;margin:0 auto 5px auto;margin-top: 20px">
              <div class="progress-bar" style="height:100%;border-radius:7px;background:#19d54a;width:${progress}%;"></div>
            </div>
          </div>
          <div class="offer-details-row" style="display:flex;justify-content:space-between;gap:16px;">
            <div class="offer-left" style="flex:1;">
              <p><strong>Offer Title:</strong> ${offer.offer_title}</p>
              <p><strong>Date Sent:</strong> ${formatDate(offer.creation_date)}</p>
              <p><strong>Deadline:</strong> ${formatDate(offer.deadline)}</p>
            </div>
            <div class="offer-right" style="flex:1;">
              <p><strong>Amount:</strong> $${offer.offer_amount}</p>
              <p><strong>Payment Schedule:</strong> ${offer.payment_schedule}</p>
              <p><strong>Status:</strong> <span style="color:${statusColor};font-weight:600;">${statusText}</span></p>
            </div>
          </div>
        </div>
      </div>
      <div class="card-bottom" style="margin-top:6px;">
        <button class="offer-Comments" style="background:#2156e4;color:#fff;border-radius:8px;padding:7px 14px;margin-right:7px;">Comments</button>
        <button class="offer-img" style="background:#2156e4;color:#fff;border-radius:8px;padding:7px 14px;margin-right:7px;">Offer Images</button>
        <button class="expand-btn" style="background:#2156e4;color:#fff;border-radius:8px;padding:7px 14px;">View Details</button>
        <div class="details-section" style="display: none; margin-top:12px;">
          <fieldset><legend><strong>Description:</strong></legend>${offer.offer_description}</fieldset>
          <div class="job-deliverable-row" style="margin:7px 0 7px 0;">
            <span><strong>Job Type:</strong> ${offer.job_type || '-'}</span>
            <span style="margin-left:18px;"><strong>Deliverable Type:</strong> ${offer.deliverable_type || '-'}</span>
          </div>
          <fieldset><legend><strong>Instructions:</strong></legend>${offer.instructions || ''}</fieldset>
        </div>
        <div class="images-section" style="display: none; gap: 20px; padding: 10px">
          <div class="image-viewer" style="flex: 1; text-align: center;">
            <img class="main-image" src="${(offer.offer_images && offer.offer_images[0]) || ''}" alt="Selected Image" style="max-width: 100%; height: 250px; border: 1px solid #ccc; border-radius: 8px">
            <div style="margin-top: 15px;">
              <button class="prev-image">Previous</button>
              <button class="next-image">Next</button>
            </div>
          </div>
          <div class="image-thumbnails" style="width: 60px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 8px">
            ${(offer.offer_images || []).map(img =>
              `<img src="${img}" style="width:100%;margin-bottom:10px;cursor:pointer;border-radius:4px;">`
            ).join('')}
          </div>
        </div>
        <div class="comments-section" style="display: none;">
          <div class="existing-comments"></div>
          <textarea placeholder="Write a comment..." class="comment-input"></textarea><br>
          <button class="submit-comment">Submit Comment</button>
        </div>
      </div>
    </div>
  `;

  // Details section toggle
  card.querySelector('.expand-btn').onclick = function () {
    const details = card.querySelector('.details-section');
    details.style.display = details.style.display === 'block' ? 'none' : 'block';
    card.querySelector('.images-section').style.display = 'none';
    card.querySelector('.comments-section').style.display = 'none';
  };
  // Images section
  if ((offer.offer_images || []).length > 0) {
    let viewer = card.querySelector('.main-image');
    let thumbnails = Array.from(card.querySelectorAll('.image-thumbnails img'));
    let index = 0;
    function showImage(i) {
      index = i;
      viewer.src = thumbnails[i].src;
      thumbnails.forEach((t, ti) => t.style.border = ti === i ? '2px solid #007BFF' : '1px solid #ccc');
    }
    thumbnails.forEach((t, i) => t.onclick = () => showImage(i));
    card.querySelector('.prev-image').onclick = () => showImage((index - 1 + thumbnails.length) % thumbnails.length);
    card.querySelector('.next-image').onclick = () => showImage((index + 1) % thumbnails.length);
    showImage(0);
  }
  card.querySelector('.offer-img').onclick = function () {
    const images = card.querySelector('.images-section');
    images.style.display = images.style.display === 'flex' ? 'none' : 'flex';
    card.querySelector('.details-section').style.display = 'none';
    card.querySelector('.comments-section').style.display = 'none';
  };
  // Comments section
  card.querySelector('.offer-Comments').onclick = function () {
    const comments = card.querySelector('.comments-section');
    comments.style.display = comments.style.display === 'block' ? 'none' : 'block';
    card.querySelector('.details-section').style.display = 'none';
    card.querySelector('.images-section').style.display = 'none';
    comments.querySelector('.submit-comment').onclick = function () {
      const input = comments.querySelector('.comment-input');
      if (!input.value.trim()) return alert('Comment cannot be empty.');
      const newP = document.createElement('p');
      newP.innerHTML = `<strong>Sponsee:</strong> ${input.value} <em>(Now)</em>`;
      comments.querySelector('.existing-comments').appendChild(newP);
      input.value = '';
    };
  };

  return card;
}

// ============= SPONSEE GUEST DEMO LOGIC ======================
function fillSponseeDemo() {
  document.getElementById('user-name').innerText = "Sponsee";
  document.getElementById('user-email').textContent = "demo@creator.com";
  document.getElementById('user-username').textContent = "Sponsee";
  document.getElementById('user-location').textContent = guestLocation;
  document.getElementById('user-gender').textContent = "Content Creator";
  document.getElementById('contenttype').textContent = "YouTube Shorts";
  document.getElementById('about-yourself').innerText = "I make viral shorts and fun sponsored content!";
  document.getElementById('active-sponsorships').innerText = "2";
  document.getElementById('completed-deals').innerText = "5";
  document.getElementById('total-followers').innerText = "22,000";
  document.getElementById('total-earnings').innerText = "$3,200";
  renderStars(document.getElementById('sponsee-average-stars'), 5);
  renderStars(document.getElementById('sponsee-communication-stars'), 5);
  renderStars(document.getElementById('sponsee-punctuality-stars'), 5);
  renderStars(document.getElementById('sponsee-work-output-stars'), 4);

  document.getElementById('social_handles').innerHTML = `<img src="youtubelogo.png" title="YouTube" style="height:22px;vertical-align:middle;"> <span>@Sponsee</span> <img src="instagramlogo.png" title="Instagram" style="height:22px;vertical-align:middle;"> <span>@Sponsee</span>`;
  document.getElementById('linked-accounts').innerHTML = `<img src="youtubelogo.png" title="YouTube" style="height:22px;vertical-align:middle;"> <span>@Sponsee</span> <img src="instagramlogo.png" title="Instagram" style="height:22px;vertical-align:middle;"> <span>@Sponsee</span>`;

  // --- Two demo offers with separate stages ---
  const demoSponseeActiveOffers = [
    {
      id: "offer1",
      offer_title: "Demo Brand Collab",
      offer_description: "Film a 60s product showcase and include #Sponsor.",
      offer_amount: 250,
      offer_images: ["demooffer1.jpg", "demooffer2.jpg"],
      platforms: ["youtube", "instagram"],
      creation_date: "2025-07-30",
      deadline: "2025-08-15",
      job_type: "Short Video",
      deliverable_type: "YouTube Short",
      instructions: "Film a 60s product showcase and include #Sponsor.",
      payment_schedule: "On Completion",
      sponsorship_duration: "2 Weeks",
      audience_country: "AU",
      status: "in_progress",
      sponsor_username: "Acme Demo Co.",
      sponsor_company: "Acme Demo Co.",
      applicants: [
        {
          id: "demo-sponsee",
          sponsee_username: "Sponsee",
          profile_pic: "logos.png",
          status: "accepted",
          application_text: "Excited to work with your brand!"
        }
      ]
    },
    {
      id: "offer2",
      offer_title: "Snack Review TikTok",
      offer_description: "Show our snacks in a 30s TikTok. Use #QuickSnax.",
      offer_amount: 120,
      offer_images: ["demooffer1.jpg"],
      platforms: ["tiktok"],
      creation_date: "2025-07-28",
      deadline: "2025-08-10",
      job_type: "Short Video",
      deliverable_type: "TikTok Clip",
      instructions: "Show our snacks in a 30s TikTok. Use #QuickSnax.",
      payment_schedule: "On Completion",
      sponsorship_duration: "1 Week",
      audience_country: "AU",
      status: "in_progress",
      sponsor_username: "QuickSnax Pty Ltd",
      sponsor_company: "QuickSnax Pty Ltd",
      applicants: [
        {
          id: "demo-sponsee",
          sponsee_username: "Sponsee",
          profile_pic: "logos.png",
          status: "accepted",
          application_text: "Let's do this!"
        }
      ]
    }
  ];

  // ========== RENDER ACTIVE LISTINGS CARDS (MATCHES DASHBOARD LOOK) ==========
  let listing = document.getElementById('sponsee-listing-container');
  listing.innerHTML = '';
  demoSponseeActiveOffers.forEach((offer, idx) => {
    listing.appendChild(renderGuestSponseeActiveOfferCard(offer, idx));
  });

  // Existing demo table logic for other sections
  let activityTable = document.getElementById("activity-table-body");
  if (activityTable) {
    activityTable.innerHTML = `
      <tr><td>SponBrand</td><td>Completed</td><td>$750</td><td>2025-07-12</td><td>2025-07-25</td><td>BrandUser</td><td>✔️</td></tr>
      <tr><td>QuickSnax</td><td>In Progress</td><td>$250</td><td>2025-07-25</td><td>2025-08-02</td><td>SponsorX</td><td></td></tr>
    `;
  }
  let archivedTable = document.getElementById("archived-table-body");
  if (archivedTable) {
    archivedTable.innerHTML = `
      <tr><td>BrandUser</td><td>$900</td><td>2025-06-14</td><td>✔️</td><td>2025-07-03</td><td>★★★★★</td><td>★★★★★</td></tr>
    `;
  }
  document.getElementById('yt-channel-title').innerText = "Demo Creator Channel";
  document.getElementById('yt-channel-desc').innerText = "Your YouTube demo profile. Real stats are available after signup!";
  document.getElementById('yt-subs').innerText = "18,500";
  document.getElementById('yt-views').innerText = "2,500,000";
  document.getElementById('yt-videos').innerText = "126";
  document.getElementById('yt-created').innerText = "2022-05-12";
  renderGuestSponseePublicOffers();
}


// ================= HANDLE SIGNUP MODAL BUTTONS =====================
window.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('#guest-signup-modal .btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if(this.textContent.includes('Sign Up')) {
        window.location.href = 'signup.html';
      } else {
        hideGuestSignupModal();
      }
    });
  });
});

// =============== DISABLE ACTION BUTTONS IN GUEST MODE ===============
function disableAllRealActions() {
  let disableIds = [
    'privacy-export-btn', 'privacy-delete-btn', 'generate-invoices-btn',
    'change-profile-logo-btn', 'edit-profile-description-btn', 'relink-social-btn',
    'oauth-link-btn', 'show-referral-link-btn', 'show-subscription-modal-btn'
  ];
  disableIds.forEach(id => {
    document.querySelectorAll(`#${id}`).forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        showGuestSignupModal("Available after signup!");
      };
    });
  });
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = function() {
      btn.closest('.modal').style.display = 'none';
    };
  });
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if(e.target === m) m.style.display = 'none';
  }));
}
window.addEventListener('DOMContentLoaded', disableAllRealActions);

// ============== CLOSEABLE MODALS LOGIC ================
window.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = function() {
      btn.closest('.modal').style.display = 'none';
    }
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if(e.target === modal) modal.style.display = 'none';
    });
  });
});

