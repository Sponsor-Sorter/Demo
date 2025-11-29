// File: ./js/settings.js

import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';
import { famBotModerateWithModal } from './FamBot.js';

document.addEventListener('DOMContentLoaded', async () => {

  async function requireAuthOrToast() {
  const { data: { session} } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #f53838; color: #fff; font-size: 1.05em;
      padding: 10px 16px; border-radius: 10px; box-shadow: 0 3px 22px #2222;
    `;
    el.textContent = 'Please sign in to link or disconnect platforms.';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
    return false;
  }
  return true;
}



  // Remove a platform string from users_extended_data.platforms[]
async function removePlatformFromArray(userId, platformKey) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('id, platforms')
    .eq('user_id', userId)
    .single();
  if (error || !data) return false;
  const arr = Array.isArray(data.platforms) ? data.platforms : [];
  const filtered = arr.filter(p => (p || '').toLowerCase() != String(platformKey).toLowerCase());
  if (filtered.length == arr.length) return true;
  const { error: updErr } = await supabase
    .from('users_extended_data')
    .update({ platforms: filtered })
    .eq('id', data.id);
  return !updErr;
}



  // === Edge Function helper: revoke_platforms ===
// === Edge Function helper: revoke_platforms (robust URL fallback) ===
const SUPA_FN_BASE =
  (supabase && supabase.functionsUrl) // if your client exposes it
  || 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1'; // your project

async function revokePlatforms(platform, tokenHints = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');

  const url = `${SUPA_FN_BASE}/revoke_platforms`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ platform, ...tokenHints }),
  });

  let json = null;
  try { json = await resp.json(); } catch {}
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error || `HTTP ${resp.status}`);
  }
  return json; // { ok:true, db_updated:boolean, warning?:string }
}



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
    // Stripe Price ID for the Pro monthly subscription (replace with your real ID)
  const PRO_MONTHLY_PRICE_ID = 'price_1RTjwk2eA1800fRNzvisgTuO';

    // Shared Pro upgrade helper so other parts of the app (e.g. Creator Groups)
  // can start the same Stripe checkout flow.
  window.startProUpgradeFlow = async function startProUpgradeFlow(source = 'general') {
    const upgradeBtn = document.getElementById('upgrade-to-pro-btn');
    const originalText = upgradeBtn?.textContent;

    if (upgradeBtn) {
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = 'Redirecting…';
    }

    try {
      const successUrl = new URL(`./payment-success.html?plan=pro&from=${encodeURIComponent(source)}`, location.href).href;
      const cancelUrl  = new URL(`./settings.html?plan=pro_cancel&from=${encodeURIComponent(source)}`, location.href).href;

      const payload = {
        mode: 'subscription',
        price_id: PRO_MONTHLY_PRICE_ID,
        quantity: 1,
        metadata: { product: 'pro_subscription', source },
        success_url: successUrl,
        cancel_url: cancelUrl
      };

      let checkoutUrl;

      // Try Supabase functions.invoke first
      try {
        if (supabase.functions?.invoke) {
          const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: payload });
          if (error) throw error;
          checkoutUrl = data?.url || data?.session_url || data?.checkout_url;
        }
      } catch (err) {
        console.warn('invoke stripe-checkout (pro) failed; falling back to fetch()', err);
      }

      // Fallback: direct fetch to Functions endpoint
      if (!checkoutUrl) {
        const jwt = await prem_getJwt();              // already defined later in settings.js
        const resp = await fetch(`${prem_functionsBase()}/stripe-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
          },
          body: JSON.stringify(payload)
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || 'Checkout create failed');
        checkoutUrl = json?.url || json?.session_url || json?.checkout_url;
      }

      if (!checkoutUrl) throw new Error('No checkout URL returned from stripe-checkout');

      // Send user to Stripe Checkout
      location.href = checkoutUrl;
    } catch (err) {
      console.error('Error starting Pro upgrade checkout:', err);
      if (upgradeBtn) {
        upgradeBtn.disabled = false;
        upgradeBtn.textContent = originalText || 'Upgrade to Pro';
      } else {
        alert('There was a problem starting your Pro upgrade. Please try again.');
      }
    }
  };


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

      const planTypeRaw = user.planType || 'free';
  const isFreePlan = String(planTypeRaw).toLowerCase() === 'free';


    // (Inside your settings.js - inside the event listener for 'show-subscription-modal-btn')

  let stripeBlock = '';
  let subDetailsBlock = '';
  let manageLink = '';
  let planCtaBlock = '';

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
            const sub = data.subscription;

            // Plan name
            let planName = sub.plan?.nickname || sub.plan?.id || "N/A";
            // Period
            let periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;
            let periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

            let freeMonthMsg = "";
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
            if (sub.discount?.amount_off)  couponText = ` <span style="color:#ffd700;">($${(sub.discount.amount_off/100).toFixed(2)} off)</span>`;
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

      // Build plan CTA (Free vs Pro)
  if (isFreePlan) {
    planCtaBlock = `
      <div style="
        margin-top:10px;
        padding:10px 12px;
        border-radius:10px;
        background:#151515;
        border:1px solid #444;
      ">
        <div style="margin-bottom:5px;font-size:1em;">
          <b>Current plan:</b> <span style="color:#ffd700;">Free</span>
        </div>
        <div style="font-size:0.95em;color:#ccc;margin-bottom:10px;">
          Upgrade to <b>Pro</b> to unlock more active offers, more public applications, and more linked platforms.
        </div>
        <button id="upgrade-to-pro-btn" type="button"
          style="background:#2d7bfa;color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:1em;">
          Upgrade to Pro
        </button>
      </div>
    `;
  } else {
    planCtaBlock = `
      <div style="margin-top:10px;font-size:0.96em;color:#9fd89f;">
        <b>Current plan:</b> <span style="color:#31c634;">Pro</span>
      </div>
    `;
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
    ${planCtaBlock}
    <hr style="margin:10px 0 18px 0;">
    <div>${freeMonthBlock}</div>
  `;

   // Upgrade-to-Pro button (Free plan only)
  const upgradeBtn = document.getElementById('upgrade-to-pro-btn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', async () => {
      if (window.startProUpgradeFlow) {
        await window.startProUpgradeFlow('subscription_modal');
      }
    });
  }


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

  function getGoogleRedirectUri() {
    const base = window.location.origin;
    const path = window.location.pathname;

    // GitHub Pages demo
    if (path.includes('/Demo/')) {
      return `${base}/Demo/oauth2callback.html`;
    }

    // Local dev served from VS Code Live Server / static server
    if (base.includes('127.0.0.1:5500') || base.includes('localhost:5500')) {
      return `${base}/public/oauth2callback.html`;
    }

    // Production sponsorsorter.com
    return `${base}/oauth2callback.html`;
  }

  if (connectYouTubeBtn && oauthModal && oauthCloseBtn) {
    connectYouTubeBtn.onclick = async () => {
      oauthMsg.innerHTML = 'Connecting...';
      oauthModal.style.display = 'block';

      const redirectUri = getGoogleRedirectUri();
      const params = new URLSearchParams({
        client_id: '198536620935-fq5dch116tc0dc11v81bbt720m5f0216.apps.googleusercontent.com',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/youtube.readonly openid email profile',
        access_type: 'offline',
        prompt: 'consent'
      });

      window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, '_blank');
      oauthMsg.innerHTML = 'A new tab has opened. Please finish connecting your YouTube account there.<br>After approving, return here!';
    };

    oauthCloseBtn.onclick = () => {
      oauthModal.style.display = 'none';
    };
  }

  // Also allow click outside modal to close
  oauthModal?.addEventListener('mousedown', (e) => {
    if (e.target === oauthModal) oauthModal.style.display = 'none';
  });

  // --- Listen for OAuth popup success (YouTube) ---
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.youtubeConnected === true) {
      showYouTubeSuccessNotification();
      currentUser = await getActiveUser(true);
      updateYouTubeStatusUI?.(true);
      const oauthModal = document.getElementById('youtube-oauth-modal');
      if (oauthModal) oauthModal.style.display = 'none';
    }
  });

  // --- Show success notification for YouTube linking ---
  function showYouTubeSuccessNotification() {
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

  // --- Twitch OAuth helpers (same callback page) ---
  function getTwitchRedirectUri() {
    const base = window.location.origin;
    const path = window.location.pathname;

    if (path.includes('/Demo/')) {
      return `${base}/Demo/oauth2callback.html`;
    }
    // Local dev: Twitch app is registered for /oauth2callback.html (no /public)
    if (base.includes('127.0.0.1:5500') || base.includes('localhost:5500')) {
      return `${base}/oauth2callback.html`;
    }
    // Production
    return `${base}/oauth2callback.html`;
  }

  function launchTwitchOAuth() {
    const TWITCH_CLIENT_ID = 'mb99fqgpca3jyng8y79n362ogroxd7'; // exact from Twitch console
    const redirect = getTwitchRedirectUri();
    const scopes = ['user:read:email'];

    // CSRF
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    const csrf = Array.from(buf).map(x => x.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('oauth_csrf', csrf);

    const u = new URL('https://id.twitch.tv/oauth2/authorize');
    u.searchParams.set('client_id', TWITCH_CLIENT_ID);
    u.searchParams.set('redirect_uri', redirect);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', scopes.join(' '));
    u.searchParams.set('force_verify', 'true');
    // provider prefix so oauth-handler knows which Edge Function to call
    u.searchParams.set('state', `twitch:${csrf}`);

    window.open(u.toString(), '_blank', 'noopener');
  }

  // --- Listen for Twitch OAuth popup success ---
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.twitchConnected === true) {
      showTwitchSuccessNotification();
      await refreshOauthAccountsUI?.();
    }
  });

  function showTwitchSuccessNotification() {
    let notif = document.createElement('div');
    notif.id = 'twitch-link-success';
    notif.style.cssText = `
      position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #9146FF; color: #fff; font-size: 1.1em;
      padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
      border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
    `;
    notif.textContent = '✅ Twitch account successfully linked!';
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3500);
  }

  // =========================
  //   INSTAGRAM INTEGRATION
  // =========================

  // Build the Meta login URL for Instagram Graph (Business/Creator)
  function buildInstagramAuthUrl() {
    const APP_ID = '1051907877053568'; // safe to expose, required in the URL
    const redirectUri = encodeURIComponent(`${location.origin}/oauth2callback.html`);
    const scope = [
      'instagram_basic',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_manage_insights',
      'business_management'
    ].join(',');
    // We use state=instagram so oauth-handler knows which provider to finish
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=instagram`;
  }

  // Success toast when returning from oauth2callback.html
  function showInstagramSuccessNotification() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #E1306C; color: #fff; font-size: 1.1em;
      padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
      border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
    `;
    el.textContent = '✅ Instagram account successfully linked!';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function showInstagramDisconnectedNotification() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #f53838; color: #fff; font-size: 1.1em;
      padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
      border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
    `;
    el.textContent = '⛔ Instagram account disconnected.';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // If we just returned from oauth2callback.html with ?instagram=connected, show toast and clean URL
  (function handleInstagramReturn() {
    const url = new URL(location.href);
    if (url.searchParams.get('instagram') === 'connected') {
      showInstagramSuccessNotification();
      url.searchParams.delete('instagram');
      history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash);
    }
  })();

  // =========================
  //    FACEBOOK INTEGRATION
  // =========================

  function buildFacebookAuthUrl() {
    const APP_ID = '1051907877053568'; // your Meta App ID (same app as Instagram)
    const redirectUri = encodeURIComponent(`${location.origin}/oauth2callback.html`);
    const scope = [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement'
    ].join(',');
    // We use state=facebook so oauth2callback.html knows to call facebook-oauth
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=facebook`;
  }

  function showFacebookSuccessNotification() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #1877F2; color: #fff; font-size: 1.1em;
      padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
      border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
    `;
    el.textContent = '✅ Facebook Page successfully linked!';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function showFacebookDisconnectedNotification() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #f53838; color: #fff; font-size: 1.1em;
      padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
      border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
    `;
    el.textContent = '⛔ Facebook account disconnected.';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // If oauth2callback.html redirected back with ?facebook=connected
  (function handleFacebookReturn() {
    const url = new URL(location.href);
    if (url.searchParams.get('facebook') === 'connected') {
      showFacebookSuccessNotification();
      url.searchParams.delete('facebook');
      history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash);
    }
  })();

  // =========================
  //     TIKTOK INTEGRATION
  // =========================

  function getTikTokRedirectUri() {
    const base = window.location.origin;
    const path = window.location.pathname;
    // Demo folder
    if (path.includes('/Demo/')) return `${base}/Demo/oauth2callback.html`;
    // Local dev (same as Twitch)
    if (base.includes('127.0.0.1:5500') || base.includes('localhost:5500')) return `${base}/oauth2callback.html`;
    // Production
    return `${base}/oauth2callback.html`;
  }

  function launchTikTokOAuth() {
    // TODO: replace with your real Client Key (public; safe to expose)
    const TIKTOK_CLIENT_KEY = 'sbawbcrozip468vh2m';
    const REDIRECT = getTikTokRedirectUri();
    const SCOPES = ['user.info.profile','user.info.stats','video.list'].join(',');

    // CSRF
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    const csrf = Array.from(buf).map(x => x.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('oauth_csrf', csrf);

    const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
    u.searchParams.set('client_key', TIKTOK_CLIENT_KEY);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', SCOPES);
    u.searchParams.set('redirect_uri', REDIRECT);
    u.searchParams.set('state', `tiktok:${csrf}`); // so oauth-handler routes to tiktok-oauth

    const w = 500, h = 650;
    const y = window.top.outerHeight / 2 + window.top.screenY - (h / 2);
    const x = window.top.outerWidth  / 2 + window.top.screenX - (w / 2);
    window.open(u.toString(), 'oauth_tiktok', `width=${w},height=${h},left=${x},top=${y}`);
  }

  function showTikTokSuccessNotification() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #000000; color: #fff; font-size: 1.1em;
      padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
      border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
    `;
    el.textContent = '✅ TikTok account successfully linked!';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function showTikTokDisconnectedNotification() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #f53838; color: #fff; font-size: 1.1em;
      padding: 14px 38px; border-radius: 12px; box-shadow: 0 3px 22px #2222;
      border: 2px solid #fff; font-weight: 700; letter-spacing: .02em;
    `;
    el.textContent = '⛔ TikTok account disconnected.';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // If oauth2callback.html redirected back with ?tiktok=connected
  (function handleTikTokReturn() {
    const url = new URL(location.href);
    if (url.searchParams.get('tiktok') === 'connected') {
      showTikTokSuccessNotification();
      url.searchParams.delete('tiktok');
      history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash);
    }
  })();

  // --- Unified OAuth Modal Logic ---
  const oauthLinkBtn = document.getElementById('oauth-link-btn');
  const oauthLinkModal = document.getElementById('oauth-link-modal');
  const oauthAccountsList = document.getElementById('oauth-accounts-list');
  const closeOauthLinkModalBtn = document.getElementById('close-oauth-link-modal');

  const supportedPlatforms = [
    {
      key: "youtube",
      name: "YouTube",
      logo: "./youtubelogo.png",
      badgeId: "youtube-status-badge"
    },
    {
      key: "instagram",
      name: "Instagram",
      logo: "./instagramlogo.png",
      badgeId: "instagram-status-badge"
    },
    {
      key: "tiktok",
      name: "TikTok",
      logo: "./tiktoklogo.png",
      badgeId: "tiktok-status-badge"
    },
    {
      key: "twitter",
      name: "X (Twitter)",
      logo: "./twitterlogo.png",
      badgeId: "twitter-status-badge"
    },
    {
      key: "facebook",
      name: "Facebook",
      logo: "./facebooklogo.png",
      badgeId: "facebook-status-badge"
    },
    {
      key: "twitch",
      name: "Twitch",
      logo: "./twitchlogo.png",
      badgeId: "twitch-status-badge"
    },
    // Add more platforms here as needed
  ];

  // Enhanced: allow either *_connected bool OR presence of provider-specific columns
  function isPlatformConnected(user, key) {
    if (!user) return false;

    // direct boolean pattern (youtube_connected, instagram_connected, etc.)
    const boolFlag = user[`${key}_connected`] === true;
    if (boolFlag) return true;

    // Fallbacks by provider (when you haven't added *_connected yet)
    if (key === 'twitch')   return !!(user.twitch_access_token);
    if (key === 'youtube')  return !!(user.youtube_refresh_token || user.youtube_access_token);
    if (key === 'instagram')return !!(user.instagram_user_id || user.instagram_access_token);
    if (key === 'facebook') return !!(user.facebook_page_id || user.facebook_access_token);
    if (key === 'tiktok')   return !!(user.tiktok_access_token); // NEW: TikTok
    return false;
  }
    // === Free plan: limit OAuth-linked platforms to 1 ===
  async function enforceFreePlanOauthLimitOrToast(user, platKey) {
    try {
      if (!user) return false;

      const planType = (user.planType || 'free').toLowerCase();

      // Only Free plan is limited
      if (planType !== 'free') {
        return true;
      }

      // Count linked platforms using the same logic as the UI
      let linkedCount = 0;
      for (const p of supportedPlatforms) {
        if (isPlatformConnected(user, p.key)) {
          linkedCount++;
        }
      }

      const thisConnected = isPlatformConnected(user, platKey);

      // If trying to CONNECT a new platform and already at limit, block
      if (!thisConnected && linkedCount >= 1) {
        let toast = document.getElementById('free-plan-oauth-limit-toast');
        if (toast) toast.remove();

        toast = document.createElement('div');
        toast.id = 'free-plan-oauth-limit-toast';
        toast.style.cssText = `
          position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
          z-index: 9999; background: #f6c62e; color: #000; font-size: 1.05em;
          padding: 10px 18px; border-radius: 10px; box-shadow: 0 3px 22px #2222;
          border: 2px solid #fff; font-weight: 600; letter-spacing: .01em;
        `;
        toast.textContent =
          'Free accounts can link only one platform. Disconnect an existing one or upgrade to Pro to link more.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);

        return false;
      }

      return true;
    } catch (err) {
      console.error('Error enforcing free-plan OAuth limit:', err);
      // Fail-open so we don't completely break linking if something goes wrong
      return true;
    }
  }


  async function refreshOauthAccountsUI() {
    let user = await getActiveUser(true); // Get latest user data
    let html = supportedPlatforms.map(p => {
      const connected = isPlatformConnected(user, p.key);
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
            type="button" class="oauth-connect-btn" 
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
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!(await requireAuthOrToast())) return;

        const plat = btn.getAttribute('data-platform');
        const user = await getActiveUser(true);

        // NEW: enforce Free plan limit of 1 OAuth-linked platform
        if (!(await enforceFreePlanOauthLimitOrToast(user, plat))) {
          return; // stop here if user is at limit on Free
        }

if (plat === "youtube") {
          if (user.youtube_connected) {
            // --- DISCONNECT YOUTUBE ---
            btn.innerText = "Disconnecting...";

            await revokePlatforms('youtube', { refresh_token: user.youtube_refresh_token || null, access_token: user.youtube_access_token || null });

            btn.disabled = true;
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
              await removePlatformFromArray(user.user_id, 'youtube');

              btn.innerText = "Connect";
              btn.style.background = "#2d7bfa";
              document.getElementById('youtube-status-badge').innerText = "Not linked";
              document.getElementById('youtube-status-badge').style.color = "#888";
              showYouTubeDisconnectedNotification();
              await refreshOauthAccountsUI();
            } else {
              btn.innerText = "Failed!"; btn.style.background = "#e22";
              setTimeout(() => { btn.innerText = "Disconnect"; btn.style.background = "#f55"; btn.disabled = false; }, 1200);
            }
          } else {
            // --- CONNECT YOUTUBE ---
            oauthModal.style.display = 'block';
            oauthMsg.innerHTML = 'Connecting...';
            connectYouTubeBtn.click();
            oauthLinkModal.style.display = "none";
          }
        }

        else if (plat === "twitch") {
          if (user.twitch_connected) {
            // --- DISCONNECT TWITCH ---
            btn.innerText = "Disconnecting...";

            await revokePlatforms('twitch', { access_token: user.twitch_access_token || null, twitch_client_id: (window.__twitch_client_id__ || null) });

            btn.disabled = true;

            const { error } = await supabase
              .from('users_extended_data')
              .update({
                twitch_access_token: null,
                twitch_refresh_token: null,
                twitch_token_expiry: null,
                twitch_connected: false
              })
              .eq('user_id', user.user_id);

            if (!error) {
              await removePlatformFromArray(user.user_id, 'twitch');

              btn.innerText = "Connect";
              btn.style.background = "#2d7bfa";
              const badge = document.getElementById('twitch-status-badge');
              if (badge) { badge.innerText = "Not linked"; badge.style.color = "#888"; }
              await refreshOauthAccountsUI();
            } else {
              btn.innerText = "Failed!"; btn.style.background = "#e22";
              setTimeout(() => { btn.innerText = "Disconnect"; btn.style.background = "#f55"; btn.disabled = false; }, 1200);
            }
          } else {
            // --- CONNECT TWITCH ---
            launchTwitchOAuth();                  // open Twitch popup
            oauthLinkModal.style.display = "none"; // close the picker while user authorizes
          }
        }

        else if (plat === "instagram") {
          if (user.instagram_connected) {
            // --- DISCONNECT INSTAGRAM ---
            btn.innerText = "Disconnecting...";

            await revokePlatforms('instagram', { access_token: user.instagram_access_token || null });

            btn.disabled = true;

            const { error } = await supabase
              .from('users_extended_data')
              .update({
                instagram_access_token: null,
                instagram_refresh_token: null,
                instagram_token_expiry: null,
                instagram_connected: false,
                instagram_user_id: null
              })
              .eq('user_id', user.user_id);

            if (!error) {
              await removePlatformFromArray(user.user_id, 'instagram');

              btn.innerText = "Connect";
              btn.style.background = "#2d7bfa";
              const badge = document.getElementById('instagram-status-badge');
              if (badge) { badge.innerText = "Not linked"; badge.style.color = "#888"; }
              showInstagramDisconnectedNotification();
              await refreshOauthAccountsUI();
            } else {
              btn.innerText = "Failed!"; btn.style.background = "#e22";
              setTimeout(() => { btn.innerText = "Disconnect"; btn.style.background = "#f55"; btn.disabled = false; }, 1200);
            }
          } else {
            // --- CONNECT INSTAGRAM ---
            const url = buildInstagramAuthUrl();
            oauthLinkModal.style.display = "none";
            // Full-page redirect (Meta blocks popup in many cases)
            window.location.href = url;
          }
        }

        // --- NEW: FACEBOOK CONNECT/DISCONNECT ---
       // --- FACEBOOK CONNECT/DISCONNECT (correct token param + no update to generated column) ---
else if (plat === "facebook") {
  const fbConnected = isPlatformConnected(user, 'facebook');

  if (fbConnected) {
    // --- DISCONNECT FACEBOOK ---
    btn.innerText = "Disconnecting...";

    try {
      // IMPORTANT: Edge function expects `access_token`; include `page_id` when using a Page token.
      // If you later store a user token (e.g. facebook_user_access_token), prefer that first:
      const accessToken =
        user.facebook_user_access_token /* optional future column */ ||
        user.facebook_access_token      /* current schema: page token */ ||
        null;

      await revokePlatforms('facebook', {
        access_token: accessToken,
        page_id: user.facebook_page_id || null
      });
    } catch (e) {
      console.warn('Facebook revoke warning:', e?.message || e);
      // Continue to local unlink either way
    }

    btn.disabled = true;

    // DO NOT include `facebook_connected` here (it's a generated column).
    const { error } = await supabase
      .from('users_extended_data')
      .update({
        facebook_user_id: null,
        facebook_page_id: null,
        facebook_page_name: null,
        facebook_access_token: null,
        // facebook_user_access_token: null, // uncomment if you add that column later
        facebook_token_expires_at: null
      })
      .eq('user_id', user.user_id);

    if (!error) {
      await removePlatformFromArray(user.user_id, 'facebook');

      btn.innerText = "Connect";
      btn.style.background = "#2d7bfa";
      const badge = document.getElementById('facebook-status-badge');
      if (badge) { badge.innerText = "Not linked"; badge.style.color = "#888"; }
      showFacebookDisconnectedNotification?.();
      await refreshOauthAccountsUI();
    } else {
      btn.innerText = "Failed!"; btn.style.background = "#e22";
      setTimeout(() => { btn.innerText = "Disconnect"; btn.style.background = "#f55"; btn.disabled = false; }, 1200);
    }
  } else {
    // --- CONNECT FACEBOOK ---
    const url = buildFacebookAuthUrl(); // state=facebook
    oauthLinkModal.style.display = "none";
    window.location.href = url; // full redirect (Meta-friendly)
  }
}


        // --- NEW: TIKTOK CONNECT/DISCONNECT ---
        else if (plat === "tiktok") {
          if (isPlatformConnected(user, 'tiktok')) {
            // --- DISCONNECT TIKTOK ---
            btn.innerText = "Disconnecting...";

            await revokePlatforms('tiktok', { access_token: user.tiktok_access_token || null });

            btn.disabled = true;

            const { error } = await supabase
              .from('users_extended_data')
              .update({
                tiktok_access_token: null,
                tiktok_refresh_token: null,
                tiktok_token_expiry: null,
                tiktok_connected: false,
                tiktok_user_id: null,
                tiktok_username: null
              })
              .eq('user_id', user.user_id);

            if (!error) {
              await removePlatformFromArray(user.user_id, 'tiktok');

              btn.innerText = "Connect";
              btn.style.background = "#2d7bfa";
              const badge = document.getElementById('tiktok-status-badge');
              if (badge) { badge.innerText = "Not linked"; badge.style.color = "#888"; }
              showTikTokDisconnectedNotification();
              await refreshOauthAccountsUI();
            } else {
              btn.innerText = "Failed!"; btn.style.background = "#e22";
              setTimeout(() => { btn.innerText = "Disconnect"; btn.style.background = "#f55"; btn.disabled = false; }, 1200);
            }
          } else {
            // --- CONNECT TIKTOK ---
            launchTikTokOAuth();                  // popup using state=tiktok:<csrf>
            oauthLinkModal.style.display = "none"; // close the picker while user authorizes
          }
        }

        // Future placeholders
        else if (plat === "twitter") {
          if (user.twitter_connected) {
            // TODO: add disconnect if needed
          } else {
            alert("X (Twitter) OAuth coming soon!");
          }
        } else if (plat === "kick") {
          if (user.kick_connected) {
            // TODO
          } else {
            alert("Kick OAuth coming soon!");
          }
        }
      });
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

  // --- Listen for TikTok OAuth popup success (postMessage from oauth2callback.html)
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.tiktokConnected === true) {
      showTikTokSuccessNotification();
      await refreshOauthAccountsUI?.();
    }
  });

  // --- Show notification on disconnect (YouTube) ---
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

  // === COMPLETION RECAPS SLIDER ===
const recapToggle = document.getElementById('toggle-recap-slider');

async function loadRecapSetting() {
  const user = await getActiveUser();
  if (!user?.user_id || !recapToggle) return;

  const { data, error } = await supabase
    .from('users_extended_data')
    .select('completion_recaps_enabled')
    .eq('user_id', user.user_id)
    .single();

  if (!error && data && typeof data.completion_recaps_enabled === 'boolean') {
    recapToggle.checked = data.completion_recaps_enabled;
  } else {
    recapToggle.checked = false; // default OFF
  }
}

if (recapToggle) {
  recapToggle.addEventListener('change', async () => {
    const user = await getActiveUser();
    if (!user?.user_id) return;

    const enabled = !!recapToggle.checked;
    const { error } = await supabase
      .from('users_extended_data')
      .upsert(
        { user_id: user.user_id, completion_recaps_enabled: enabled },
        { onConflict: ['user_id'] }
      );

    if (error) {
      alert('Failed to update Completion Recaps setting. Please try again.');
      recapToggle.checked = !enabled; // revert UI on failure
      return;
    }

    // small visual feedback
    const slider = recapToggle.parentElement?.querySelector('.slider');
    if (slider) {
      slider.style.boxShadow = '0 0 0 2px #36a2eb';
      setTimeout(() => (slider.style.boxShadow = ''), 600);
    }
  });

  loadRecapSetting();
}

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
  // =========================
// =========================
// Affiliate Application (Settings dropdown → modal)
// Paste this whole block just ABOVE the closing "});" of DOMContentLoaded
// =========================
  // --- Website URL Modal (Link Website) ---

  function ensureWebsiteModal() {
    if (document.getElementById('website-url-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'website-url-modal';
    modal.className = 'modal';
    modal.style.cssText = `
      display:none;
      position:fixed;
      inset:0;
      z-index:9999;
      background:rgba(0,0,0,0.7);
      align-items:center;
      justify-content:center;
    `;

    modal.innerHTML = `
      <div class="modal-content" style="
        background:#111;
        color:#eee;
        max-width:480px;
        width:92vw;
        padding:24px 20px 18px;
        border-radius:14px;
        box-shadow:0 8px 24px #0009;
        position:relative;
      ">
        <button type="button" id="close-website-url-modal" aria-label="Close" style="
          position:absolute;
          right:14px;
          top:10px;
          background:none;
          border:none;
          color:#f55;
          font-size:1.4em;
          cursor:pointer;
          box-shadow:none;
        ">&times;</button>

        <h3 style="margin:0 0 10px 0; font-size:1.2rem;">Link your website</h3>
        <p style="margin:0 0 12px 0; font-size:0.95rem; color:#ccc;">
          Add your main website, store, or portfolio so sponsors can click through from your profile.
        </p>

        <label for="website-url-input" style="display:block; font-size:0.95rem; margin-bottom:4px;">
          Website URL
        </label>
        <input
          id="website-url-input"
          type="url"
          placeholder="https://your-site.com"
          style="
            width:100%;
            padding:8px 10px;
            border-radius:8px;
            border:1px solid #444;
            background:#000;
            color:#fff;
            box-sizing:border-box;
            margin-bottom:6px;
          "
        >

        <div style="font-size:0.85rem; color:#888; margin-bottom:12px;">
          We’ll automatically add “https://” if you leave it off. Leave blank and save to remove your website.
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button
            type="button"
            id="website-url-cancel-btn"
            style="
              padding:7px 14px;
              border-radius:8px;
              border:1px solid #444;
              background:#222;
              color:#eee;
              cursor:pointer;
              box-shadow:none;
            "
          >Cancel</button>

          <button
            type="button"
            id="website-url-save-btn"
            style="
              padding:7px 16px;
              border-radius:8px;
              border:none;
              background:#36a2eb;
              color:#fff;
              font-weight:600;
              cursor:pointer;
              box-shadow:none;
            "
          >Save</button>
        </div>

        <div id="website-url-msg" style="margin-top:8px; font-size:0.9rem; color:#bbb;"></div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) closeModal('website-url-modal');
    });
    document.getElementById('close-website-url-modal')?.addEventListener('click', () => {
      closeModal('website-url-modal');
    });
    document.getElementById('website-url-cancel-btn')?.addEventListener('click', () => {
      closeModal('website-url-modal');
    });

    // Save handler
    document.getElementById('website-url-save-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('website-url-input');
      const msgEl = document.getElementById('website-url-msg');
      if (!input || !msgEl) return;

      let raw = input.value.trim();
      const user = await getActiveUser();
      if (!user?.user_id) return;

      // Clear website if empty
      if (!raw) {
        msgEl.style.color = '#bbb';
        msgEl.textContent = 'Saving...';

        const { error } = await supabase
          .from('users_extended_data')
          .update({ website_url: null })
          .eq('user_id', user.user_id);

        if (error) {
          msgEl.style.color = '#f66';
          msgEl.textContent = 'Error saving website. Please try again.';
          return;
        }

        msgEl.style.color = '#7CFFA1';
        msgEl.textContent = 'Website removed.';
        setTimeout(() => closeModal('website-url-modal'), 900);
        return;
      }

      // Normalise + basic validation
      if (!/^https?:\/\//i.test(raw)) {
        raw = `https://${raw}`;
      }

      try {
        const u = new URL(raw);
        raw = u.toString();
      } catch {
        msgEl.style.color = '#f66';
        msgEl.textContent = 'That does not look like a valid URL.';
        return;
      }

      msgEl.style.color = '#bbb';
      msgEl.textContent = 'Saving...';

      const { error } = await supabase
        .from('users_extended_data')
        .update({ website_url: raw })
        .eq('user_id', user.user_id);

      if (error) {
        msgEl.style.color = '#f66';
        msgEl.textContent = 'Error saving website. Please try again.';
        return;
      }

      msgEl.style.color = '#7CFFA1';
      msgEl.textContent = 'Website saved!';
      setTimeout(() => closeModal('website-url-modal'), 900);
    });
  }

  // Wire the “Link Website” item in the settings dropdown
  const addWebsiteBtn = document.getElementById('add-website-url');
  if (addWebsiteBtn) {
    addWebsiteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      ensureWebsiteModal();

      // Prefill from current user data
      const user = await getActiveUser();
      const input = document.getElementById('website-url-input');
      const msgEl = document.getElementById('website-url-msg');
      if (input && user) {
        input.value = user.website_url || '';
      }
      if (msgEl) {
        msgEl.style.color = '#bbb';
        msgEl.textContent = '';
      }

      // Close dropdown, open modal
      if (settingsDropdown) settingsDropdown.style.display = 'none';
      openModal('website-url-modal');
    });
  }

