// File: ./js/settingsPage.js
//
// Extra wiring just for settings.html:
// - Show profile picture with "click to change".
// - Show current description + website.
// - Allow editing title, company_name, location, contenttype.
// - Show Platforms & Handles with real connected status (same logic as settings.js).
//   - If platform is connected via OAuth, disable its "Edit handle" button.
// - Show inline Referrals & Subscription summary (plan, Stripe status, referral link, referral stats).
// - Proxy the visible buttons to the hidden dropdown actions that settings.js already handles.

import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';

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
  // If the expanded platforms UI isn’t on this page, bail early.
  if (!platformsSummaryEl || !user) return;

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
 *
 * Expects:
 *  - Hidden buttons somewhere on the page:
 *      #relink-social-btn   (opens manual handles modal)
 *      #oauth-link-btn      (opens OAuth accounts modal)
 *  - Per-row buttons:
 *      #settings-youtube-edit-handle-btn, #settings-youtube-manage-oauth-btn
 *      #settings-twitch-edit-handle-btn,  #settings-twitch-manage-oauth-btn
 *      #settings-instagram-edit-handle-btn, #settings-instagram-manage-oauth-btn
 *      #settings-tiktok-edit-handle-btn,    #settings-tiktok-manage-oauth-btn
 *      #settings-x-edit-handle-btn,         #settings-x-manage-oauth-btn
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

  // ---- Plan type (planType column on user) ----
  try {
    // ---- Plan type (planType column on user) ----
const planTypeRaw = user.planType || 'free';
const planType = String(planTypeRaw).toLowerCase();
const isFreePlan = planType === 'free';

if (planRow) {
  const label = isFreePlan ? 'Free' : 'Pro';

  // Text span inside the row (fallback to planRow if span not found)
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
            subRow.textContent = 'Subscription: Unable to load subscription (missing session).';
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

    // ---- Referral link summary (same logic as modal, but inline) ----
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

// ---------- Main wiring ----------

document.addEventListener('DOMContentLoaded', async () => {
  let currentUser = await getActiveUser();
  if (!currentUser) return;

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

        // Update local copy so UI stays in sync
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

  // ---- Proxy buttons (pretty buttons -> hidden dropdown hooks from settings.js) ----

  // Website edit button → hidden "add-website-url" hook
  const websiteBtn = document.getElementById('settings-open-website-btn');
  if (websiteBtn) {
    websiteBtn.addEventListener('click', () => {
      document.getElementById('add-website-url')?.click();
    });
  }

  // Featured / Premium → hidden "open-premium-settings"
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
