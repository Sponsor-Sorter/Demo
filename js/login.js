import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaXh0cm5ob3RxcXliYWdoZ255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NzM1OTcsImV4cCI6MjA2MTA0OTU5N30.mlRfsBXfHkRv8SVQHHPUSDiI74ROs55xdq-yRS-XYnY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =======================
// Sponsor logo carousels
// =======================
async function loadSponsorCarousels() {
  // Get up to 12 public user profiles, shuffled
  const { data: users, error } = await supabase
    .from('public_user_homepage_view')
    .select('profile_pic, username')
    .limit(12); // extra for shuffling

  if (error || !users || users.length === 0) return;

  // Shuffle and pick 3 for each side
  const shuffled = users.sort(() => Math.random() - 0.5);
  const left = shuffled.slice(0, 3);
  const right = shuffled.slice(3, 6);

  function profileHTML(user) {
    const picUrl = user.profile_pic
      ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${user.profile_pic}`
      : 'logos.png';
    const username = user.username || 'Sponsor';
    return `<li><figure>
      <img src="${picUrl}" alt="Sponsor Logo">
      <figcaption>@${username}</figcaption>
    </figure></li>`;
  }

  const leftList = document.getElementById('sponsor-list-left');
  if (leftList) leftList.innerHTML = left.map(profileHTML).join('');

  const rightList = document.getElementById('sponsor-list-right');
  if (rightList) rightList.innerHTML = right.map(profileHTML).join('');
}

// =======================
// Referral reward helper
// =======================
async function processReferralReward(user) {
  // Fetch extended user data again (to get referral_code if still present)
  const { data: ext, error: extErr } = await supabase
    .from('users_extended_data')
    .select('referral_code')
    .eq('user_id', user.id)
    .single();

  if (extErr) {
    console.warn('[Referral Reward] Could not fetch extended user data:', extErr.message);
    return;
  }

  const referral_code = ext?.referral_code;
  if (!referral_code) {
    // Already rewarded or never had referral
    return;
  }

  // Get JWT (must be fresh)
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData?.session?.access_token;

  if (!jwt) {
    console.warn('[Referral Reward] No JWT available. Cannot call edge function.');
    return;
  }

  try {
    const response = await fetch(
      'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/referral_rewards',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ referred_user_id: user.id })
      }
    );
    const result = await response.json();
    if (response.ok && result.success) {
      console.log('[Referral Reward] Reward processed:', result);
    } else if (response.status === 409) {
      console.log('[Referral Reward] Already granted:', result.error);
    } else {
      console.warn('[Referral Reward] Error:', result.error || result.details);
    }
  } catch (e) {
    console.warn('[Referral Reward] Exception calling edge function:', e);
  }
}

// =======================
// DOM wiring
// =======================
window.addEventListener('DOMContentLoaded', () => {
  // Load logos
  loadSponsorCarousels();

  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const toggle = document.getElementById('password-toggle');

  const errorBox = document.getElementById('login-error-box');

  // Reset password modal elements
  const resetTrigger = document.getElementById('reset-password-trigger');
  const resetModal = document.getElementById('reset-password-modal');
  const resetClose = document.getElementById('reset-password-close');
  const resetForm = document.getElementById('reset-password-form');
  const resetEmailInput = document.getElementById('reset-email');
  const resetLastPasswordInput = document.getElementById('reset-last-password');
  const resetStatus = document.getElementById('reset-password-status');

  // -------- Password eye toggle --------
  if (passwordInput && toggle) {
    const ICON_SHOW = '👁'; // field hidden → show password
    const ICON_HIDE = '◡';  // field visible → "closed eye"

    const toggleVisibility = () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';

      toggle.textContent = isHidden ? ICON_HIDE : ICON_SHOW;
      toggle.setAttribute(
        'aria-label',
        isHidden ? 'Hide password' : 'Show password'
      );
    };

    toggle.addEventListener('click', toggleVisibility);

    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleVisibility();
      }
    });
  }

  // -------- Error box helpers --------
  function showLoginErrorBox() {
    if (errorBox) errorBox.style.display = 'block';
  }

  function hideLoginErrorBox() {
    if (errorBox) errorBox.style.display = 'none';
  }

  // -------- Reset modal open/close --------
  function openResetModal() {
    if (!resetModal) return;

    // Pre-fill email with whatever they tried to log in with
    if (resetEmailInput && usernameInput && usernameInput.value) {
      resetEmailInput.value = usernameInput.value.trim();
    }

    if (resetStatus) {
      resetStatus.textContent = '';
      resetStatus.className = 'reset-status';
    }
    if (resetLastPasswordInput) resetLastPasswordInput.value = '';

    resetModal.style.display = 'flex';
  }

  function closeResetModal() {
    if (resetModal) resetModal.style.display = 'none';
  }

  if (resetTrigger) {
    resetTrigger.addEventListener('click', openResetModal);
  }
  if (resetClose) {
    resetClose.addEventListener('click', closeResetModal);
  }
  if (resetModal) {
    resetModal.addEventListener('click', (e) => {
      if (e.target === resetModal) {
        closeResetModal();
      }
    });
  }

  // -------- Reset password form submit --------
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!resetEmailInput) return;

      const email = resetEmailInput.value.trim();
      if (!email) {
        if (resetStatus) {
          resetStatus.textContent = 'Please enter your email address.';
          resetStatus.className = 'reset-status error';
        }
        return;
      }

      // For security, we do NOT send or store the "last password" anywhere
      if (resetLastPasswordInput) {
        resetLastPasswordInput.value = '';
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
          if (resetStatus) {
            resetStatus.textContent = 'Error sending reset email: ' + error.message;
            resetStatus.className = 'reset-status error';
          }
        } else {
          if (resetStatus) {
            resetStatus.textContent =
              'If that email exists in our system, a reset link has been sent.';
            resetStatus.className = 'reset-status success';
          }
        }
      } catch (err) {
        if (resetStatus) {
          resetStatus.textContent = 'Unexpected error sending reset email.';
          resetStatus.className = 'reset-status error';
        }
      }
    });
  }

  // -------- Login submit handler --------
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = usernameInput?.value.trim();
      const password = passwordInput?.value.trim();

      if (!email || !password) {
        showLoginErrorBox();
        return;
      }

      hideLoginErrorBox();

      // Attempt to sign in
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        console.warn('Login failed:', loginError.message);
        showLoginErrorBox();
        return;
      }

      // Force fetch fresh user object (with up-to-date confirmed_at)
      const { data: freshUserData, error: userFetchError } = await supabase.auth.getUser();
      if (userFetchError) {
        alert('Failed to fetch fresh user data: ' + userFetchError.message);
        return;
      }

      const freshUser = freshUserData.user;
      console.log('Fresh user:', freshUser);

      // Fetch extended user data from your custom table
      const { data: extendedData, error: dataError } = await supabase
        .from('users_extended_data')
        .select('userType, referral_code')
        .eq('user_id', freshUser.id)
        .single();

      if (dataError || !extendedData) {
        alert('Failed to fetch user data: ' + (dataError?.message || 'No extended data found.'));
        return;
      }

      // Check if email is confirmed
      const isEmailConfirmed = !!freshUser.confirmed_at;

      // Sync email_verified field in your custom table
      const { error: updateError } = await supabase
        .from('users_extended_data')
        .update({ email_verified: isEmailConfirmed })
        .eq('user_id', freshUser.id);

      if (updateError) {
        console.warn('Failed to sync email_verified field:', updateError.message);
      }

      // Run referral reward grant only if email is confirmed and referral_code exists
      if (isEmailConfirmed && extendedData.referral_code) {
        await processReferralReward(freshUser);
      }

      // Redirect based on verification
      if (!isEmailConfirmed) {
        alert('Email not verified yet. Redirecting to limited dashboard.');
        window.location.href = 'limited-dashboard.html';
        return;
      }

      // Redirect based on user type
      const userType = extendedData.userType?.toLowerCase();
      if (userType === 'sponsor') {
        window.location.href = 'dashboardsponsor.html';
      } else if (userType === 'besponsored') {
        window.location.href = 'dashboardsponsee.html';
      } else {
        alert('Unknown user type. Please contact support.');
      }
    });
  }
});