// ---------- Small helpers ----------
function aff_functionsBase(){ return (supabase && supabase.functionsUrl) || 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1'; }
async function aff_getJwt(){ return (await supabase.auth.getSession()).data.session?.access_token || ''; }
function aff_esc(v){ return v==null?'':String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// deep read (with common wrappers)
function aff_get(root, keys) {
  const prefixes = ['', 'data.', 'result.', 'channel.', 'profile.', 'stats.', 'payload.', 'body.'];
  const read = (obj, path) => path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  for (const k of keys) for (const p of prefixes) {
    const val = read(root, p + k);
    if (val !== undefined && val !== null) return val;
  }
  return undefined;
}
function aff_num(x) {
  if (x === undefined || x === null) return undefined;
  if (typeof x === 'number') return x;
  if (typeof x === 'string') {
    const m = x.replace(/[, _]/g, '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : undefined;
  }
  return undefined;
}

// Normalize a URL for de-duping (no query/hash, lowercased host, no trailing slash, no www)
function aff_normUrl(u){
  try{
    const url = new URL(u);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./,'');
    let s = url.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  }catch{ return null; }
}

// ---------- Snapshot globals ----------
let AFF_SNAPSHOT = null;       // compact object of detected stats
let AFF_SNAPSHOT_AT = null;    // ISO timestamp when captured

// ---------- Add / wire up the Affiliate button (idempotent) ----------
(function wireAffiliateApplyMenuItem() {
  const dd = document.getElementById('settings-dropdown');
  if (!dd) return;

  let btn = document.getElementById('open-affiliate-apply');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'open-affiliate-apply';
    btn.type = 'button';
    btn.className = 'dropdown-item';
    btn.textContent = '🤝 Apply to be an Affiliate';
    const ul = dd.querySelector('ul') || dd;
    const li = document.createElement('li');
    li.appendChild(btn);
    ul.appendChild(li);
  }

  if (!btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      aff_buildApplyModal();
      const modal = document.getElementById('affiliate-apply-modal');
      modal.style.display = 'block';
      dd.style.display = 'none';

      // OAuth-only detection (no prefill from saved handles)
      await aff_refreshDetectedStats();
      await aff_refreshMyApplications();
    });
  }
})();

