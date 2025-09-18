// File: ./js/oauth-handler.js
// One callback for YouTube + Twitch + Instagram + Facebook (Meta) + TikTok

import { supabase } from './supabaseClient.js';

const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
const EDGE_FN = {
  youtube:   'youtube-oauth',
  twitch:    'twitch-oauth',
  instagram: 'instagram-oauth',
  facebook:  'facebook-oauth',
  tiktok:    'tiktok-oauth',
};

// Local logo paths (keep/edit these filenames as needed in your ./ root)
const PLATFORM_UI = {
  youtube:   { name: 'YouTube',   logo: './youtubelogo.png',   bg: '#000' },
  twitch:    { name: 'Twitch',    logo: './twitchlogo.png',    bg: '#6441a5' },
  instagram: { name: 'Instagram', logo: './instagramlogo.png', bg: '#000' },
  facebook:  { name: 'Facebook',  logo: './facebooklogo.png',  bg: '#1877f2' },
  tiktok:    { name: 'TikTok',    logo: './tiktoklogo.png',    bg: '#000' },
};

const AUTO_CLOSE_MS = 900;

document.addEventListener('DOMContentLoaded', async () => {
  // Small helper to set UI after we know the provider
  function applyPlatformUI(providerKey) {
    const ui = PLATFORM_UI[providerKey] || PLATFORM_UI.youtube;
    const pretty = ui.name;

    // Title + meta
    document.title = `${pretty} OAuth | Sponsor Sorter`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', `Connect ${pretty} - Sponsor Sorter`);
    
    // Heading text + logo
    const nameSpan = document.getElementById('platform-name');
    const logoImg  = document.getElementById('platform-logo');
    if (nameSpan) nameSpan.textContent = ` ${pretty} `;
    if (logoImg) {
      logoImg.src = ui.logo;
      logoImg.alt = `${pretty} logo`;
      logoImg.style.backgroundColor = ui.bg || '#000';
    }
  }

  const statusDiv = document.getElementById('oauth-status');
  const setStatus = (html) =>
    (statusDiv ? (statusDiv.innerHTML = html) : console.log(html.replace(/<[^>]+>/g, '')));

  const qs = new URLSearchParams(location.search);
  const code  = qs.get('code');
  const error = qs.get('error') || qs.get('error_description') || qs.get('error_reason');
  let state   = qs.get('state') || '';

  if (error) return fail(`OAuth error: ${error}`);
  if (!code)  return setStatus('<span style="color:red;">No OAuth code found. Try again.</span>');

  // Detect provider (unchanged logic, but we also reflect it in the UI)
  let provider = 'youtube';
  let csrfFromState = '';
  if (state.includes(':')) {
    const [maybe, csrf] = state.split(':', 2);
    if (['twitch','youtube','tiktok'].includes(maybe)) {
      provider = maybe;
      csrfFromState = csrf || '';
    }
  } else if (state && ['instagram','youtube','twitch','facebook','tiktok'].includes(state)) {
    provider = state;
  } else {
    const via = (qs.get('provider') || '').toLowerCase();
    if (['twitch','youtube','instagram','facebook','tiktok'].includes(via)) provider = via;
  }

  // Update the UI immediately for the detected platform
  applyPlatformUI(provider);
  const pretty = (PLATFORM_UI[provider]?.name) || provider;
  setStatus(`<span style="color:#4886f4;">Connecting to ${pretty}…</span>`);
  console.debug('[oauth-handler] provider =', provider, 'code?', !!code);

  try {
    // CSRF for Twitch/new YouTube/TikTok
    const expected = localStorage.getItem('oauth_csrf');
    if (csrfFromState && expected && expected !== csrfFromState) throw new Error('State mismatch');
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
      credentials: 'omit',
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
    provider === 'tiktok'    ? { tiktokConnected: true } :
    { youtubeConnected: true };

  if (window.opener) {
    try { window.opener.postMessage(flag, '*'); } catch {}
    setTimeout(() => window.close(), AUTO_CLOSE_MS);
  } else {
    const suffix =
      provider === 'instagram' ? '?instagram=connected' :
      provider === 'facebook'  ? '?facebook=connected'  :
      provider === 'tiktok'    ? '?tiktok=connected'    :
      '';
    location.href = `./dashboardsponsee.html${suffix}`;
  }
}

function fail(msg) {
  const statusDiv = document.getElementById('oauth-status');
  if (statusDiv) statusDiv.innerHTML = `<span style="color:red;">${msg}</span>`;
  if (window.opener) {
    try { window.opener.postMessage({ oauthError: msg }, '*'); } catch {}
    setTimeout(() => window.close(), AUTO_CLOSE_MS + 600);
  } else {
    location.href = `./dashboardsponsee.html?error=${encodeURIComponent(msg)}`;
  }
}
