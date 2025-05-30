import { supabase } from './supabaseClient.js';

// === UI notification dropdown logic ===

let notifications = [];

document.addEventListener('DOMContentLoaded', async () => {
  const bell = document.getElementById('notification-bell');
  const badge = document.getElementById('notification-count');
  if (!bell || !badge) return;

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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    badge.style.display = 'none';
    return;
  }
  const userId = session.user.id;

  // Get notification_uuid and email for this user
  const { data: userRow } = await supabase
    .from('users_extended_data')
    .select('notification_uuid, email')
    .eq('user_id', userId)
    .single();

  const notification_uuid = userRow?.notification_uuid;
  const user_email = userRow?.email;
  if (!notification_uuid) {
    badge.style.display = 'none';
    return;
  }

  async function loadNotifications() {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('notification_uuid', notification_uuid)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
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
    if (idsToDelete.length > 0) {
      await supabase
        .from('user_notifications')
        .delete()
        .in('id', idsToDelete);
      await loadNotifications();
    }
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
      clearBtn.onmouseenter = () => clearBtn.style.background = '#006ed1';
      clearBtn.onmouseleave = () => clearBtn.style.background = '#0096FF';
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
        if (!n.read) {
          await supabase
            .from('user_notifications')
            .update({ read: true })
            .eq('id', n.id);
          n.read = true;
          loadNotifications();
        }
        if (n.related_offer_id) {
          dropdown.style.display = 'none';
          if (n.type === "review") {
            setTimeout(() => {
              const archiveRow = document.querySelector(`#archived-table-body tr[data-offer-id="${n.related_offer_id}"]`);
              if (archiveRow) {
                archiveRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                archiveRow.style.transition = 'background 0.4s, box-shadow 0.4s, border 0.4s';
                const prevBg = archiveRow.style.background;
                const prevBorder = archiveRow.style.border;
                const prevBoxShadow = archiveRow.style.boxShadow;
                archiveRow.style.background = '#3b3b3b';
                archiveRow.style.border = '3px solid #0096FF';
                archiveRow.style.boxShadow = '0 0 18px 2px rgba(40, 5, 180, 0.53)';
                setTimeout(() => {
                  archiveRow.style.background = prevBg || '';
                  archiveRow.style.border = prevBorder || '';
                  archiveRow.style.boxShadow = prevBoxShadow || '';
                }, 1500);
              } else {
                const card = document.querySelector(`.listing-stage[data-offer-id="${n.related_offer_id}"]`);
                if (card) {
                  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  card.style.transition = 'background 0.4s, box-shadow 0.4s, border 0.4s';
                  const prevBg = card.style.background;
                  const prevBorder = card.style.border;
                  const prevBoxShadow = card.style.boxShadow;
                  card.style.background = '#3b3b3b';
                  card.style.border = '3px solid #0096FF';
                  card.style.boxShadow = '0 0 18px 2px rgba(40, 5, 180, 0.53)';
                  setTimeout(() => {
                    card.style.background = prevBg || '';
                    card.style.border = prevBorder || '';
                    card.style.boxShadow = prevBoxShadow || '';
                  }, 1500);
                }
              }
            }, 120);
          } else {
            setTimeout(() => {
              const card = document.querySelector(`.listing-stage[data-offer-id="${n.related_offer_id}"]`);
              if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.transition = 'background 0.4s, box-shadow 0.4s, border 0.4s';
                const prevBg = card.style.background;
                const prevBorder = card.style.border;
                const prevBoxShadow = card.style.boxShadow;
                card.style.background = '#3b3b3b';
                card.style.border = '3px solid #0096FF';
                card.style.boxShadow = '0 0 18px 2px rgba(40, 5, 180, 0.53)';
                setTimeout(() => {
                  card.style.background = prevBg || '';
                  card.style.border = prevBorder || '';
                  card.style.boxShadow = prevBoxShadow || '';
                }, 1500);
              }
            }, 80);
          }
        }
      };
      dropdown.appendChild(notif);
    });
  }

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

  document.addEventListener('click', (e) => {
    if (dropdown && dropdown.style.display === 'block') {
      dropdown.style.display = 'none';
    }
  });

  loadNotifications();
  setInterval(loadNotifications, 20000);
});

// ==== Notification INSERT HELPERS ====

// Helper: Given a user_id, get their notification_uuid **and email**
export async function getNotificationInfo(user_id) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('notification_uuid, email')
    .eq('user_id', user_id)
    .single();
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
      email, // new email field
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
  // Get recipient's notification_uuid and email
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
    message: `You have a payout of ${payout_amount} ${payout_currency} on the way! Please allow upto 3 days for payment.`,
    related_offer_id: offer_id || null
  });
}

// --- NEW OFFER NOTIFICATION ---
export async function notifyNewOffer({ offer_id, to_user_id, from_username, offer_title }) {
  // Get recipient's notification_uuid and email
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
