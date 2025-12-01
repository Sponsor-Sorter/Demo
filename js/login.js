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
    .limit(12);

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
    return;
  }

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
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ referred_user_id: user.id }),
      }
    );

    const result = await response.json().catch(() => ({}));

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
// 2FA constants & storage
// =======================
const TWOFA_CODE_LIFETIME_MINUTES = 10;
const TWOFA_MAX_ATTEMPTS = 3;
const TWOFA_LOCKOUT_HOURS = 24;
const TWOFA_TRUST_DAYS = 30;

const TWOFA_ATTEMPTS_KEY = 'ss_twofa_attempts';
const TWOFA_TRUSTED_KEY = 'ss_twofa_trusted_devices';

function readJsonFromStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return fallback;
  } catch (e) {
    console.warn('[2FA] Failed to read localStorage', e);
    return fallback;
  }
}

function writeJsonToStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[2FA] Failed to write localStorage', e);
  }
}

// Attempt tracking per user (device-local)
function getTwofaAttemptInfo(userId) {
  const all = readJsonFromStorage(TWOFA_ATTEMPTS_KEY, {});
  return all[userId] || { count: 0, lockedUntil: null };
}

function setTwofaAttemptInfo(userId, info) {
  const all = readJsonFromStorage(TWOFA_ATTEMPTS_KEY, {});
  all[userId] = info;
  writeJsonToStorage(TWOFA_ATTEMPTS_KEY, all);
}

function resetTwofaAttempts(userId) {
  const all = readJsonFromStorage(TWOFA_ATTEMPTS_KEY, {});
  if (userId in all) {
    delete all[userId];
    writeJsonToStorage(TWOFA_ATTEMPTS_KEY, all);
  }
}

function isTwofaLocked(userId) {
  const info = getTwofaAttemptInfo(userId);
  if (!info.lockedUntil) {
    return { locked: false, lockedUntil: null };
  }
  const now = Date.now();
  if (now >= info.lockedUntil) {
    // Lockout expired, reset attempts
    resetTwofaAttempts(userId);
    return { locked: false, lockedUntil: null };
  }
  return { locked: true, lockedUntil: info.lockedUntil };
}

function recordFailedTwofaAttempt(userId) {
  const now = Date.now();
  const prev = getTwofaAttemptInfo(userId);

  // If currently locked and not expired, just keep lock
  if (prev.lockedUntil && now < prev.lockedUntil) {
    return prev;
  }

  const newCount = (prev.count || 0) + 1;
  let lockedUntil = prev.lockedUntil || null;

  if (newCount >= TWOFA_MAX_ATTEMPTS) {
    lockedUntil = now + TWOFA_LOCKOUT_HOURS * 60 * 60 * 1000;
  }

  const info = { count: newCount, lockedUntil };
  setTwofaAttemptInfo(userId, info);
  return info;
}

// Trusted device helpers
function isDeviceTrustedForUser(userId) {
  const all = readJsonFromStorage(TWOFA_TRUSTED_KEY, {});
  const entry = all[userId];
  if (!entry || !entry.trustedUntil) return false;

  const now = Date.now();
  if (now >= entry.trustedUntil) {
    // expired, clean it up
    delete all[userId];
    writeJsonToStorage(TWOFA_TRUSTED_KEY, all);
    return false;
  }
  return true;
}

function setDeviceTrustedForUser(userId, days) {
  const all = readJsonFromStorage(TWOFA_TRUSTED_KEY, {});
  const now = Date.now();
  all[userId] = { trustedUntil: now + days * 24 * 60 * 60 * 1000 };
  writeJsonToStorage(TWOFA_TRUSTED_KEY, all);
}

// =======================
// 2FA helpers (DB + email)
// =======================
async function generateAndStoreTwofaCode(userId) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + TWOFA_CODE_LIFETIME_MINUTES * 60 * 1000
  ).toISOString();

  const { error } = await supabase
    .from('users_extended_data')
    .update({
      twofa_email_code: code,
      twofa_email_expires_at: expiresAt,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[2FA] Failed to store verification code:', error.message);
    throw new Error('Failed to store verification code.');
  }

  return code;
}

