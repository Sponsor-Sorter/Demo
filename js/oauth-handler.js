// File: ./js/oauth-handler.js
// Unified OAuth callback handler for YouTube + Twitch + Instagram
// - One callback page: /oauth2callback.html
// - Twitch launcher sets state="twitch:<csrf>"
// - Instagram launcher sets state="instagram"
// - Legacy YouTube can omit state (defaults to youtube)

import { supabase } from './supabaseClient.js';

// === Config ===
const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co'; // keep hardcoded like your current handler
const EDGE_FN = {
  youtube:   'youtube-oauth',
  twitch:    'twitch-oauth',
  instagram: 'instagram-oauth',
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
  // Meta sometimes returns error_description and/or error_reason; keep both.
  const error = p.get('error') || p.get('error_description') || p.get('error_reason');
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
  // Expected:
  //  - twitch uses state="twitch:<csrf>"
  //  - instagram uses state="instagram"
  //  - youtube may use nothing (legacy) or state="youtube:<csrf>"
  let provider = 'youtube';
  let csrfFromState = '';

  if (state.includes(':')) {
    const [maybeProvider, csrf] = state.split(':', 2);
    if (maybeProvider === 'twitch' || maybeProvider === 'youtube') {
      provider = maybeProvider;
      csrfFromState = csrf || '';
    }
  } else if (state) {
    if (state === 'instagram' || state === 'youtube' || state === 'twitch') {
      provider = state;
    }
  } else {
    const qProv = (p.get('provider') || '').toLowerCase();
    if (qProv === 'twitch' || qProv === 'youtube' || qProv === 'instagram') provider = qProv;
  }

  const niceNameMap = { youtube: 'YouTube', twitch: 'Twitch', instagram: 'Instagram' };
  const niceName = niceNameMap[provider] || provider;
  setStatus(`<span style="color:#4886f4;">Connecting to ${niceName}, please wait...</span>`);

  try {
    const redirectUri = window.location.origin + window.location.pathname;

    // --- Optional CSRF check (Twitch/new YouTube). Instagram uses simple "instagram" state w/o CSRF.
    const expectedCsrf = localStorage.getItem('oauth_csrf');
    if (csrfFromState) {
      if (!expectedCsrf || expectedCsrf !== csrfFromState) {
        throw new Error('State mismatch');
      }
    }
    if (expectedCsrf) localStorage.removeItem('oauth_csrf');

    // --- Current Supabase session JWT ---
    const { data: { session} } = await supabase.auth.getSession();
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

    // --- Success UX: notify opener (popup) or redirect fallback
    setStatus(`<span style="color:green;">${niceName} account successfully connected! Closing…</span>`);
    finalizeSuccess(provider);
  } catch (err) {
    setStatus(`<span style="color:red;">Failed to connect ${niceName}: ${err.message}</span>`);
    safeBounce(`Failed to connect ${niceName}: ${err.message}`);
  }
});

// Notify parent window if this is a popup, else redirect appropriately
function finalizeSuccess(provider) {
  const flag =
    provider === 'twitch'    ? { twitchConnected: true } :
    provider === 'instagram' ? { instagramConnected: true } :
    { youtubeConnected: true }; // default legacy

  if (window.opener) {
    try { window.opener.postMessage(flag, '*'); } catch {}
    window.close();
  } else {
    // Instagram uses full-page redirect; bounce back to settings where we show the toast.
    if (provider === 'instagram') {
      window.location.href = './settings.html?instagram=connected';
    } else {
      // Existing fallback for YouTube/Twitch
      window.location.href = './dashboardsponsee.html';
    }
  }
}

function safeBounce(msg) {
  // If opened as a popup, inform parent and close; else bounce to settings with error
  if (window.opener) {
    try { window.opener.postMessage({ oauthError: msg }, '*'); } catch {}
    window.close();
  } else {
    window.location.href = `./settings.html?error=${encodeURIComponent(msg)}`;
  }
}
