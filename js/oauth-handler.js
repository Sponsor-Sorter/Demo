// File: ./js/oauth-handler.js
// One callback for YouTube + Twitch + Instagram + Facebook (Meta) + TikTok

import { supabase } from './supabaseClient.js';

const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
const EDGE_FN = {
  youtube:   'youtube-oauth',
  twitch:    'twitch-oauth',
  instagram: 'instagram-oauth',
  facebook:  'facebook-oauth',
  tiktok:    'tiktok-oauth',          // NEW
};

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('oauth-status');
  const setStatus = (html) =>
    (statusDiv ? (statusDiv.innerHTML = html) : console.log(html.replace(/<[^>]+>/g, '')));

  const qs = new URLSearchParams(location.search);
  const code  = qs.get('code');
  const error = qs.get('error') || qs.get('error_description') || qs.get('error_reason');
  let state   = qs.get('state') || '';

  if (error) return fail(`OAuth error: ${error}`);
  if (!code)  return setStatus('<span style="color:red;">No OAuth code found. Try again.</span>');

  // Detect provider
  let provider = 'youtube';
  let csrfFromState = '';
  if (state.includes(':')) {
    const [maybe, csrf] = state.split(':', 2);
    if (['twitch','youtube','tiktok'].includes(maybe)) { // include TikTok in CSRF-style state
      provider = maybe;
      csrfFromState = csrf || '';
    }
  } else if (state && ['instagram','youtube','twitch','facebook','tiktok'].includes(state)) {
    provider = state;
  } else {
    const via = (qs.get('provider') || '').toLowerCase();
    if (['twitch','youtube','instagram','facebook','tiktok'].includes(via)) provider = via;
  }

  const pretty =
    ({ youtube:'YouTube', twitch:'Twitch', instagram:'Instagram', facebook:'Facebook', tiktok:'TikTok' }[provider]) || provider;

  setStatus(`<span style="color:#4886f4;">Connecting to ${pretty}…</span>`);

  try {
    // CSRF for Twitch/new YouTube/TikTok (Instagram/Facebook use simple state)
    const expected = localStorage.getItem('oauth_csrf');
    if (csrfFromState && expected !== csrfFromState) throw new Error('State mismatch');
    if (expected) localStorage.removeItem('oauth_csrf');

    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Missing session');

    const redirect_uri = location.origin + location.pathname;
    const fn = EDGE_FN[provider];
    if (!fn) throw new Error('Unknown provider');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${jwt}` },
      body: JSON.stringify({ code, redirect_uri }),
      credentials: 'include',
    });

    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(payload?.error || payload?.message || 'Unknown error');

    setStatus(`<span style="color:green;">${pretty} connected! Closing…</span>`);
    return success(provider);
  } catch (e) {
    return fail(`Failed to connect ${pretty}: ${e.message || e}`);
  }
});

function success(provider) {
  const flag =
    provider === 'twitch'    ? { twitchConnected: true } :
    provider === 'instagram' ? { instagramConnected: true } :
    provider === 'facebook'  ? { facebookConnected: true } :
    provider === 'tiktok'    ? { tiktokConnected: true } : // NEW
    { youtubeConnected: true };

  if (window.opener) {
    try { window.opener.postMessage(flag, '*'); } catch {}
    window.close();
  } else {
    const suffix =
      provider === 'instagram' ? '?instagram=connected' :
      provider === 'facebook'  ? '?facebook=connected'  :
      provider === 'tiktok'    ? '?tiktok=connected'    : // optional convenience
      '';
    location.href = `./dashboardsponsee.html${suffix}`;
  }
}

function fail(msg) {
  const statusDiv = document.getElementById('oauth-status');
  if (statusDiv) statusDiv.innerHTML = `<span style="color:red;">${msg}</span>`;
  if (window.opener) {
    try { window.opener.postMessage({ oauthError: msg }, '*'); } catch {}
    window.close();
  } else {
    location.href = `./dashboardsponsee.html?error=${encodeURIComponent(msg)}`;
  }
}
