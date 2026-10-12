// alerts.js
import { supabase } from './supabaseClient.js';
import { appendNotificationContent } from './notificationContent.js?v=20261012-safe1';

const notificationStyles = document.createElement('link');
notificationStyles.rel = 'stylesheet';
notificationStyles.href = new URL('../notifications.css?v=20261012-brand4', import.meta.url).href;
document.head.appendChild(notificationStyles);

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
function waitAndJumpToOffer(offerId, opts = {}) {
  const {
    interval = 150,
    limit = 10,
    onFail
  } = opts;

  let tries = 0;
  const timer = setInterval(() => {
    tries++;

    // If we successfully find and jump to the offer, stop polling
    if (jumpToOfferId(offerId)) {
      clearInterval(timer);
      return;
    }

    // If we've hit the limit and still didn't find it, stop and run fallback
    if (tries >= limit) {
      clearInterval(timer);
      if (typeof onFail === 'function') {
        onFail();
      }
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
  let bell = document.getElementById('notification-bell');
  const badge = document.getElementById('notification-count');
  if (!bell || !badge) {
    consumeDeepLinkIfPresent(); // still consume deep link even if no bell on page
    return;
  }

  // Imported helpers and versioned script tags can load separate module instances.
  if (document.documentElement.dataset.notificationsReady) return;
  document.documentElement.dataset.notificationsReady = 'true';

  // Build dropdown once
  let dropdown = document.getElementById('notification-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    dropdown.style.display = 'none';
    dropdown.setAttribute('role', 'region');
    dropdown.setAttribute('aria-label', 'Notifications');
    dropdown.addEventListener('click', e => e.stopPropagation());
    document.body.appendChild(dropdown);
  }

  bell.setAttribute('aria-controls', 'notification-dropdown');
  bell.setAttribute('aria-expanded', 'false');
  function closeNotifications() {
    dropdown.style.display = 'none';
    bell.setAttribute('aria-expanded', 'false');
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

  // NEW: Mark all notifications as read (no delete, just flip read=true)
  async function markAllNotificationsRead() {
    const unreadNotifs = notifications.filter(n => !n.read);
    if (!unreadNotifs.length) return;

    const { error } = await supabase
      .from('user_notifications')
      .update({ read: true })
      .eq('notification_uuid', notification_uuid)
      .eq('read', false);

    if (error) {
      console.error('alerts.js: markAllNotificationsRead failed:', error.message);
      return;
    }

    await loadNotifications();
  }

 function renderDropdown() {
  if (!dropdown) return;
  dropdown.replaceChildren();

  const readCount   = notifications.filter(n => n.read).length;
  const unreadCount = notifications.filter(n => !n.read).length;

  const header = document.createElement('div'); header.className = 'notification-heading';
  const heading = document.createElement('h2'); heading.textContent = 'Notifications';
  const summary = document.createElement('p'); summary.textContent = unreadCount ? unreadCount + ' unread · latest updates' : 'You’re all caught up';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'notification-close';
  close.textContent = '×'; close.setAttribute('aria-label', 'Close notifications'); close.onclick = closeNotifications;
  header.append(heading, summary, close); dropdown.append(header);

  // === Actions row (Mark all read + Clear read) on ONE line ===
  if (unreadCount > 0 || readCount > 0) {
    const actionsRow = document.createElement('div'); actionsRow.className = 'notification-actions';

    // Mark all read (left)
    if (unreadCount > 0) {
      const markAllBtn = document.createElement('button');
      markAllBtn.innerText = `Mark all read (${unreadCount})`;
      markAllBtn.onclick = async (e) => {
        e.stopPropagation();
        await markAllNotificationsRead();
      };
      actionsRow.appendChild(markAllBtn);
    }

    // Clear read (right)
    if (readCount > 0) {
      const clearBtn = document.createElement('button');
      clearBtn.innerText = `Clear read (${readCount})`;
      clearBtn.onclick = async (e) => {
        e.stopPropagation();
        await clearReadNotifications();
      };
      actionsRow.appendChild(clearBtn);
    }

    dropdown.appendChild(actionsRow);
  }

  // If no notifications at all
  if (!notifications.length) {
    const empty = document.createElement('p'); empty.className = 'notification-empty';
    empty.textContent = 'No updates yet. Your offers, messages and campaign activity will appear here.';
    dropdown.append(empty);
    return;
  }

  // === Notification list ===
  notifications.forEach(n => {
    const notif = document.createElement('button');
    notif.type = 'button';
    notif.className = 'notif-item' + (n.read ? '' : ' is-unread');
    appendNotificationContent(notif, n);

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

      const dashboard = resolveDashboardPath(userType);
      const target = new URL(dashboard, window.location.href);
      if (n.related_offer_id) target.searchParams.set('offer', n.related_offer_id);
      if (n.type)            target.searchParams.set('type', n.type);
      target.searchParams.set('notif', String(n.id));

            const onSponsor = location.pathname.toLowerCase().endsWith('dashboardsponsor.html');
      const onSponsee = location.pathname.toLowerCase().endsWith('dashboardsponsee.html');
      const shouldBeSponsor = dashboard.toLowerCase().includes('dashboardsponsor.html');
      const isCorrectDashboard = (shouldBeSponsor && onSponsor) || (!shouldBeSponsor && onSponsee);

      closeNotifications();

      // If we're on the wrong dashboard, just navigate there with deep-link params.
      if (!isCorrectDashboard) {
        window.location.href = target.toString();
        return;
      }

      // Already on the correct dashboard:
      // 1) Try an in-place jump.
      // 2) If we fail to find the card after polling, reload the page
      //    with the deep-link params so the dashboard scripts re-run
      //    and `consumeDeepLinkIfPresent()` can try again.
      if (!n.related_offer_id) {
        return;
      }

      setTimeout(() => {
        // Quick immediate attempt
        if (jumpToOfferId(n.related_offer_id)) return;

        // Poll for a bit; on failure, reload with deep link
        waitAndJumpToOffer(n.related_offer_id, {
          // Optionally tweak limit if you want a shorter/longer wait
          // limit: 20,
          onFail: () => {
            window.location.href = target.toString();
          }
        });
      }, 100);

    };

    dropdown.appendChild(notif);
  });
}


  // Bell open/close
  document.addEventListener('click', (e) => {
    const currentBell = e.target.closest?.('#notification-bell');
    if (!currentBell) return;
    bell = currentBell;
    bell.setAttribute('aria-controls', 'notification-dropdown');
    e.stopPropagation();
    if (dropdown.style.display === 'none') {
      const rect = bell.getBoundingClientRect();
      dropdown.style.setProperty('--notification-right', Math.max(12, window.innerWidth - rect.right) + 'px');
      const top = Math.min(rect.bottom + 8, window.innerHeight - 180);
      dropdown.style.top = Math.max(12, top) + 'px';
      dropdown.style.setProperty('--notification-room', Math.max(160, window.innerHeight - top - 12) + 'px');
      dropdown.style.display = 'block';
      bell.setAttribute('aria-expanded', 'true');
    } else {
      closeNotifications();
    }
  });

  document.addEventListener('click', e => {
    if (e.target.closest?.('#notification-bell, #notification-dropdown')) return;
    closeNotifications();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dropdown.style.display === 'block') { closeNotifications(); bell.focus(); }
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
