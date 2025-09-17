// alerts.js
import { supabase } from './supabaseClient.js';

// === UI notification dropdown logic (shared by sponsor & sponsee) ===

let notifications = [];

/** Utility: check if current page is one of the dashboards */
function isOnDashboard() {
  const p = location.pathname.toLowerCase();
  return p.endsWith('dashboardsponsor.html') || p.endsWith('/dashboardsponsor.html')
      || p.endsWith('dashboardsponsee.html') || p.endsWith('/dashboardsponsee.html');
}

/** Utility: which dashboard for this user? */
function resolveDashboardPath(userType) {
  return (String(userType || '').toLowerCase() === 'besponsored')
    ? './dashboardsponsee.html'
    : './dashboardsponsor.html'; // default to sponsor if missing/unknown
}

/** Highlight a DOM node temporarily */
function flashNode(node) {
  if (!node) return;
  node.style.transition = 'background 0.4s, box-shadow 0.4s, border 0.4s';
  const prevBg = node.style.background;
  const prevBorder = node.style.border;
  const prevBoxShadow = node.style.boxShadow;
  node.style.background = '#3b3b3b';
  node.style.border = '3px solid #0096FF';
  node.style.boxShadow = '0 0 18px 2px rgba(40, 5, 180, 0.53)';
  setTimeout(() => {
    node.style.background = prevBg || '';
    node.style.border = prevBorder || '';
    node.style.boxShadow = prevBoxShadow || '';
  }, 1500);
}

/** Try to find a card/row by offer id and scroll/highlight it */
function jumpToOfferId(offerId) {
  if (!offerId) return false;
  let card =
    document.querySelector(`.public-offer-card[data-offer-id="${offerId}"]`) ||
    document.querySelector(`.listing-stage[data-offer-id="${offerId}"]`) ||
    document.querySelector(`#archived-table-body tr[data-offer-id="${offerId}"]`);
  if (!card) return false;

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flashNode(card);
  return true;
}

/** Poll for target element to exist before jumping (for content rendered by other JS) */
function waitAndJumpToOffer(offerId, { interval = 150, limit = 40 } = {}) {
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (jumpToOfferId(offerId) || tries >= limit) {
      clearInterval(timer);
    }
  }, interval);
}

/** On dashboards, auto-consume ?offer=... deep links created by alert clicks */
function consumeDeepLinkIfPresent() {
  if (!isOnDashboard()) return;
  const url = new URL(window.location.href);
  const deepOffer = url.searchParams.get('offer');
  if (!deepOffer) return;
  // Give the page a moment to render cards, then attempt jump a few times.
  setTimeout(() => waitAndJumpToOffer(deepOffer), 300);
}

