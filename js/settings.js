// ./settings.js

import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';

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
    // 'onboarded' TRUE means completed (so onboarding should be hidden)
    // 'onboarded' FALSE/null means NOT completed (so onboarding should show)
    onboardingHidden = !!currentUser.onboarded;
    updateOnboardingToggleUI();
  }
  async function saveOnboardingSetting(val) {
    currentUser = await getActiveUser();
    if (!currentUser) return;
    // val: true = onboarding is done/hide, false = show onboarding
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
      // You could also trigger onboarding.js to run here if needed
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
    addPlatformBtn.onclick = () => {
      const plat = platformSelect.value;
      const handle = platformInput.value.trim();
      if (!plat || !handle) { socialMsg.textContent = "Choose a platform and enter a handle."; return; }
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
