// File: ./js/settingsPage.js
//
// Page-specific glue for settings.html.
// Uses the existing big ./js/settings.js for all the heavy lifting (modals,
// FamBot moderation, 2FA UI, etc.) and just:
//  - Shows profile picture with "click to change".
//  - Shows current description + website.
//  - Allows editing title, company_name, location, contenttype.
//  - Shows Platforms & Handles with real connected status (same logic as settings.js),
//    and disables the "Edit handle" button if the platform is connected via OAuth.
//  - Shows inline Referrals & Subscription (plan badge, Stripe status, referral link, referral stats).
//  - Shows inline Featured Star placements (only active spots).
//  - Shows inline Affiliate summary + applications table.
//  - Shows inline Security & 2FA status (method, backup codes, lockout).
//  - Proxies the nice buttons on this page to the hidden hooks that settings.js already uses.

import { supabase } from './supabaseClient.js';
import { famBotModerateWithModal } from './FamBot.js';
import { getActiveUser } from './impersonationHelper.js';

// ---------- Small helpers ----------

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Simple date helpers for Featured slots
function fmtDate(v) {
  try {
    if (!v) return '—';
    return new Date(v).toLocaleDateString();
  } catch {
    return '—';
  }
}

function slotStatus(starts_at, ends_at) {
  const now = Date.now();
  const s = starts_at ? Date.parse(starts_at) : 0;
  const e = ends_at ? Date.parse(ends_at) : 0;
  if (s && now < s) return 'Scheduled';
  if (e && now > e) return 'Expired';
  return 'Active';
}

// ---------- Platform helpers ----------

/**
 * Mirror the connection logic from settings.js isPlatformConnected(user, key)
 * so the settings page matches the dashboard OAuth modal.
 */
function isPlatformConnectedFromUser(user, key) {
  if (!user) return false;

  // Standard *_connected boolean pattern: youtube_connected, instagram_connected, etc.
  if (user[`${key}_connected`] === true) return true;

  // Provider-specific fallbacks (when you haven't added *_connected yet)
  switch (key) {
    case 'youtube':
      return !!(user.youtube_refresh_token || user.youtube_access_token);
    case 'twitch':
      return !!user.twitch_access_token;
    case 'instagram':
      return !!(user.instagram_user_id || user.instagram_access_token);
    case 'facebook':
      return !!(user.facebook_page_id || user.facebook_access_token);
    case 'tiktok':
      return !!user.tiktok_access_token;
    case 'twitter': // “X” in UI
      return !!(user.twitter_connected || user.twitter_access_token);
    default:
      return false;
  }
}

/**
 * Try to get a nice handle string out of whatever is stored in social_handles.
 */
function extractHandle(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return (
      value.handle ||
      value.username ||
      value.channel ||
      value.page_name ||
      ''
    );
  }
  return '';
}

/**
 * Fill in the Platforms & Handles section using:
 *  - social_handles JSON (manual handles)
 *  - OAuth connection status (tokens / *_connected flags)
 *
 * IDs expected in settings.html (only used if they exist):
 *  - #settings-platforms-summary
 *  - #settings-youtube-handle / #settings-youtube-status / #settings-youtube-edit-handle-btn
 *  - #settings-twitch-handle  / #settings-twitch-status  / #settings-twitch-edit-handle-btn
 *  - #settings-instagram-handle / #settings-instagram-status / #settings-instagram-edit-handle-btn
 *  - #settings-tiktok-handle / #settings-tiktok-status / #settings-tiktok-edit-handle-btn
 *  - #settings-x-handle / #settings-x-status / #settings-x-edit-handle-btn
 */
