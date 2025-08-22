// File: ./js/oauth-handler.js
// Unified OAuth callback handler for YouTube + Twitch
// - Backwards compatible with your current YouTube flow
// - Uses one callback page: /oauth2callback.html
// - Expects Twitch launcher to set state="twitch:<csrf>" (YouTube can remain unchanged)

import { supabase } from './supabaseClient.js';

// === Config ===
const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co'; // keep hardcoded like your current handler
const EDGE_FN = {
  youtube: 'youtube-oauth',
  twitch:  'twitch-oauth',
};

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('oauth-status');

  const setStatus = (html) => {
    if (statusDiv) statusDiv.innerHTML = html;
    else console.log('[oauth-handler]', html.replace(/<[^>]+>/g, ''));
  };

  // --- Parse URL params ---
  const p = new URLSearchParams(window.location.search);
  const code  = p.get('code');
  const error = p.get('error') || p.get('error_description');
  let state   = p.get('state') || '';

  if (error) {
    setStatus(`<span style="color:red;">OAuth failed: ${error}</span>`);
    safeBounce(`OAuth error: ${error}`);
    return;
  }
  if (!code) {
    setStatus(`<span style="color:red;">No OAuth code found. Please try connecting again.</span>`);
    return;
  }

  // --- Detect provider (state OR ?provider=) ---
  // Expected (preferred): state = "twitch:<csrf>" or "youtube:<csrf>"
  // Fallbacks: ?provider=twitch|youtube ; default -> youtube (legacy-safe)
  let provider = 'youtube';
  let csrfFromState = '';
  if (state.includes(':')) {
    const [maybeProvider, csrf] = state.split(':', 2);
    if (maybeProvider === 'twitch' || maybeProvider === 'youtube') {
      provider = maybeProvider;
      csrfFromState = csrf || '';
    }
  } else {
    const qProv = (p.get('provider') || '').toLowerCase();
    if (qProv === 'twitch' || qProv === 'youtube') provider = qProv;
  }

  // --- Friendly status text ---
  const niceName = provider === 'twitch' ? 'Twitch' : 'YouTube';
  setStatus(`<span style="color:#4886f4;">Connecting to ${niceName}, please wait...</span>`);

  try {
    const redirectUri = window.location.origin + window.location.pathname;

    // --- Optional CSRF check (new Twitch flow uses this; legacy YouTube may not) ---
    // If a CSRF was stored, enforce it; otherwise allow legacy YouTube path through.
    const expectedCsrf = localStorage.getItem('oauth_csrf');
    if (csrfFromState) {
      if (!expectedCsrf || expectedCsrf !== csrfFromState) {
        throw new Error('State mismatch');
      }
    }
    // Clean up either way (keeps storage tidy)
    if (expectedCsrf) localStorage.removeItem('oauth_csrf');

    // --- Current Supabase session JWT ---
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Not logged in or missing session.');

    // --- Call appropriate Edge Function ---
    const fn = EDGE_FN[provider];
    if (!fn) throw new Error('Unknown provider');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
      credentials: 'include',
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data?.error || data?.message || 'Unknown error');
    }

    // --- Success UX: notify opener (popup) or redirect fallback ---
    setStatus(`<span style="color:green;">${niceName} account successfully connected! Closing…</span>`);
    finalizeSuccess(provider);
  } catch (err) {
    setStatus(`<span style="color:red;">Failed to connect ${niceName}: ${err.message}</span>`);
    safeBounce(`Failed to connect ${niceName}: ${err.message}`);
  }
});

// Notify parent window if this is a popup, else redirect to dashboard
function finalizeSuccess(provider) {
  const flag =
    provider === 'twitch' ? { twitchConnected: true } :
    { youtubeConnected: true }; // default for legacy YouTube

  if (window.opener) {
    try {
      window.opener.postMessage(flag, '*');
    } catch {}
    window.close();
  } else {
    // Fallback: redirect to dashboard (matches your existing behavior)
    window.location.href = './dashboardsponsee.html';
  }
}

function safeBounce(msg) {
  // If opened as a popup, inform parent and close; else bounce to settings with error
  if (window.opener) {
    try {
      window.opener.postMessage({ oauthError: msg }, '*');
    } catch {}
    window.close();
  } else {
    window.location.href = `./settings.html?error=${encodeURIComponent(msg)}`;
  }
}
