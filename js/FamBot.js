const FAMBOT_ENDPOINT = 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/FamBot';
const FAMBOT_UNAVAILABLE_MESSAGE = 'We could not check this content right now. Please try again.';

export async function famBotModerateWithModal({ user_id, content, jwt, type = 'content' }) {
  let res;
  let data;
  try {
    res = await fetch(FAMBOT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({ user_id, content })
    });
    data = await res.json();
  } catch {
    const unavailable = {
      allowed: false,
      flagged: false,
      unavailable: true,
      message: FAMBOT_UNAVAILABLE_MESSAGE
    };
    famBotShowModal(unavailable, type);
    return unavailable;
  }

  // A missing/invalid decision or a non-success status is not an approval.
  if (!res.ok || !data || typeof data !== 'object' || typeof data.flagged !== 'boolean') {
    const unavailable = {
      allowed: false,
      flagged: false,
      unavailable: true,
      message: FAMBOT_UNAVAILABLE_MESSAGE
    };
    famBotShowModal(unavailable, type);
    return unavailable;
  }

  // Show modal/dialog if flagged
  if (data.flagged) {
    famBotShowModal(data, type);
    return { allowed: false, ...data };
  }
  return { allowed: true, ...data };
}

// --- Modal/UX Logic ---
function famBotShowModal(result, type) {
  // Remove any existing modal
  const existing = document.getElementById('fambot-modal');
  if (existing) existing.remove();

  // Type-specific messages (easy to expand)
  const typeNames = {
    comment: "Comment",
    offer: "Offer",
    review: "Review",
    profile: "Profile",
    report: "Report",
    content: "Content",
  };
  const typeLabel = typeNames[type] || "Content";

  // Flagged categories (if any)
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const categories = (Array.isArray(result.flaggedCategories) ? result.flaggedCategories : [])
    .filter(cat => typeof cat === 'string')
    .map(cat => escapeText(cat.charAt(0).toUpperCase() + cat.slice(1)))
    .join(', ');
  const message = typeof result.message === 'string' && result.message
    ? escapeText(result.message)
    : 'This content was blocked by moderation. Please try again with different wording.';
  const strikes = Number.isInteger(result.strikes) && result.strikes >= 0 && result.strikes <= 3
    ? result.strikes
    : 0;

  // Modal HTML
  const modal = document.createElement('div');
  modal.id = 'fambot-modal';
  modal.innerHTML = `
    <div style="
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      background:rgba(0,0,0,0.55);z-index:10000;display:flex;
      align-items:center;justify-content:center;">
      <div style="
        background:white;padding:2.5rem 2rem 1.5rem 2rem;max-width:430px;
        border-radius:18px;box-shadow:0 6px 32px 4px rgba(0,0,0,.12);text-align:center;">
        <h2 style="margin-bottom:12px;color:#C41A1A;">${typeLabel} ${result.unavailable ? 'Could Not Be Checked' : 'Blocked'}</h2>
        <p style="color:#222;font-size:1.04em;margin-bottom:1em;">
          ${message}
        </p>
        ${
          categories
            ? `<div style="color:#b44; margin-bottom:.7em;">
                <b>Flagged Category:</b> ${categories}
                <div style="font-size:0.97em;color:#333;margin-top:3px;">
                  Please edit your text to remove potentially inappropriate language.
                </div>
               </div>`
            : ''
        }
        ${!result.unavailable && result.banned === true ?
          `<div style="color:#C41A1A;font-weight:700;margin-bottom:.7em;">Your account is now banned from submitting content.</div>`
          : !result.unavailable && strikes >= 1 ?
          `<div style="color:#bf8800;font-weight:700;margin-bottom:.7em;">
            You have received a strike (${strikes}/3). Further violations will result in a ban.
          </div>` : ''
        }
        <button id="fambot-close" style="
          margin-top:8px;background:#0c7a1a;color:#fff;padding:7px 28px;
          border:none;border-radius:9px;font-weight:600;cursor:pointer;">
          Close
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Modal close
  document.getElementById('fambot-close').onclick = () => modal.remove();
}
