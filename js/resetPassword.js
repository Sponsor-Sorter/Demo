// ./js/resetPassword.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaXh0cm5ob3RxcXliYWdoZ255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NzM1OTcsImV4cCI6MjA2MTA0OTU5N30.mlRfsBXfHkRv8SVQHHPUSDiI74ROs55xdq-yRS-XYnY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Optional: log the PASSWORD_RECOVERY event when it happens
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[reset-password] auth event:', event, session);
});

window.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('new-password-form');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const statusEl = document.getElementById('new-password-status');

  // Eye toggle elements
  const newPasswordToggle = document.getElementById('new-password-toggle');
  const confirmPasswordToggle = document.getElementById('confirm-password-toggle');

  // Strength meter elements
  const strengthBar = document.getElementById('password-strength-bar');
  const strengthText = document.getElementById('password-strength-text');

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'reset-status ' + (isError ? 'error' : 'success');
  }

  // -------- Password eye toggles (same icons as login) --------
  function attachToggle(inputEl, toggleEl) {
    if (!inputEl || !toggleEl) return;

    const ICON_SHOW = '👁'; // field hidden → show password
    const ICON_HIDE = '◡';  // field visible → "closed eye"

    const toggleVisibility = () => {
      const isHidden = inputEl.type === 'password';
      inputEl.type = isHidden ? 'text' : 'password';

      toggleEl.textContent = isHidden ? ICON_HIDE : ICON_SHOW;
      toggleEl.setAttribute(
        'aria-label',
        isHidden ? 'Hide password' : 'Show password'
      );
    };

    toggleEl.addEventListener('click', toggleVisibility);
    toggleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleVisibility();
      }
    });
  }

  attachToggle(newPasswordInput, newPasswordToggle);
  attachToggle(confirmPasswordInput, confirmPasswordToggle);

  // -------- Password strength evaluation --------
  function evaluatePasswordStrength(pw) {
    if (!pw) {
      return { score: 0, label: 'Minimum 8 characters.' };
    }

    let score = 0;

    // Basic length
    if (pw.length >= 8) score++;
    // Mixed case
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    // Numbers
    if (/\d/.test(pw)) score++;
    // Symbols
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    // Extra length bonus
    if (pw.length >= 12) score++;

    let label;
    if (score <= 1) {
      label = 'Very weak';
    } else if (score === 2) {
      label = 'Weak';
    } else if (score === 3) {
      label = 'Medium';
    } else {
      label = 'Strong';
    }

    return { score, label };
  }

  function updateStrengthMeter() {
    if (!newPasswordInput || !strengthBar || !strengthText) return;

    const pw = newPasswordInput.value;
    if (!pw) {
      strengthBar.style.width = '0%';
      strengthBar.style.backgroundColor = '#444';
      strengthText.textContent = 'Minimum 8 characters.';
      return;
    }

    const { score, label } = evaluatePasswordStrength(pw);
    const normalized = Math.min(score, 4); // clamp to 0–4
    const widthPct = (normalized / 4) * 100;

    let color;
    if (normalized <= 1) {
      color = '#ff4d4d';      // red
    } else if (normalized === 2) {
      color = '#ffb74d';      // orange
    } else if (normalized === 3) {
      color = '#ffd95e';      // yellow
    } else {
      color = '#66ff99';      // green
    }

    strengthBar.style.width = widthPct + '%';
    strengthBar.style.backgroundColor = color;
    strengthText.textContent = 'Strength: ' + label;
  }

  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', updateStrengthMeter);
    // initialise empty state
    updateStrengthMeter();
  }

  // -------- Ensure the recovery link actually gave us a session --------
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[reset-password] getSession error:', error);
    }

    if (!data || !data.session) {
      setStatus(
        'This reset link is invalid or has expired. Please request a new reset email from the login page.',
        true
      );
      if (form) {
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
      }
      return;
    }
  } catch (e) {
    console.warn('[reset-password] unexpected getSession error:', e);
  }

  if (!form || !newPasswordInput || !confirmPasswordInput) return;

  // -------- Form submit: actually update the password via Supabase --------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const newPassword = newPasswordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (newPassword.length < 8) {
      setStatus('Password must be at least 8 characters long.', true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus('Passwords do not match. Please try again.', true);
      return;
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.warn('[reset-password] updateUser error:', error);
        setStatus('Error updating password: ' + error.message, true);
        return;
      }

      setStatus('Password updated! Redirecting you to the login page...', false);

      // Optionally sign out and send them back to login
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn('[reset-password] signOut error:', e);
        }
        window.location.href = './login.html';
      }, 2000);
    } catch (err) {
      console.warn('[reset-password] unexpected error:', err);
      setStatus('Unexpected error updating password. Please try again.', true);
    }
  });
});