function populatePlatformsSection(user) {
  const platformsSummaryEl = document.getElementById('settings-platforms-summary');
  if (!user || !platformsSummaryEl) return;

  const platformRows = [
    {
      key: 'youtube',
      label: 'YouTube',
      socialKeys: ['youtube'],
      handleId: 'settings-youtube-handle',
      statusId: 'settings-youtube-status',
      editBtnId: 'settings-youtube-edit-handle-btn',
    },
    {
      key: 'twitch',
      label: 'Twitch',
      socialKeys: ['twitch'],
      handleId: 'settings-twitch-handle',
      statusId: 'settings-twitch-status',
      editBtnId: 'settings-twitch-edit-handle-btn',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      socialKeys: ['instagram', 'ig'],
      handleId: 'settings-instagram-handle',
      statusId: 'settings-instagram-status',
      editBtnId: 'settings-instagram-edit-handle-btn',
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      socialKeys: ['tiktok'],
      handleId: 'settings-tiktok-handle',
      statusId: 'settings-tiktok-status',
      editBtnId: 'settings-tiktok-edit-handle-btn',
    },
    {
      // NOTE: use `twitter` as the key so it lines up with twitter_connected etc.
      key: 'twitter',
      label: 'X (Twitter)',
      socialKeys: ['x', 'twitter'],
      handleId: 'settings-x-handle',
      statusId: 'settings-x-status',
      editBtnId: 'settings-x-edit-handle-btn',
    },
  ];

  try {
    // social_handles JSON from users_extended_data (may be text or object).
    let socialHandles = user.social_handles || {};
    if (typeof socialHandles === 'string') {
      try {
        socialHandles = JSON.parse(socialHandles);
      } catch {
        socialHandles = {};
      }
    }

    let connectedCount = 0;

    for (const row of platformRows) {
      const handleNode = document.getElementById(row.handleId);
      const statusNode = document.getElementById(row.statusId);
      const editBtn = row.editBtnId
        ? document.getElementById(row.editBtnId)
        : null;

      // If this particular row doesn’t exist in HTML, skip it.
      if (!handleNode && !statusNode && !editBtn) continue;

      // Find the first matching key in social_handles (e.g. "x" or "twitter" for X)
      let rawHandleValue = null;
      for (const k of row.socialKeys) {
        if (
          socialHandles &&
          Object.prototype.hasOwnProperty.call(socialHandles, k)
        ) {
          rawHandleValue = socialHandles[k];
          break;
        }
      }

      const handleText = extractHandle(rawHandleValue);
      const oauthConnected = isPlatformConnectedFromUser(user, row.key);
      const connected = oauthConnected || !!handleText;

      if (connected) connectedCount += 1;

      // Handle text (manual or from OAuth)
      if (handleNode) {
        const displayHandle =
          handleText ||
          (oauthConnected ? 'Connected via OAuth (no handle saved yet)' : '');

        handleNode.textContent = displayHandle || 'Not linked yet';
      }

      // Connected / not connected label
      if (statusNode) {
        statusNode.textContent = connected ? 'Connected' : 'Not connected';
        statusNode.style.color = connected ? '#7cf29c' : '#777';
      }

      // If OAuth is connected, lock the "Edit handle" button
      if (editBtn) {
        if (oauthConnected) {
          editBtn.disabled = true;
          editBtn.title = 'Handle is managed via OAuth connection.';
          editBtn.style.opacity = '0.5';
          editBtn.style.cursor = 'not-allowed';
        } else {
          editBtn.disabled = false;
          editBtn.title = '';
          editBtn.style.opacity = '';
          editBtn.style.cursor = '';
        }
      }
    }

    const total = platformRows.filter((row) => {
      return (
        document.getElementById(row.handleId) ||
        document.getElementById(row.statusId)
      );
    }).length;

    if (total === 0) {
      // Expanded UI not present; nothing to summarise.
      return;
    }

    if (connectedCount === 0) {
      platformsSummaryEl.textContent = 'No platforms connected yet.';
    } else if (connectedCount === total) {
      platformsSummaryEl.textContent = `All ${total} platforms connected.`;
    } else {
      platformsSummaryEl.textContent = `Connected ${connectedCount} of ${total} platforms.`;
    }
  } catch (err) {
    console.error('Error populating platforms section on settings page:', err);
    platformsSummaryEl.textContent = 'Unable to load platforms right now.';
  }
}

/**
 * Wire the “Edit handle” / “Manage connections” buttons in the Platforms area
 * to the hidden hooks that settings.js already uses in the dashboard dropdown.
 */
function wirePlatformRowShortcuts() {
  const relinkSocialBtn = document.getElementById('relink-social-btn');
  const oauthLinkBtn = document.getElementById('oauth-link-btn');

  const wirePlatformRow = (editId, manageId) => {
    if (!relinkSocialBtn && !oauthLinkBtn) return;

    const editBtn = document.getElementById(editId);
    const manageBtn = document.getElementById(manageId);

    if (editBtn && relinkSocialBtn) {
      editBtn.addEventListener('click', () => {
        if (!editBtn.disabled) {
          relinkSocialBtn.click();
        }
      });
    }
    if (manageBtn && oauthLinkBtn) {
      manageBtn.addEventListener('click', () => oauthLinkBtn.click());
    }
  };

  wirePlatformRow(
    'settings-youtube-edit-handle-btn',
    'settings-youtube-manage-oauth-btn'
  );
  wirePlatformRow(
    'settings-twitch-edit-handle-btn',
    'settings-twitch-manage-oauth-btn'
  );
  wirePlatformRow(
    'settings-instagram-edit-handle-btn',
    'settings-instagram-manage-oauth-btn'
  );
  wirePlatformRow(
    'settings-tiktok-edit-handle-btn',
    'settings-tiktok-manage-oauth-btn'
  );
  wirePlatformRow(
    'settings-x-edit-handle-btn',
    'settings-x-manage-oauth-btn'
  );
}

// ---------- Referrals & Subscription helpers ----------

