// File: ./js/setupNextStep.js
// Purpose: Drives the "Setup - next step" pill on dashboardsponsee.html (and similar pages).
// - Computes profile completeness
// - Shows progress + next recommended action
// - Opens the OAuth Link modal (with buttons) by triggering the existing settings.js handler
// - When complete: writes users_extended_data."NSSetup" = true and hides the pill permanently

import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';

function hasToken(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s !== '' && s !== 'null' && s !== 'undefined';
  }
  return true;
}

function isNSSetupTrue(user) {
  // Be tolerant in case the column ends up lowercased in some environments
  return user?.NSSetup === true || user?.nssetup === true || user?.ns_setup === true;
}

function normalizeHandles(socialHandles) {
  if (!socialHandles) return {};
  if (typeof socialHandles === 'object') return socialHandles;
  if (typeof socialHandles === 'string') {
    try {
      const parsed = JSON.parse(socialHandles);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function hasAnyHandle(user) {
  const handles = normalizeHandles(user?.social_handles);
  const vals = Object.values(handles || {});
  const anyFromJson = vals.some(v => {
    if (!hasToken(v)) return false;
    const s = String(v).trim();
    return s.length >= 2 && s !== '@';
  });

  const platforms = Array.isArray(user?.platforms) ? user.platforms : [];
  const anyFromPlatforms = platforms.length > 0;

  return anyFromJson || anyFromPlatforms;
}

// Match settings.js connection logic:
// - Prefer `<platform>_connected` boolean if present
// - Fallback to provider-specific token/id columns
function isPlatformConnected(user, key) {
  if (!user) return false;

  if (user[`${key}_connected`] === true) return true;

  if (key === 'twitch')    return hasToken(user.twitch_access_token);
  if (key === 'youtube')   return hasToken(user.youtube_refresh_token) || hasToken(user.youtube_access_token);
  if (key === 'instagram') return hasToken(user.instagram_user_id) || hasToken(user.instagram_access_token);
  if (key === 'facebook')  return hasToken(user.facebook_page_id) || hasToken(user.facebook_access_token) || hasToken(user.facebook_user_access_token);
  if (key === 'tiktok')    return hasToken(user.tiktok_access_token);

  return false;
}

function getConnectedOauthPlatforms(user) {
  // keep in sync with settings.js supported platforms (minus twitter, which has no token columns)
  const keys = ['youtube', 'instagram', 'tiktok', 'facebook', 'twitch'];
  return keys.filter(k => isPlatformConnected(user, k));
}

function isFreePlan(user) {
  const planType = (user?.planType || user?.plan_type || user?.plan || user?.subscription_plan || 'free');
  return String(planType).toLowerCase().includes('free');
}

function setPill(el, { text, subtext = '', status = 'info' }) {
  // status: info | warn | ok
  const statusColor = status === 'ok' ? '#21d32e' : (status === 'warn' ? '#ffb020' : '#9ad0ff');

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:2px;min-width:240px;">
      <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        <span style="font-weight:800;color:${statusColor};">●</span>
        <span style="font-weight:800;">${text}</span>
      </div>
      ${subtext ? `<div style="font-size:0.92em;color:#d7d7d7;opacity:0.95;text-align:right;">${subtext}</div>` : ''}
    </div>
  `;
}

async function getEmailVerified(session, userRow) {
  const authConfirmed = !!session?.user?.email_confirmed_at;
  const extConfirmed = userRow?.email_verified === true;
  return authConfirmed || extConfirmed;
}

async function markNSSetupComplete(userId) {
  // Writes users_extended_data."NSSetup"=true (once)
  try {
    const { error } = await supabase
      .from('users_extended_data')
      .update({ NSSetup: true })
      .eq('user_id', userId);

    if (!error) return { ok: true };

    // If your column got created lowercased for some reason, try fallback
    const msg = String(error.message || error);
    if (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('nssetup')) {
      const { error: e2 } = await supabase
        .from('users_extended_data')
        .update({ nssetup: true })
        .eq('user_id', userId);

      if (!e2) return { ok: true };
      return { ok: false, error: e2 };
    }

    return { ok: false, error };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function computeSteps() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return { error: 'not_signed_in' };

  const user = await getActiveUser(true);
  if (!user) return { error: 'no_user_row' };

  if (isNSSetupTrue(user)) {
    return {
      user,
      alreadyComplete: true,
      steps: [],
      doneCount: 0,
      total: 0,
      next: null,
      connectedOauth: getConnectedOauthPlatforms(user),
      freePlan: isFreePlan(user),
    };
  }

  const connectedOauth = getConnectedOauthPlatforms(user);
  const freePlan = isFreePlan(user);
  const emailVerified = await getEmailVerified(session, user);

  const pic = user?.profile_pic;
  const hasProfilePic =
    hasToken(pic) &&
    !String(pic).toLowerCase().includes('logos.png') &&
    !String(pic).toLowerCase().includes('default');

  const hasAbout = hasToken(user?.about_yourself) && String(user.about_yourself).trim().length >= 20;
  const hasBasics = hasToken(user?.location) && hasToken(user?.title) && hasToken(user?.contenttype);
  const hasHandles = hasAnyHandle(user);

  const oauthRequired = true;
  const oauthDone = connectedOauth.length >= 1;

  const steps = [
    {
      key: 'email',
      label: 'Confirm your email',
      done: emailVerified,
      action: () => {},
    },
    {
      key: 'basics',
      label: 'Fill in your profile details (title, location, content type)',
      done: hasBasics,
      action: () => { window.location.href = './settings.html'; },
    },
    {
      key: 'pic',
      label: 'Upload a profile picture',
      done: hasProfilePic,
      action: () => { document.getElementById('change-profile-logo-btn')?.click(); },
    },
    {
      key: 'about',
      label: 'Add a profile description',
      done: hasAbout,
      action: () => { document.getElementById('edit-profile-description-btn')?.click(); },
    },
    {
      key: 'handles',
      label: 'Add at least one social handle',
      done: hasHandles,
      action: () => { document.getElementById('relink-social-btn')?.click(); },
    },
    {
      key: 'oauth',
      label: freePlan
        ? 'Connect 1 social account via OAuth (required for live stats)'
        : 'Connect social accounts via OAuth (required for live stats)',
      done: oauthRequired ? oauthDone : true,
      action: () => {
        // IMPORTANT: trigger settings.js handler so buttons render immediately
        const oauthLinkBtn = document.getElementById('oauth-link-btn');
        if (oauthLinkBtn) {
          oauthLinkBtn.click();
          return;
        }
        // fallback
        const modal = document.getElementById('oauth-link-modal');
        if (modal) modal.style.display = 'block';
      },
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const total = steps.length;
  const next = steps.find(s => !s.done);

  return { user, steps, doneCount, total, next, connectedOauth, freePlan };
}

document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('setup-nextstep') || document.querySelector('.setup-nextstep');
  if (!el) return;

  el.style.cursor = 'pointer';
  el.style.userSelect = 'none';

  // If already complete, hide and do nothing (no listeners)
  try {
    const u = await getActiveUser(true);
    if (u && isNSSetupTrue(u)) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      return;
    }
  } catch {}

  let latest = null;
  let listenersAttached = false;
  let markingInFlight = false;

  function hideForever() {
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  }

  async function refresh() {
    try {
      setPill(el, { text: '', subtext: '', status: 'info' });

      const res = await computeSteps();
      latest = res;

      if (res?.error === 'not_signed_in') {
        setPill(el, { text: 'Sign in to finish setup', subtext: '', status: 'warn' });
        return;
      }

      if (res?.error) {
        setPill(el, { text: 'Setup: unable to load', subtext: 'Try refreshing the page', status: 'warn' });
        return;
      }

      if (res?.alreadyComplete || isNSSetupTrue(res?.user)) {
        hideForever();
        return;
      }

      const { doneCount, total, next, connectedOauth, freePlan, user } = res;

      // If completed -> write NSSetup=true then hide
      if (!next) {
        const extra = connectedOauth.length ? `OAuth: ${connectedOauth.join(', ')}` : '';
        setPill(el, { text: `Setup complete (${doneCount}/${total})`, subtext: extra, status: 'ok' });

        if (!markingInFlight) {
          markingInFlight = true;
          const r = await markNSSetupComplete(user.user_id);
          markingInFlight = false;

          if (r?.ok) {
            hideForever();
          } else {
            console.warn('[setupNextStep] Failed to write NSSetup:', r?.error);
            setPill(el, {
              text: 'Setup complete (not saved)',
              subtext: 'Run the NSSetup migration / check RLS, then refresh.',
              status: 'warn',
            });
          }
        }
        return;
      }

      let sub = `${doneCount}/${total} complete`;
      if (next.key === 'oauth') {
        sub = freePlan
          ? `${doneCount}/${total} complete • Connect 1 account for live stats`
          : `${doneCount}/${total} complete • Connect accounts for live stats`;
      }

      setPill(el, { text: `Next: ${next.label}`, subtext: sub, status: 'warn' });

      if (!listenersAttached) {
        listenersAttached = true;

        function runNextAction() {
          const n = latest?.next;
          if (n?.action) n.action();
        }

        el.addEventListener('click', runNextAction);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            runNextAction();
          }
        });

        window.addEventListener('focus', () => { refresh(); });
        window.addEventListener('message', () => { setTimeout(() => refresh(), 350); });
      }
    } catch (err) {
      console.error('[setupNextStep] refresh failed:', err);
      setPill(el, { text: 'Setup: error', subtext: 'Open console for details', status: 'warn' });
    }
  }

  await refresh();
});