async function sendTwofaEmail(email, code) {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn('[2FA] Could not get session for email send:', sessionError.message);
    }

    const jwt = sessionData?.session?.access_token;
    if (!jwt) {
      console.warn('[2FA] No JWT available, cannot call sendNotificationEmail.');
      return { error: 'Missing auth session while sending 2FA email.' };
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/sendNotificationEmail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        type: 'twofa_login_code',
        to: email,
        subject: 'Your Sponsor Sorter login code',
        message: `Your Sponsor Sorter login code is ${code}. It expires in ${TWOFA_CODE_LIFETIME_MINUTES} minutes.`,
        code,
      }),
    });

    let result = {};
    try {
      result = await response.json();
    } catch (_e) {
      // ignore JSON parse error
    }

    if (!response.ok) {
      console.warn(
        '[2FA] sendNotificationEmail error:',
        result.error || result.message || response.statusText
      );
      return { error: result.error || 'Failed to send 2FA email.' };
    }

    console.log('[2FA] Login code email sent.');
    return { success: true };
  } catch (e) {
    console.error('[2FA] Exception sending 2FA email:', e);
    return { error: 'Unexpected error sending 2FA email.' };
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
  const resetOpen = document.getElementById('reset-password-open');
  const resetModal = document.getElementById('reset-password-modal');
  const resetClose = document.getElementById('reset-password-close');
  const resetForm = document.getElementById('reset-password-form');
  const resetEmailInput = document.getElementById('reset-email');
  const resetLastPasswordInput = document.getElementById('reset-last-password');
  const resetStatus = document.getElementById('reset-password-status');

  // 2FA elements
  const twofaStep = document.getElementById('twofa-step');
  const twofaEmailLabel = document.getElementById('twofa-email-label');
  const twofaCodeInput = document.getElementById('twofa-code-input');
  const twofaSubmitBtn = document.getElementById('twofa-submit-btn');
  const twofaResendBtn = document.getElementById('twofa-resend-btn');
  const twofaCancelBtn = document.getElementById('twofa-cancel-btn');
  const twofaStatusEl = document.getElementById('twofa-status');
  const twofaRememberCheckbox = document.getElementById('twofa-remember-device');

  // Current 2FA login context
  let twofaContext = null; // { userId, email, userType }

  // -------- Password eye toggle --------
  if (passwordInput && toggle) {
    const ICON_SHOW = '👁';
    const ICON_HIDE = '◡';

    const toggleVisibility = () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';

      toggle.textContent = isHidden ? ICON_HIDE : ICON_SHOW;
      toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
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
  if (resetOpen) {
    resetOpen.addEventListener('click', openResetModal);
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

      if (resetLastPasswordInput) {
        resetLastPasswordInput.value = '';
      }

      try {
        const redirectTo = `${window.location.origin}/reset-password.html`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });

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

  // -------- 2FA UI helpers --------
  function setTwofaStatus(message, type) {
    if (!twofaStatusEl) return;
    twofaStatusEl.textContent = message || '';
    twofaStatusEl.className = 'twofa-status';
    if (type) {
      twofaStatusEl.classList.add(type);
    }
  }

  function resetToLoginForm() {
    twofaContext = null;
    if (twofaStep) twofaStep.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
    if (twofaStatusEl) {
      twofaStatusEl.textContent = '';
      twofaStatusEl.className = 'twofa-status';
    }
    if (twofaCodeInput) twofaCodeInput.value = '';
    hideLoginErrorBox();
    if (twofaSubmitBtn) twofaSubmitBtn.disabled = false;
    if (twofaResendBtn) twofaResendBtn.disabled = false;
  }

  function redirectToDashboardByType(userType) {
    const t = (userType || '').toLowerCase();
    if (t === 'sponsor') {
      window.location.href = 'dashboardsponsor.html';
    } else if (t === 'besponsored') {
      window.location.href = 'dashboardsponsee.html';
    } else {
      alert('Unknown user type. Please contact support.');
    }
  }

  function formatLockoutTime(timestampMs) {
    try {
      return new Date(timestampMs).toLocaleString();
    } catch (_e) {
      return '';
    }
  }

  async function sendTwofaCodeForContext() {
    if (!twofaContext) return;

    const lockInfo = isTwofaLocked(twofaContext.userId);
    if (lockInfo.locked) {
      const untilStr = formatLockoutTime(lockInfo.lockedUntil);
      setTwofaStatus(
        untilStr
          ? `Too many incorrect attempts. This device is locked until ${untilStr}.`
          : 'Too many incorrect attempts. This device is temporarily locked.',
        'error'
      );
      if (twofaSubmitBtn) twofaSubmitBtn.disabled = true;
      if (twofaResendBtn) twofaResendBtn.disabled = true;
      return;
    }

    try {
      const code = await generateAndStoreTwofaCode(twofaContext.userId);
      const emailResult = await sendTwofaEmail(twofaContext.email, code);

      if (emailResult.error) {
        setTwofaStatus(emailResult.error, 'error');
      } else {
        setTwofaStatus('Verification code sent. Please check your email.', 'success');
      }
    } catch (err) {
      console.error('[2FA] Error during code send:', err);
      setTwofaStatus('Error sending verification code. Please try again.', 'error');
    }
  }

  async function beginTwofaLoginFlow(freshUser, extendedData, loginEmail) {
    if (!twofaStep || !loginForm) {
      console.warn('[2FA] UI container missing; skipping 2FA and redirecting.');
      redirectToDashboardByType(extendedData.userType);
      return;
    }

    twofaContext = {
      userId: freshUser.id,
      email: loginEmail,
      userType: extendedData.userType,
    };

    if (twofaEmailLabel) {
      twofaEmailLabel.textContent = loginEmail || '';
    }

    loginForm.style.display = 'none';
    twofaStep.style.display = 'block';

    if (twofaCodeInput) {
      twofaCodeInput.value = '';
      if (typeof twofaCodeInput.focus === 'function') {
        twofaCodeInput.focus();
      }
    }

    // Check lockout before sending code
    const lockInfo = isTwofaLocked(freshUser.id);
    if (lockInfo.locked) {
      const untilStr = formatLockoutTime(lockInfo.lockedUntil);
      setTwofaStatus(
        untilStr
          ? `Too many incorrect attempts. This device is locked until ${untilStr}.`
          : 'Too many incorrect attempts. This device is temporarily locked.',
        'error'
      );
      if (twofaSubmitBtn) twofaSubmitBtn.disabled = true;
      if (twofaResendBtn) twofaResendBtn.disabled = true;
      return;
    }

    if (twofaSubmitBtn) twofaSubmitBtn.disabled = false;
    if (twofaResendBtn) twofaResendBtn.disabled = false;

    setTwofaStatus('Sending verification code...', '');
    await sendTwofaCodeForContext();
  }

  // -------- 2FA button handlers --------
  if (twofaSubmitBtn) {
    twofaSubmitBtn.addEventListener('click', async () => {
      if (!twofaContext) return;

      const entered = twofaCodeInput?.value.trim();
      if (!entered || !/^\d{6}$/.test(entered)) {
        setTwofaStatus('Please enter the 6-digit code we sent you.', 'error');
        return;
      }

      // Check lockout state
      const lockInfo = isTwofaLocked(twofaContext.userId);
      if (lockInfo.locked) {
        const untilStr = formatLockoutTime(lockInfo.lockedUntil);
        setTwofaStatus(
          untilStr
            ? `Too many incorrect attempts. This device is locked until ${untilStr}.`
            : 'Too many incorrect attempts. This device is temporarily locked.',
          'error'
        );
        return;
      }

      setTwofaStatus('Verifying code...', '');

      const { data, error } = await supabase
        .from('users_extended_data')
        .select('twofa_email_code, twofa_email_expires_at, userType')
        .eq('user_id', twofaContext.userId)
        .single();

      if (error || !data) {
        console.error('[2FA] Could not fetch stored code:', error?.message);
        setTwofaStatus('Could not verify code. Please try again.', 'error');
        return;
      }

      const now = new Date();
      let failureReason = null;

      if (!data.twofa_email_code) {
        failureReason = 'missing';
      } else if (data.twofa_email_expires_at) {
        const expiresAt = new Date(data.twofa_email_expires_at);
        if (now > expiresAt) {
          failureReason = 'expired';
        }
      }

      if (!failureReason && data.twofa_email_code !== entered) {
        failureReason = 'mismatch';
      }

      if (failureReason) {
        let message;
        if (failureReason === 'expired') {
          message = 'That code has expired. Please click "Resend code" to get a new one.';
        } else {
          message = 'Incorrect code. Please double-check and try again.';
        }

        const info = recordFailedTwofaAttempt(twofaContext.userId);
        if (info.lockedUntil) {
          const untilStr = formatLockoutTime(info.lockedUntil);
          message =
            untilStr
              ? `Too many incorrect attempts. This device is locked until ${untilStr}.`
              : 'Too many incorrect attempts. This device is temporarily locked.';
        }

        setTwofaStatus(message, 'error');
        return;
      }

      // Success: clear code & expiry (best effort)
      const { error: clearError } = await supabase
        .from('users_extended_data')
        .update({
          twofa_email_code: null,
          twofa_email_expires_at: null,
        })
        .eq('user_id', twofaContext.userId);

      if (clearError) {
        console.warn('[2FA] Failed to clear stored code:', clearError.message);
      }

      // Reset attempts on success
      resetTwofaAttempts(twofaContext.userId);

      // Remember device if checked
      if (twofaRememberCheckbox && twofaRememberCheckbox.checked) {
        setDeviceTrustedForUser(twofaContext.userId, TWOFA_TRUST_DAYS);
      }

      setTwofaStatus('Code verified! Signing you in...', 'success');

      const finalUserType = twofaContext.userType || data.userType;
      redirectToDashboardByType(finalUserType);
    });
  }

  if (twofaResendBtn) {
    twofaResendBtn.addEventListener('click', async () => {
      if (!twofaContext) return;

      const lockInfo = isTwofaLocked(twofaContext.userId);
      if (lockInfo.locked) {
        const untilStr = formatLockoutTime(lockInfo.lockedUntil);
        setTwofaStatus(
          untilStr
            ? `Too many incorrect attempts. This device is locked until ${untilStr}.`
            : 'Too many incorrect attempts. This device is temporarily locked.',
          'error'
        );
        return;
      }

      setTwofaStatus('Resending verification code...', '');
      await sendTwofaCodeForContext();
    });
  }

  if (twofaCancelBtn) {
    twofaCancelBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      resetToLoginForm();
    });
  }

  if (twofaCodeInput && twofaSubmitBtn) {
    twofaCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        twofaSubmitBtn.click();
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

      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        console.warn('Login failed:', loginError.message);
        showLoginErrorBox();
        return;
      }

      const { data: freshUserData, error: userFetchError } = await supabase.auth.getUser();
      if (userFetchError) {
        alert('Failed to fetch fresh user data: ' + userFetchError.message);
        return;
      }

      const freshUser = freshUserData.user;
      console.log('Fresh user:', freshUser);

      const { data: extendedData, error: dataError } = await supabase
        .from('users_extended_data')
        .select('userType, referral_code, twofa_enabled, twofa_method, email')
        .eq('user_id', freshUser.id)
        .single();

      if (dataError || !extendedData) {
        alert('Failed to fetch user data: ' + (dataError?.message || 'No extended data found.'));
        return;
      }

      const isEmailConfirmed = !!freshUser.confirmed_at;

      const { error: updateError } = await supabase
        .from('users_extended_data')
        .update({ email_verified: isEmailConfirmed })
        .eq('user_id', freshUser.id);

      if (updateError) {
        console.warn('Failed to sync email_verified field:', updateError.message);
      }

      if (isEmailConfirmed && extendedData.referral_code) {
        await processReferralReward(freshUser);
      }

      if (!isEmailConfirmed) {
        alert('Email not verified yet. Redirecting to limited dashboard.');
        window.location.href = 'limited-dashboard.html';
        return;
      }

      const userType = extendedData.userType?.toLowerCase();
      const twofaEnabled = !!extendedData.twofa_enabled;
      const twofaMethod = (extendedData.twofa_method || '').toLowerCase();

      // If 2FA is enabled and device is trusted, skip 2FA
      if (twofaEnabled && twofaMethod === 'email') {
        if (isDeviceTrustedForUser(freshUser.id)) {
          console.log('[2FA] Trusted device detected, skipping 2FA step.');
          redirectToDashboardByType(userType);
          return;
        }

        console.log('[2FA] Two-factor auth enabled for this user. Starting 2FA login flow.');
        const loginEmail = extendedData.email || freshUser.email || email;
        await beginTwofaLoginFlow(freshUser, extendedData, loginEmail);
        return;
      }

      // No 2FA: redirect based on user type
      redirectToDashboardByType(userType);
    });
  }
});