async function populateReferralsAndSubscription(user) {
  const summaryEl = document.getElementById('referrals-subscription-summary');
  const planRow = document.getElementById('settings-plan-row');
  const subRow = document.getElementById('settings-subscription-row');
  const linkRow = document.getElementById('settings-referral-link-row');
  const statsRow = document.getElementById('settings-referral-stats-row');

  if (!user) return;
  if (!summaryEl && !planRow && !subRow && !linkRow && !statsRow) return;

  if (summaryEl) {
    summaryEl.textContent = 'Loading your referral & subscription details...';
    summaryEl.style.color = '#999';
  }

  try {
    // ---- Plan type (planType column on user) ----
    const planTypeRaw = user.planType || 'free';
    const planType = String(planTypeRaw).toLowerCase();
    const isFreePlan = planType === 'free';

    if (planRow) {
      const label = isFreePlan ? 'Free' : 'Pro';

      const planTextEl =
        document.getElementById('settings-plan-text') || planRow;

      if (planTextEl) {
        planTextEl.textContent = `Plan: ${label}`;
      }

      planRow.style.color = isFreePlan ? '#ffd062' : '#7CFFA1';

      // Badge image
      const badgeEl = document.getElementById('settings-plan-badge');
      if (badgeEl) {
        badgeEl.style.display = 'inline-block';
        if (isFreePlan) {
          badgeEl.src = './freebadge.png';
          badgeEl.alt = 'Free plan badge';
        } else {
          badgeEl.src = './probadge.png';
          badgeEl.alt = 'Pro plan badge';
        }
      }
    }

    // ---- Subscription summary (Stripe) ----
    if (subRow) {
      if (user.stripe_customer_id) {
        subRow.textContent = 'Subscription: Checking Stripe subscription…';
        subRow.style.color = '#bbb';

        try {
          const sessionRes = await supabase.auth.getSession();
          const jwt = sessionRes?.data?.session?.access_token;

          if (!jwt) {
            subRow.textContent =
              'Subscription: Unable to load subscription (missing session).';
            subRow.style.color = '#e93';
          } else {
            const resp = await fetch(
              'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/stripe_subscription_info',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({ customer_id: user.stripe_customer_id }),
              }
            );

            if (resp.ok) {
              const data = await resp.json();
              if (data.subscription) {
                const sub = data.subscription;
                const planName = sub.plan?.nickname || sub.plan?.id || '';
                const periodEnd = sub.current_period_end
                  ? new Date(sub.current_period_end * 1000)
                  : null;
                const when = periodEnd
                  ? periodEnd.toLocaleDateString()
                  : 'N/A';

                subRow.textContent = `Subscription: Active${
                  planName ? ` – ${planName}` : ''
                } (next billing ${when})`;
                subRow.style.color = '#7CFFA1';
              } else {
                subRow.textContent =
                  'Subscription: No active Stripe subscription found.';
                subRow.style.color = '#ffd062';
              }
            } else {
              subRow.textContent =
                'Subscription: Could not load subscription details.';
              subRow.style.color = '#e93';
            }
          }
        } catch (err) {
          console.error('Error loading Stripe subscription info:', err);
          subRow.textContent =
            'Subscription: Error loading subscription info.';
          subRow.style.color = '#e93';
        }
      } else {
        subRow.textContent =
          'Subscription: No Stripe subscription linked yet.';
        subRow.style.color = '#ffd062';
      }
    }

    // ---- Referral link summary ----
    if (linkRow) {
      linkRow.textContent = 'Referral link: Loading…';
      linkRow.style.color = '#bbb';

      if (!user.user_id || !user.username) {
        linkRow.textContent =
          'Referral link: Could not load your user details.';
        linkRow.style.color = '#f88';
      } else {
        try {
          let { data: link, error } = await supabase
            .from('referral_links')
            .select('code')
            .eq('user_id', user.user_id)
            .single();

          if (!link || error) {
            // Generate a new code
            const code = `${user.username}-${user.user_id
              .slice(0, 8)
              .replace(/[^a-zA-Z0-9_-]/g, '')}`.replace(
              /[^a-zA-Z0-9_-]/g,
              ''
            );
            const { data: created, error: insertErr } = await supabase
              .from('referral_links')
              .insert([{ user_id: user.user_id, code }])
              .select()
              .single();

            if (insertErr || !created) {
              linkRow.textContent =
                'Referral link: Error generating referral code.';
              linkRow.style.color = '#f88';
            } else {
              link = created;
            }
          }

          if (link?.code) {
            const currentPath = window.location.pathname;
            const folder =
              currentPath.substring(
                0,
                currentPath.lastIndexOf('/') + 1
              ) || '/';
            const refUrl = `${window.location.origin}${folder}signup.html?ref=${encodeURIComponent(
              link.code
            )}`;
            linkRow.innerHTML = `Referral link: <span style="color:#9fc2ff;word-break:break-all;">${refUrl}</span>`;
          }
        } catch (err) {
          console.error('Error loading referral link:', err);
          linkRow.textContent =
            'Referral link: Error loading referral link.';
          linkRow.style.color = '#f88';
        }
      }
    }

    // ---- Referral stats (successful referrals + free month rewards) ----
    if (statsRow) {
      statsRow.textContent = 'Referrals: Loading…';
      statsRow.style.color = '#bbb';

      try {
        const { data: rewards, error: rewardsErr } = await supabase
          .from('referral_rewards')
          .select('reward_for, reward_type, claimed')
          .eq('referrer_id', user.user_id);

        if (rewardsErr) {
          statsRow.textContent =
            'Referrals: Error loading referral stats.';
          statsRow.style.color = '#f88';
        } else if (rewards && rewards.length > 0) {
          const successful = rewards.filter(
            (r) => r.reward_for && r.reward_for !== user.user_id
          ).length;

          const totalFreeMonths = rewards.filter(
            (r) => r.reward_type === 'free_month'
          ).length;

          const unclaimedFreeMonths = rewards.filter(
            (r) => r.reward_type === 'free_month' && !r.claimed
          ).length;

          statsRow.textContent = `Referrals: ${successful} successful · Free month rewards: ${totalFreeMonths} (${unclaimedFreeMonths} unclaimed)`;
          statsRow.style.color = '#eee';
        } else {
          statsRow.textContent =
            'Referrals: No successful referrals yet.';
          statsRow.style.color = '#777';
        }
      } catch (err) {
        console.error('Error loading referral stats:', err);
        statsRow.textContent =
          'Referrals: Error loading referral stats.';
        statsRow.style.color = '#f88';
      }
    }
  } finally {
    if (summaryEl) {
      summaryEl.textContent = 'Referrals & subscription up to date.';
      summaryEl.style.color = '#7CFFA1';
    }
  }
}

