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

// Used ONLY for the “Retry” button in the Meta linking-help modal
// (matches your current live Meta app + API version)
const META_APP_ID = '1051907877053568';
const META_API_VERSION = 'v19.0';
const META_SCOPES = {
  instagram: [
    'instagram_basic',
    'pages_show_list',
    'pages_read_engagement',
    'instagram_manage_insights',
    'business_management',
  ],
  facebook: [
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
  ],
};

document.addEventListener('DOMContentLoaded', async () => {

  // ---------- UI helpers ----------
  function applyPlatformUI(providerKey) {
    const ui = PLATFORM_UI[providerKey] || PLATFORM_UI.youtube;
    const pretty = ui.name;

    document.title = `${pretty} OAuth | Sponsor Sorter`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', `Connect ${pretty} - Sponsor Sorter`);

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
  const setStatus = (html) => (
    statusDiv ? (statusDiv.innerHTML = html) : console.log(String(html).replace(/<[^>]+>/g, ''))
  );

  const qs = new URLSearchParams(location.search);
  const code  = qs.get('code');
  const error = qs.get('error') || qs.get('error_description') || qs.get('error_reason');
  let state   = qs.get('state') || '';

  // ---------- Provider detection ----------
  let provider = 'youtube';
  let csrfFromState = '';

  // state formats:
  // - "tiktok:<csrf>" / "twitch:<csrf>" / "youtube:<csrf>" (CSRF protected)
  // - "instagram" / "facebook" (simple)
  if (state.includes(':')) {
    const [maybe, csrf] = state.split(':', 2);
    if (['twitch', 'youtube', 'tiktok'].includes(maybe)) {
      provider = maybe;
      csrfFromState = csrf || '';
    }
  } else if (state && ['instagram', 'youtube', 'twitch', 'facebook', 'tiktok'].includes(state)) {
    provider = state;
  } else {
    const via = (qs.get('provider') || '').toLowerCase();
    if (['twitch', 'youtube', 'instagram', 'facebook', 'tiktok'].includes(via)) provider = via;
  }

  applyPlatformUI(provider);
  const pretty = (PLATFORM_UI[provider]?.name) || provider;

  if (error) return fail(`OAuth error: ${error}`);
  if (!code)  return setStatus('<span style="color:red;">No OAuth code found. Try again.</span>');

  setStatus(`<span style="color:#4886f4;">Connecting to ${pretty}…</span>`);
  console.debug('[oauth-handler] provider =', provider, 'code?', !!code);

  // ---------- OAuth exchange ----------
  try {
    // CSRF for Twitch/new YouTube/TikTok
    const expected = localStorage.getItem('oauth_csrf');
    if (csrfFromState && expected && expected !== csrfFromState) throw new Error('State mismatch');
    if (expected) localStorage.removeItem('oauth_csrf');

    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Missing session');

    const redirect_uri = location.origin + location.pathname; // must match the one used during auth
    const fn = EDGE_FN[provider];
    if (!fn) throw new Error('Unknown provider');

    const { ok, status, payload } = await callEdgeFunction(fn, jwt, { code, redirect_uri });

    if (!ok) {
      const errMsg = normalizeErr(payload, status);

      // ⭐ Meta special case: show “Link your page” modal instead of dead-end + redirect
      if ((provider === 'instagram' || provider === 'facebook') && looksLikeMetaLinkPrereqIssue(provider, payload, errMsg)) {
        setStatus(`<span style="color:#ffcc66;">${pretty} needs one more step…</span>`);
        showMetaLinkHelpModal({
          provider,
          pretty,
          redirectUri: redirect_uri,
          errorMessage: errMsg,
          rawPayload: payload
        });
        // Optional: inform opener (does NOT close)
        if (window.opener) {
          try {
            window.opener.postMessage({ oauthNeedsMetaSetup: true, provider, error: errMsg }, '*');
          } catch {}
        }
        return; // IMPORTANT: do not call fail() (which redirects/closes)
      }

      return fail(`Failed to connect ${pretty}: ${errMsg}`);
    }

    setStatus(`<span style="color:green;">${pretty} connected! Closing…</span>`);
    return success(provider);

  } catch (e) {
    return fail(`Failed to connect ${pretty}: ${e?.message || e}`);
  }

  // ---------- helpers ----------
  async function callEdgeFunction(fn, jwt, body) {
    let resp = null;
    let payload = {};
    try {
      resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
        body: JSON.stringify(body),
        credentials: 'omit',
      });
      payload = await resp.json().catch(() => ({}));
      return { ok: resp.ok, status: resp.status, payload };
    } catch (err) {
      return { ok: false, status: 0, payload: { error: err?.message || String(err) } };
    }
  }

  function normalizeErr(payload, status) {
    if (!payload) return `HTTP ${status || 'error'}`;
    const msg =
      payload?.error ||
      payload?.message ||
      payload?.details ||
      payload?.hint ||
      payload?.statusText ||
      '';
    const clean = String(msg).trim();
    return clean || `HTTP ${status || 'error'}`;
  }

  function looksLikeMetaLinkPrereqIssue(providerKey, payload, errMsg) {
    const blob = [
      errMsg,
      payload?.error,
      payload?.message,
      payload?.details,
      payload?.hint,
      payload?.type,
    ].filter(Boolean).join(' ').toLowerCase();

    // These are the common failure modes when:
    // - IG isn't a professional account
    // - IG isn't linked to a FB Page
    // - app can't see a Page/IG business account to fetch insights from
    const commonHints = [
      'no pages',
      'no page',
      'page',
      'pages',
      'not linked',
      'not connected',
      'needs to be linked',
      'requires a page',
      'requires pages',
      'missing page',
      'instagram business',
      'business account',
      'no instagram',
      'ig user',
      'does not have an instagram business account',
      'object with id',
      'unsupported get request',
      'permissions error',
      'insufficient permission',
      'permission',
      'manage_insights',
      'pages_show_list',
      'pages_read_engagement',
    ];

    const hit = commonHints.some(h => blob.includes(h));

    // If it's instagram, we *strongly* bias toward showing the modal on any “page / IG business” hint.
    if (providerKey === 'instagram') {
      const igBias = blob.includes('instagram') || blob.includes('ig') || blob.includes('manage_insights');
      const pageBias = blob.includes('page') || blob.includes('pages') || blob.includes('pages_show_list');
      return hit && (igBias || pageBias);
    }

    // For facebook, only show if it's obviously page-related
    if (providerKey === 'facebook') {
      return hit && (blob.includes('page') || blob.includes('pages') || blob.includes('pages_show_list'));
    }

    return false;
  }

  function buildMetaRetryUrl(providerKey, redirectUri) {
    const scopes = (META_SCOPES[providerKey] || []).join(',');
    const u = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
    u.searchParams.set('client_id', META_APP_ID);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', scopes);
    u.searchParams.set('state', providerKey);
    // Helpful if user previously authorized without all scopes:
    u.searchParams.set('auth_type', 'rerequest');
    return u.toString();
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch {
        return false;
      }
    }
  }

  function showMetaLinkHelpModal({ provider, pretty, redirectUri, errorMessage, rawPayload }) {
    // Remove any existing modal
    document.getElementById('meta-link-help-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'meta-link-help-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(0,0,0,0.72);
      display: flex; align-items: center; justify-content: center;
      padding: 18px;
    `;

    const retryUrl = buildMetaRetryUrl(provider, redirectUri);
    const primaryLabel = `Retry ${pretty} Connect`;
    const secondaryLabel = window.opener ? 'Close' : 'Back to Dashboard';

    const prettyExplain = provider === 'instagram'
      ? 'To fetch full Instagram insights, Meta requires your Instagram Professional account to be connected to a Facebook Page you manage.'
      : 'To fetch Page engagement data, we need access to at least one Facebook Page you manage.';

    const steps = provider === 'instagram'
      ? `
        <ol style="margin:10px 0 0 18px; padding:0; color:#ddd; line-height:1.5;">
          <li>Make sure your Instagram is a <b>Professional</b> account (Creator or Business).</li>
          <li>Link that Instagram to a <b>Facebook Page</b> you manage (Meta Business Suite / Page settings).</li>
          <li>Return here and click <b>${primaryLabel}</b>.</li>
        </ol>
        <div style="margin-top:10px;color:#aaa;font-size:.92em;">
          If you have multiple Facebook accounts, make sure you’re logged into the one that owns the Page.
        </div>
      `
      : `
        <ol style="margin:10px 0 0 18px; padding:0; color:#ddd; line-height:1.5;">
          <li>Log into Facebook with the account that manages your Page(s).</li>
          <li>Return here and click <b>${primaryLabel}</b>.</li>
        </ol>
      `;

    const raw = escapeHtml(JSON.stringify(rawPayload ?? {}, null, 2));
    const err = escapeHtml(errorMessage || '');

    overlay.innerHTML = `
      <div style="
        width: min(720px, 96vw);
        background: #0f0f12;
        border: 1px solid #24242a;
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.55);
        padding: 16px 16px 14px 16px;
        color: #fff;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#ffd062;"></div>
            <div style="font-weight:900;letter-spacing:.02em;">Finish linking ${pretty}</div>
          </div>
          <button id="meta-link-close-x" style="
            background: transparent; border: none; color: #bbb;
            font-size: 20px; cursor: pointer; padding: 6px 10px; border-radius: 10px;
          " aria-label="Close">✕</button>
        </div>

        <div style="margin-top:10px;color:#ddd;">
          ${prettyExplain}
        </div>

        ${steps}

        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
          <a href="https://business.facebook.com/" target="_blank" rel="noopener" style="
            color:#b9c7ff;text-decoration:none;border:1px solid #2b2b35;
            padding:8px 10px;border-radius:12px;background:#141419;
          ">Open Meta Business Suite ↗</a>
          <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener" style="
            color:#b9c7ff;text-decoration:none;border:1px solid #2b2b35;
            padding:8px 10px;border-radius:12px;background:#141419;
          ">Check connected apps ↗</a>
        </div>

        <div style="margin-top:14px;padding:10px 12px;border-radius:14px;border:1px solid #2a2a33;background:#121217;">
          <div style="font-weight:800;color:#ffd062;margin-bottom:6px;">What we got back</div>
          <div style="color:#f6a6a6;font-size:.92em;white-space:pre-wrap;">${err}</div>
          <details style="margin-top:10px;">
            <summary style="cursor:pointer;color:#aaa;">Raw payload</summary>
            <pre style="margin:8px 0 0 0;max-height:180px;overflow:auto;background:#0b0b0f;border:1px solid #23232c;padding:10px;border-radius:12px;color:#bbb;font-size:12px;">${raw}</pre>
          </details>
          <button id="meta-link-copy" style="
            margin-top:10px;background:#222;border:1px solid #333;color:#fff;
            padding:7px 10px;border-radius:12px;cursor:pointer;
          ">Copy error</button>
          <span id="meta-link-copied" style="margin-left:10px;color:#8cff98;font-size:.9em;display:none;">Copied ✓</span>
        </div>

        <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          <button id="meta-link-retry" style="
            background:#ffd062;border:none;color:#111;
            padding:10px 14px;border-radius:14px;font-weight:900;cursor:pointer;
          ">${primaryLabel}</button>

          <button id="meta-link-close" style="
            background:#18181f;border:1px solid #2b2b35;color:#fff;
            padding:10px 14px;border-radius:14px;font-weight:800;cursor:pointer;
          ">${secondaryLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector('#meta-link-close-x')?.addEventListener('click', close);

    overlay.querySelector('#meta-link-copy')?.addEventListener('click', async () => {
      const ok = await copyText(`${pretty} connect error:\n${errorMessage || ''}\n\nPayload:\n${JSON.stringify(rawPayload ?? {}, null, 2)}`);
      const badge = overlay.querySelector('#meta-link-copied');
      if (ok && badge) {
        badge.style.display = 'inline';
        setTimeout(() => { badge.style.display = 'none'; }, 1600);
      }
    });

    overlay.querySelector('#meta-link-retry')?.addEventListener('click', () => {
      // Re-run OAuth to get a fresh code after user links their Page/IG correctly.
      location.href = retryUrl;
    });

    overlay.querySelector('#meta-link-close')?.addEventListener('click', () => {
      if (window.opener) {
        try { window.opener.postMessage({ oauthMetaSetupDismissed: true, provider }, '*'); } catch {}
        window.close();
      } else {
        location.href = './dashboardsponsee.html';
      }
    });
  }

});

// ---------- existing success/fail behavior ----------
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