// ---------- Modal builder (idempotent, scrollable) ----------
function aff_buildApplyModal(){
  if (document.getElementById('affiliate-apply-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'affiliate-apply-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;z-index:1000;';
  modal.innerHTML = `
    <div style="
      width:min(760px,92vw);
      margin:7vh auto;
      background:#111;
      border:1px solid #333;
      border-radius:12px;
      box-shadow:0 20px 80px #0007;
      color:#fff;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #222;">
        <h3 style="margin:0;font-size:1.2rem;">Apply to be an Affiliate</h3>
        <button id="close-affiliate-apply-modal" style="background:none;border:none;color:#aaa;font-size:1.6rem;cursor:pointer;box-shadow:none;">×</button>
      </div>

      <div style="max-height:75vh;overflow:auto;padding:16px;">
        <div style="display:grid;gap:10px;">
          <label>Partner Type
            <select id="aff-partner-type" style="width:100%">
              <option value="affiliate">Affiliate</option>
              <option value="agency">Agency</option>
              <option value="reseller">Reseller</option>
            </select>
          </label>

          <label>Pitch
            <textarea id="aff-pitch" rows="4" placeholder="Tell us about your audience and how you’ll promote."></textarea>
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label>Niche <input id="aff-niche" placeholder="e.g., gaming, beauty"></label>
            <label>Regions <input id="aff-regions" placeholder="e.g., AU/NZ, US, EU"></label>
          </div>

          <label>Monthly Clicks (est.) <input id="aff-clicks" type="number" min="0" step="1" placeholder="e.g., 12000"></label>

          <label>Links (one per line)
            <textarea id="aff-links" rows="3" placeholder="https://your-site
https://instagram.com/you
https://youtube.com/@you"></textarea>
          </label>

          <label>Desired Commission Rate (%) <input id="aff-rate" type="number" step="0.01" min="0" max="100" value="10"></label>

          <div style="display:flex;gap:10px;position:sticky;top:0;">
            <button id="aff-save-draft" style="padding:8px 14px;border-radius:8px;border:1px solid #444;background:#222;color:#fff;box-shadow:none;">Save Draft</button>
            <button id="aff-submit" style="padding:8px 14px;border-radius:8px;border:1px solid #ffd062;background:#ffd062;color:#222;font-weight:700;box-shadow:none;">Submit Application</button>
          </div>
          <div id="aff-apply-msg" style="color:#bbb;font-size:.95em;"></div>
        </div>

        <hr style="margin:16px 0;border-color:#222;">

        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-weight:700;">▾ Detected Profiles &amp; Stats</div>
          <button id="aff-stats-refresh" style="background:#2654ff;border:none;color:#fff;padding:4px 10px;border-radius:8px;cursor:pointer;">Refresh</button>
        </div>
        <div id="aff-stats" style="display:grid;gap:10px;margin-top:10px;"></div>

        <hr style="margin:16px 0;border-color:#222;">

        <h4 style="margin:0 0 8px 0;">Your Applications</h4>
        <div id="aff-my-apps"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // close handlers
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) modal.style.display='none'; });
  document.getElementById('close-affiliate-apply-modal').addEventListener('click', ()=> modal.style.display='none');

  // buttons
  document.getElementById('aff-save-draft').addEventListener('click', ()=> aff_submitApplication(false));
  document.getElementById('aff-submit').addEventListener('click', ()=> aff_submitApplication(true));
  document.getElementById('aff-stats-refresh').addEventListener('click', aff_refreshDetectedStats);
}

// ---------- Draft/Submit handler (calls Edge Function: affiliate-apply) ----------
async function aff_submitApplication(submit){
  const msg = document.getElementById('aff-apply-msg');
  const pitch = (document.getElementById('aff-pitch')?.value || '').trim();

  // FamBot moderation on pitch
  const { data: { session } } = await supabase.auth.getSession();
  if (pitch) {
    const res = await famBotModerateWithModal({
      user_id: session?.user?.id,
      content: pitch,
      jwt: session?.access_token,
      type: 'affiliate_pitch'
    });
    if (!res.allowed) return;
  }

  const body = {
    partner_type: document.getElementById('aff-partner-type')?.value || 'affiliate',
    pitch,
    audience: {
      niche: (document.getElementById('aff-niche')?.value || '').trim() || null,
      regions: (document.getElementById('aff-regions')?.value || '').trim() || null,
      monthly_clicks: Number(document.getElementById('aff-clicks')?.value || 0)
    },
    links: (document.getElementById('aff-links')?.value || '')
      .split('\n').map(s=>s.trim()).filter(Boolean),
    desired_rate: Number(document.getElementById('aff-rate')?.value || 0),

    // >>> Include the captured snapshot so it persists on the row <<<
    stats_snapshot: AFF_SNAPSHOT || null,
    stats_captured_at: AFF_SNAPSHOT_AT || null,

    submit
  };

  msg.style.color = '#bbb';
  msg.textContent = submit ? 'Submitting…' : 'Saving draft…';

  try {
    const resp = await fetch(`${aff_functionsBase()}/affiliate-apply`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${await aff_getJwt()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      mode: 'cors',
    });
    const json = await resp.json().catch(()=>({ ok:false, error:'Bad JSON' }));
    if (!json.ok) throw new Error(json.error || 'Unknown error');

    msg.style.color = '#21d32e';
    msg.textContent = submit ? 'Application submitted!' : 'Draft saved.';
    await aff_refreshMyApplications();
  } catch (e) {
    msg.style.color = '#f66';
    msg.textContent = 'Error: ' + (e.message || e);
  }
}

// ---------- Live “Detected Profiles & Stats” (OAuth URLs only; builds snapshot) ----------
async function aff_refreshDetectedStats(){
  const box = document.getElementById('aff-stats');
  if (!box) return;
  box.innerHTML = '<div style="color:#bbb;">Scanning connected accounts…</div>';

  const jwt = await aff_getJwt();
  const headers = { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' };

  async function callFn(name){
    const base = `${aff_functionsBase()}/${name}`;
    let r = await fetch(base, { method:'POST', headers, mode:'cors', cache:'no-store' }).catch(()=>null);
    if (!r || !r.ok) r = await fetch(base, { method:'GET', headers, mode:'cors', cache:'no-store' }).catch(()=>null);
    if (!r || !r.ok) throw new Error(`${name}: ${r ? r.status : 'network'}`);
    return r.json();
  }

  const work = [
    ['YouTube','get-youtube-stats'],
    ['TikTok','get-tiktok-stats'],
    ['Twitch','get-twitch-stats'],
    ['Instagram','get-instagram-stats'],
    ['Facebook','get-facebook-page-insights'],
  ].map(([label, fn]) => callFn(fn).then(d => ({label, ok:true, data:d})).catch(err => ({label, ok:false, err:String(err?.message||err)})));

  const results = await Promise.allSettled(work);

  // De-dupe by normalized URL; start with what's in the textarea already
  const linksBox   = document.getElementById('aff-links');
  const existingRaw  = (linksBox?.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
  const existingNorm = new Set(existingRaw.map(aff_normUrl).filter(Boolean));

  // Helper: coerce any shape -> array of strings
  function toUrlArray(x){
    if (!x) return [];
    if (typeof x === 'string') return [x];
    if (Array.isArray(x)) return x.filter(v => typeof v === 'string');
    if (typeof x === 'object') {
      const vals = Object.values(x).flat();
      return vals.filter(v => typeof v === 'string');
    }
    return [];
  }

  // fresh snapshot we’ll send with the application
  const snapshot = {};

  const cards = results.map((wrap) => {
    const res = wrap.value || wrap.reason;
    if (!res || !res.label) return '';

    if (!res.ok) {
      return `
        <div style="border:1px solid #333;border-radius:10px;padding:10px;background:#141414">
          <div style="font-weight:700">${aff_esc(res.label)}</div>
          <div style="color:#f66;font-size:.95em;margin-top:4px;">No stats (not linked or blocked by CORS)</div>
        </div>
      `;
    }

    const d = res.data || {};

    // Only accept URLs provided (directly or as arrays/objects) by the OAuth-backed function
    const urlCandidates = [
      aff_get(d, ['url','link','permalink','permalink_url','page_url','channel_url','profile_url','external_url','website']),
      aff_get(d, ['urls']),
      aff_get(d, ['links']),
      aff_get(d, ['profiles']),
      aff_get(d, ['page.link']),
      aff_get(d, ['page.permalink_url']),
      aff_get(d, ['data.0.link','pages.0.link','accounts.0.link','accounts.data.0.link']),
    ];
    const discoveredUrls = urlCandidates.flatMap(toUrlArray);

    // Fallback: derive from OAuth identifiers when URL not provided
    if (!discoveredUrls.length) {
      if (res.label === 'YouTube') {
        const handle = aff_get(d, ['handle','snippet.customUrl','items.0.snippet.customUrl','customUrl','channel.handle']);
        const chanId = aff_get(d, ['channelId','channel.id','items.0.id','id']);
        if (typeof handle === 'string' && handle.trim()) {
          discoveredUrls.push(handle.startsWith('@') ? `https://youtube.com/${handle.trim()}` : `https://youtube.com/c/${String(handle).replace(/^c\//,'')}`);
        } else if (chanId) {
          discoveredUrls.push(`https://youtube.com/channel/${chanId}`);
        }
      } else if (res.label === 'TikTok') {
        const u = aff_get(d, ['username','unique_id','profile.username']);
        if (u) discoveredUrls.push(`https://www.tiktok.com/@${u}`);
      } else if (res.label === 'Twitch') {
        const login = aff_get(d, ['login','user_login','profile.login','user.login','users.0.login','data.0.login']);
        if (login) discoveredUrls.push(`https://twitch.tv/${login}`);
      } else if (res.label === 'Instagram') {
        const u = aff_get(d, ['username','profile.username']);
        if (u) discoveredUrls.push(`https://instagram.com/${u}`);
      } else if (res.label === 'Facebook') {
        const uname = aff_get(d, ['page_username','username','page.username','pages.0.username','accounts.0.username','accounts.data.0.username']);
        const pid   = aff_get(d, ['page_id','id','page.id','pages.0.id','accounts.0.id','accounts.data.0.id']);
        if (uname) discoveredUrls.push(`https://facebook.com/${uname}`);
        else if (pid) discoveredUrls.push(`https://facebook.com/${pid}`);
      }
    }

    // Append any new URLs (de-duped)
    if (linksBox && discoveredUrls.length) {
      let dirty = false;
      for (const u of discoveredUrls) {
        const norm = aff_normUrl(u);
        if (norm && !existingNorm.has(norm)) {
          existingNorm.add(norm);
          existingRaw.push(u);
          dirty = true;
        }
      }
      if (dirty) linksBox.value = existingRaw.join('\n');
    }

    // Render numbers + add to snapshot
    let inner = '';

    if (res.label === 'YouTube') {
      const subs = aff_num(aff_get(d, [
        'subscribers','subscriber_count',
        'statistics.subscriberCount','data.statistics.subscriberCount',
        'channel.statistics.subscriberCount','channel.subscriberCount',
        'items.0.statistics.subscriberCount'
      ]));
      const views = aff_num(aff_get(d, [
        'views','viewCount',
        'statistics.viewCount','data.statistics.viewCount',
        'channel.statistics.viewCount','channel.viewCount',
        'items.0.statistics.viewCount'
      ]));
      const videos = aff_num(aff_get(d, [
        'videos','videoCount',
        'statistics.videoCount','data.statistics.videoCount',
        'channel.statistics.videoCount','channel.videoCount',
        'items.0.statistics.videoCount'
      ]));
      inner = [
        subs!=null  ? `<b>Subs:</b> ${aff_esc(subs)}`   : '',
        views!=null ? `<b>Views:</b> ${aff_esc(views)}` : '',
        videos!=null? `<b>Videos:</b> ${aff_esc(videos)}`: ''
      ].filter(Boolean).join(' &nbsp; ');
      snapshot.youtube = { url: discoveredUrls[0] || null, subscribers: subs ?? null, views: views ?? null, videos: videos ?? null };

    } else if (res.label === 'TikTok') {
      const followers = aff_num(aff_get(d, ['followers','followers_count','follower_count','profile.follower_count','data.followers']));
      const likes     = aff_num(aff_get(d, ['likes','likes_count','heart','profile.total_heart','data.likes']));
      const videos    = aff_num(aff_get(d, ['videos','video_count','profile.video_count','data.videos']));
      inner = [
        followers!=null ? `<b>Followers:</b> ${aff_esc(followers)}` : '',
        likes!=null     ? `<b>Likes:</b> ${aff_esc(likes)}`         : '',
        videos!=null    ? `<b>Videos:</b> ${aff_esc(videos)}`       : ''
      ].filter(Boolean).join(' &nbsp; ');
      snapshot.tiktok = { url: discoveredUrls[0] || null, followers: followers ?? null, likes: likes ?? null, videos: videos ?? null };

    } else if (res.label === 'Twitch') {
      const followers = aff_num(aff_get(d, ['followers','follower_count','total','data.total']));
      const live      = aff_get(d,  ['live','is_live','streaming','data.live']);
      const views     = aff_num(aff_get(d, ['view_count','views','data.views']));
      inner = [
        followers!=null ? `<b>Followers:</b> ${aff_esc(followers)}` : '',
        live!=null      ? `<b>Live:</b> ${aff_esc(live)}`           : '',
        views!=null     ? `<b>Views:</b> ${aff_esc(views)}`         : ''
      ].filter(Boolean).join(' &nbsp; ');
      snapshot.twitch = { url: discoveredUrls[0] || null, followers: followers ?? null, live: !!live, views: views ?? null };

    } else if (res.label === 'Instagram') {
      const followers = aff_num(aff_get(d, ['followers','followers_count','account.followers_count','insights.followers','data.followers']));
      const posts     = aff_num(aff_get(d, ['posts','media_count','data.media_count']));
      const er        = aff_get(d,  ['engagement_rate','eng_rate','data.engagement_rate']);
      inner = [
        followers!=null ? `<b>Followers:</b> ${aff_esc(followers)}` : '',
        posts!=null     ? `<b>Posts:</b> ${aff_esc(posts)}`         : '',
        er!=null        ? `<b>ER (12):</b> ${aff_esc(er)}`          : ''
      ].filter(Boolean).join(' &nbsp; ');
      snapshot.instagram = { url: discoveredUrls[0] || null, followers: followers ?? null, posts: posts ?? null, engagement_rate: er ?? null };

    } else if (res.label === 'Facebook') {
      const followers = aff_num(aff_get(d, ['followers','page_followers','page_follows','data.page_followers']));
      const likes     = aff_num(aff_get(d, ['page_likes','likes','data.page_likes']));
      const reach28   = aff_num(aff_get(d, ['reach_28d','page_impressions_unique_28d','reach','data.reach_28d']));
      inner = [
        followers!=null ? `<b>Followers:</b> ${aff_esc(followers)}` : '',
        likes!=null     ? `<b>Page Likes:</b> ${aff_esc(likes)}`    : '',
        reach28!=null   ? `<b>Reach (28d):</b> ${aff_esc(reach28)}` : ''
      ].filter(Boolean).join(' &nbsp; ');
      snapshot.facebook = { url: discoveredUrls[0] || null, followers: followers ?? null, likes: likes ?? null, reach_28d: reach28 ?? null };
    }

    return `
      <div style="border:1px solid #333;border-radius:10px;padding:10px;background:#141414">
        <div style="font-weight:700">${aff_esc(res.label)} <span style="color:#21d32e;font-weight:600;margin-left:6px;">(ok)</span></div>
        <div style="margin-top:6px;font-size:.98em;">${inner || '<span style="color:#bbb;">Connected</span>'}</div>
      </div>
    `;
  }).join('');

  box.innerHTML = cards || '<div style="color:#bbb;">No connected accounts detected.</div>';

  // save snapshot for submit
  AFF_SNAPSHOT = Object.keys(snapshot).length ? snapshot : null;
  AFF_SNAPSHOT_AT = AFF_SNAPSHOT ? new Date().toISOString() : null;
}

