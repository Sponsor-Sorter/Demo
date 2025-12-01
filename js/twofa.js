// ./js/twofa.js
//
// Two-Factor Authentication helpers for Sponsor Sorter.
// - Settings page: initTwoFASettings() wires up the Security modal UI
//   (email 2FA, authenticator app, backup codes).
// - Login page:    loginWith2FA() wraps signInWithPassword and, if needed,
//                  runs an email / authenticator (TOTP) 2FA challenge step.
//                  Users can also enter one of their backup codes instead
//                  of the 6-digit code.
//
// This file assumes:
// - supabaseClient.js exports `supabase` (v2 client)
// - alerts.js registers `window.showToast(message, type?)` (global)
// - (Optional) qrcode.js is loaded globally as `QRCode` for TOTP QR codes:
//     <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
// - TOTP is handled via OTPAuth, imported from cdnjs:
//
//     import * as OTPAuth from 'https://cdnjs.cloudflare.com/ajax/libs/otpauth/9.4.1/otpauth.esm.min.js';

import { supabase } from './supabaseClient.js';
import * as OTPAuth from 'https://cdnjs.cloudflare.com/ajax/libs/otpauth/9.4.1/otpauth.esm.min.js';

// 2FA method constants
const TWOFA_METHOD_NONE  = 'none';
const TWOFA_METHOD_EMAIL = 'email';
const TWOFA_METHOD_TOTP  = 'totp';

// How many backup codes to generate per set
const BACKUP_CODES_COUNT = 10;

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

