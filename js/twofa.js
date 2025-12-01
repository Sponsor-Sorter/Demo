// ./js/twofa.js
//
// Two-Factor Authentication helpers for Sponsor Sorter.
// - Settings page: initTwoFASettings() wires up the Security modal UI.
// - Login page:    loginWith2FA() wraps signInWithPassword and, if needed,
//                  runs an email 2FA challenge step.
//
// This file assumes:
// - supabaseClient.js exports `supabase` (v2 client)
// - alerts.js registers `window.showToast(message, type?)` (global)
//
// No other modules are imported from here so that this stays lightweight.

import { supabase } from './supabaseClient.js';

// 2FA method constants
const TWOFA_METHOD_NONE  = 'none';
const TWOFA_METHOD_EMAIL = 'email';
const TWOFA_METHOD_TOTP  = 'totp'; // reserved for future authenticator app support

// ---- Toast helper ----------------------------------------------------------

function toast(message, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    const prefix = `[${type}]`;
    if (type === 'error' && console.error) {
      console.error(prefix, message);
    } else if ((type === 'warn' || type === 'warning') && console.warn) {
      console.warn(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}

// ---- Small shared helpers --------------------------------------------------

// this mirrors resolveDashboardPath in alerts.js/settings.js
function resolveDashboardPath(userType) {
  return (String(userType || '').toLowerCase() === 'besponsored')
    ? './dashboardsponsee.html'
    : './dashboardsponsor.html';
}

// Functions base URL, copied from settings.js: prem_functionsBase()
function functionsBase() {
  // supabase.functionsUrl will be undefined on some local setups;
  // fall back to the known project URL.
  return (supabase && supabase.functionsUrl) ||
         'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1';
}

async function getCurrentUserAndProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { user: null, profile: null, error: userError || new Error('No user') };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users_extended_data')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return { user, profile: null, error: profileError || new Error('Profile not found') };
  }

  return { user, profile, error: null };
}

function generateSixDigitCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

async function saveEmail2FACode(userId, code, expiresAtIso) {
  const { error } = await supabase
    .from('users_extended_data')
    .update({
      twofa_email_code: code,
      twofa_email_expires_at: expiresAtIso
    })
    .eq('user_id', userId);

  if (error) throw error;
}

async function clearEmail2FACode(userId) {
  const { error } = await supabase
    .from('users_extended_data')
    .update({
      twofa_email_code: null,
      twofa_email_expires_at: null
    })
    .eq('user_id', userId);

  if (error) throw error;
}

async function updateTwoFASettings(userId, enabled, method) {
  const { error } = await supabase
    .from('users_extended_data')
    .update({
      twofa_enabled: enabled,
      twofa_method: enabled ? method : TWOFA_METHOD_NONE
    })
    .eq('user_id', userId);

  if (error) throw error;
}

// ---- Edge Function call: sendNotificationEmail -----------------------------

