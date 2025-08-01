// /public/js/settings.js

import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';
import { famBotModerateWithModal } from './FamBot.js';

document.addEventListener('DOMContentLoaded', async () => {
  // --- User & Vars ---
  let currentUser = await getActiveUser();
  if (!currentUser) return;

  // --- Settings Dropdown ---
  const settingsCogBtn = document.getElementById('settings-cog-btn');
  const settingsDropdown = document.getElementById('settings-dropdown');
  if (settingsCogBtn && settingsDropdown) {
    settingsCogBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsDropdown.style.display = (settingsDropdown.style.display === 'block') ? 'none' : 'block';
    });
    document.addEventListener('click', () => settingsDropdown.style.display = 'none');
    settingsDropdown.addEventListener('click', (e) => e.stopPropagation());
  }

 // === HELP BLOCKS SLIDER ===
const helpBlocksToggle = document.getElementById('toggle-help-slider');

async function loadHelpBlocksSetting() {
  let user = await getActiveUser();
  if (!user) return;
  const { data } = await supabase
    .from('user_settings')
    .select('hide_help_blocks')
    .eq('user_id', user.user_id)
    .single();
  // hide_help_blocks: true means HIDE, so slider OFF means "hidden"
  helpBlocksToggle.checked = !(data && data.hide_help_blocks); // checked = SHOW
  updateHelpBlocksVisibility();
}
function updateHelpBlocksVisibility() {
  document.querySelectorAll('.help-block').forEach(el => {
    el.style.display = helpBlocksToggle.checked ? '' : 'none';
  });
}
if (helpBlocksToggle) {
  helpBlocksToggle.addEventListener('change', async () => {
    let user = await getActiveUser();
    if (!user) return;
    // Save "hide_help_blocks" as the REVERSE of the switch
    const hideHelp = !helpBlocksToggle.checked;
    await supabase
      .from('user_settings')
      .upsert({ user_id: user.user_id, hide_help_blocks: hideHelp }, { onConflict: ['user_id'] });
    updateHelpBlocksVisibility();
    // Feedback effect
    helpBlocksToggle.parentElement.querySelector('.slider').style.boxShadow = '0 0 0 2px #36a2eb';
    setTimeout(() => helpBlocksToggle.parentElement.querySelector('.slider').style.boxShadow = '', 600);
  });
  loadHelpBlocksSetting();
}

