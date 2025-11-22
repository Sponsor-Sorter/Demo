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

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'reset-status ' + (isError ? 'error' : 'success');
  }

  // Make sure this link actually gave us a session
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