// === 2FA email helper ===
async function sendTwoFAEmail(toEmail, code, context = 'login') {
  const subject =
    context === 'setup'
      ? 'Two-Factor Authentication enabled on your Sponsor Sorter account'
      : 'Your Sponsor Sorter login code';

  const message =
    `Hi,\n\n` +
    `Your Sponsor Sorter verification code is: ${code}\n\n` +
    `This code will expire in 10 minutes.\n` +
    `If you did not request this, please secure your account immediately.\n\n` +
    `— Sponsor Sorter`;

  // Local dev: DON'T hit the Edge Function (avoids CORS + lets you test)
  const origin = window.location.origin || '';
  const isLocalDev =
    origin.includes('127.0.0.1:5500') ||
    origin.includes('localhost:5500');

  if (isLocalDev) {
    console.log(
      '[2FA DEV] Skipping sendNotificationEmail call. ' +
      `Would send email to ${toEmail} with code ${code} (context=${context}).`
    );
    return;
  }

  // Production: call the Edge Function directly via fetch (same pattern as other functions)
  const functionsBase =
    (supabase && supabase.functionsUrl) ||
    'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1';

  // Get the current JWT so the function can auth the user if it needs to
  const { data } = await supabase.auth.getSession();
  const jwt = data?.session?.access_token || '';

  try {
    const resp = await fetch(`${functionsBase}/sendNotificationEmail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        to: toEmail,
        subject,
        message,
        type: '2fa'
      })
    });

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      console.error(
        'sendNotificationEmail failed:',
        resp.status,
        bodyText || resp.statusText
      );
      throw new Error(`sendNotificationEmail HTTP ${resp.status}`);
    }
  } catch (err) {
    console.error('Error sending 2FA email via Edge Function:', err);
    throw err;
  }
}


// ============================================================================
//  2FA SETTINGS (Security modal on dashboards)
// ============================================================================

/**
 * Initialize 2FA settings UI.
 *
 * Expected HTML elements:
 *  - span#twofa-status-text
 *  - button#twofa-enable-email
 *  - button#twofa-disable
 *  - div#twofa-email-setup  (optional, for setup code entry)
 *      - input#twofa-setup-code
 *      - button#twofa-setup-confirm
 */
export async function initTwoFASettings() {
  const statusSpan      = document.getElementById('twofa-status-text');
  const enableEmailBtn  = document.getElementById('twofa-enable-email');
  const disableBtn      = document.getElementById('twofa-disable');
  const setupBlock      = document.getElementById('twofa-email-setup');
  const setupCodeInput  = document.getElementById('twofa-setup-code');
  const setupConfirmBtn = document.getElementById('twofa-setup-confirm');

  // If these don't exist, we're not on a page that needs 2FA settings.
  if (!statusSpan || !enableEmailBtn || !disableBtn) {
    return;
  }

  const { user, profile, error } = await getCurrentUserAndProfile();
  if (error || !user || !profile) {
    console.error('initTwoFASettings error', error);
    return;
  }

  function refreshStatusUi(enabled, method) {
    if (!enabled || method === TWOFA_METHOD_NONE) {
      statusSpan.textContent = 'Disabled';
      if (setupBlock) setupBlock.style.display = 'none';
    } else if (method === TWOFA_METHOD_EMAIL) {
      statusSpan.textContent = 'Email 2FA enabled';
      if (setupBlock) setupBlock.style.display = 'none';
    } else if (method === TWOFA_METHOD_TOTP) {
      statusSpan.textContent = 'Authenticator app (TOTP) enabled';
      if (setupBlock) setupBlock.style.display = 'none';
    }
  }

  refreshStatusUi(profile.twofa_enabled, profile.twofa_method);

  // Start enable-email 2FA setup
  enableEmailBtn.addEventListener('click', async () => {
    try {
      const code = generateSixDigitCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await saveEmail2FACode(user.id, code, expiresAt);
      await sendTwoFAEmail(profile.email || user.email, code, 'setup');

      if (setupBlock) setupBlock.style.display = 'block';
      if (setupCodeInput) setupCodeInput.value = '';

      toast('We emailed you a 6-digit code. Enter it below to enable 2FA.', 'info');
    } catch (err) {
      console.error('Error starting 2FA email setup', err);
      toast('Could not start 2FA setup. Please try again.', 'error');
    }
  });

  // Confirm setup code
  if (setupConfirmBtn && setupCodeInput) {
    setupConfirmBtn.addEventListener('click', async () => {
      try {
        const userInput = (setupCodeInput.value || '').trim();
        if (!userInput) {
          toast('Please enter the code we emailed you.', 'warn');
          return;
        }

        const { data: freshProfile, error: freshErr } = await supabase
          .from('users_extended_data')
          .select('twofa_email_code, twofa_email_expires_at')
          .eq('user_id', user.id)
          .single();

        if (freshErr || !freshProfile) {
          console.error('Error loading 2FA code for verification', freshErr);
          toast('Unable to verify code. Please try again.', 'error');
          return;
        }

        const { twofa_email_code, twofa_email_expires_at } = freshProfile;
        if (!twofa_email_code || !twofa_email_expires_at) {
          toast('No active code found. Click enable again to resend.', 'warn');
          return;
        }

        const now    = new Date();
        const expiry = new Date(twofa_email_expires_at);

        if (now > expiry) {
          toast('That code has expired. Click enable again to get a new one.', 'warn');
          return;
        }

        if (userInput !== twofa_email_code) {
          toast('Incorrect code. Please double-check and try again.', 'error');
          return;
        }

        await updateTwoFASettings(user.id, true, TWOFA_METHOD_EMAIL);
        await clearEmail2FACode(user.id);

        refreshStatusUi(true, TWOFA_METHOD_EMAIL);
        if (setupBlock) setupBlock.style.display = 'none';

        toast('Email 2FA enabled for your account.', 'success');
      } catch (err) {
        console.error('Error confirming 2FA setup code', err);
        toast('Could not verify 2FA code. Please try again.', 'error');
      }
    });
  }

  // Disable 2FA
  disableBtn.addEventListener('click', async () => {
    try {
      await updateTwoFASettings(user.id, false, TWOFA_METHOD_NONE);
      await clearEmail2FACode(user.id);
      refreshStatusUi(false, TWOFA_METHOD_NONE);
      toast('Two-factor authentication has been disabled.', 'info');
    } catch (err) {
      console.error('Error disabling 2FA', err);
      toast('Could not disable 2FA. Please try again.', 'error');
    }
  });
}

// ============================================================================
//  LOGIN WRAPPER WITH OPTIONAL 2FA STEP
// ============================================================================

/**
 * Call this from login.js instead of directly calling supabase.auth.signInWithPassword.
 *
 * @param {string} email
 * @param {string} password
 * @param {(msg: string) => void} onError    - show error in login UI
 * @param {(url: string) => void} onRedirect - redirect when fully logged in
 */
export async function loginWith2FA(email, password, onError, onRedirect) {
  onError    = onError    || ((msg) => toast(msg, 'error'));
  onRedirect = onRedirect || ((url) => { window.location.href = url; });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Sign-in error', error);
    onError(error.message || 'Login failed. Please check your details.');
    return;
  }

  const user = data.user;
  if (!user) {
    onError('No user returned from login.');
    return;
  }

  // Load profile to see if 2FA is enabled
  const { data: profile, error: profileErr } = await supabase
    .from('users_extended_data')
    .select('userType, twofa_enabled, twofa_method, twofa_email_code, twofa_email_expires_at')
    .eq('user_id', user.id)
    .single();

  if (profileErr || !profile) {
    console.error('Error loading profile after login', profileErr);
    onError('Could not load your profile after login.');
    return;
  }

  const dashboardUrl = resolveDashboardPath(profile.userType);

  if (!profile.twofa_enabled || profile.twofa_method === TWOFA_METHOD_NONE) {
    onRedirect(dashboardUrl);
    return;
  }

  if (profile.twofa_method === TWOFA_METHOD_EMAIL) {
    await startEmail2FAChallengeForLogin(user, profile, dashboardUrl, onError, onRedirect);
    return;
  }

  if (profile.twofa_method === TWOFA_METHOD_TOTP) {
    // Placeholder for future TOTP integration
    onRedirect(dashboardUrl);
    return;
  }

  onRedirect(dashboardUrl);
}

/**
 * Email 2FA login challenge.
 *
 * Expects these elements on the login page (optional, only if you want
 * an inline 2FA step instead of a separate page):
 *  - div#twofa-login-step
 *  - input#twofa-login-code
 *  - button#twofa-login-confirm
 *  - button#twofa-login-resend
 */
async function startEmail2FAChallengeForLogin(user, profile, dashboardUrl, onError, onRedirect) {
  const twofaStepDiv = document.getElementById('twofa-login-step');
  const codeInput    = document.getElementById('twofa-login-code');
  const confirmBtn   = document.getElementById('twofa-login-confirm');
  const resendBtn    = document.getElementById('twofa-login-resend');

  if (!twofaStepDiv || !codeInput || !confirmBtn || !resendBtn) {
    console.warn('2FA login UI elements not found; skipping email 2FA step.');
    onRedirect(dashboardUrl);
    return;
  }

  // Helper: send a fresh code & persist
  const sendFreshCode = async () => {
    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await saveEmail2FACode(user.id, code, expiresAt);
    await sendTwoFAEmail(profile.email || user.email, code, 'login');
  };

  try {
    await sendFreshCode();
    twofaStepDiv.style.display = 'block';
    codeInput.value = '';
    toast('We emailed you a login code. Enter it to finish signing in.', 'info');
  } catch (err) {
    console.error('Error starting email 2FA login challenge', err);
    onError('Could not send login code. Please try again.');
    return;
  }

  // Avoid stacking multiple listeners if function is called again
  confirmBtn.onclick = null;
  resendBtn.onclick  = null;

  confirmBtn.onclick = async () => {
    try {
      const userInput = (codeInput.value || '').trim();
      if (!userInput) {
        toast('Please enter the code we emailed you.', 'warn');
        return;
      }

      const { data: freshProfile, error: freshErr } = await supabase
        .from('users_extended_data')
        .select('twofa_email_code, twofa_email_expires_at')
        .eq('user_id', user.id)
        .single();

      if (freshErr || !freshProfile) {
        console.error('Error loading 2FA code for login', freshErr);
        onError('Unable to verify login code. Please try again.');
        return;
      }

      const { twofa_email_code, twofa_email_expires_at } = freshProfile;
      if (!twofa_email_code || !twofa_email_expires_at) {
        toast('No active code found. Click resend to get a new one.', 'warn');
        return;
      }

      const now    = new Date();
      const expiry = new Date(twofa_email_expires_at);

      if (now > expiry) {
        toast('That code has expired. Click resend to get a new one.', 'warn');
        return;
      }

      if (userInput !== twofa_email_code) {
        toast('Incorrect code. Please double-check and try again.', 'error');
        return;
      }

      await clearEmail2FACode(user.id);

      toast('Login verified.', 'success');
      onRedirect(dashboardUrl);
    } catch (err) {
      console.error('Error verifying login 2FA code', err);
      onError('Could not verify login code. Please try again.');
    }
  };

  resendBtn.onclick = async () => {
    try {
      await sendFreshCode();
      toast('We sent you a new login code.', 'info');
    } catch (err) {
      console.error('Error resending login 2FA code', err);
      onError('Could not resend login code. Please try again.');
    }
  };
}