// Functions base URL, kept here in case we need functions later
function functionsBase() {
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

// ---- Email 2FA helpers -----------------------------------------------------

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

// ---- TOTP (authenticator-app) helpers -------------------------------------
//
// DB columns assumed to exist on users_extended_data:
//   - twofa_totp_secret text
//   - twofa_totp_confirmed boolean default false

async function saveTotpSecret(userId, secret) {
  const { error } = await supabase
    .from('users_extended_data')
    .update({
      twofa_totp_secret: secret,
      twofa_totp_confirmed: false
    })
    .eq('user_id', userId);

  if (error) throw error;
}

async function clearTotpSecret(userId) {
  const { error } = await supabase
    .from('users_extended_data')
    .update({
      twofa_totp_secret: null,
      twofa_totp_confirmed: false
    })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Generate a new random TOTP secret as a base32 string.
 */
function generateTotpSecret() {
  const secret = new OTPAuth.Secret({ size: 20 }); // 20 bytes ~ 160 bits
  return secret.base32;
}

/**
 * Build an otpauth:// URI compatible with Google Authenticator, Authy, etc.
 */
function buildTotpUri({ secret, label, issuer }) {
  const totp = new OTPAuth.TOTP({
    issuer,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.toString(); // otpauth://totp/...
}

/**
 * Verify a 6-digit TOTP token against the shared secret.
 * We allow a small window for clock drift (±30s).
 */
function verifyTotpToken({ secret, token }) {
  if (!secret || !token) return false;

  const totp = new OTPAuth.TOTP({
    issuer: 'Sponsor Sorter',
    label: 'Login',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({
    token: String(token).trim(),
    window: 1,
  });

  return delta !== null;
}

/**
 * Render QR code + manual secret into provided DOM nodes (if present).
 *
 * Expected elements:
 *  - div#twofa-totp-qr
 *  - input#twofa-totp-secret (readonly)
 *  - small#twofa-totp-status (optional)
 *
 * qrcode.js must be loaded globally as `QRCode` for QR rendering.
 */
function populateTotpDisplay(secret, labelHint) {
  const qrContainer   = document.getElementById('twofa-totp-qr');
  const secretInput   = document.getElementById('twofa-totp-secret');
  const statusElement = document.getElementById('twofa-totp-status');

  if (secretInput) {
    secretInput.value = secret || '';
  }

  if (!secret || !qrContainer || typeof QRCode === 'undefined') {
    if (statusElement) {
      statusElement.textContent =
        'Authenticator secret generated. Your browser may not support QR codes; use the manual secret above.';
    }
    return;
  }

  // Clear any previous QR/logo
  qrContainer.innerHTML = '';

  // Create a wrapper so we can absolutely-position the logo inside
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = '160px';
  wrapper.style.height = '160px';
  wrapper.style.display = 'inline-block';
  qrContainer.appendChild(wrapper);

  const uri = buildTotpUri({
    secret,
    issuer: 'Sponsor Sorter',
    label: labelHint || 'SponsorSorter',
  });

  // Render the QR code into the wrapper
  // eslint-disable-next-line no-undef
  new QRCode(wrapper, {
    text: uri,
    width: 160,
    height: 160,
  });

  // Add centered logo overlay
  const logo = document.createElement('img');
  logo.src = './logos.png'; // <- your existing logo file
  logo.alt = 'Sponsor Sorter';
  logo.style.position = 'absolute';
  logo.style.top = '50%';
  logo.style.left = '50%';
  logo.style.transform = 'translate(-50%, -50%)';
  logo.style.width = '48px';   // ~30% of QR size to keep it scannable
  logo.style.height = '48px';
  logo.style.borderRadius = '8px';
  logo.style.background = '#111';
  logo.style.padding = '4px';
  logo.style.boxSizing = 'border-box';
  logo.style.pointerEvents = 'none';

  wrapper.appendChild(logo);

  if (statusElement) {
    statusElement.textContent =
      'Scan this QR code with your authenticator app, or use the manual secret above.';
  }
}

// ---- Backup codes helpers --------------------------------------------------
//
// DB column on users_extended_data:
//   - twofa_backup_codes text[]  (stores hashed backup codes)

function generateBackupCode() {
  // Example format: XXXX-YYYY (A–Z, 0–9; no easily-confused chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid 0,1,I,O for clarity
  const pick = () => chars[Math.floor(Math.random() * chars.length)];

  const part1 = Array.from({ length: 4 }, pick).join('');
  const part2 = Array.from({ length: 4 }, pick).join('');
  return `${part1}-${part2}`;
}

async function hashStringSHA256(str) {
  try {
    if (
      typeof window === 'undefined' ||
      !window.crypto ||
      !window.crypto.subtle ||
      typeof TextEncoder === 'undefined'
    ) {
      // Fallback: return the plain string if crypto API unavailable
      return str;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hashBuffer);

    // Convert to hex
    let hex = '';
    for (let i = 0; i < bytes.length; i += 1) {
      const b = bytes[i].toString(16).padStart(2, '0');
      hex += b;
    }
    return hex;
  } catch (err) {
    console.warn('[2FA] Failed to hash backup code; storing plain text instead.', err);
    return str;
  }
}

/**
 * Generate a fresh set of backup codes for a user, store only hashed values
 * in users_extended_data.twofa_backup_codes, and return the plaintext codes
 * so the UI can display them once.
 */
async function generateAndSaveBackupCodes(userId, count = BACKUP_CODES_COUNT) {
  const plainCodes = [];
  for (let i = 0; i < count; i += 1) {
    plainCodes.push(generateBackupCode());
  }

  const hashedCodes = [];
  for (const code of plainCodes) {
    const hashed = await hashStringSHA256(code);
    hashedCodes.push(hashed);
  }

  const { error } = await supabase
    .from('users_extended_data')
    .update({ twofa_backup_codes: hashedCodes })
    .eq('user_id', userId);

  if (error) {
    console.error('[2FA] Error saving backup codes:', error);
    throw error;
  }

  return plainCodes;
}

// Consume a backup code at login.
//  - hash the candidate
//  - check if it’s in the array
//  - if so, remove it and save the new array
export async function tryConsumeBackupCode(userId, code) {
  const candidateHash = await hashStringSHA256(code.trim());

  const { data, error } = await supabase
    .from('users_extended_data')
    .select('twofa_backup_codes')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('[2FA] Failed to load backup codes for verification:', error);
    return { ok: false, reason: 'lookup_failed' };
  }

  const existing = Array.isArray(data.twofa_backup_codes)
    ? data.twofa_backup_codes
    : [];

  const idx = existing.indexOf(candidateHash);
  if (idx === -1) {
    return { ok: false, reason: 'not_found' };
  }

  // Remove used code
  const updated = existing.slice();
  updated.splice(idx, 1);

  const { error: saveError } = await supabase
    .from('users_extended_data')
    .update({ twofa_backup_codes: updated })
    .eq('user_id', userId);

  if (saveError) {
    console.error('[2FA] Failed to update backup codes after use:', saveError);
    return { ok: false, reason: 'save_failed' };
  }

  return { ok: true, remaining: updated.length };
}

// ---- Edge Function call: sendNotificationEmail -----------------------------

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

  const functionsBaseUrl =
    (supabase && supabase.functionsUrl) ||
    'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1';

  const { data } = await supabase.auth.getSession();
  const jwt = data?.session?.access_token || '';

  try {
    const resp = await fetch(`${functionsBaseUrl}/sendNotificationEmail`, {
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
//
// Existing expected HTML elements (email 2FA):
//  - span#twofa-status-text
//  - button#twofa-enable-email
//  - button#twofa-disable
//  - div#twofa-email-setup
//      - input#twofa-setup-code
//      - button#twofa-setup-confirm
//
// New expected HTML elements (TOTP 2FA):
//  - button#twofa-enable-totp
//  - div#twofa-totp-setup
//      - div#twofa-totp-qr
//      - input#twofa-totp-secret  (readonly, manual entry)
//      - input#twofa-totp-code    (user enters 6-digit token)
//      - button#twofa-totp-confirm
//      - small#twofa-totp-status  (optional message text)
//
// Backup codes UI (in Security modal):
//  - small#twofa-backup-status
//  - button#twofa-backup-generate
//  - div#twofa-backup-codes-wrapper
//      - ul#twofa-backup-codes-list

export async function initTwoFASettings() {
  const statusSpan      = document.getElementById('twofa-status-text');
  const enableEmailBtn  = document.getElementById('twofa-enable-email');
  const disableBtn      = document.getElementById('twofa-disable');
  const setupBlock      = document.getElementById('twofa-email-setup');
  const setupCodeInput  = document.getElementById('twofa-setup-code');
  const setupConfirmBtn = document.getElementById('twofa-setup-confirm');

  // TOTP-related elements (if present)
  const enableTotpBtn   = document.getElementById('twofa-enable-totp');
  const totpSetupBlock  = document.getElementById('twofa-totp-setup');
  const totpCodeInput   = document.getElementById('twofa-totp-code');
  const totpConfirmBtn  = document.getElementById('twofa-totp-confirm');

  // Backup codes elements (if present)
  const backupStatusEl    = document.getElementById('twofa-backup-status');
  const backupGenerateBtn = document.getElementById('twofa-backup-generate');
  const backupWrapper     = document.getElementById('twofa-backup-codes-wrapper');
  const backupList        = document.getElementById('twofa-backup-codes-list');

  // If key controls don't exist, we're not on a page that needs 2FA settings.
  if (!statusSpan || !enableEmailBtn || !disableBtn) {
    return;
  }

  const { user, profile, error } = await getCurrentUserAndProfile();
  if (error || !user || !profile) {
    console.error('initTwoFASettings error', error);
    return;
  }

  let currentTotpSecret = profile.twofa_totp_secret || null;

  function refreshStatusUi(enabled, method) {
    if (!enabled || method === TWOFA_METHOD_NONE) {
      statusSpan.textContent = 'Disabled';
      if (setupBlock) setupBlock.style.display = 'none';
      if (totpSetupBlock) totpSetupBlock.style.display = 'none';
    } else if (method === TWOFA_METHOD_EMAIL) {
      statusSpan.textContent = 'Email 2FA enabled';
      if (setupBlock) setupBlock.style.display = 'none';
      if (totpSetupBlock) totpSetupBlock.style.display = 'none';
    } else if (method === TWOFA_METHOD_TOTP) {
      statusSpan.textContent = 'Authenticator app (TOTP) enabled';
      if (setupBlock) setupBlock.style.display = 'none';
      if (totpSetupBlock) totpSetupBlock.style.display = 'none';
    }
  }

  refreshStatusUi(profile.twofa_enabled, profile.twofa_method);

  // ---------------- Backup codes status + generate button -------------------

  if (backupStatusEl) {
    const existingCount = Array.isArray(profile.twofa_backup_codes)
      ? profile.twofa_backup_codes.length
      : 0;

    backupStatusEl.textContent =
      existingCount > 0
        ? 'You already have backup codes. Generating new ones will invalidate the old set.'
        : 'No backup codes generated yet.';
  }

  if (backupGenerateBtn && backupWrapper && backupList) {
    backupGenerateBtn.addEventListener('click', async () => {
      try {
        const confirmed = window.confirm(
          'Generate new backup codes? Any existing backup codes will stop working.'
        );
        if (!confirmed) return;

        backupGenerateBtn.disabled = true;
        if (backupStatusEl) {
          backupStatusEl.textContent = 'Generating new backup codes...';
        }

        // Generate & save hashed codes, returns plaintext list for display
        const plainCodes = await generateAndSaveBackupCodes(user.id);

        // Render codes for the user (one-time display)
        backupList.innerHTML = '';
        plainCodes.forEach((code) => {
          const li = document.createElement('li');
          li.textContent = code;
          backupList.appendChild(li);
        });

        backupWrapper.style.display = 'block';

        if (backupStatusEl) {
          backupStatusEl.textContent =
            'These codes will only be shown here once. Store them in a safe place.';
        }

        toast('Backup codes generated. Save them somewhere safe.', 'success');
      } catch (err) {
        console.error('Error generating backup codes', err);
        if (backupStatusEl) {
          backupStatusEl.textContent = 'Could not generate backup codes. Please try again.';
        }
        toast('Could not generate backup codes. Please try again.', 'error');
      } finally {
        backupGenerateBtn.disabled = false;
      }
    });
  }

  // ---------------- Email 2FA setup ----------------------------------------

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

  // ---------------- TOTP 2FA setup -----------------------------------------

  if (enableTotpBtn && totpSetupBlock && totpConfirmBtn && totpCodeInput) {
    enableTotpBtn.addEventListener('click', async () => {
      try {
        // Generate or reuse a secret
        if (!currentTotpSecret) {
          currentTotpSecret = generateTotpSecret();
          await saveTotpSecret(user.id, currentTotpSecret);
        }

        // Show the setup block + QR/manual secret
        totpSetupBlock.style.display = 'block';
        const labelHint = profile.username || profile.email || user.email || 'SponsorSorter';
        populateTotpDisplay(currentTotpSecret, labelHint);

        toast(
          'Scan the QR with your authenticator app, then enter a 6-digit code to confirm.',
          'info'
        );
      } catch (err) {
        console.error('Error starting TOTP setup', err);
        toast('Could not start authenticator app setup. Please try again.', 'error');
      }
    });

    totpConfirmBtn.addEventListener('click', async () => {
      try {
        const token = (totpCodeInput.value || '').trim();
        if (!token || token.length < 6) {
          toast('Enter the 6-digit code from your authenticator app.', 'warn');
          return;
        }

        // Reload the secret from DB to be safe
        const { data: freshProfile, error: freshErr } = await supabase
          .from('users_extended_data')
          .select('twofa_totp_secret')
          .eq('user_id', user.id)
          .single();

        if (freshErr || !freshProfile || !freshProfile.twofa_totp_secret) {
          console.error('Error loading TOTP secret for verification', freshErr);
          toast('Unable to verify authenticator code. Please try again.', 'error');
          return;
        }

        const secret = freshProfile.twofa_totp_secret;
        const ok = verifyTotpToken({ secret, token });

        if (!ok) {
          toast('Invalid authenticator code. Please try again.', 'error');
          return;
        }

        const { error: updErr } = await supabase
          .from('users_extended_data')
          .update({
            twofa_enabled: true,
            twofa_method: TWOFA_METHOD_TOTP,
            twofa_totp_confirmed: true
          })
          .eq('user_id', user.id);

        if (updErr) {
          console.error('Error enabling TOTP 2FA', updErr);
          toast('Failed to enable authenticator 2FA. Please try again.', 'error');
          return;
        }

        refreshStatusUi(true, TWOFA_METHOD_TOTP);
        totpSetupBlock.style.display = 'none';
        toast('Authenticator app 2FA enabled for your account.', 'success');
      } catch (err) {
        console.error('Error confirming TOTP code', err);
        toast('Could not verify authenticator code. Please try again.', 'error');
      }
    });
  }

  // ---------------- Disable 2FA (any method) --------------------------------

  disableBtn.addEventListener('click', async () => {
    try {
      await updateTwoFASettings(user.id, false, TWOFA_METHOD_NONE);
      await clearEmail2FACode(user.id);
      await clearTotpSecret(user.id);
      await supabase
        .from('users_extended_data')
        .update({ twofa_backup_codes: [] })
        .eq('user_id', user.id);

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
//
// Call loginWith2FA() from login.js instead of directly calling
// supabase.auth.signInWithPassword.
//
// For email 2FA login challenge, the page should have:
//  - div#twofa-login-step
//  - input#twofa-login-code
//  - button#twofa-login-confirm
//  - button#twofa-login-resend
//
// For TOTP 2FA login challenge, you can add:
//  - div#twofa-login-totp-step
//  - input#twofa-login-totp-code
//  - button#twofa-login-totp-confirm
//
// Backup codes:
//  - No extra fields are required. Users can paste one of their backup
//    codes into the same 2FA input. Anything that is *not* a 6-digit
//    numeric code is treated as a backup code.
//
// If any of those elements are missing, the TOTP/email step will be
// skipped and we’ll redirect straight to the dashboard.

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
    .select('userType, twofa_enabled, twofa_method, twofa_totp_secret, twofa_totp_confirmed')
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

  if (profile.twofa_method === TWOFA_METHOD_TOTP && profile.twofa_totp_confirmed) {
    await startTotp2FAChallengeForLogin(user, profile, dashboardUrl, onError, onRedirect);
    return;
  }

  // Fallback: if method is unknown, just let them in (fail-open rather than lock-out)
  onRedirect(dashboardUrl);
}

/**
 * Email 2FA login challenge (plus backup code support).
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
    toast('We emailed you a login code. Enter it (or one of your backup codes) to finish signing in.', 'info');
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
      const userInputRaw = (codeInput.value || '').trim();
      if (!userInputRaw) {
        toast('Enter the 6-digit code or one of your backup codes.', 'warn');
        return;
      }

      const isSixDigitNumeric = /^[0-9]{6}$/.test(userInputRaw);

      // If it’s NOT a 6-digit numeric code, treat it as a backup code
      if (!isSixDigitNumeric) {
        const { ok } = await tryConsumeBackupCode(user.id, userInputRaw);
        if (!ok) {
          toast('That backup code is not valid or has already been used.', 'error');
          return;
        }

        toast('Backup code accepted. Login verified.', 'success');
        onRedirect(dashboardUrl);
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

      if (userInputRaw !== twofa_email_code) {
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

/**
 * TOTP (authenticator-app) 2FA login challenge.
 *
 * Expected TOTP login HTML:
 *  - div#twofa-login-totp-step
 *  - input#twofa-login-totp-code
 *  - button#twofa-login-totp-confirm
 *
 * Backup codes are supported via the same input; non-6-digit values
 * are treated as backup codes.
 */
async function startTotp2FAChallengeForLogin(user, profile, dashboardUrl, onError, onRedirect) {
  const stepDiv    = document.getElementById('twofa-login-totp-step');
  const codeInput  = document.getElementById('twofa-login-totp-code');
  const confirmBtn = document.getElementById('twofa-login-totp-confirm');

  if (!stepDiv || !codeInput || !confirmBtn) {
    console.warn('TOTP 2FA login UI elements not found; skipping TOTP step.');
    onRedirect(dashboardUrl);
    return;
  }

  stepDiv.style.display = 'block';
  codeInput.value = '';

  confirmBtn.onclick = async () => {
    try {
      const tokenRaw = (codeInput.value || '').trim();
      if (!tokenRaw) {
        toast('Enter the 6-digit code from your app or one of your backup codes.', 'warn');
        return;
      }

      const isSixDigitNumeric = /^[0-9]{6}$/.test(tokenRaw);

      // Backup code path
      if (!isSixDigitNumeric) {
        const { ok } = await tryConsumeBackupCode(user.id, tokenRaw);
        if (!ok) {
          toast('That backup code is not valid or has already been used.', 'error');
          return;
        }

        toast('Backup code accepted. Login verified.', 'success');
        onRedirect(dashboardUrl);
        return;
      }

      // Normal TOTP path
      const { data: freshProfile, error: freshErr } = await supabase
        .from('users_extended_data')
        .select('twofa_totp_secret')
        .eq('user_id', user.id)
        .single();

      if (freshErr || !freshProfile || !freshProfile.twofa_totp_secret) {
        console.error('Error loading TOTP secret for login', freshErr);
        onError('Unable to verify authenticator code. Please try again.');
        return;
      }

      const secret = freshProfile.twofa_totp_secret;
      const ok = verifyTotpToken({ secret, token: tokenRaw });

      if (!ok) {
        toast('Invalid authenticator code. Please try again.', 'error');
        return;
      }

      toast('Login verified.', 'success');
      onRedirect(dashboardUrl);
    } catch (err) {
      console.error('Error verifying TOTP login code', err);
      onError('Could not verify authenticator code. Please try again.');
    }
  };
}