document.addEventListener('DOMContentLoaded', async () => {
  const bell = document.getElementById('notification-bell');
  const badge = document.getElementById('notification-count');
  if (!bell || !badge) {
    consumeDeepLinkIfPresent(); // still consume deep link even if no bell on page
    return;
  }

  // Build dropdown once
  let dropdown = document.getElementById('notification-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.right = '10px';
    dropdown.style.top = '55px';
    dropdown.style.background = '#222';
    dropdown.style.color = '#fff';
    dropdown.style.minWidth = '290px';
    dropdown.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)';
    dropdown.style.borderRadius = '11px';
    dropdown.style.zIndex = '200';
    dropdown.style.padding = '10px 0';
    dropdown.style.maxHeight = '380px';
    dropdown.style.overflowY = 'auto';
    document.body.appendChild(dropdown);
  }

  // Session + user
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    badge.style.display = 'none';
    consumeDeepLinkIfPresent();
    return;
  }
  const userId = session.user.id;

  // Pull notification_uuid, email, userType (for routing), and alert_email (for toggle)
  const { data: userRow, error: userErr } = await supabase
    .from('users_extended_data')
    .select('notification_uuid, email, userType, alert_email')
    .eq('user_id', userId)
    .single();

  if (userErr) {
    console.error('alerts.js: failed to load users_extended_data:', userErr.message);
  }
  const notification_uuid = userRow?.notification_uuid;
  const user_email = userRow?.email;
  const userType = userRow?.userType || 'sponsor';

  if (!notification_uuid) {
    badge.style.display = 'none';
    consumeDeepLinkIfPresent();
    return;
  }

  // (Optional) Email Alerts toggle, if present on page
  initEmailAlertToggle(userId, userRow?.alert_email);

  async function loadNotifications() {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('notification_uuid', notification_uuid)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('alerts.js: loadNotifications failed:', error.message);
      badge.style.display = 'none';
      return;
    }

    notifications = data || [];
    const unread = notifications.filter(n => !n.read);
    if (unread.length > 0) {
      badge.textContent = unread.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
    renderDropdown();
  }

  async function clearReadNotifications() {
    const readNotifs = notifications.filter(n => n.read);
    if (!readNotifs.length) return;
    const idsToDelete = readNotifs.map(n => n.id);
    if (!idsToDelete.length) return;

    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      console.error('alerts.js: clearReadNotifications failed:', error.message);
    }
    await loadNotifications();
  }

  function renderDropdown() {
    if (!dropdown) return;
    dropdown.innerHTML = '';

    const readCount = notifications.filter(n => n.read).length;
    if (readCount > 0) {
      const clearBtn = document.createElement('button');
      clearBtn.innerText = `Clear Read (${readCount})`;
      clearBtn.style.display = 'block';
      clearBtn.style.margin = '5px auto 15px auto';
      clearBtn.style.padding = '6px 18px';
      clearBtn.style.background = '#0096FF';
      clearBtn.style.color = '#fff';
      clearBtn.style.border = 'none';
      clearBtn.style.borderRadius = '6px';
      clearBtn.style.cursor = 'pointer';
      clearBtn.style.fontWeight = 'bold';
      clearBtn.onmouseenter = () => (clearBtn.style.background = '#006ed1');
      clearBtn.onmouseleave = () => (clearBtn.style.background = '#0096FF');
      clearBtn.onclick = async (e) => {
        e.stopPropagation();
        await clearReadNotifications();
      };
      dropdown.appendChild(clearBtn);
    }

    if (!notifications.length) {
      dropdown.innerHTML += `<div class="notif-item" style="padding:20px;text-align:center;color:#aaa;">No notifications.</div>`;
      return;
    }

    notifications.forEach(n => {
      const notif = document.createElement('div');
      notif.className = 'notif-item';
      notif.style.padding = '12px 18px';
      notif.style.cursor = 'pointer';
      notif.style.borderBottom = '1px solid #333';
      notif.style.background = n.read ? 'transparent' : '#292929';
      notif.innerHTML = `
        <div style="font-weight:bold;font-size:1em;color:${n.read ? '#fff' : '#3498fd'}">${n.title || '[No Title]'}</div>
        <div style="font-size:0.95em;line-height:1.5;">${n.message || ''}</div>
        <div style="font-size:0.85em;color:#aaa;margin-top:3px;">${n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
      `;

      notif.onclick = async () => {
        // Mark read if needed
        if (!n.read) {
          const { error } = await supabase
            .from('user_notifications')
            .update({ read: true })
            .eq('id', n.id);
          if (error) console.error('alerts.js: mark read failed:', error.message);
          n.read = true;
          loadNotifications();
        }

        // Build deep link for the correct dashboard
        const dashboard = resolveDashboardPath(userType);
        const target = new URL(dashboard, window.location.href);
        if (n.related_offer_id) target.searchParams.set('offer', n.related_offer_id);
        if (n.type)            target.searchParams.set('type', n.type);
        target.searchParams.set('notif', String(n.id));

        // If not on the dashboard for this user, redirect; else in-page jump.
        const onSponsor = location.pathname.toLowerCase().endsWith('dashboardsponsor.html');
        const onSponsee = location.pathname.toLowerCase().endsWith('dashboardsponsee.html');
        const shouldBeSponsor = dashboard.toLowerCase().includes('dashboardsponsor.html');
        const isCorrectDashboard = (shouldBeSponsor && onSponsor) || (!shouldBeSponsor && onSponsee);

        dropdown.style.display = 'none';

        if (!isCorrectDashboard) {
          window.location.href = target.toString();
          return;
        }

        // Already on correct dashboard: smooth scroll + highlight
        setTimeout(() => {
          if (n.related_offer_id) {
            if (!jumpToOfferId(n.related_offer_id)) {
              // If card not yet rendered, poll briefly
              waitAndJumpToOffer(n.related_offer_id);
            }
          }
        }, 100);
      };

      dropdown.appendChild(notif);
    });
  }

  // Bell open/close
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.style.display === 'none') {
      const rect = bell.getBoundingClientRect();
      dropdown.style.right = (window.innerWidth - rect.right + 12) + 'px';
      dropdown.style.top = (rect.bottom + 8) + 'px';
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
  });

  document.addEventListener('click', () => {
    if (dropdown && dropdown.style.display === 'block') dropdown.style.display = 'none';
  });

  // Initial load + polling
  await loadNotifications();
  setInterval(loadNotifications, 20000);

  // If we landed here with ?offer=... (from some other page), do the jump
  consumeDeepLinkIfPresent();
});