// ---------- Featured Star inline helpers ----------

async function populateFeaturedInline(user) {
  const container = document.getElementById('settings-featured-inline');
  if (!container || !user) return;

  // Start clean
  container.innerHTML = '';

  try {
    const { data, error } = await supabase
      .from('featured_slots')
      .select('slot_index,label,starts_at,ends_at')
      .eq('user_id', user.user_id || user.id)
      .order('starts_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading featured slots for settings page:', error);
      // Per request: if none or error, just show nothing.
      container.innerHTML = '';
      return;
    }

    if (!data || !data.length) {
      // No placements at all; show nothing.
      container.innerHTML = '';
      return;
    }

    const activeRows = data.filter(
      (row) => slotStatus(row.starts_at, row.ends_at) === 'Active'
    );

    if (!activeRows.length) {
      // Has placements but none currently active – show nothing inline.
      container.innerHTML = '';
      return;
    }

    const itemsHtml = activeRows
      .map((row) => {
        const status = slotStatus(row.starts_at, row.ends_at);
        const dates = `${fmtDate(row.starts_at)} → ${fmtDate(row.ends_at)}`;
        const label = row.label ? ` — ${escapeHtml(row.label)}` : '';
        const viewHref = `./featured.html?slot=${row.slot_index}`;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div>
              <div style="font-weight:600;color:#fff;">Slot #${row.slot_index}${label}</div>
              <div style="color:#bbb;font-size:0.82rem;">
                ${dates}
                · <span style="color:#7CFFA1;">${escapeHtml(status)}</span>
              </div>
            </div>
            <a href="${viewHref}"
               style="font-size:0.8rem;padding:4px 10px;border-radius:999px;background:#ffd062;color:#000;text-decoration:none;font-weight:600;">
              View
            </a>
          </div>
        `;
      })
      .join('');

    container.innerHTML = itemsHtml;
  } catch (err) {
    console.error('Unexpected error loading featured slots for settings page:', err);
    container.innerHTML = '';
  }
}

// ---------- Affiliate inline helpers ----------

async function populateAffiliateInline(user) {
  const activeEl = document.getElementById('settings-affiliate-active');
  const appsEl = document.getElementById('settings-affiliate-apps');

  if (!activeEl && !appsEl) return;
  if (!user) return;

  if (appsEl) {
    appsEl.innerHTML = '<span style="color:#999;">Loading applications…</span>';
  }

  try {
    const { data, error } = await supabase
      .from('affiliate_applications')
      .select('*')
      .eq('user_id', user.user_id || user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading affiliate applications for settings page:', error);
      if (appsEl) {
        appsEl.innerHTML =
          '<span style="color:#f66;">Error loading affiliate applications.</span>';
      }
      if (activeEl) activeEl.textContent = '';
      return;
    }

    if (!data || !data.length) {
      if (appsEl) {
        appsEl.innerHTML =
          '<span style="color:#777;">No applications yet.</span>';
      }
      if (activeEl) activeEl.textContent = '';
      return;
    }

    // Active affiliate summary – look for status "active" or "approved"
    if (activeEl) {
      const activeApp = data.find((a) => {
        const s = String(a.status || '').toLowerCase();
        return s === 'active' || s === 'approved';
      });

      if (activeApp) {
        const started = activeApp.created_at
          ? new Date(activeApp.created_at).toLocaleDateString()
          : '';
        const rate =
          activeApp.desired_rate != null
            ? `${Number(activeApp.desired_rate).toFixed(2)}%`
            : null;

        activeEl.innerHTML = `
          <div style="padding:6px 10px;border-radius:8px;background:rgba(124,255,161,0.06);border:1px solid #2b7543;">
            <div style="font-weight:600;color:#7CFFA1;margin-bottom:2px;">Active Affiliate</div>
            <div style="font-size:0.85rem;color:#ccc;">
              Type: <b>${escapeHtml(activeApp.partner_type || 'Affiliate')}</b>
              ${rate ? ` · Rate: <b>${escapeHtml(rate)}</b>` : ''}
              ${
                started
                  ? ` · Since: <b>${escapeHtml(started)}</b>`
                  : ''
              }
              <br/>
              Status: <b>${escapeHtml(activeApp.status || '')}</b>
            </div>
          </div>
        `;
      } else {
        activeEl.textContent = '';
      }
    }

    // Applications table
    if (appsEl) {
      const rowsHtml = data
        .map((a) => {
          const created = a.created_at
            ? new Date(a.created_at).toLocaleString()
            : '';
          const rate =
            a.desired_rate != null
              ? `${Number(a.desired_rate).toFixed(2)}%`
              : '-';
          return `
            <tr>
              <td>${escapeHtml(a.id)}</td>
              <td>${escapeHtml(a.partner_type || '')}</td>
              <td>${escapeHtml(a.status || '')}</td>
              <td>${escapeHtml(rate)}</td>
              <td>${escapeHtml(created)}</td>
            </tr>
          `;
        })
        .join('');

      appsEl.innerHTML = `
        <div style="overflow:auto;max-height:220px;">
          <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-color:#333;font-size:0.82rem;">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Desired Rate</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    }
  } catch (err) {
    console.error('Unexpected error loading affiliate applications for settings page:', err);
    if (appsEl) {
      appsEl.innerHTML =
        '<span style="color:#f66;">Error loading affiliate applications.</span>';
    }
    if (activeEl) activeEl.textContent = '';
  }
}

// ---------- Security & 2FA inline helpers ----------

async function populateSecurityTwoFA(user) {
  const statusEl = document.getElementById('security-twofa-status');
  const primaryEl = document.getElementById('security-twofa-primary');
  const backupEl = document.getElementById('security-twofa-backup');
  const lockoutEl = document.getElementById('security-twofa-lockout');

  if (!statusEl && !primaryEl && !backupEl && !lockoutEl) return;
  if (statusEl) {
    statusEl.textContent = 'Loading 2FA status…';
    statusEl.style.color = '#ccc';
  }

  try {
    let twofaSource = user;

    // If the basic fields aren't on the user object, fetch them directly.
    if (
      typeof user.twofa_enabled === 'undefined' ||
      typeof user.twofa_method === 'undefined'
    ) {
      const { data, error } = await supabase
        .from('users_extended_data')
        .select('twofa_enabled, twofa_method, twofa_locked_until, twofa_backup_codes')
        .eq('user_id', user.user_id)
        .single();

      if (!error && data) {
        twofaSource = { ...user, ...data };
      }
    }

    const enabled = !!twofaSource.twofa_enabled;
    const methodRaw = String(twofaSource.twofa_method || 'none').toLowerCase();

    let methodLabel = 'Off';
    if (enabled) {
      if (methodRaw === 'email') methodLabel = 'Email codes';
      else if (methodRaw === 'totp' || methodRaw === 'app')
        methodLabel = 'Authenticator app';
      else if (methodRaw === 'both')
        methodLabel = 'Email + Authenticator app';
      else methodLabel = 'Enabled';
    }

    // Main line
    if (statusEl) {
      if (enabled) {
        statusEl.textContent = `2FA: Enabled (${methodLabel})`;
        statusEl.style.color = '#7CFFA1';
      } else {
        statusEl.textContent = '2FA: Disabled';
        statusEl.style.color = '#ff6b6b';
      }
    }

    // Primary method detail
    if (primaryEl) {
      primaryEl.textContent = enabled
        ? `Primary method: ${methodLabel}`
        : 'Primary method: None (2FA is turned off).';
    }

    // Backup codes
    if (backupEl) {
      let total = 0;
      let remaining = 0;
      let rawBackup = twofaSource.twofa_backup_codes;

      if (rawBackup) {
        let arr = rawBackup;
        if (typeof arr === 'string') {
          try {
            arr = JSON.parse(arr);
          } catch {
            // ignore parse error; treat as no codes
            arr = null;
          }
        }

        if (Array.isArray(arr)) {
          total = arr.length;
          for (const entry of arr) {
            if (!entry || typeof entry !== 'object') {
              remaining += 1;
              continue;
            }
            // Consider used_at or used flag as "used"
            const used = !!(entry.used_at || entry.used);
            if (!used) remaining += 1;
          }
        }
      }

      if (!total) {
        backupEl.textContent =
          'Backup codes: Not set up yet. Generate a set in the Security & 2FA modal.';
      } else {
        backupEl.textContent = `Backup codes: ${remaining}/${total} unused. You can regenerate a fresh set at any time.`;
      }
    }

    // Lockout / trusted devices
    if (lockoutEl) {
      const lockedUntil = twofaSource.twofa_locked_until
        ? new Date(twofaSource.twofa_locked_until)
        : null;

      if (lockedUntil && lockedUntil.getTime() > Date.now()) {
        lockoutEl.textContent =
          `Lockout: Too many incorrect 2FA attempts. New attempts allowed after ` +
          lockedUntil.toLocaleString() +
          '.';
        lockoutEl.style.color = '#ff9f43';
      } else {
        lockoutEl.textContent =
          "Lockout: No active lockout. Use “Remember this device” on login for trusted devices.";
        lockoutEl.style.color = '#999';
      }
    }
  } catch (err) {
    console.error('Error loading 2FA status for settings page:', err);
    if (statusEl) {
      statusEl.textContent = 'Could not load 2FA status.';
      statusEl.style.color = '#ff6b6b';
    }
    if (primaryEl) {
      primaryEl.textContent = 'Primary method: Unable to load.';
    }
    if (backupEl) {
      backupEl.textContent = 'Backup codes: Unable to load.';
    }
    if (lockoutEl) {
      lockoutEl.textContent = 'Lockout: Unable to load.';
      lockoutEl.style.color = '#ff6b6b';
    }
  }
}

// ---------- Public dashboard & privacy helpers ----------

const PUBLIC_DASH_BASE = `${location.origin}/u/index.html?u=`;

/**
 * Normalise a slug into a URL-safe string (same style as privacy.js).
 */
function sanitizePublicSlug(value) {
  if (!value) return '';
  let out = String(value)
    .normalize('NFD') // strip accents
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // collapse to hyphens
    .replace(/^-+|-+$/g, '')     // trim leading/trailing hyphens
    .slice(0, 64);
  return out;
}

/**
 * Best-effort slug suggestion based on username/email/user_id.
 */
function suggestPublicSlugFromUser(userLike) {
  const src = userLike || {};
  const username = (src.username || '').trim();
  const email = (src.email || '').trim();
  const rawUserId = (src.user_id || src.id || '').replace(/-/g, '');
  let base = '';

  if (username) {
    base = username;
  } else if (email && email.includes('@')) {
    base = email.split('@')[0];
  } else if (rawUserId) {
    base = `user-${rawUserId.slice(0, 8)}`;
  } else {
    base = `user-${Math.random().toString(36).slice(2, 8)}`;
  }

  let slug = sanitizePublicSlug(base);
  if (!slug) {
    slug =
      'user-' +
      (rawUserId ? rawUserId.slice(0, 8) : Math.random().toString(36).slice(2, 8));
  }
  if (slug.length < 4) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

/**
 * Wire the "Public dashboard enabled" toggle + URL + copy button
 * on the settings page to the same fields used by the privacy modal:
 *   users_extended_data.public_dashboard_enabled
 *   users_extended_data.public_dashboard_slug
 */
async function populatePublicDashboardInline(user) {
  const toggleEl = document.getElementById('settings-public-dashboard-toggle');
  const urlEl = document.getElementById('settings-public-url');
  const copyBtn = document.getElementById('settings-public-url-copy-btn');

  // If the HTML block isn't present, nothing to do.
  if (!toggleEl || !urlEl || !copyBtn || !user) return;

  const userId = user.user_id || user.id;
  let currentEnabled = false;
  let currentSlug = '';

  urlEl.textContent = 'Loading…';
  urlEl.style.color = '#9fc2ff';

  try {
    const { data, error } = await supabase
      .from('users_extended_data')
      .select(
        'public_dashboard_enabled, public_dashboard_slug, username, email, user_id'
      )
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error loading public dashboard state for settings page:', error);
      urlEl.textContent = 'Unable to load public URL.';
      urlEl.style.color = '#ff6b6b';
      return;
    }

    currentEnabled = !!data.public_dashboard_enabled;
    currentSlug = data.public_dashboard_slug || '';

    toggleEl.checked = currentEnabled;

    // Decide what to show in the URL box.
    if (currentSlug) {
      urlEl.textContent = `${PUBLIC_DASH_BASE}${currentSlug}`;
      urlEl.style.color = '#9fc2ff';
    } else {
      // No slug yet – show a preview of what it will look like when enabled.
      const previewSlug = suggestPublicSlugFromUser({
        username: data.username || user.username,
        email: data.email || user.email,
        user_id: data.user_id || userId,
        id: data.user_id || userId,
      });
      urlEl.textContent = `${PUBLIC_DASH_BASE}${previewSlug}`;
      urlEl.style.color = '#777'; // more "disabled"/preview look
    }
  } catch (err) {
    console.error('Unexpected error loading public dashboard state:', err);
    urlEl.textContent = 'Unable to load public URL.';
    urlEl.style.color = '#ff6b6b';
    return;
  }

  // Toggle handler
  toggleEl.addEventListener('change', async () => {
    const wantEnabled = !!toggleEl.checked;
    const prevEnabled = currentEnabled;

    try {
      let slugToUse = currentSlug;

      if (wantEnabled) {
        if (!slugToUse) {
          slugToUse = suggestPublicSlugFromUser({
            username: user.username,
            email: user.email,
            user_id: userId,
            id: userId,
          });
        }
        slugToUse = sanitizePublicSlug(slugToUse);
        if (!slugToUse) {
          if (window.showToast) {
            window.showToast(
              'Could not generate a public URL. Please contact support.',
              'error'
            );
          }
          toggleEl.checked = false;
          return;
        }
      }

      const payload = wantEnabled
        ? {
            public_dashboard_enabled: true,
            public_dashboard_slug: slugToUse,
          }
        : {
            // Keep the slug in the DB so the link stays reserved,
            // but flip enabled off.
            public_dashboard_enabled: false,
          };

      const { error } = await supabase
        .from('users_extended_data')
        .update(payload)
        .eq('user_id', userId);

      if (error) {
        console.error(
          'Error updating public dashboard enable flag from settings page:',
          error
        );

        const msg = String(error.message || '');
        if (msg.includes('public_dashboard_slug')) {
          if (window.showToast) {
            window.showToast(
              'That public URL is already in use. Open the privacy settings modal from your dashboard to choose a different slug.',
              'error'
            );
          }
        } else if (window.showToast) {
          window.showToast(
            'Could not update public dashboard setting. Please try again.',
            'error'
          );
        }

        toggleEl.checked = prevEnabled;
        return;
      }

      currentEnabled = wantEnabled;
      if (wantEnabled) {
        currentSlug = slugToUse;
        urlEl.textContent = `${PUBLIC_DASH_BASE}${currentSlug}`;
        urlEl.style.color = '#9fc2ff';
        if (window.showToast) {
          window.showToast('Public dashboard enabled.');
        }
      } else {
        // Still show the URL but make it clear it's disabled.
        if (currentSlug) {
          urlEl.textContent = `${PUBLIC_DASH_BASE}${currentSlug} (disabled)`;
        } else {
          urlEl.textContent = 'Public dashboard disabled.';
        }
        urlEl.style.color = '#999';
        if (window.showToast) {
          window.showToast('Public dashboard disabled.');
        }
      }
    } catch (err) {
      console.error(
        'Unexpected error while toggling public dashboard from settings page:',
        err
      );
      toggleEl.checked = prevEnabled;
      if (window.showToast) {
        window.showToast('Error updating public dashboard setting.', 'error');
      }
    }
  });

  // Copy button
  copyBtn.addEventListener('click', () => {
    const slug = currentSlug;
    if (!slug) {
      if (window.showToast) {
        window.showToast(
          'Enable your public dashboard first to generate a link.',
          'error'
        );
      }
      return;
    }

    const url = `${PUBLIC_DASH_BASE}${slug}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          if (window.showToast) {
            window.showToast('Public dashboard link copied!');
          }
        })
        .catch((err) => {
          console.error('Clipboard API failed, falling back:', err);
          if (window.showToast) {
            window.showToast(
              'Unable to copy link automatically. Please copy it manually.',
              'error'
            );
          }
        });
    } else {
      // Older browser fallback
      try {
        const tempInput = document.createElement('input');
        tempInput.value = url;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        tempInput.remove();
        if (window.showToast) {
          window.showToast('Public dashboard link copied!');
        }
      } catch (err) {
        console.error('execCommand copy failed:', err);
        if (window.showToast) {
          window.showToast(
            'Unable to copy link automatically. Please copy it manually.',
            'error'
          );
        }
      }
    }
  });
}


// ---------- Main wiring ----------

document.addEventListener('DOMContentLoaded', async () => {
  let currentUser = await getActiveUser();
  if (!currentUser) return;

  // ---- Dashboard link: route based on user type ----
  const dashboardLink = document.getElementById('settings-dashboard-link');
  if (dashboardLink) {
    const userType = String(
      currentUser.user_type || currentUser.userType || ''
    ).toLowerCase();

    const target =
      userType === 'besponsored' || userType === 'to be sponsored'
        ? './dashboardsponsee.html'
        : './dashboardsponsor.html';

    // Set href for proper “open in new tab”, etc.
    dashboardLink.href = target;

    dashboardLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = target;
    });
  }

  // ---- Avatar preview ----
  const avatarImg = document.getElementById('profile-avatar-img');
  if (avatarImg) {
    avatarImg.alt = currentUser.username
      ? `${currentUser.username}'s profile picture`
      : 'Profile picture';


    if (currentUser.profile_pic) {
      try {
        const { data, error } = await supabase.storage
          .from('logos')
          .createSignedUrl(currentUser.profile_pic, 60 * 60); // 1 hour

        if (!error && data?.signedUrl) {
          avatarImg.src = data.signedUrl;
        }
      } catch (err) {
        console.error('Error loading profile logo for settings page:', err);
      }
    }
  }

  // ---- Description text ----
  const descDisplay = document.getElementById('settings-profile-description');
  if (descDisplay) {
    const text = (currentUser.about_yourself || '').trim();
    descDisplay.textContent = text || 'No description added yet.';
    descDisplay.style.color = text ? '#eee' : '#777';
  }

  // ---- Website link ----
  const websiteLink = document.getElementById('settings-profile-website-link');
  if (websiteLink) {
    const raw = currentUser.website_url || '';
    const val = typeof raw === 'string' ? raw.trim() : '';

    if (val) {
      const href =
        val.startsWith('http://') || val.startsWith('https://')
          ? val
          : `https://${val}`;
      websiteLink.href = href;
      websiteLink.textContent = href;
      websiteLink.style.color = '#9fc2ff';
    } else {
      websiteLink.removeAttribute('href');
      websiteLink.textContent = 'No website linked yet.';
      websiteLink.style.color = '#777';
    }
  }

  // ---- Extra details: title, company_name, location, contenttype ----
  const titleInput = document.getElementById('settings-title-input');
  const companyInput = document.getElementById('settings-company-input');
  const locationInput = document.getElementById('settings-location-input');
  const contentTypeInput = document.getElementById('settings-contenttype-input');
  const saveDetailsBtn = document.getElementById(
    'settings-profile-details-save-btn'
  );
  const detailsMsg = document.getElementById('settings-profile-details-msg');

  // Prefill from currentUser (matches users_extended_data columns).
  if (titleInput) {
    titleInput.value = currentUser.title || '';
  }
  if (companyInput) {
    companyInput.value = currentUser.company_name || '';
  }
  if (locationInput) {
    locationInput.value = currentUser.location || '';
  }
  if (contentTypeInput) {
    contentTypeInput.value = currentUser.contenttype || '';
  }

  if (saveDetailsBtn) {
    saveDetailsBtn.addEventListener('click', async () => {
      if (!currentUser) {
        if (detailsMsg) {
          detailsMsg.textContent = 'You must be signed in to update details.';
          detailsMsg.style.color = '#ff6b6b';
        }
        return;
      }

      const titleVal = titleInput ? titleInput.value.trim() : '';
      const companyVal = companyInput ? companyInput.value.trim() : '';
      const locationVal = locationInput ? locationInput.value.trim() : '';
      const contentTypeVal = contentTypeInput
        ? contentTypeInput.value.trim()
        : '';

      // -------- FamBot moderation for inline profile details --------
      const combinedContent = [
        titleVal && `Title: ${titleVal}`,
        companyVal && `Company: ${companyVal}`,
        locationVal && `Location: ${locationVal}`,
        contentTypeVal && `Content type: ${contentTypeVal}`,
      ]
        .filter(Boolean)
        .join('\n')
        .trim();

      if (combinedContent) {
        try {
          const {
            data: sessionData,
            error: sessionError,
          } = await supabase.auth.getSession();
          if (sessionError) {
            console.warn('Could not fetch session for FamBot:', sessionError);
          }

          const jwt = sessionData?.session?.access_token || null;

          const modResult = await famBotModerateWithModal({
            user_id: currentUser.user_id,
            content: combinedContent,
            jwt,
            type: 'profile',
          });

          if (modResult && modResult.allowed === false) {
            const msg =
              modResult.message ||
              'Some of your profile details were blocked by moderation. Please adjust and try again.';
            if (detailsMsg) {
              detailsMsg.textContent = msg;
              detailsMsg.style.color = '#ff6b6b';
            }
            if (window.showToast) {
              window.showToast(msg, 'error');
            }
            return; // Do NOT write to Supabase if blocked
          }
        } catch (err) {
          console.error('FamBot moderation failed (profile details):', err);
          // If FamBot fails, fall through and allow the save instead of bricking the form.
        }
      }
      // -------- End FamBot moderation --------

      if (detailsMsg) {
        detailsMsg.textContent = 'Saving…';
        detailsMsg.style.color = '#999';
      }

      try {
        const { error } = await supabase
          .from('users_extended_data')
          .update({
            title: titleVal || null,
            company_name: companyVal || null,
            location: locationVal || null,
            contenttype: contentTypeVal || null,
          })
          .eq('user_id', currentUser.user_id);

        if (error) {
          console.error('Error updating profile details:', error);
          if (detailsMsg) {
            detailsMsg.textContent = 'Error saving details. Please try again.';
            detailsMsg.style.color = '#ff6b6b';
          }
          if (window.showToast) {
            window.showToast(
              'Could not save details. Please try again.',
              'error'
            );
          }
          return;
        }

        // Update in-memory currentUser so the rest of the page stays in sync.
        currentUser = {
          ...currentUser,
          title: titleVal,
          company_name: companyVal,
          location: locationVal,
          contenttype: contentTypeVal,
        };

        if (detailsMsg) {
          detailsMsg.textContent = 'Details saved.';
          detailsMsg.style.color = '#7CFFA1';
        }
        if (window.showToast) {
          window.showToast('Profile details updated.');
        }
      } catch (err) {
        console.error('Unexpected error updating profile details:', err);
        if (detailsMsg) {
          detailsMsg.textContent = 'Unexpected error. Please try again.';
          detailsMsg.style.color = '#ff6b6b';
        }
        if (window.showToast) {
          window.showToast(
            'Unexpected error while saving details.',
            'error'
          );
        }
      }
    });
  }

  // ---- Platforms & handles section ----
  populatePlatformsSection(currentUser);
  wirePlatformRowShortcuts();

  // ---- Referrals & Subscription section ----
  await populateReferralsAndSubscription(currentUser);

  // ---- Featured Star & Affiliate inline sections ----
  await populateFeaturedInline(currentUser);
  await populateAffiliateInline(currentUser);

  // ---- Security & 2FA inline status ----
  await populateSecurityTwoFA(currentUser);

  // ---- Public dashboard & privacy ----
  await populatePublicDashboardInline(currentUser);

  // ---- Proxy buttons (pretty buttons -> hidden dropdown hooks from settings.js) ----

  // Website edit button → hidden "add-website-url" hook
  const websiteBtn = document.getElementById('settings-open-website-btn');
  if (websiteBtn) {
    websiteBtn.addEventListener('click', () => {
      document.getElementById('add-website-url')?.click();
    });
  }

  // Featured/Premium → hidden "open-premium-settings"
  const premiumBtn = document.getElementById('settings-open-premium-visible');
  if (premiumBtn) {
    premiumBtn.addEventListener('click', () => {
      document.getElementById('open-premium-settings')?.click();
    });
  }

  // Affiliate apply → hidden "open-affiliate-apply"
  const affiliateBtn = document.getElementById(
    'settings-open-affiliate-visible'
  );
  if (affiliateBtn) {
    affiliateBtn.addEventListener('click', () => {
      document.getElementById('open-affiliate-apply')?.click();
    });
  }

  // Security & 2FA → hidden "open-security-settings"
  const securityBtn = document.getElementById('settings-open-security-visible');
  if (securityBtn) {
    securityBtn.addEventListener('click', () => {
      document.getElementById('open-security-settings')?.click();
    });
  }
});
