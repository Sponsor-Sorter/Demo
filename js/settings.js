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

  // --- Help Blocks Hide/Show (DB-persisted) ---
  const toggleHelpBtn = document.getElementById('toggle-help-blocks-btn');
  let helpHidden = false;

  async function loadHelpSetting() {
    const user = await getActiveUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_settings')
      .select('hide_help_blocks')
      .eq('user_id', user.user_id)
      .single();
    helpHidden = !!(data && data.hide_help_blocks);
    updateHelpBlocksVisibility();
  }
  async function saveHelpSetting(val) {
    const user = await getActiveUser();
    if (!user) return;
    await supabase
      .from('user_settings')
      .upsert({ user_id: user.user_id, hide_help_blocks: val }, { onConflict: ['user_id'] });
  }
  function updateHelpBlocksVisibility() {
    document.querySelectorAll('.help-block').forEach(el => {
      el.style.display = helpHidden ? 'none' : '';
    });
    if (toggleHelpBtn) toggleHelpBtn.innerText = helpHidden ? 'Show All Help Blocks' : 'Hide All Help Blocks';
  }
  if (toggleHelpBtn) {
    toggleHelpBtn.addEventListener('click', async () => {
      helpHidden = !helpHidden;
      updateHelpBlocksVisibility();
      await saveHelpSetting(helpHidden);
    });
  }
  await loadHelpSetting();

  // --- Onboarding Show/Hide Toggle (DB-persisted) ---
  const toggleOnboardingBtn = document.getElementById('toggle-onboarding-btn');
  let onboardingHidden = false;

  async function loadOnboardingSetting() {
    currentUser = await getActiveUser();
    if (!currentUser) return;
    onboardingHidden = !!currentUser.onboarded;
    updateOnboardingToggleUI();
  }
  async function saveOnboardingSetting(val) {
    currentUser = await getActiveUser();
    if (!currentUser) return;
    await supabase
      .from('users_extended_data')
      .update({ onboarded: val })
      .eq('user_id', currentUser.user_id);
  }
  function updateOnboardingToggleUI() {
    if (toggleOnboardingBtn)
      toggleOnboardingBtn.innerText = onboardingHidden ? 'Show Guided Onboarding' : 'Hide Guided Onboarding';
  }
  if (toggleOnboardingBtn) {
    toggleOnboardingBtn.addEventListener('click', async () => {
      onboardingHidden = !onboardingHidden;
      updateOnboardingToggleUI();
      await saveOnboardingSetting(onboardingHidden);
    });
  }
  await loadOnboardingSetting();

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
});