/** Optional: wire Email Alerts toggle if present on the page */
async function initEmailAlertToggle(userId, initial) {
  const toggle = document.getElementById('email-alert-toggle');
  if (!toggle) return;
  toggle.checked = !!initial;
  toggle.addEventListener('change', async () => {
    const { error } = await supabase
      .from('users_extended_data')
      .update({ alert_email: toggle.checked })
      .eq('user_id', userId);
    if (error) {
      console.error('alerts.js: failed to update alert_email:', error.message);
      // revert UI on failure
      toggle.checked = !toggle.checked;
    }
  });
}

// ==== Notification INSERT HELPERS ====

// Helper: Given a user_id, get their notification_uuid **and email**
export async function getNotificationInfo(user_id) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('notification_uuid, email')
    .eq('user_id', user_id)
    .single();
  if (error) {
    console.error('alerts.js: getNotificationInfo failed:', error.message);
  }
  return { notification_uuid: data?.notification_uuid || null, email: data?.email || null };
}

// Universal notification insert (use notification_uuid and email now)
export async function insertNotification({ notification_uuid, email, type, title, message, related_offer_id }) {
  if (!notification_uuid || !email) {
    console.error('insertNotification: notification_uuid and email are required');
    return;
  }
  const { error } = await supabase
    .from('user_notifications')
    .insert([{
      notification_uuid,
      email,
      type,
      title,
      message,
      read: false,
      related_offer_id: related_offer_id || null,
      created_at: new Date().toISOString()
    }]);
  if (error) {
    console.error('Notification insert error:', error.message);
  }
}

// --- COMMENT NOTIFICATION ---
export async function notifyComment({ offer_id, from_user_id, to_user_id, from_username, message }) {
  const { notification_uuid, email } = await getNotificationInfo(to_user_id);
  if (!notification_uuid || !email) return;
  await insertNotification({
    notification_uuid,
    email,
    type: 'comment',
    title: `New Comment from ${from_username}`,
    message: message,
    related_offer_id: offer_id
  });
}

// --- OFFER STATUS/UPDATE NOTIFICATION ---
export async function notifyOfferUpdate({ to_user_id, offer_id, type, title, message }) {
  const { notification_uuid, email } = await getNotificationInfo(to_user_id);
  if (!notification_uuid || !email) return;
  await insertNotification({
    notification_uuid,
    email,
    type: type || 'offer_update',
    title,
    message,
    related_offer_id: offer_id
  });
}

export async function notifyOfferStatus({ offer_id, to_user_id, status, offer_title }) {
  const statusText = {
    accepted: 'Offer Accepted',
    rejected: 'Offer Rejected',
    in_progress: 'Work In Progress',
    live: 'Content is Live',
    completed: 'Sponsorship Completed',
    pending: 'Offer Pending',
    cancelled: 'Offer Cancelled'
  }[status] || `Status: ${status}`;
  const { notification_uuid, email } = await getNotificationInfo(to_user_id);
  if (!notification_uuid || !email) return;
  await insertNotification({
    notification_uuid,
    email,
    type: 'offer_status',
    title: `${statusText}`,
    message: `Offer: ${offer_title}`,
    related_offer_id: offer_id
  });
}

export async function notifyReview({ offer_id, to_user_id, reviewer_username, role }) {
  const roleText = role === 'sponsee' ? 'Sponsee' : 'Sponsor';
  const { notification_uuid, email } = await getNotificationInfo(to_user_id);
  if (!notification_uuid || !email) return;
  await insertNotification({
    notification_uuid,
    email,
    type: 'review',
    title: `New Review from ${reviewer_username}`,
    message: `${roleText} has left you a review.`,
    related_offer_id: offer_id
  });
}

export async function notifyPayout({ to_user_id, payout_amount, payout_currency, payout_status, offer_id }) {
  const statusText = payout_status === 'sent'
    ? 'Payout Sent'
    : payout_status === 'completed'
      ? 'Payout Completed'
      : `Payout ${payout_status}`;
  const { notification_uuid, email } = await getNotificationInfo(to_user_id);
  if (!notification_uuid || !email) return;
  await insertNotification({
    notification_uuid,
    email,
    type: 'payout',
    title: `${statusText}`,
    message: `You have a payout of ${payout_amount} ${payout_currency} credited to your account, request payout in your wallet.`,
    related_offer_id: offer_id || null
  });
}

// --- NEW OFFER NOTIFICATION ---
export async function notifyNewOffer({ offer_id, to_user_id, from_username, offer_title }) {
  const { notification_uuid, email } = await getNotificationInfo(to_user_id);
  if (!notification_uuid || !email) return;
  await insertNotification({
    notification_uuid,
    email,
    type: 'new_offer',
    title: `New Sponsorship Offer from ${from_username}`,
    message: `Offer: ${offer_title}`,
    related_offer_id: offer_id
  });
}