// === ONBOARDING SLIDER ===
const onboardingToggle = document.getElementById('toggle-onboarding-slider');
async function loadOnboardingSetting() {
  let user = await getActiveUser();
  if (!user) return;
  // If onboarded is TRUE, user wants onboarding HIDDEN, so switch OFF
  onboardingToggle.checked = !(user.onboarded === true); // checked = SHOW
}
if (onboardingToggle) {
  onboardingToggle.addEventListener('change', async () => {
    let user = await getActiveUser();
    if (!user) return;
    // "onboarded" true means hide, so set to REVERSE of checked
    const onboarded = !onboardingToggle.checked;
    await supabase
      .from('users_extended_data')
      .update({ onboarded })
      .eq('user_id', user.user_id);
    onboardingToggle.parentElement.querySelector('.slider').style.boxShadow = '0 0 0 2px #36a2eb';
    setTimeout(() => onboardingToggle.parentElement.querySelector('.slider').style.boxShadow = '', 600);
  });
  loadOnboardingSetting();
}

  // --- Modal Open/Close helpers ---
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'block';
  }
  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  }
  // Modal close by X
  document.getElementById('close-profile-logo-modal')?.addEventListener('click', () => closeModal('profile-logo-modal'));
  document.getElementById('close-profile-desc-modal')?.addEventListener('click', () => closeModal('profile-desc-modal'));
  document.getElementById('close-social-modal')?.addEventListener('click', () => closeModal('social-modal'));

  // --- Profile Logo Modal (Drag and Drop or Click) ---
  const profileLogoBtn = document.getElementById('change-profile-logo-btn');
  const logoForm = document.getElementById('profile-logo-form');
  const dropZone = document.getElementById('drop-zone');
  const logoInput = document.getElementById('profile-logo-input');
  const logoMsg = document.getElementById('profile-logo-modal-msg');
  if (profileLogoBtn) {
    profileLogoBtn.onclick = () => {
      openModal('profile-logo-modal');
      if (settingsDropdown) settingsDropdown.style.display = 'none';
      if (logoMsg) logoMsg.textContent = '';
      document.getElementById('drop-zone-text').textContent = 'Click or Drag & Drop image here';
    };
  }
  if (dropZone && logoInput) {
    dropZone.addEventListener('click', () => logoInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = '#3100d2'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#36a2eb'; });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.style.borderColor = '#36a2eb';
      if (e.dataTransfer.files.length) logoInput.files = e.dataTransfer.files;
      document.getElementById('drop-zone-text').textContent = e.dataTransfer.files[0].name;
    });
    logoInput.addEventListener('change', () => {
      if (logoInput.files[0]) document.getElementById('drop-zone-text').textContent = logoInput.files[0].name;
    });
  }
  if (logoForm) {
    logoForm.onsubmit = async (e) => {
      e.preventDefault();
      if (!logoInput.files || !logoInput.files[0]) {
        if (logoMsg) logoMsg.textContent = 'Select an image!';
        return;
      }
      const file = logoInput.files[0];
      currentUser = await getActiveUser();
      const ext = file.name.split('.').pop();
      const fileName = `logo_${currentUser.user_id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true, cacheControl: '3600' });
      if (uploadError) { logoMsg.textContent = 'Upload error: ' + uploadError.message; return; }
      await supabase.from('users_extended_data').update({ profile_pic: fileName }).eq('user_id', currentUser.user_id);
      logoMsg.textContent = "Logo updated! Reload page to see change.";
    };
  }

  // --- Profile Description Modal ---
  const editProfileDescBtn = document.getElementById('edit-profile-description-btn');
  const descTextarea = document.getElementById('profile-desc-textarea');
  const saveDescBtn = document.getElementById('save-profile-desc-btn');
  const descMsg = document.getElementById('profile-desc-modal-msg');
  if (editProfileDescBtn) {
    editProfileDescBtn.onclick = async () => {
      openModal('profile-desc-modal');
      if (settingsDropdown) settingsDropdown.style.display = 'none';
      currentUser = await getActiveUser();
      if (descTextarea && currentUser) descTextarea.value = currentUser.about_yourself || '';
      if (descMsg) descMsg.innerText = '';
    };
  }
  if (saveDescBtn && descTextarea) {
    saveDescBtn.onclick = async () => {
      if (!descTextarea.value.trim()) {
        if (descMsg) descMsg.textContent = "Description cannot be empty.";
        return;
      }
      // --- FAMBOT moderation before save ---
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;
      const jwt = session?.access_token;
      const famRes = await famBotModerateWithModal({
        user_id,
        content: descTextarea.value.trim(),
        jwt,
        type: 'profile'
      });
      if (!famRes.allowed) return;

      currentUser = await getActiveUser();
      const { error } = await supabase.from('users_extended_data')
        .update({ about_yourself: descTextarea.value.trim() })
        .eq('user_id', currentUser.user_id);
      if (descMsg) descMsg.textContent = error ? "Error saving." : "Description updated!";
    };
  }

  // --- Relink Social Media Handles (Dynamic, Add/Remove/Update) ---
  const relinkSocialBtn = document.getElementById('relink-social-btn');
  const platformSelect = document.getElementById('platform-select');
  const platformInput = document.getElementById('platform-handle-input');
  const addPlatformBtn = document.getElementById('add-platform-btn');
  const socialForm = document.getElementById('social-form');
  const socialMsg = document.getElementById('social-modal-msg');
  const currentList = document.getElementById('current-social-list');
  let socials = {};

  async function loadSocials() {
    currentUser = await getActiveUser();
    try {
      if (typeof currentUser.social_handles === 'string') {
        socials = JSON.parse(currentUser.social_handles);
      } else if (typeof currentUser.social_handles === 'object' && currentUser.social_handles) {
        socials = currentUser.social_handles;
      } else socials = {};
    } catch { socials = {}; }
    renderSocialList();
  }
  function renderSocialList() {
    if (!currentList) return;
    currentList.innerHTML = Object.keys(socials).length === 0
      ? '<em>No platforms linked yet.</em>'
      : Object.entries(socials).map(([plat, handle]) =>
        `<span style="display:inline-block;background:#eef;border-radius:8px;padding:4px 10px;margin:0 4px 6px 0;font-size:0.98em;">
          <b>${plat[0].toUpperCase() + plat.slice(1)}:</b> ${handle}
          <button type="button" class="remove-social-btn" data-plat="${plat}" style="margin-left:6px;font-size:0.95em;color:#3100d2;background:none;border:none;cursor:pointer;">×</button>
        </span>`).join('');
    // Add remove handlers
    currentList.querySelectorAll('.remove-social-btn').forEach(btn => {
      btn.onclick = e => {
        const plat = btn.getAttribute('data-plat');
        delete socials[plat];
        renderSocialList();
      };
    });
  }
  if (addPlatformBtn && platformSelect && platformInput) {
    addPlatformBtn.onclick = async () => {
      const plat = platformSelect.value;
      const handle = platformInput.value.trim();
      if (!plat || !handle) { socialMsg.textContent = "Choose a platform and enter a handle."; return; }
      // --- FAMBOT moderation for new handle ---
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;
      const jwt = session?.access_token;
      const famRes = await famBotModerateWithModal({
        user_id,
        content: handle,
        jwt,
        type: 'social_handle'
      });
      if (!famRes.allowed) return;

      socials[plat] = handle;
      renderSocialList();
      platformSelect.selectedIndex = 0;
      platformInput.value = '';
      socialMsg.textContent = '';
    };
  }
  if (socialForm) {
    socialForm.onsubmit = async e => {
      e.preventDefault();
      currentUser = await getActiveUser();
      const { error } = await supabase.from('users_extended_data')
        .update({ social_handles: JSON.stringify(socials) })
        .eq('user_id', currentUser.user_id);
      if (socialMsg) socialMsg.textContent = error ? "Error saving." : "Social media updated!";
    };
  }
  if (relinkSocialBtn) {
    relinkSocialBtn.onclick = async () => {
      openModal('social-modal');
      if (settingsDropdown) settingsDropdown.style.display = 'none';
      if (socialMsg) socialMsg.textContent = '';
      await loadSocials();
    };
  }

// --- Referral Link Modal Logic ---
document.getElementById('show-referral-link-btn')?.addEventListener('click', async () => {
  const modal = document.getElementById('referral-link-modal');
  const input = document.getElementById('my-ref-link');
  const copyBtn = document.getElementById('copy-ref-link-btn');
  const copiedMsg = document.getElementById('ref-link-copied-msg');

  if (modal) modal.style.display = 'flex';
  if (input) input.value = 'Loading...';
  if (copiedMsg) copiedMsg.style.display = 'none';

  // Fetch or create referral link
  let user = await getActiveUser();
  if (!user || !user.user_id || !user.username) {
    if (input) input.value = "Could not load your referral link.";
    return;
  }
  // Check for existing code
  let { data: link, error } = await supabase
    .from('referral_links')
    .select('code')
    .eq('user_id', user.user_id)
    .single();
  if (!link || error) {
    // Generate a new code
    const code = `${user.username}-${user.user_id.slice(0,8)}`.replace(/[^a-zA-Z0-9_-]/g, '');
    const { data: created, error: insertErr } = await supabase
      .from('referral_links')
      .insert([{ user_id: user.user_id, code }])
      .select()
      .maybeSingle();
    if (insertErr) {
      if (input) input.value = "Could not create referral link.";
      return;
    }
    link = created;
  }
// Always use the same folder as settings/dashboard page for signup page
const currentPath = window.location.pathname;
const folder = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
const refUrl = `${window.location.origin}${folder}signup.html?ref=${encodeURIComponent(link.code)}`;
  if (input) input.value = refUrl;

  copyBtn.onclick = () => {
    input.select();
    document.execCommand('copy');
    if (copiedMsg) copiedMsg.style.display = 'block';
  };

 // --- Referral Medal Logic: Query count, percentile, and display badge ---
(async function showReferralMedal() {
  const medalDiv = document.getElementById('referral-medal-info');
  if (medalDiv) medalDiv.innerHTML = 'Loading medal...';

  // 1. Fetch all relevant referral reward rows (exclude self-refer and nulls)
  let { data: allRewards, error: allErr } = await supabase
    .from('referral_rewards')
    .select('referrer_id, reward_for')
    .not('referrer_id', 'is', null);

  if (allErr || !allRewards) {
    if (medalDiv) medalDiv.innerHTML = '<span style="color:red;">Error loading referral data.</span>';
    return;
  }

  // 2. Only count rows where referrer_id != reward_for (ignore self-refer and count only true successful referrals)
  const filtered = allRewards.filter(r => r.referrer_id && r.reward_for && r.referrer_id !== r.reward_for);

  // 3. Tally successful referrals for every user
  const referralMap = {};
  filtered.forEach(row => {
    referralMap[row.referrer_id] = (referralMap[row.referrer_id] || 0) + 1;
  });

  // 4. This user's count
  const myCount = referralMap[user.user_id] || 0;

  // 5. Calculate percentile
const allCounts = Object.values(referralMap);
allCounts.sort((a, b) => a - b);

let myPercentile = 0;
if (allCounts.length > 0 && myCount > 0) {
  const lessThan = allCounts.filter(c => c < myCount).length;
  myPercentile = lessThan / allCounts.length;
}
// Award Gold if you are the only referrer
if (allCounts.length === 1 && myCount > 0) {
  myPercentile = 1;
}


  // 6. Assign medal by percentile
  let medal = '', medalHtml = '';
  if (myPercentile >= 0.9) {
    medal = 'Gold';
    medalHtml = `<span style="color:#FFD700;font-size:1.23em;">🥇 Gold Referrer</span>`;
  } else if (myPercentile >= 0.7) {
    medal = 'Silver';
    medalHtml = `<span style="color:#C0C0C0;font-size:1.23em;">🥈 Silver Referrer</span>`;
  } else if (myPercentile >= 0.5) {
    medal = 'Bronze';
    medalHtml = `<span style="color:#CD7F32;font-size:1.23em;">🥉 Bronze Referrer</span>`;
  }

  // 7. Output in modal (with styling)
  if (medalDiv) {
    medalDiv.innerHTML = `
      <div style="margin-top:13px;font-size:1.13em;color:black;">
        <b>Your Successful Referrals:</b> <span style="color:#36a2eb;font-weight:600;">${myCount}</span>
        <br>
        ${
          medal 
          ? `<span style="margin-top:5px;display:inline-block;">${medalHtml}</span>`
          : `<span style="color:#999;">Refer more people to receive a medal!</span>`
        }
      </div>
      <div style="font-size:0.97em;color:#bbb;margin-top:5px;">
        (Gold = Top 10%, Silver = Top 30%, Bronze = Top 50% of referrers)
      </div>
    `;
  }
})();

});
// --- Subscription & Free Month Rewards Modal Logic ---
document.getElementById('show-subscription-modal-btn')?.addEventListener('click', async () => {
  const modal = document.getElementById('subscription-modal');
  const detailsDiv = document.getElementById('subscription-details');
  if (modal) modal.style.display = 'flex';
  if (detailsDiv) detailsDiv.innerHTML = '<div style="text-align:center;color:#bbb;">Loading your subscription info...</div>';

  let user = await getActiveUser();
  if (!user || !user.user_id) {
    if (detailsDiv) detailsDiv.innerHTML = '<span style="color:red;">Could not load your details. Please try again later.</span>';
    return;
  }

  // (Inside your settings.js - inside the event listener for 'show-subscription-modal-btn')

let stripeBlock = '';
let subDetailsBlock = '';
let manageLink = '';

if (user.stripe_customer_id) {
  manageLink = `
    <a href="https://dashboard.stripe.com/test/customers/${user.stripe_customer_id}" 
      target="_blank" 
      style="display:inline-block;margin-top:5px;margin-left:4px;background:#36a2eb;color:#fff;padding:5px 14px;border-radius:10px;text-decoration:none;font-size:1em;">
      Manage Subscription
    </a>`;

  // Try to get their current subscription status via a backend function
try {
  const jwt = (await supabase.auth.getSession()).data.session?.access_token;
  const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/stripe_subscription_info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({ customer_id: user.stripe_customer_id })
  });
  if (resp.ok) {
    const data = await resp.json();
    if (data.subscription) {
      // --- Replace ONLY this section with the improved logic ---
      const sub = data.subscription;
      console.log("Stripe discount object:", sub.discount);

      // Plan name
      let planName = sub.plan?.nickname || sub.plan?.id || "N/A";
      // Period: use JS Date for proper formatting
      let periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;
      let periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
       // -------------- ADD THIS FOR NEXT MONTH FREE DISPLAY --------------
  let freeMonthMsg = "";
  let debugDiscountBlock = '';
if (sub.discount) {
  debugDiscountBlock = `
    <div style="font-size:0.9em; background:#222; color:#ffd700; padding:2px 5px; border-radius:6px;">
      Discount Debug: ${JSON.stringify(sub.discount)}
    </div>
  `;
}

  if (sub.discount && (sub.discount.id === "1MonthFreeSS2025" || (sub.discount.name && sub.discount.name.includes("free month")))) {
    freeMonthMsg = `
      <div style="margin-bottom:7px;font-size:1.04em;color:#ffd700;">
        <b>Next Month: </b> <span style="color:#32e232;">FREE (Referral Applied)</span>
      </div>
    `;
  }
      // Discount text
      let couponText = "";
      if (sub.discount?.percent_off) couponText = ` <span style="color:#ffd700;">(${sub.discount.percent_off}% off)</span>`;
      if (sub.discount?.amount_off) couponText = ` <span style="color:#ffd700;">($${(sub.discount.amount_off/100).toFixed(2)} off)</span>`;
      subDetailsBlock = `
  ${freeMonthMsg}
  <div style="margin-bottom:7px;font-size:1em;color:white;">
    <b>Status:</b> ${sub.status}
    <span style="margin-left:18px;"><b>Renews:</b> ${periodEnd ? periodEnd.toLocaleDateString() : "N/A"}</span>
  </div>
  <div style="margin-bottom:7px;font-size:1em;">
    <b>Plan:</b> <span style="color:#36a2eb;">${planName}${couponText}</span>
  </div>
  <div style="margin-bottom:7px;font-size:0.99em;color:#bbb;">
    <b>Period:</b>
    ${periodStart ? periodStart.toLocaleDateString() : "N/A"}
    &rarr;
    ${periodEnd ? periodEnd.toLocaleDateString() : "N/A"}
  </div>
`;

}
 else {
        subDetailsBlock = `<div style="color:#f88;font-size:1em;">No active subscription found.</div>`;
      }
    } else {
      subDetailsBlock = `<div style="color:#e93;font-size:1em;">Could not load subscription details.</div>`;
    }
  } catch (err) {
    subDetailsBlock = `<div style="color:#e93;font-size:1em;">Error loading subscription info.</div>`;
  }
  stripeBlock = `
    <div style="margin-bottom:16px;display:flex;align-items:center;">
      <span style="font-size:0.98em;margin-right:8px;color:white">Your Stripe Customer ID:</span>
      <span style="background:#222;color:#eee;font-family:monospace;padding:2.5px 12px 2.5px 12px;border-radius:14px;font-size:0.99em;letter-spacing:.01em;">
        ${user.stripe_customer_id}
      </span>
      ${manageLink}
    </div>
    ${subDetailsBlock}
  `;
} else {
  stripeBlock = `<div style="margin-bottom:14px;font-size:1em;color:#888;">No linked Stripe subscription found.</div>`;
}

  // Query only rewards for this user
  let freeMonthBlock = '';
  let { data: rewardRows, error: rewardsErr } = await supabase
    .from('referral_rewards')
    .select('id, reward_type, claimed, granted_at')
    .eq('reward_for', user.user_id)
    .order('granted_at', { ascending: false });

  if (rewardsErr) {
    freeMonthBlock = `<div style="color:red;font-size:1em;">Error loading reward info.</div>`;
  } else if (rewardRows && rewardRows.length > 0) {
    freeMonthBlock = rewardRows.map(r => `
      <div style="
        margin-bottom:16px;
        background:black;
        border-radius:13px;
        box-shadow:0 1px 4px #0001;
        padding:17px 16px 11px 16px;
        border:1px solid #eee;
      ">
        <div style="font-size:1.1em;margin-bottom:2px;">
          <b>Type:</b>
          <span style="color:#dfba03;">${r.reward_type.replace('_',' ')}</span>
          <span style="margin-left:16px;color:${r.claimed ? '#31c634' : '#ff9900'};">
            ${r.claimed ? 'Claimed' : 'Available!'}
          </span>
        </div>
        ${!r.claimed ? `
          <button class="claim-reward-btn" data-reward-id="${r.id}" style="margin-top:5px;padding:6px 16px;font-size:1em;border-radius:8px;background:#ffd062;color:#222;border:none;cursor:pointer;box-shadow:0 2px 8px #ffd06270;">Claim Free Month</button>
        ` : ''}
        <div style="color:#888;font-size:0.99em;margin-top:9px;">
          Granted: ${new Date(r.granted_at).toLocaleDateString()} ${new Date(r.granted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    `).join('');
  } else {
    freeMonthBlock = `
      <div style="margin-top:13px;font-size:1.01em;color:#888;">
        You have no free month rewards yet.<br>
        <span style="font-size:0.98em;">Invite friends with your referral link to earn one!</span>
      </div>
    `;
  }

  detailsDiv.innerHTML = `
    <div style="margin-bottom:4px;">${stripeBlock}</div>
    <hr style="margin:10px 0 18px 0;">
    <div>${freeMonthBlock}</div>
  `;

  // --- Add claim button logic ---
  document.querySelectorAll('.claim-reward-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      btn.disabled = true;
      btn.innerText = "Claiming...";
      const rewardId = btn.getAttribute('data-reward-id');
      // Get the current user ID and JWT from session
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const jwt = session?.access_token;

      if (!userId || !jwt) {
        btn.innerText = "Auth Failed";
        btn.style.background = "#e22";
        setTimeout(() => { btn.innerText = "Claim Free Month"; btn.style.background = "#ffd062"; btn.disabled = false; }, 1600);
        return;
      }

      try {
        const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/claim_free_month', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({
            reward_id: rewardId,
            user_id: userId
          })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          btn.innerText = "Failed! Try Again";
          btn.style.background = "#e22";
          setTimeout(() => { btn.innerText = "Claim Free Month"; btn.style.background = "#ffd062"; btn.disabled = false; }, 1600);
        } else {
          btn.innerText = "Claimed!";
          btn.style.background = "#31c634";
          btn.style.color = "#fff";
          btn.disabled = true;
          setTimeout(() => {
            modal.style.display = 'none';
          }, 1200);
        }
      } catch (err) {
        btn.innerText = "Failed! Try Again";
        btn.style.background = "#e22";
        setTimeout(() => { btn.innerText = "Claim Free Month"; btn.style.background = "#ffd062"; btn.disabled = false; }, 1600);
      }
    });
  });
});

// --- YouTube OAuth Modal ---
const connectYouTubeBtn = document.getElementById('connect-youtube-btn');
const oauthModal = document.getElementById('youtube-oauth-modal');
const oauthMsg = document.getElementById('youtube-oauth-modal-msg');
const oauthCloseBtn = document.getElementById('close-youtube-oauth-modal');

if (connectYouTubeBtn && oauthModal && oauthCloseBtn) {
  connectYouTubeBtn.onclick = async () => {
    oauthMsg.innerHTML = 'Connecting...';
    oauthModal.style.display = 'block';

    // Build Google OAuth URL (replace CLIENT_ID and REDIRECT_URI below if needed)
    const params = new URLSearchParams({
      client_id: '198536620935-fq5dch116tc0dc11v81bbt720m5f0216.apps.googleusercontent.com',
      redirect_uri: window.location.origin + '/public/oauth2callback.html', // Or /Demo/oauth2callback.html if on GitHub Pages
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.readonly openid email profile',
      access_type: 'offline',
      prompt: 'consent'
    });

    // In case you're on /Demo/ folder (GitHub Pages), auto-adjust the redirect URI:
    if (window.location.pathname.includes('/Demo/')) {
      params.set('redirect_uri', window.location.origin + '/Demo/oauth2callback.html');
    }

    // Open the OAuth URL in a new tab/window
    window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, '_blank');
    oauthMsg.innerHTML = 'A new tab has opened. Please finish connecting your YouTube account there.<br>After approving, return here!';
  };

  // Close modal by X or button
  oauthCloseBtn.onclick = () => {
    oauthModal.style.display = 'none';
  };
}

// Also allow click outside modal to close
oauthModal?.addEventListener('mousedown', (e) => {
  if (e.target === oauthModal) oauthModal.style.display = 'none';
});

// --- Listen for OAuth popup success ---
// Place this right after your YouTube OAuth modal logic

window.addEventListener('message', async (event) => {
  // Allow all origins here for local/dev, restrict to your domains in prod if needed
  if (event.data && event.data.youtubeConnected === true) {
    // Show a notification
    showYouTubeSuccessNotification();

    // Optional: refresh the user's data from Supabase to get new youtube_connected status
    currentUser = await getActiveUser(true); // Use true if your getActiveUser supports force refresh

    // If you have a UI element that shows the YouTube link status, update it here
    updateYouTubeStatusUI?.(true);

    // Hide the modal if it's still open
    const oauthModal = document.getElementById('youtube-oauth-modal');
    if (oauthModal) oauthModal.style.display = 'none';
  }
});

// --- Show success notification for YouTube linking ---
function showYouTubeSuccessNotification() {
  // You can use any notification system you want. Here’s a simple banner implementation:
  let notif = document.createElement('div');
  notif.id = 'youtube-link-success';
  notif.style.cssText = `
    position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
    z-index: 9999; background: #22b34c; color: #fff; font-size: 1.1em;
    padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
    border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
  `;
  notif.innerHTML = `✅ YouTube account successfully linked!`;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.remove();
  }, 3500);
}

// Optional: helper to update YouTube UI status if you display a "YouTube Connected" badge
function updateYouTubeStatusUI(connected) {
  const badge = document.getElementById('youtube-status-badge');
  const connectBtn = document.getElementById('connect-youtube-btn');
  if (badge) {
    badge.innerText = connected ? "YouTube Linked" : "Not linked";
    badge.style.color = connected ? "#21d32e" : "#888";
  }
  if (connectBtn) {
    connectBtn.disabled = !!connected;
    connectBtn.style.opacity = connected ? 0.5 : 1;
    connectBtn.innerText = connected ? "YouTube Linked" : "Connect YouTube";
  }
}

// --- Unified OAuth Modal Logic ---
const oauthLinkBtn = document.getElementById('oauth-link-btn');
const oauthLinkModal = document.getElementById('oauth-link-modal');
const oauthAccountsList = document.getElementById('oauth-accounts-list');
const closeOauthLinkModalBtn = document.getElementById('close-oauth-link-modal');

const supportedPlatforms = [
  {
    key: "youtube",
    name: "YouTube",
    logo: "youtubelogo.png",
    badgeId: "youtube-status-badge"
  },
  {
    key: "instagram",
    name: "Instagram",
    logo: "instagramlogo.png",
    badgeId: "instagram-status-badge"
  },
  {
    key: "tiktok",
    name: "TikTok",
    logo: "tiktoklogo.png",
    badgeId: "tiktok-status-badge"
  },
  {
    key: "twitter",
    name: "X (Twitter)",
    logo: "twitterlogo.png", // Use xlogo.png or twitterlogo.png
    badgeId: "twitter-status-badge"
  },
  {
    key: "facebook",
    name: "Facebook",
    logo: "facebooklogo.png",
    badgeId: "facebook-status-badge"
  },
  {
    key: "twitch",
    name: "Twitch",
    logo: "twitchlogo.png",
    badgeId: "twitch-status-badge"
  },
   // Add more platforms here as needed
];


async function refreshOauthAccountsUI() {
  let user = await getActiveUser(true); // Get latest user data
  let html = supportedPlatforms.map(p => {
    let connected = user[`${p.key}_connected`] === true;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;align-items:center;">
          <img src="${p.logo}" alt="${p.name}" style="height:32px;width:32px;border-radius:8px;margin-right:14px;">
          <span style="font-size:1.12em;font-weight:700;">${p.name}</span>
        </div>
        <span id="${p.badgeId}" style="margin-right:12px;color:${connected ? "#21d32e" : "#888"};">
          ${connected ? "Linked" : "Not linked"}
        </span>
        <button 
          class="oauth-connect-btn" 
          data-platform="${p.key}"
          style="background:${connected ? "#f55" : "#2d7bfa"};color:#fff;font-weight:600;border:none;padding:6px 18px;border-radius:8px;cursor:pointer;"
        >
          ${connected ? "Disconnect" : "Connect"}
        </button>
      </div>
    `;
  }).join('');
  oauthAccountsList.innerHTML = html;

  // Connect/disconnect logic
  document.querySelectorAll('.oauth-connect-btn').forEach(btn => {
    btn.onclick = async () => {
      const plat = btn.getAttribute('data-platform');
      if (plat === "youtube") {
        let user = await getActiveUser(true);
        if (user.youtube_connected) {
          // --- DISCONNECT YOUTUBE ---
          btn.innerText = "Disconnecting...";
          btn.disabled = true;
          // Wipe tokens in DB
          const { error } = await supabase
            .from("users_extended_data")
            .update({
              youtube_refresh_token: null,
              youtube_access_token: null,
              youtube_token_expiry: null,
              youtube_connected: false
            })
            .eq("user_id", user.user_id);
          if (!error) {
            btn.innerText = "Connect";
            btn.style.background = "#2d7bfa";
            document.getElementById('youtube-status-badge').innerText = "Not linked";
            document.getElementById('youtube-status-badge').style.color = "#888";
            showYouTubeDisconnectedNotification();
            await refreshOauthAccountsUI();
          } else {
            btn.innerText = "Failed!";
            btn.style.background = "#e22";
            setTimeout(() => { btn.innerText = "Disconnect"; btn.style.background = "#f55"; btn.disabled = false; }, 1200);
          }
        } else {
          // --- CONNECT YOUTUBE ---
          // Trigger existing OAuth modal flow
          oauthModal.style.display = 'block';
          oauthMsg.innerHTML = 'Connecting...';
          connectYouTubeBtn.click();
          oauthLinkModal.style.display = "none";
        }
      }
      // Future: add logic for other platforms
      else if (plat === "instagram") {
      if (user.instagram_connected) {
        // Disconnect Instagram (implement this logic in Supabase)
      } else {
        // Connect Instagram (open OAuth flow)
        alert("Instagram OAuth coming soon!");
      }
    } else if (plat === "tiktok") {
      if (user.tiktok_connected) {
        // Disconnect TikTok
      } else {
        // Connect TikTok (open OAuth flow)
        alert("TikTok OAuth coming soon!");
      }
    } else if (plat === "twitter") {
      if (user.twitter_connected) {
        // Disconnect X (Twitter)
      } else {
        // Connect X (Twitter)
        alert("X (Twitter) OAuth coming soon!");
      }
    } else if (plat === "facebook") {
      if (user.facebook_connected) {
        // Disconnect Facebook
      } else {
        // Connect Facebook
        alert("Facebook OAuth coming soon!");
      }
    } else if (plat === "twitch") {
      if (user.twitch_connected) {
        // Disconnect Twitch
      } else {
        // Connect Twitch
        alert("Twitch OAuth coming soon!");
      }
    } else if (plat === "kick") {
      if (user.kick_connected) {
        // Disconnect Kick
      } else {
        // Connect Kick
        alert("Kick OAuth coming soon!");
      }
    }
    // Add more as needed
    };
  });
}

if (oauthLinkBtn && oauthLinkModal && closeOauthLinkModalBtn) {
  oauthLinkBtn.onclick = async () => {
    await refreshOauthAccountsUI();
    oauthLinkModal.style.display = "flex";
  };
  closeOauthLinkModalBtn.onclick = () => oauthLinkModal.style.display = "none";
  oauthLinkModal.addEventListener('mousedown', (e) => {
    if (e.target === oauthLinkModal) oauthLinkModal.style.display = "none";
  });
}

// --- Show notification on disconnect
function showYouTubeDisconnectedNotification() {
  let notif = document.createElement('div');
  notif.id = 'youtube-link-disconnect';
  notif.style.cssText = `
    position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
    z-index: 9999;color:black; background: #f53838; font-size: 1.1em;
    padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
    border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
  `;
  notif.innerHTML = `⛔ YouTube account disconnected.`;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.remove();
  }, 3200);
}



