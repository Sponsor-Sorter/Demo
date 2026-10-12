// Notification content can originate from other accounts. Never render it as HTML.
export function appendNotificationContent(parent, notification) {
  const title = document.createElement('div');
  title.style.fontWeight = 'bold';
  title.style.fontSize = '1em';
  title.style.color = notification.read ? '#fff' : '#3498fd';
  title.textContent = String(notification.title || '[No Title]');

  const message = document.createElement('div');
  message.style.fontSize = '0.95em';
  message.style.lineHeight = '1.5';
  message.style.whiteSpace = 'pre-wrap';
  message.textContent = String(notification.message || '');

  const timestamp = document.createElement('div');
  timestamp.style.fontSize = '0.85em';
  timestamp.style.color = '#aaa';
  timestamp.style.marginTop = '3px';
  const date = notification.created_at ? new Date(notification.created_at) : null;
  timestamp.textContent = date && Number.isFinite(date.getTime()) ? date.toLocaleString() : '';

  for (const node of [title, message, timestamp]) node.style.overflowWrap = 'anywhere';
  parent.append(title, message, timestamp);
}