// ---------- “Your Applications” table ----------
async function aff_refreshMyApplications(){
  const el = document.getElementById('aff-my-apps');
  if (!el) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { el.innerHTML = '<p>Please log in.</p>'; return; }

  const { data, error } = await supabase
    .from('affiliate_applications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<p style="color:#f66;">${aff_esc(error.message)}</p>`; return; }
  if (!data?.length) { el.innerHTML = '<p>No applications yet.</p>'; return; }

  const rows = data.map(a => `
    <tr>
      <td>${aff_esc(a.id)}</td>
      <td>${aff_esc(a.partner_type)}</td>
      <td>${aff_esc(a.status)}</td>
      <td>${a.desired_rate!=null ? aff_esc(Number(a.desired_rate).toFixed(2))+'%' : '-'}</td>
      <td>${a.created_at ? new Date(a.created_at).toLocaleString() : ''}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div style="overflow:auto;">
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-color:#333;">
        <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Desired Rate</th><th>Created</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* =========================
   PREMIUM: Featured Star checkout (Settings dropdown → modal)
   Paste this whole block just ABOVE the closing "});" of DOMContentLoaded
========================= */

// --- Config ---
const FEATURED_STAR_PRICE_ID = 'price_1SRAl62eA1800fRN56wtcQbH';

// Optional: label/amount to show in the modal
const FEATURED_STAR_DISPLAY = {
  title: 'Featured Star',
  blurb: 'Buy a sparkle placement on the homepage that links visitors to your public spotlight.',
  displayPrice: '$10 one-time for 1 month'
};

// --- Utility: Functions URL + JWT ---
function prem_functionsBase(){
  return (supabase && supabase.functionsUrl) || 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1';
}
async function prem_getJwt(){
  return (await supabase.auth.getSession()).data.session?.access_token || '';
}
function fmtDate(v){
  try { return new Date(v).toLocaleDateString(); } catch { return '—'; }
}
function slotStatus(starts_at, ends_at){
  const now = Date.now();
  const s = starts_at ? Date.parse(starts_at) : 0;
  const e = ends_at ? Date.parse(ends_at) : 0;
  if (s && now < s) return 'Scheduled';
  if (e && now > e) return 'Expired';
  return 'Active';
}

// --- Render user's existing featured slots ---
async function loadMyFeaturedSlots(){
  const list = document.getElementById('premium-slots');
  const empty = document.getElementById('premium-slots-empty');
  if (!list) return;

  list.innerHTML = '<div style="color:#9fc2ff;">Loading your placements…</div>';
  empty.style.display = 'none';

  const { data: userResp } = await supabase.auth.getUser();
  const user = userResp?.user;
  if (!user) {
    list.innerHTML = `
      <div style="color:#bbb;">
        You’re not signed in. <a href="./login.html" style="color:#ffd062;text-decoration:underline;">Log in</a> to see your placements.
      </div>`;
    return;
  }

  const { data, error } = await supabase
    .from('featured_slots')
    .select('slot_index,label,starts_at,ends_at')
    .eq('user_id', user.id)
    .order('starts_at', { ascending: false })
    .limit(50);

  if (error) {
    list.innerHTML = `<div style="color:#ff8a8a;">Could not load placements.</div>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }

  list.innerHTML = '';
  for (const row of data) {
    const st = slotStatus(row.starts_at, row.ends_at);
    const viewHref = `./featured.html?slot=${row.slot_index}`;
    const item = document.createElement('div');
    item.className = 'mini-item';
    item.style.margin = '6px 0';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <div>
          <div style="font-weight:800;color:#fff;">Slot #${row.slot_index} ${row.label ? `— ${row.label}` : ''}</div>
          <div style="color:#bbb;font-size:.92em;">
            ${fmtDate(row.starts_at)} → ${fmtDate(row.ends_at)} • <span style="color:${st==='Active' ? '#7CFFA1' : st==='Scheduled' ? '#FFD062' : '#999'}">${st}</span>
          </div>
        </div>
        <a href="${viewHref}" style="background:#ffd062;color:#222;padding:6px 10px;border-radius:10px;font-weight:800;text-decoration:none;">View</a>
      </div>
    `;
    list.appendChild(item);
  }
}

// --- Ensure we have the modal markup only once ---
function ensurePremiumModal(){
  if (document.getElementById('premium-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'premium-modal';
  modal.className = 'modal';
  modal.style.cssText = `
    display:none; position:fixed; z-index:9999; left:0; top:0; width:100vw; height:100vh;
    background:rgba(16,18,32,0.86); align-items:center; justify-content:center;
  `;

  modal.innerHTML = `
    <div class="modal-content" style="
      background:#111; color:#eee; max-width:620px; width:92vw;max-height:none;
      padding:28px 24px 20px 24px; border-radius:16px; box-shadow:0 8px 30px #0008; position:relative;">
      <button id="close-premium-modal" aria-label="Close" style="
        position:absolute; right:16px; top:12px; font-size:1.4em; background:none; border:none; color:red; cursor:pointer; box-shadow:none;">&times;</button>

      <h3 style="margin:0 0 8px 0; letter-spacing:.02em;">${FEATURED_STAR_DISPLAY.title}</h3>
      <div style="margin-bottom:10px; color:#bbb;">${FEATURED_STAR_DISPLAY.blurb}</div>

      <div style="margin:10px 0 14px 0;">
        <span style="background:#222; color:#ffd062; padding:6px 12px; border-radius:10px; font-weight:700;">
          ${FEATURED_STAR_DISPLAY.displayPrice}
        </span>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
        <button id="buy-featured-star" class="btn btn-primary" style="
          background:#ffd062; color:#222; border:none; padding:10px 16px; border-radius:10px; cursor:pointer; font-weight:800;">
          Buy Featured Star
        </button>
        <button id="premium-refresh" class="btn btn-secondary" style="
          background:#333; color:#eee; border:none; padding:10px 16px; border-radius:10px; cursor:pointer;">
          Refresh
        </button>
        <button id="premium-cancel" class="btn btn-secondary" style="
          background:#333; color:#eee; border:none; padding:10px 16px; border-radius:10px; cursor:pointer;">
          Close
        </button>
      </div>

      <div id="premium-status" style="margin-top:12px; color:#7fbaff; min-height:1.2em;"></div>

      <hr style="opacity:.15;margin:16px 0;">
      <div style="font-weight:800;margin-bottom:6px;">Your Featured Placements</div>
      <div id="premium-slots" class="mini-list" style="min-height:24px;"></div>
      <div id="premium-slots-empty" style="display:none;color:#bbb;">No placements yet.</div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close + refresh
  document.getElementById('close-premium-modal')?.addEventListener('click', () => closeModal('premium-modal'));
  document.getElementById('premium-cancel')?.addEventListener('click', () => closeModal('premium-modal'));
  document.getElementById('premium-refresh')?.addEventListener('click', loadMyFeaturedSlots);

  // Buy button
  document.getElementById('buy-featured-star')?.addEventListener('click', async () => {
    const status = document.getElementById('premium-status');
    try {
      status.textContent = 'Creating checkout…';

      const successUrl = new URL('./payment-success.html?premium=success', location.href).href;
      const cancelUrl  = new URL('./settings.html?premium=cancel',  location.href).href;

      const payload = {
        mode: 'payment',
        price_id: FEATURED_STAR_PRICE_ID,
        quantity: 1,
        amount: 10, // your Edge Function requires amount; keep in sync with display
        metadata: { product: 'featured_star' },
        success_url: successUrl,
        cancel_url: cancelUrl
      };

      let checkoutUrl;

      // Try invoke first
      try {
        if (supabase.functions?.invoke) {
          const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: payload });
          if (error) throw error;
          checkoutUrl = data?.url || data?.session_url || data?.checkout_url;
        }
      } catch (e) {
        console.warn('invoke failed; falling back to fetch()', e);
      }

      // Fallback: direct fetch
      if (!checkoutUrl) {
        const jwt = await prem_getJwt();
        const resp = await fetch(`${prem_functionsBase()}/stripe-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
          body: JSON.stringify(payload)
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || 'Checkout create failed');
        checkoutUrl = json?.url || json?.session_url || json?.checkout_url;
      }

      if (!checkoutUrl) throw new Error('No checkout URL returned');

      // Mark intent locally (optional)
      localStorage.setItem('premiumCheckout', 'featured_star');

      status.textContent = 'Redirecting to Stripe…';
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error(err);
      if (status) status.textContent = 'Could not create checkout. Please try again.';
      alert('Sorry, we could not start checkout. If this keeps happening, contact support.');
    }
  });
}

// --- Wire dropdown item ---
document.getElementById('open-premium-settings')?.addEventListener('click', async () => {
  ensurePremiumModal();
  openModal('premium-modal');               // your existing helper
  await loadMyFeaturedSlots();              // <-- populate rows on open
});



});