// Modal close handlers
document.getElementById('close-subscription-modal')?.addEventListener('click', () => {
  document.getElementById('subscription-modal').style.display = 'none';
});
document.getElementById('subscription-modal')?.addEventListener('mousedown', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

document.getElementById('close-ref-link-modal')?.addEventListener('click', () => {
  document.getElementById('referral-link-modal').style.display = 'none';
});

// Also allow clicking outside modal to close
document.getElementById('referral-link-modal')?.addEventListener('mousedown', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});


  // --- Close modals on outside click ---
  document.addEventListener('mousedown', (e) => {
    ['profile-logo-modal', 'profile-desc-modal', 'social-modal'].forEach(id => {
      const modal = document.getElementById(id);
      if (modal && modal.style.display === 'block' && !modal.contains(e.target)) {
        modal.style.display = 'none';
      }
    });
  });
  // === EMAIL ALERTS SLIDER ===
const emailAlertToggle = document.getElementById('email-alert-toggle');

async function loadEmailAlertSetting() {
  let currentUser = await getActiveUser();
  if (!currentUser || !currentUser.user_id) return;
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('alert_email')
    .eq('user_id', currentUser.user_id)
    .single();
  if (!error && data && typeof data.alert_email === "boolean") {
    emailAlertToggle.checked = data.alert_email;
  } else {
    emailAlertToggle.checked = true;
  }
}

if (emailAlertToggle) {
  emailAlertToggle.addEventListener('change', async () => {
    let currentUser = await getActiveUser();
    if (!currentUser || !currentUser.user_id) return;
    const checked = emailAlertToggle.checked;
    const { error } = await supabase
      .from('users_extended_data')
      .update({ alert_email: checked })
      .eq('user_id', currentUser.user_id);
    if (!error) {
      emailAlertToggle.parentElement.querySelector('.slider').style.boxShadow = '0 0 0 2px #36a2eb';
      setTimeout(() => emailAlertToggle.parentElement.querySelector('.slider').style.boxShadow = '', 600);
    } else {
      alert("Failed to update Email Alerts. Please try again.");
      emailAlertToggle.checked = !checked; // revert
    }
  });
  loadEmailAlertSetting();
}

});
