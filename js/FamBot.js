import { supabase } from './supabaseClient.js';

const FAMBOT_ENDPOINT = 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/FamBot';
const FAMBOT_UNAVAILABLE_MESSAGE = 'We could not check this content right now. Please try again.';
const FAMBOT_TIMEOUT_MS = 25000;
const FAMBOT_MAX_CONTENT = 12000;
const FAMBOT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAMBOT_TYPES = new Set(['content', 'comment', 'offer', 'review', 'profile', 'report', 'testimonial', 'review_reply', 'social_handle', 'affiliate_pitch']);

export async function famBotModerateWithModal({ user_id, content, jwt, type = 'content', request_id } = {}) {
  const unavailable = () => ({ allowed: false, flagged: false, unavailable: true, message: FAMBOT_UNAVAILABLE_MESSAGE });
  let result;
  let timer;
  const controller = new AbortController();
  try {
    if (typeof content !== 'string' || !FAMBOT_TYPES.has(type)) throw new Error('Invalid moderation input');
    const normalizedContent = content.normalize('NFC').trim();
    if (!normalizedContent || Array.from(normalizedContent).length > FAMBOT_MAX_CONTENT) throw new Error('Invalid moderation input');
    const requestId = request_id || crypto.randomUUID();
    if (!FAMBOT_UUID.test(requestId)) throw new Error('Invalid request reference');
    const operation = async () => {
      let actor = user_id;
      let token = jwt;
      if (!token || !actor) {
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;
        if (error || !session?.access_token || !session.user?.id || (actor && actor !== session.user.id)) throw new Error('Sign in required');
        actor = session.user.id;
        token = session.access_token;
      }
      if (!FAMBOT_UUID.test(actor) || typeof token !== 'string' || !token.trim() || token.length > 16384) throw new Error('Invalid moderation actor');
      const body = JSON.stringify({ user_id: actor, content: normalizedContent, request_id: requestId, type });
      if (new TextEncoder().encode(body).byteLength > 65536) throw new Error('Moderation request is too large');
      if (controller.signal.aborted) throw new Error('Moderation timed out');
      const res = await fetch(FAMBOT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabase.supabaseKey, Authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || !data || typeof data !== 'object' || Array.isArray(data) ||
          typeof data.flagged !== 'boolean' || typeof data.banned !== 'boolean' || typeof data.allowed !== 'boolean' ||
          !Number.isSafeInteger(data.strikes) || data.strikes < 0 || !FAMBOT_UUID.test(data.check_id || '') ||
          data.policy_version !== 'fambot-three-distinct-v1' ||
          typeof data.replayed !== 'boolean' || !Array.isArray(data.flaggedCategories) || data.flaggedCategories.some(category => typeof category !== 'string')) throw new Error('Invalid moderation decision');
      const allowed = !data.flagged && !data.banned && data.allowed === true && data.unavailable !== true && data.ok !== false;
      // Response fields never override the local deny rule.
      if (!allowed && (!data.flagged || data.unavailable === true || data.ok === false)) return unavailable();
      return { ...data, allowed };
    };
    result = await Promise.race([
      operation(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Moderation timed out')); }, FAMBOT_TIMEOUT_MS); }),
    ]);
  } catch { result = unavailable(); }
  finally { clearTimeout(timer); }
  if (!result.allowed) famBotShowModal(result, type);
  return result;
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
    review_reply: "Review reply",
    testimonial: "Testimonial",
    social_handle: "Social handle",
    affiliate_pitch: "Affiliate pitch",
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
  const message = result.unavailable
    ? FAMBOT_UNAVAILABLE_MESSAGE
    : `${typeLabel} was flagged and was not submitted. This notice reports a content decision only; account status is not shown here. Edit it and try again.`;

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
        <h2 style="margin-bottom:12px;color:#C41A1A;">${typeLabel} ${result.unavailable ? 'Could Not Be Checked' : 'Flagged'}</h2>
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
