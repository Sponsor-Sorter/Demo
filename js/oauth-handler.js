// File: ./js/oauth-handler.js
// Unified OAuth callback handler for YouTube + Twitch + Instagram

import { supabase } from './supabaseClient.js';

const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
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

  const p = new URLSearchParams(window.location.search);
  const code  = p.get('code');
  const error = p.get('error') || p.get('error_description') || p.get('error_reason');
  let state   = p.get('state') || '';

  if (error) { setStatus(`<span style="color:red;">OAuth failed: ${error}</span>`); return safeBounce(`OAuth error: ${error}`); }
  if (!code) { setStatus(`<span style="color:red;">No OAuth code found. Please try connecting again.</span>`); return; }

  // Detect provider
  let provider = 'youtube';
  let csrfFromState = '';
  if (state.includes(':')) {
    const [maybeProvider, csrf] = state.split(':', 2);
    if (maybeProvider === 'twitch' || maybeProvider === 'youtube') { provider = maybeProvider; csrfFromState = csrf || ''; }
  } else if (state) {
    if (['instagram','youtube','twitch'].includes(state)) provider = state;
  } else {
    const qProv = (p.get('provider') || '').toLowerCase();
    if (['twitch','youtube','instagram'].includes(qProv)) provider = qProv;
  }

  const niceName = { youtube:'YouTube', twitch:'Twitch', instagram:'Instagram' }[provider] || provider;
  setStatus(`<span style="color:#4886f4;">Connecting to ${niceName}, please wait...</span>`);

  try {
    const redirectUri = window.location.origin + window.location.pathname;

    // CSRF (Twitch/new YouTube)
    const expectedCsrf = localStorage.getItem('oauth_csrf');
    if (csrfFromState) {
      if (!expectedCsrf || expectedCsrf !== csrfFromState) throw new Error('State mismatch');
    }
    if (expectedCsrf) localStorage.removeItem('oauth_csrf');

    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Not logged in or missing session.');

    const fn = EDGE_FN[provider];
    if (!fn) throw new Error('Unknown provider');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
      credentials: 'include',
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || data?.message || 'Unknown error');

    // Success
    setStatus(`<span style="color:green;">${niceName} account successfully connected! Closing…</span>`);
    finalizeSuccess(provider);
  } catch (err) {
    setStatus(`<span style="color:red;">Failed to connect ${niceName}: ${err.message}</span>`);
    safeBounce(`Failed to connect ${niceName}: ${err.message}`);
  }
});

function finalizeSuccess(provider) {
  const flag =
    provider === 'twitch'    ? { twitchConnected: true } :
    provider === 'instagram' ? { instagramConnected: true } :
    { youtubeConnected: true };

  if (window.opener) {
    try { window.opener.postMessage(flag, '*'); } catch {}
    window.close();
  } else {
    // Route everyone to dashboard 
    const suffix = provider === 'instagram' ? '?instagram=connected' : '';
    window.location.href = `./dashboardsponsee.html${suffix}`;
  }
}

function safeBounce(msg) {
  if (window.opener) {
    try { window.opener.postMessage({ oauthError: msg }, '*'); } catch {}
    window.close();
  } else {
    window.location.href = `./dashboardsponsee.html?error=${encodeURIComponent(msg)}`;
  }
}
