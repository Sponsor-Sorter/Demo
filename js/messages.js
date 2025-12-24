// File: ./js/messages.js

import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';

const BTN_ID = 'messags-btn';

// Set false if you never want chats to restore after refresh
const PERSIST_CHATS = true;
const LS_KEY = 'ss_open_chats_v2';

// Profile image bucket (per your note)
const PROFILE_BUCKET = 'logos';

const CHAT_W = 340;
const CHAT_H = 520;
const CHAT_GAP = 12;
const CHAT_RIGHT_PAD = 16;
const CHAT_BOTTOM_PAD = 16;

// Fallback polling so messages update even if realtime is flaky
const POLL_OPEN_CHATS_MS = 2500;

const UI = {
  dropdown: 'ss-msg-dd',
  dropdownList: 'ss-msg-dd-list',
  badge: 'ss-msg-badge',
};

const offerById = new Map();          // offer_id -> offer row
const peerByOfferId = new Map();      // offer_id -> { peerName, peerEmail, peerPic, offerTitle, offerAmount, myRole }
const peerProfileByEmail = new Map(); // lower(email) -> { email, username, profile_pic, profile_pic_url }

const profilePicUrlCache = new Map(); // raw string -> resolved url/null

const unreadByOffer = new Map(); // offer_id -> unread count (session-based)
const openChats = new Map();     // offer_id -> { minimized, infoOpen, lastOpenedAt, renderedIds:Set, unread, lastMsgAt }

let activeUser = null;
let rtSponsorCh = null;
let rtSponseeCh = null;
let pollTimer = null;

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeLower(s) {
  return String(s || '').trim().toLowerCase();
}

function fmtDate(isoOrDate) {
  if (!isoOrDate) return '';
  try {
    return new Date(isoOrDate).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(isoOrDate);
  }
}

function fmtDateOnly(v) {
  if (!v) return '';
  const s = String(v).trim();

  // Avoid timezone “day shift” for date-only strings
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    try {
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return s;
    }
  }

  try {
    const dt = new Date(s);
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (Number.isNaN(num)) return '';
  const hasCents = Math.abs(num % 1) > 0.000001;
  const fmt = num.toLocaleString(undefined, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
  return `$${fmt}`;
}

function myEmail() {
  return safeLower(activeUser?.email || '');
}

function myUsername() {
  return String(activeUser?.username || '').trim();
}

function myAuthId() {
  return activeUser?.user_id || activeUser?.id || null;
}

function resolveProfilePicUrl(raw) {
  // Returns a browser-usable URL (public) or null.
  // Handles:
  // - Full URL
  // - bucket-prefixed keys: "logos/...."
  // - just key: "folder/file.png"
  // - full public object url containing "/storage/v1/object/public/logos/...."
  const key = String(raw || '').trim();
  if (!key) return null;

  if (profilePicUrlCache.has(key)) return profilePicUrlCache.get(key);

  // Already a URL (including data:)
  if (/^(https?:)?\/\//i.test(key) || /^data:/i.test(key)) {
    profilePicUrlCache.set(key, key);
    return key;
  }

  // Extract path inside the bucket
  let path = key.replace(/^\/+/, '').replace(/^public\//, '');

  // If they stored something like "logos/xyz.png"
  if (path.startsWith(`${PROFILE_BUCKET}/`)) {
    path = path.slice(PROFILE_BUCKET.length + 1);
  }

  // If they stored a full object path but without protocol, e.g. "storage/v1/object/public/logos/xyz.png"
  const marker1 = `storage/v1/object/public/${PROFILE_BUCKET}/`;
  const idx1 = path.indexOf(marker1);
  if (idx1 !== -1) {
    path = path.slice(idx1 + marker1.length);
  }

  // If they stored the exact public url tail ".../storage/v1/object/public/logos/xyz.png"
  const marker2 = `/storage/v1/object/public/${PROFILE_BUCKET}/`;
  const idx2 = path.indexOf(marker2);
  if (idx2 !== -1) {
    path = path.slice(idx2 + marker2.length);
  }

  // Now build public URL via supabase client
  try {
    const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    const url = data?.publicUrl || null;
    profilePicUrlCache.set(key, url);
    return url;
  } catch {
    profilePicUrlCache.set(key, null);
    return null;
  }
}

function addStylesOnce() {
  if (document.getElementById('ss-msg-styles')) return;

  const style = document.createElement('style');
  style.id = 'ss-msg-styles';
  style.textContent = `
    /* ===== Dropdown ===== */
    #${UI.dropdown}{
      position: fixed;
      width: 360px;
      max-width: calc(100vw - 20px);
      background: rgba(25,25,27,.98);
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 14px;
      box-shadow: 0 14px 44px rgba(0,0,0,.55);
      z-index: 9999;
      overflow: hidden;
      backdrop-filter: blur(10px);
      display:none;
    }
    #${UI.dropdown} .ss-dd-header{
      display:flex;
      align-items:center;
      justify-content: space-between;
      padding: 12px 12px;
      border-bottom: 1px solid rgba(255,255,255,.10);
      gap: 10px;
    }
    #${UI.dropdown} .ss-dd-header h4{
      margin:0;
      font-size: 1.02rem;
      font-weight: 900;
      letter-spacing: .01em;
      color: #fff;
    }
    #${UI.dropdown} .ss-dd-actions{
      display:flex;
      gap:8px;
      align-items:center;
    }
    #${UI.dropdown} .ss-dd-action{
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      color:#fff;
      border-radius: 10px;
      padding: 6px 9px;
      cursor:pointer;
      font-weight: 800;
      line-height: 1;
      box-shadow:none;
    }
    #${UI.dropdown} .ss-dd-action:hover{ background: rgba(255,255,255,.12); }

    #${UI.dropdownList}{
      max-height: 420px;
      overflow:auto;
      padding: 8px;
    }
    .ss-dd-empty{
      padding: 16px 10px;
      color: rgba(255,255,255,.75);
      font-style: italic;
    }

    .ss-thread{
      width: 100%;
      display:flex;
      align-items:flex-start;
      gap: 10px;
      padding: 10px 10px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: rgba(255,255,255,.04);
      cursor: pointer;
      color:#fff;
      text-align:left;
      position: relative;
      box-shadow: none;
    }
    .ss-thread:hover{
      background: rgba(255,255,255,.07);
      border-color: rgba(255,255,255,.10);
    }
    .ss-thread + .ss-thread{ margin-top: 8px; }

    /* Avatar (supports image w/ initials fallback) */
    .ss-ava{
      width: 38px;
      height: 38px;
      aspect-ratio: 1 / 1;
      border-radius: 999px;
      background: linear-gradient(135deg, #6F30F5 0%, #5B8FF8 55%, #3BD6FB 100%);
      display:flex;
      align-items:center;
      justify-content:center;
      flex: 0 0 38px;
      font-weight: 900;
      color: #0b0b0c;
      user-select:none;
      position: relative;
      overflow: hidden;
    }
    .ss-ava img{
      position:absolute;
      inset:0;
      width:100% !important;
      height:100% !important;
      max-width:none !important;
      max-height:none !important;
      display:block;
      object-fit: cover !important;
      object-position: center !important;
      border-radius: 999px;
    }
    .ss-ava img.ss-broken{ display:none !important; }
    .ss-ava .ss-ava-initial{ position: relative; z-index: 1; }

    .ss-thread-main{ flex:1 1 auto; min-width: 0; }
    .ss-thread-top{
      display:flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .ss-thread-name{
      font-weight: 900;
      font-size: .98rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ss-thread-time{
      font-size: .78rem;
      opacity: .75;
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .ss-thread-sub{
      margin-top: 2px;
      font-size: .86rem;
      opacity: .9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ss-thread-offer{
      margin-top: 4px;
      font-size: .78rem;
      opacity: .72;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ss-thread-unread-dot{
      position:absolute;
      top: 12px;
      right: 12px;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #ff3b3b;
      display:none;
      box-shadow: 0 0 0 2px rgba(25,25,27,.95);
    }
    .ss-thread[data-unread="1"] .ss-thread-unread-dot{ display:block; }

    /* Badge on icon */
    #${UI.badge}{
      position:absolute;
      top:-6px;
      right:-2px;
      background: #ff3b3b;
      color: #fff;
      border-radius: 999px;
      font-size: 12px;
      padding: 1px 6px;
      display:none;
      min-width: 18px;
      text-align:center;
      font-weight: 900;
      line-height: 1.4;
    }

    /* ===== Chat windows ===== */
    .ss-chat{
      width: ${CHAT_W}px;
      height: ${CHAT_H}px;
      max-height: calc(100vh - 100px);
      background: rgba(25,25,27,.98);
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 16px;
      box-shadow: 0 14px 44px rgba(0,0,0,.55);
      overflow: hidden;
      display:flex;
      flex-direction: column;
      backdrop-filter: blur(10px);
      position: fixed;
      bottom: ${CHAT_BOTTOM_PAD}px;
      pointer-events: auto;
      z-index: 9999;
    }
    .ss-chat.minimized{ height: 68px; }
    .ss-chat.info-open .ss-chat-info{ display:block; }

    .ss-chat-header{
      display:flex;
      align-items:center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,.10);
      gap: 10px;
      cursor: pointer;
      user-select:none;
    }

    .ss-chat-title{ min-width: 0; flex: 1 1 auto; }

    /* Header peer line with avatar + username */
    .ss-chat-peer{
      color:#fff;
      font-weight: 900;
      font-size: 1.02rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display:flex;
      align-items:center;
      gap: 8px;
    }
    .ss-chat-ava{
      width: 34px;
      height: 34px;
      aspect-ratio: 1 / 1;
      border-radius: 999px;
      background: linear-gradient(135deg, #6F30F5 0%, #5B8FF8 55%, #3BD6FB 100%);
      display:flex;
      align-items:center;
      justify-content:center;
      flex: 0 0 34px;
      font-weight: 900;
      color: #0b0b0c;
      position: relative;
      overflow:hidden;
    }
    .ss-chat-ava img{
      position:absolute;
      inset:0;
      width:100% !important;
      height:100% !important;
      max-width:none !important;
      max-height:none !important;
      display:block;
      object-fit: cover !important;
      object-position: center !important;
      border-radius: 999px;
    }
    .ss-chat-ava img.ss-broken{ display:none !important; }
    .ss-chat-ava .ss-ava-initial{ position: relative; z-index: 1; }

    .ss-chat-peer .ss-chat-unread{
      display:none;
      background:#ff3b3b;
      color:#fff;
      border-radius: 999px;
      font-size: 12px;
      padding: 1px 7px;
      font-weight: 900;
      line-height: 1.4;
    }
    .ss-chat[data-unread="1"] .ss-chat-peer .ss-chat-unread{ display:inline-block; }

    .ss-chat-sub{
      color: rgba(255,255,255,.75);
      font-size: .8rem;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ss-chat-actions{
      display:flex;
      gap: 8px;
      align-items:center;
      flex: 0 0 auto;
    }
    .ss-chat-btn{
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      color:#fff;
      border-radius: 10px;
      padding: 6px 9px;
      cursor:pointer;
      font-weight: 900;
      line-height: 1;
      box-shadow:none;
    }
    .ss-chat-btn:hover{ background: rgba(255,255,255,.12); }
    .ss-chat-btn.ss-info{ padding: 6px 8px; min-width: 34px; text-align:center; }

    .ss-chat-body{
      flex: 1 1 auto;
      display:flex;
      flex-direction: column;
      min-height: 0;
    }
    .ss-chat.minimized .ss-chat-body{ display:none; }

    /* Offer info dropdown inside chat */
    .ss-chat-info{
      display:none;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.03);
      color: rgba(255,255,255,.92);
      font-size: .86rem;
    }
    .ss-chat-info .ss-info-title{
      margin: 0 0 6px;
      font-size: .92rem;
      font-weight: 900;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content: space-between;
      gap: 10px;
    }
    .ss-chat-info .ss-info-pills{
      display:flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .ss-chat-info .ss-info-pill{
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.10);
      color: rgba(255,255,255,.9);
      padding: 4px 8px;
      border-radius: 999px;
      font-size: .76rem;
      font-weight: 900;
      line-height: 1.1;
      white-space: nowrap;
    }
    .ss-chat-info .ss-info-desc{
      white-space: pre-wrap;
      background: rgba(0,0,0,.10);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 12px;
      padding: 8px 10px;
      max-height: 140px;
      overflow:auto;
    }
    .ss-chat-info .ss-info-grid{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 10px;
    }
    .ss-chat-info .ss-info-item{
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 12px;
      padding: 8px 10px;
      min-width: 0;
    }
    .ss-chat-info .ss-info-label{
      font-size: .72rem;
      opacity: .75;
      font-weight: 900;
      letter-spacing: .02em;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .ss-chat-info .ss-info-value{
      font-size: .86rem;
      color: rgba(255,255,255,.92);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ss-chat-info .ss-info-value a{
      color: rgba(59,214,251,.95);
      text-decoration: none;
      font-weight: 900;
    }
    .ss-chat-info .ss-info-value a:hover{ text-decoration: underline; }

    .ss-chat-messages{
      flex: 1 1 auto;
      overflow:auto;
      padding: 12px;
      display:flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Message row with optional left avatar (them) */
    .ss-msg-row{
      display:flex;
      gap: 0px;
      align-items:flex-end;
    }
    .ss-msg-row.me{ justify-content:flex-end; }
    .ss-msg-row.them{ justify-content:flex-start; }

    .ss-msg-ava-mini{
      width: 26px;
      height: 26px;
      aspect-ratio: 1 / 1;
      border-radius: 999px;
      background: linear-gradient(135deg, #6F30F5 0%, #5B8FF8 55%, #3BD6FB 100%);
      flex: 0 0 26px;
      position: relative;
      overflow:hidden;
    }
    .ss-msg-ava-mini img{
      position:absolute;
      inset:0;
      width:100% !important;
      height:100% !important;
      max-width:none !important;
      max-height:none !important;
      display:block;
      object-fit: cover !important;
      object-position: center !important;
      border-radius: 999px;
    }
    .ss-msg-ava-mini img.ss-broken{ display:none !important; }
    .ss-msg-ava-mini .ss-ava-initial{
      position:absolute;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight: 900;
      color: #0b0b0c;
      font-size: 12px;
    }

    .ss-bubble{
      max-width: 78%;
      padding: 10px 11px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.06);
      color: #fff;
      font-size: .92rem;
      line-height: 1.25;
      word-break: break-word;
    }
    .ss-bubble.me{
      background: rgba(59,214,251,.14);
      border-color: rgba(59,214,251,.22);
    }
    .ss-bubble .ss-bubble-meta{
      margin-top: 6px;
      font-size: .74rem;
      opacity: .7;
      display:flex;
      gap: 6px;
      align-items:center;
      justify-content: flex-end;
    }

    .ss-chat-form{
      padding: 10px;
      border-top: 1px solid rgba(255,255,255,.10);
      display:flex;
      gap: 10px;
      align-items:flex-end;
      background: rgba(0,0,0,.08);
    }
    .ss-chat-input{
      flex: 1 1 auto;
      min-height: 38px;
      max-height: 110px;
      resize: none;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.06);
      color: #fff;
      padding: 10px 10px;
      outline: none;
      font-size: .92rem;
      line-height: 1.2;
    }
    .ss-chat-send{
      flex: 0 0 auto;
      background: linear-gradient(135deg, #6F30F5 0%, #5B8FF8 55%, #3BD6FB 100%);
      border: none;
      color: #0b0b0c;
      font-weight: 900;
      border-radius: 12px;
      padding: 10px 12px;
      cursor:pointer;
    }
    .ss-chat-send:disabled{ opacity: .5; cursor: not-allowed; }

    @media (max-width: 520px){
      .ss-chat{
        width: calc(100vw - 20px);
        right: 10px !important;
        left: 10px !important;
      }
      #${UI.dropdown}{
        right: 10px !important;
        left: 10px !important;
      }
      .ss-chat-info .ss-info-grid{ grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function ensureUI() {
  addStylesOnce();

  const btn = document.getElementById(BTN_ID);
  if (btn && !$(UI.badge)) {
    btn.style.position = btn.style.position || 'relative';
    const badge = document.createElement('span');
    badge.id = UI.badge;
    badge.textContent = '0';
    btn.appendChild(badge);
  }

  if (!$(UI.dropdown)) {
    const dd = document.createElement('div');
    dd.id = UI.dropdown;
    dd.style.display = 'none';
    dd.innerHTML = `
      <div class="ss-dd-header">
        <h4>Messages</h4>
        <div class="ss-dd-actions">
          <button class="ss-dd-action" type="button" id="ss-dd-refresh" title="Refresh">⟳</button>
        </div>
      </div>
      <div id="${UI.dropdownList}">
        <div class="ss-dd-empty">Loading…</div>
      </div>
    `;
    document.body.appendChild(dd);

    dd.addEventListener('click', (e) => e.stopPropagation());
    dd.querySelector('#ss-dd-refresh')?.addEventListener('click', async () => refreshThreads());
  }
}

function positionDropdown() {
  const dd = $(UI.dropdown);
  const btn = document.getElementById(BTN_ID);
  if (!dd || !btn) return;

  const wasHidden = dd.style.display === 'none';
  if (wasHidden) dd.style.display = 'block';
  dd.style.visibility = 'hidden';

  const rect = btn.getBoundingClientRect();
  const ddW = dd.offsetWidth || 360;
  const top = Math.min(window.innerHeight - 120, rect.bottom + 10);
  const left = Math.min(
    window.innerWidth - 10 - ddW,
    Math.max(10, rect.right - ddW)
  );

  dd.style.top = `${top}px`;
  dd.style.left = `${left}px`;
  dd.style.right = 'auto';
  dd.style.bottom = 'auto';

  dd.style.visibility = 'visible';
  if (wasHidden) dd.style.display = 'none';
}

function dropdownOpen() {
  const dd = $(UI.dropdown);
  return dd && dd.style.display !== 'none';
}

function setDropdownOpen(open) {
  const dd = $(UI.dropdown);
  if (!dd) return;
  if (open) {
    positionDropdown();
    dd.style.display = 'block';
  } else {
    dd.style.display = 'none';
  }
}

function badgeCountOffers() {
  let n = 0;
  for (const v of unreadByOffer.values()) {
    if ((v || 0) > 0) n++;
  }
  return n;
}

function updateBadge() {
  const badge = $(UI.badge);
  if (!badge) return;

  const n = badgeCountOffers();
  if (n <= 0) badge.style.display = 'none';
  else {
    badge.textContent = String(Math.min(n, 99));
    badge.style.display = 'inline-block';
  }
}

async function loadMyOffers() {
  const email = myEmail();
  const uname = myUsername();
  if (!email && !uname) return [];

  const orParts = [];
  if (email) {
    orParts.push(`sponsee_email.eq.${email}`);
    orParts.push(`sponsor_email.eq.${email}`);
  }
  if (uname) {
    orParts.push(`sponsee_username.eq.${uname}`);
    orParts.push(`sponsor_username.eq.${uname}`);
  }

  // Columns verified against schema (private_offers)
  const { data, error } = await supabase
    .from('private_offers')
    .select([
      'id',
      'offer_title',
      'offer_description',
      'offer_amount',
      'deadline',
      'creation_date',
      'created_at',
      'stage',
      'status',
      'deliverable_type',
      'instructions',
      'payment_schedule',
      'sponsorship_duration',
      'job_type',
      'platforms',
      'live_date',
      'live_url',
      'sponsor_email',
      'sponsor_company',
      'sponsor_username',
      'sponsee_email',
      'sponsee_username',
      'sponsor_id',
    ].join(','))
    .or(orParts.join(','))
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[messages.js] loadMyOffers error:', error);
    return [];
  }

  offerById.clear();
  peerByOfferId.clear();
  (data || []).forEach(o => offerById.set(o.id, o));

  await loadPeerProfiles(data || []);

  for (const o of (data || [])) {
    peerByOfferId.set(o.id, getPeerForOffer(o));
  }

  return data || [];
}

function getPeerForOffer(offer) {
  const email = myEmail();
  const uname = myUsername();

  const isSponsor =
    (email && offer?.sponsor_email && safeLower(offer.sponsor_email) === email) ||
    (uname && offer?.sponsor_username && offer.sponsor_username === uname);

  const offerTitle = offer?.offer_title || 'Offer';
  const offerAmount = offer?.offer_amount ?? null;

  if (isSponsor) {
    const peerEmail = offer?.sponsee_email || null;
    const profile = peerEmail ? peerProfileByEmail.get(safeLower(peerEmail)) : null;

    return {
      myRole: 'sponsor',
      peerEmail,
      peerName: profile?.username || offer?.sponsee_username || peerEmail || 'Sponsee',
      peerPic: profile?.profile_pic_url || resolveProfilePicUrl(profile?.profile_pic) || null,
      offerTitle,
      offerAmount,
    };
  }

  const peerEmail = offer?.sponsor_email || null;
  const profile = peerEmail ? peerProfileByEmail.get(safeLower(peerEmail)) : null;

  return {
    myRole: 'sponsee',
    peerEmail,
    peerName: profile?.username || offer?.sponsor_username || offer?.sponsor_company || peerEmail || 'Sponsor',
    peerPic: profile?.profile_pic_url || resolveProfilePicUrl(profile?.profile_pic) || null,
    offerTitle,
    offerAmount,
  };
}

async function loadPeerProfiles(offers) {
  const email = myEmail();
  const uname = myUsername();
  if (!email && !uname) return;

  const wanted = new Set();

  for (const o of (offers || [])) {
    const isSponsor =
      (email && o?.sponsor_email && safeLower(o.sponsor_email) === email) ||
      (uname && o?.sponsor_username && o.sponsor_username === uname);

    const peerEmail = isSponsor ? (o?.sponsee_email || '') : (o?.sponsor_email || '');
    const k = safeLower(peerEmail);
    if (k && !peerProfileByEmail.has(k)) wanted.add(peerEmail);
  }

  const emails = Array.from(wanted).filter(Boolean);
  if (!emails.length) return;

  const { data, error } = await supabase
    .from('users_extended_data')
    .select('email, username, profile_pic')
    .in('email', emails);

  if (error) {
    console.warn('[messages.js] loadPeerProfiles blocked or failed:', error?.message || error);
    return;
  }

  for (const row of (data || [])) {
    const k = safeLower(row.email);
    if (!k) continue;
    peerProfileByEmail.set(k, {
      ...row,
      profile_pic_url: resolveProfilePicUrl(row.profile_pic),
    });
  }
}

async function loadLatestCommentsForMe(limit = 300) {
  const email = myEmail();
  if (!email) return [];

  const { data, error } = await supabase
    .from('private_offer_comments')
    .select('id, offer_id, comment_text, created_at, sender, user_id, sponsor_email, sponsee_email')
    .or(`sponsor_email.eq.${email},sponsee_email.eq.${email}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[messages.js] loadLatestCommentsForMe error:', error);
    return [];
  }
  return data || [];
}

function avatarHTML({ picUrl, initial, sizeClass = 'ss-ava' }) {
  const safePic = picUrl ? escapeHtml(picUrl) : '';
  const safeInitial = escapeHtml((initial || '?').toUpperCase());
  const imgStyle = 'width:100%;height:100%;display:block;object-fit:cover;object-position:center;';
  return `
    <div class="${sizeClass}">
      ${safePic ? `<img src="${safePic}" style="${imgStyle}" alt="" referrerpolicy="no-referrer" onerror="this.classList.add('ss-broken');">` : ''}
      <span class="ss-ava-initial">${safeInitial}</span>
    </div>
  `;
}

function renderThreads(threads) {
  const list = $(UI.dropdownList);
  if (!list) return;
  list.innerHTML = '';

  if (!threads.length) {
    const empty = document.createElement('div');
    empty.className = 'ss-dd-empty';
    empty.textContent = 'No messages yet. Start a conversation from an offer.';
    list.appendChild(empty);
    return;
  }

  for (const t of threads) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ss-thread';
    b.dataset.offerId = t.offer_id;

    const initial = (t.peerName || '?').trim().charAt(0).toUpperCase();
    const lastText = t.lastCommentText ? t.lastCommentText : 'Start conversation…';

    const money = t.offerAmount !== null && t.offerAmount !== undefined ? fmtMoney(t.offerAmount) : '';
    const offerLine = t.offerTitle ? `Offer: ${t.offerTitle}${money ? ` • ${money}` : ''}` : '';

    const unread = (unreadByOffer.get(t.offer_id) || 0) > 0 ? 1 : 0;
    b.dataset.unread = String(unread);

    b.innerHTML = `
      <div class="ss-thread-unread-dot"></div>
      ${avatarHTML({ picUrl: t.peerPic, initial, sizeClass: 'ss-ava' })}
      <div class="ss-thread-main">
        <div class="ss-thread-top">
          <div class="ss-thread-name">${escapeHtml(t.peerName)}</div>
          <div class="ss-thread-time">${escapeHtml(t.lastCommentAt ? fmtDate(t.lastCommentAt) : '')}</div>
        </div>
        <div class="ss-thread-sub">${escapeHtml(lastText)}</div>
        <div class="ss-thread-offer">${escapeHtml(offerLine)}</div>
      </div>
    `;

    b.addEventListener('click', async () => {
      setDropdownOpen(false);
      await openChat(t.offer_id, { focus: true });
    });

    list.appendChild(b);
  }
}

async function refreshThreads() {
  ensureUI();

  const offers = await loadMyOffers();
  const comments = await loadLatestCommentsForMe();

  const latestByOffer = new Map();
  for (const c of comments) {
    if (!c.offer_id) continue;
    if (!latestByOffer.has(c.offer_id)) latestByOffer.set(c.offer_id, c);
  }

  for (const o of offers) {
    if (!unreadByOffer.has(o.id)) unreadByOffer.set(o.id, 0);
  }

  const threads = offers.map(o => {
    const peer = peerByOfferId.get(o.id) || getPeerForOffer(o);
    const last = latestByOffer.get(o.id);
    return {
      offer_id: o.id,
      peerName: peer.peerName,
      peerEmail: peer.peerEmail,
      peerPic: peer.peerPic,
      offerTitle: peer.offerTitle,
      offerAmount: peer.offerAmount,
      lastCommentAt: last?.created_at || null,
      lastCommentText: last?.comment_text || null,
      sortTime: last?.created_at || o.created_at || null,
    };
  });

  threads.sort((a, b) => {
    const ta = a.sortTime ? new Date(a.sortTime).getTime() : 0;
    const tb = b.sortTime ? new Date(b.sortTime).getTime() : 0;
    return tb - ta;
  });

  renderThreads(threads);
  updateBadge();
}

function persistOpenChats() {
  if (!PERSIST_CHATS) return;
  try {
    const payload = [];
    for (const [offerId, st] of openChats.entries()) {
      payload.push({
        offerId,
        minimized: !!st.minimized,
        infoOpen: !!st.infoOpen,
        lastOpenedAt: st.lastOpenedAt || Date.now(),
      });
    }
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {}
}

function restoreOpenChats() {
  if (!PERSIST_CHATS) return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(x => x && typeof x.offerId === 'string')
      .map(x => ({
        offerId: x.offerId,
        minimized: !!x.minimized,
        infoOpen: !!x.infoOpen,
        lastOpenedAt: Number(x.lastOpenedAt || Date.now()),
      }));
  } catch {
    return [];
  }
}

function computeMaxVisibleChats() {
  const w = window.innerWidth || 1200;
  const usable = Math.max(0, w - (CHAT_RIGHT_PAD + 16));
  const per = CHAT_W + CHAT_GAP;
  const n = Math.max(1, Math.floor((usable + CHAT_GAP) / per));
  return Math.min(n, 4);
}

function layoutChats() {
  const maxVisible = computeMaxVisibleChats();

  const entries = Array.from(openChats.entries())
    .sort((a, b) => (b[1].lastOpenedAt || 0) - (a[1].lastOpenedAt || 0));

  entries.forEach(([offerId], idx) => {
    const chatEl = document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`);
    if (!chatEl) return;

    if (idx >= maxVisible) {
      chatEl.style.display = 'none';
      return;
    }
    chatEl.style.display = 'flex';
    chatEl.style.right = `${CHAT_RIGHT_PAD + idx * (CHAT_W + CHAT_GAP)}px`;
  });
}

function scrollChatToBottom(offerId) {
  const box = document.getElementById(`ss-chat-msgs-${offerId}`);
  if (!box) return;
  box.scrollTop = box.scrollHeight + 9999;
}

function setChatUnreadUI(offerId, n) {
  const el = document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`);
  if (!el) return;
  const pill = el.querySelector('.ss-chat-unread');
  if (pill) pill.textContent = String(Math.min(n, 99));
  el.dataset.unread = n > 0 ? '1' : '0';
}

function markOfferRead(offerId) {
  unreadByOffer.set(offerId, 0);
  const st = openChats.get(offerId);
  if (st) st.unread = 0;
  setChatUnreadUI(offerId, 0);
  updateBadge();
}

function setOfferInfoOpen(offerId, open) {
  const el = document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`);
  const st = openChats.get(offerId);
  if (!el || !st) return;

  st.infoOpen = !!open;
  if (open) el.classList.add('info-open');
  else el.classList.remove('info-open');

  const btn = el.querySelector('.ss-info');
  if (btn) btn.textContent = open ? '▴' : '▾';

  persistOpenChats();
}

function toggleOfferInfo(offerId) {
  const st = openChats.get(offerId);
  setOfferInfoOpen(offerId, !st?.infoOpen);
}

function renderOfferInfo(offerId) {
  const el = document.getElementById(`ss-chat-info-${offerId}`);
  if (!el) return;

  const offer = offerById.get(offerId);
  const peer = peerByOfferId.get(offerId) || (offer ? getPeerForOffer(offer) : null);

  const offerTitle = peer?.offerTitle || offer?.offer_title || 'Offer';
  const offerAmount = peer?.offerAmount ?? offer?.offer_amount ?? null;

  const desc =
    (offer?.offer_description && String(offer.offer_description).trim()) ||
    (offer?.instructions && String(offer.instructions).trim()) ||
    '';

  const createdLabel = offer?.creation_date ? fmtDateOnly(offer.creation_date) : (offer?.created_at ? fmtDate(offer.created_at) : '');
  const deadlineLabel = offer?.deadline ? fmtDateOnly(offer.deadline) : '';
  const liveLabel = offer?.live_date ? fmtDateOnly(offer.live_date) : '';

  const stage = (offer?.stage === 0 || offer?.stage) ? String(offer.stage) : '';
  const status = offer?.status ? String(offer.status) : '';
  const deliverable = offer?.deliverable_type ? String(offer.deliverable_type) : '';
  const duration = offer?.sponsorship_duration ? String(offer.sponsorship_duration) : '';
  const schedule = offer?.payment_schedule ? String(offer.payment_schedule) : '';
  const jobType = offer?.job_type ? String(offer.job_type) : '';
  const platforms = Array.isArray(offer?.platforms) ? offer.platforms.filter(Boolean).join(', ') : (offer?.platforms ? String(offer.platforms) : '');
  const liveUrl = offer?.live_url ? String(offer.live_url) : '';

  const money = offerAmount !== null && offerAmount !== undefined ? fmtMoney(offerAmount) : '';

  const pills = [];
  if (status) pills.push(`<span class="ss-info-pill">Status: ${escapeHtml(status)}</span>`);
  if (stage) pills.push(`<span class="ss-info-pill">Stage: ${escapeHtml(stage)}</span>`);
  if (deliverable) pills.push(`<span class="ss-info-pill">${escapeHtml(deliverable)}</span>`);
  if (platforms) pills.push(`<span class="ss-info-pill">${escapeHtml(platforms)}</span>`);

  const gridItem = (label, valueHtml) => `
    <div class="ss-info-item">
      <div class="ss-info-label">${escapeHtml(label)}</div>
      <div class="ss-info-value">${valueHtml}</div>
    </div>
  `;

  const safeUrl = (u) => {
    const s = String(u || '').trim();
    if (!s) return '';
    try {
      const url = new URL(s, window.location.origin);
      const shown = escapeHtml(s);
      return `<a href="${escapeHtml(url.toString())}" target="_blank" rel="noopener noreferrer">${shown}</a>`;
    } catch {
      return escapeHtml(s);
    }
  };

  el.innerHTML = `
    <div class="ss-info-title">
      <span>${escapeHtml(offerTitle)}${money ? ` • ${escapeHtml(money)}` : ''}</span>
      <span style="opacity:.7;font-weight:900;">Offer info</span>
    </div>

    <div class="ss-info-desc">${desc ? escapeHtml(desc) : 'No description provided.'}</div>

    <div class="ss-info-grid">
      ${gridItem('Created', escapeHtml(createdLabel || '—'))}
      ${gridItem('Deadline', escapeHtml(deadlineLabel || '—'))}
      ${gridItem('Live date', escapeHtml(liveLabel || '—'))}
      ${gridItem('Payment schedule', escapeHtml(schedule || '—'))}
      ${gridItem('Duration', escapeHtml(duration || '—'))}
      ${gridItem('Job type', escapeHtml(jobType || '—'))}
      ${gridItem('Live URL', liveUrl ? safeUrl(liveUrl) : '—')}
      ${gridItem('With', escapeHtml(peer?.peerName || '—'))}
    </div>

    ${pills.length ? `<div class="ss-info-pills">${pills.join('')}</div>` : ''}
  `;
}

function toggleMinimizeChat(offerId) {
  const el = document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`);
  if (!el) return;

  const st = openChats.get(offerId);
  const minimizing = !el.classList.contains('minimized');

  if (minimizing) el.classList.add('minimized');
  else el.classList.remove('minimized');

  if (st) st.minimized = minimizing;

  if (!minimizing) {
    markOfferRead(offerId);
    scrollChatToBottom(offerId);
    document.getElementById(`ss-chat-input-${offerId}`)?.focus();
  }

  persistOpenChats();
  layoutChats();
}

function closeChat(offerId) {
  document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`)?.remove();
  openChats.delete(offerId);
  persistOpenChats();
  layoutChats();
}

async function fetchOfferMessages(offerId, limit = 400) {
  const { data, error } = await supabase
    .from('private_offer_comments')
    .select('id, offer_id, comment_text, created_at, sender, user_id, sponsor_email, sponsee_email')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[messages.js] fetchOfferMessages error:', error);
    return [];
  }
  return data || [];
}

async function fetchOfferMessagesSince(offerId, sinceIso, limit = 50) {
  let q = supabase
    .from('private_offer_comments')
    .select('id, offer_id, comment_text, created_at, sender, user_id, sponsor_email, sponsee_email')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (sinceIso) q = q.gt('created_at', sinceIso);

  const { data, error } = await q;
  if (error) {
    console.warn('[messages.js] fetchOfferMessagesSince error:', error);
    return [];
  }
  return data || [];
}

function buildMiniAvatar({ picUrl, initial }) {
  const safePic = picUrl ? escapeHtml(picUrl) : '';
  const safeInitial = escapeHtml((initial || '?').toUpperCase());
  const imgStyle = 'width:100%;height:100%;display:block;object-fit:cover;object-position:center;';
  return `
    <div class="ss-msg-ava-mini">
      ${safePic ? `<img src="${safePic}" style="${imgStyle}" alt="" referrerpolicy="no-referrer" onerror="this.classList.add('ss-broken');">` : ''}
      <div class="ss-ava-initial">${safeInitial}</div>
    </div>
  `;
}

function ensureRenderedSet(offerId) {
  const st = openChats.get(offerId);
  if (!st) return null;
  if (!st.renderedIds) st.renderedIds = new Set();
  return st.renderedIds;
}

function setLastMsgAt(offerId, iso) {
  const st = openChats.get(offerId);
  if (!st) return;
  if (!iso) return;

  const curr = st.lastMsgAt ? new Date(st.lastMsgAt).getTime() : 0;
  const nxt = new Date(iso).getTime();
  if (!Number.isFinite(nxt)) return;

  if (!curr || nxt > curr) st.lastMsgAt = iso;
}

function renderChatMessages(offerId, rows) {
  const box = document.getElementById(`ss-chat-msgs-${offerId}`);
  if (!box) return;

  box.innerHTML = '';

  const peer = peerByOfferId.get(offerId);
  const peerName = peer?.peerName || 'User';
  const peerPic = peer?.peerPic || null;
  const peerInitial = peerName.trim().charAt(0).toUpperCase();

  const st = openChats.get(offerId);
  if (st) st.renderedIds = new Set();

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'ss-dd-empty';
    empty.textContent = 'No messages yet — say hello 👋';
    box.appendChild(empty);
    return;
  }

  const myId = myAuthId();
  const myName = myUsername();

  for (const m of rows) {
    const id = String(m.id || '');
    if (st?.renderedIds && id) st.renderedIds.add(id);

    const isMe =
      (myId && m.user_id && m.user_id === myId) ||
      (myName && m.sender && m.sender === myName);

    const displayName = isMe ? 'You' : peerName;

    const row = document.createElement('div');
    row.className = `ss-msg-row ${isMe ? 'me' : 'them'}`;
    row.dataset.messageId = id || '';

    row.innerHTML = `
      ${isMe ? '' : buildMiniAvatar({ picUrl: peerPic, initial: peerInitial })}
      <div class="ss-bubble ${isMe ? 'me' : 'them'}">
        <div>${escapeHtml(m.comment_text || '')}</div>
        <div class="ss-bubble-meta">
          <span class="ss-meta-name">${escapeHtml(displayName)}</span>
          <span>·</span>
          <span class="ss-meta-time">${escapeHtml(fmtDate(m.created_at))}</span>
        </div>
      </div>
    `;

    box.appendChild(row);

    if (m.created_at) setLastMsgAt(offerId, m.created_at);
  }

  scrollChatToBottom(offerId);
}

function appendOneMessage(offerId, m, isMeOverride = null) {
  const box = document.getElementById(`ss-chat-msgs-${offerId}`);
  if (!box) return null;

  if (box.firstElementChild && box.firstElementChild.classList.contains('ss-dd-empty')) {
    box.innerHTML = '';
  }

  const myId = myAuthId();
  const myName = myUsername();

  const isMe =
    isMeOverride !== null ? isMeOverride :
    ((myId && m.user_id && m.user_id === myId) || (myName && m.sender && m.sender === myName));

  const peer = peerByOfferId.get(offerId);
  const peerName = peer?.peerName || 'User';
  const peerPic = peer?.peerPic || null;
  const peerInitial = peerName.trim().charAt(0).toUpperCase();

  const displayName = isMe ? 'You' : peerName;

  const row = document.createElement('div');
  row.className = `ss-msg-row ${isMe ? 'me' : 'them'}`;

  const msgId = String(m.id || '');
  if (msgId) row.dataset.messageId = msgId;

  row.innerHTML = `
    ${isMe ? '' : buildMiniAvatar({ picUrl: peerPic, initial: peerInitial })}
    <div class="ss-bubble ${isMe ? 'me' : 'them'}">
      <div>${escapeHtml(m.comment_text || '')}</div>
      <div class="ss-bubble-meta">
        <span class="ss-meta-name">${escapeHtml(displayName)}</span>
        <span>·</span>
        <span class="ss-meta-time">${escapeHtml(fmtDate(m.created_at))}</span>
      </div>
    </div>
  `;

  box.appendChild(row);

  const rendered = ensureRenderedSet(offerId);
  if (rendered && msgId) rendered.add(msgId);

  if (m.created_at) setLastMsgAt(offerId, m.created_at);

  scrollChatToBottom(offerId);
  return row;
}

function alreadyRendered(offerId, msgId) {
  const st = openChats.get(offerId);
  if (!st?.renderedIds) return false;
  return st.renderedIds.has(msgId);
}

function acceptIncomingMessage(offerId, row) {
  if (!row?.offer_id || row.offer_id !== offerId) return;

  const msgId = String(row.id || '');
  if (msgId && alreadyRendered(offerId, msgId)) return;

  const myId = myAuthId();
  const myName = myUsername();
  const isMine = (myId && row.user_id === myId) || (myName && row.sender === myName);

  // Only append if chat exists (open)
  const chatEl = document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`);
  const st = openChats.get(offerId);

  if (chatEl && st) {
    appendOneMessage(offerId, row, isMine);

    if (!isMine) {
      if (chatEl.classList.contains('minimized')) {
        const curr = (unreadByOffer.get(offerId) || 0) + 1;
        unreadByOffer.set(offerId, curr);
        st.unread = curr;
        setChatUnreadUI(offerId, curr);
        updateBadge();
      } else {
        markOfferRead(offerId);
      }
    }
  } else {
    // Not open: just bump unread if it isn't mine
    if (!isMine) {
      const curr = (unreadByOffer.get(offerId) || 0) + 1;
      unreadByOffer.set(offerId, curr);
      updateBadge();
    }
  }

  if (row.created_at) setLastMsgAt(offerId, row.created_at);
}

function refreshChatHeaderAndInfo(offerId) {
  const el = document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`);
  if (!el) return;

  const offer = offerById.get(offerId);
  const peer = peerByOfferId.get(offerId) || (offer ? getPeerForOffer(offer) : null);

  const peerName = peer?.peerName || 'User';
  const peerPic = peer?.peerPic || null;
  const peerInitial = peerName.trim().charAt(0).toUpperCase();

  const offerTitle = peer?.offerTitle || offer?.offer_title || 'Offer';
  const amount = peer?.offerAmount ?? offer?.offer_amount ?? null;
  const money = amount !== null && amount !== undefined ? fmtMoney(amount) : '';
  const offerLine = `Offer: ${offerTitle}${money ? ` • ${money}` : ''}`;

  const nameEl = el.querySelector('.ss-peer-name');
  if (nameEl) nameEl.textContent = peerName;

  const subEl = el.querySelector('.ss-chat-sub');
  if (subEl) subEl.textContent = offerLine;

  const ava = el.querySelector('.ss-chat-ava');
  if (ava) {
    const img = ava.querySelector('img');
    const initialEl = ava.querySelector('.ss-ava-initial');
    if (initialEl) initialEl.textContent = peerInitial;

    const imgStyle = 'width:100%;height:100%;display:block;object-fit:cover;object-position:center;';
    if (peerPic) {
      if (img) {
        img.src = peerPic;
        img.setAttribute('style', imgStyle);
        img.classList.remove('ss-broken');
      } else {
        ava.insertAdjacentHTML('afterbegin', `<img src="${escapeHtml(peerPic)}" style="${imgStyle}" alt="" referrerpolicy="no-referrer" onerror="this.classList.add('ss-broken');">`);
      }
    } else if (img) {
      img.classList.add('ss-broken');
    }
  }

  renderOfferInfo(offerId);

  const st = openChats.get(offerId);
  if (st?.infoOpen) el.classList.add('info-open');
  else el.classList.remove('info-open');

  const infoBtn = el.querySelector('.ss-info');
  if (infoBtn) infoBtn.textContent = st?.infoOpen ? '▴' : '▾';
}

function ensureChatElement(offerId) {
  const existing = document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`);
  if (existing) return existing;

  const offer = offerById.get(offerId);
  const peer = peerByOfferId.get(offerId) || getPeerForOffer(offer);

  const peerName = peer?.peerName || 'User';
  const peerPic = peer?.peerPic || null;
  const peerInitial = peerName.trim().charAt(0).toUpperCase();

  const offerTitle = peer?.offerTitle || offer?.offer_title || 'Offer';
  const money = peer?.offerAmount !== null && peer?.offerAmount !== undefined ? fmtMoney(peer.offerAmount) : '';
  const offerLine = `Offer: ${offerTitle}${money ? ` • ${money}` : ''}`;

  const imgStyle = 'width:100%;height:100%;display:block;object-fit:cover;object-position:center;';

  const el = document.createElement('div');
  el.className = 'ss-chat';
  el.dataset.offerId = offerId;
  el.dataset.unread = '0';

  el.innerHTML = `
    <div class="ss-chat-header" title="Click to minimize/restore">
      <div class="ss-chat-title">
        <div class="ss-chat-peer">
          <div class="ss-chat-ava">
            ${peerPic ? `<img src="${escapeHtml(peerPic)}" style="${imgStyle}" alt="" referrerpolicy="no-referrer" onerror="this.classList.add('ss-broken');">` : ''}
            <span class="ss-ava-initial">${escapeHtml(peerInitial)}</span>
          </div>
          <span class="ss-peer-name">${escapeHtml(peerName)}</span>
          <span class="ss-chat-unread">0</span>
        </div>
        <div class="ss-chat-sub">${escapeHtml(offerLine)}</div>
      </div>
      <div class="ss-chat-actions">
        <button class="ss-chat-btn ss-info" type="button" aria-label="Offer info" title="Offer info">▾</button>
        <button class="ss-chat-btn ss-min" type="button" aria-label="Minimize">—</button>
        <button class="ss-chat-btn ss-close" type="button" aria-label="Close">×</button>
      </div>
    </div>

    <div class="ss-chat-body">
      <div class="ss-chat-info" id="ss-chat-info-${offerId}"></div>

      <div class="ss-chat-messages" id="ss-chat-msgs-${offerId}">
        <div class="ss-dd-empty">Loading…</div>
      </div>

      <form class="ss-chat-form" id="ss-chat-form-${offerId}" autocomplete="off">
        <textarea class="ss-chat-input" id="ss-chat-input-${offerId}" rows="1" placeholder="Type a message…"></textarea>
        <button class="ss-chat-send" id="ss-chat-send-${offerId}" type="submit" disabled>Send</button>
      </form>
    </div>
  `;

  el.querySelector('.ss-chat-header')?.addEventListener('click', (e) => {
    const t = e.target;
    if (t && (t.closest('.ss-close') || t.closest('.ss-min') || t.closest('.ss-info'))) return;
    toggleMinimizeChat(offerId);
  });

  el.querySelector('.ss-info')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleOfferInfo(offerId);
  });

  el.querySelector('.ss-min')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMinimizeChat(offerId);
  });

  el.querySelector('.ss-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeChat(offerId);
  });

  const ta = el.querySelector(`#ss-chat-input-${offerId}`);
  const sendBtn = el.querySelector(`#ss-chat-send-${offerId}`);

  ta?.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(110, ta.scrollHeight) + 'px';
    sendBtn.disabled = ta.value.trim().length === 0;
  });

  ta?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.querySelector(`#ss-chat-form-${offerId}`)?.requestSubmit();
    }
  });

  el.querySelector(`#ss-chat-form-${offerId}`)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendMessage(offerId);
  });

  document.body.appendChild(el);

  renderOfferInfo(offerId);

  const st = openChats.get(offerId);
  if (st?.infoOpen) el.classList.add('info-open');

  return el;
}

async function openChat(offerId, { focus } = { focus: true }) {
  ensureUI();

  if (!offerById.has(offerId)) {
    await loadMyOffers();
  } else {
    const offer = offerById.get(offerId);
    await loadPeerProfiles([offer]);
    peerByOfferId.set(offerId, getPeerForOffer(offer));
  }

  const now = Date.now();

  if (!openChats.has(offerId)) {
    openChats.set(offerId, {
      minimized: false,
      infoOpen: false,
      lastOpenedAt: now,
      renderedIds: new Set(),
      unread: unreadByOffer.get(offerId) || 0,
      lastMsgAt: null,
    });
  } else {
    openChats.get(offerId).lastOpenedAt = now;
  }

  const el = ensureChatElement(offerId);

  const st = openChats.get(offerId);
  if (st?.minimized) el.classList.add('minimized');
  else el.classList.remove('minimized');

  if (st?.infoOpen) el.classList.add('info-open');
  else el.classList.remove('info-open');

  layoutChats();
  persistOpenChats();

  refreshChatHeaderAndInfo(offerId);

  const rows = await fetchOfferMessages(offerId);
  renderChatMessages(offerId, rows);

  if (!st?.minimized) markOfferRead(offerId);

  if (focus && !st?.minimized) {
    document.getElementById(`ss-chat-input-${offerId}`)?.focus();
  }
}

function updateOptimisticRowToReal(domRow, realRow, offerId) {
  if (!domRow || !realRow) return;
  try {
    const oldId = domRow.dataset.messageId || '';
    const newId = String(realRow.id || '');

    if (newId) domRow.dataset.messageId = newId;

    const timeEl = domRow.querySelector('.ss-meta-time');
    if (timeEl) timeEl.textContent = fmtDate(realRow.created_at);

    // Ensure renderedIds has the real id (and optionally drop the temp id)
    const st = openChats.get(offerId);
    if (st?.renderedIds) {
      if (oldId) st.renderedIds.delete(oldId);
      if (newId) st.renderedIds.add(newId);
    }

    if (realRow.created_at) setLastMsgAt(offerId, realRow.created_at);
  } catch {}
}

async function sendMessage(offerId) {
  const ta = document.getElementById(`ss-chat-input-${offerId}`);
  const sendBtn = document.getElementById(`ss-chat-send-${offerId}`);
  if (!ta) return;

  const text = ta.value.trim();
  if (!text) return;

  const offer = offerById.get(offerId);
  if (!offer) return;

  const meId = myAuthId();
  const meName = myUsername();
  const email = myEmail();

  const peer = peerByOfferId.get(offerId) || getPeerForOffer(offer);
  const isSponsor = peer.myRole === 'sponsor';

  const insertRow = {
    offer_id: offerId,
    user_id: meId,
    comment_text: text,
    sender: meName || (email ? email.split('@')[0] : 'user'),
    sponsor_id: isSponsor ? meId : (offer.sponsor_id || null),
    sponsee_id: isSponsor ? null : meId,
    sponsor_email: offer.sponsor_email || null,
    sponsee_email: offer.sponsee_email || null,
  };

  // Optimistic UI (shows immediately without refresh)
  const optimistic = {
    ...insertRow,
    id: `temp-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  const domRow = appendOneMessage(offerId, optimistic, true);

  ta.value = '';
  ta.style.height = 'auto';
  if (sendBtn) sendBtn.disabled = true;

  try {
    // Return the inserted row so we can reconcile IDs/timestamps immediately
    const { data, error } = await supabase
      .from('private_offer_comments')
      .insert([insertRow])
      .select('id, offer_id, comment_text, created_at, sender, user_id, sponsor_email, sponsee_email')
      .single();

    if (error) {
      console.error('[messages.js] insert error:', error);
      appendOneMessage(
        offerId,
        { comment_text: 'Failed to send. Please try again.', sender: 'System', created_at: new Date().toISOString() },
        false
      );
      return;
    }

    if (data) updateOptimisticRowToReal(domRow, data, offerId);

    // If realtime is slow/unavailable, we still have the message visible.
    // Optional: refresh dropdown preview if it's open
    if (dropdownOpen()) await refreshThreads();
  } catch (err) {
    console.error('[messages.js] insert unexpected error:', err);
    appendOneMessage(
      offerId,
      { comment_text: 'Failed to send. Please try again.', sender: 'System', created_at: new Date().toISOString() },
      false
    );
  }
}

function wireDropdown() {
  const btn = document.getElementById(BTN_ID);
  if (!btn) {
    console.warn(`[messages.js] Missing #${BTN_ID} button in HTML.`);
    return;
  }

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const open = dropdownOpen();
    setDropdownOpen(!open);
    if (!open) await refreshThreads();
  });

  document.addEventListener('click', () => {
    if (dropdownOpen()) setDropdownOpen(false);
  });

  window.addEventListener('resize', () => {
    if (dropdownOpen()) positionDropdown();
  });

  window.addEventListener('scroll', () => {
    if (dropdownOpen()) positionDropdown();
  }, true);
}

function wireRealtime() {
  const email = myEmail();
  if (!email) return;

  if (rtSponsorCh) supabase.removeChannel(rtSponsorCh);
  if (rtSponseeCh) supabase.removeChannel(rtSponseeCh);

  const onInsert = async (row) => {
    if (!row?.offer_id) return;

    // Ensure offer/peer cache is warm (so avatars/names stay correct)
    if (!offerById.has(row.offer_id)) await loadMyOffers();

    acceptIncomingMessage(row.offer_id, row);

    if (dropdownOpen()) await refreshThreads();
  };

  rtSponsorCh = supabase
    .channel(`ss-msg-sponsor-${email}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'private_offer_comments', filter: `sponsor_email=eq.${email}` },
      (payload) => onInsert(payload?.new)
    )
    .subscribe();

  rtSponseeCh = supabase
    .channel(`ss-msg-sponsee-${email}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'private_offer_comments', filter: `sponsee_email=eq.${email}` },
      (payload) => onInsert(payload?.new)
    )
    .subscribe();
}

async function pollOpenChatsOnce() {
  const entries = Array.from(openChats.entries());
  if (!entries.length) return;

  for (const [offerId, st] of entries) {
    // Only poll if the chat element exists (open)
    const chatEl = document.querySelector(`.ss-chat[data-offer-id="${offerId}"]`);
    if (!chatEl) continue;

    // Use lastMsgAt as a cursor
    const since = st?.lastMsgAt || null;

    // If lastMsgAt is missing (edge-case), do a quick one-time load of tail messages
    // but avoid huge loads: just fetch the last ~40 and render if empty.
    if (!since) {
      const rows = await fetchOfferMessages(offerId, 80);
      // Render only if the box is still showing Loading/empty (don’t clobber a populated chat)
      const box = document.getElementById(`ss-chat-msgs-${offerId}`);
      const isPlaceholder = !!box?.querySelector('.ss-dd-empty');
      if (isPlaceholder) renderChatMessages(offerId, rows);
      continue;
    }

    const newRows = await fetchOfferMessagesSince(offerId, since, 50);
    if (!newRows.length) continue;

    // Append each safely (dedupe with renderedIds)
    for (const r of newRows) {
      acceptIncomingMessage(offerId, r);
    }

    // Update dropdown preview if open (so it feels instant like Messenger)
    if (dropdownOpen()) await refreshThreads();
  }
}

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(() => {
    pollOpenChatsOnce().catch(() => {});
  }, POLL_OPEN_CHATS_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function restoreChatsAfterLoad() {
  const saved = restoreOpenChats();
  if (!saved.length) return;

  saved.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));

  for (const item of saved) {
    openChats.set(item.offerId, {
      minimized: item.minimized,
      infoOpen: item.infoOpen,
      lastOpenedAt: item.lastOpenedAt || Date.now(),
      renderedIds: new Set(),
      unread: unreadByOffer.get(item.offerId) || 0,
      lastMsgAt: null,
    });

    await openChat(item.offerId, { focus: false });

    if (item.minimized) {
      document.querySelector(`.ss-chat[data-offer-id="${item.offerId}"]`)?.classList.add('minimized');
    }
    if (item.infoOpen) {
      const chat = document.querySelector(`.ss-chat[data-offer-id="${item.offerId}"]`);
      chat?.classList.add('info-open');
      const btn = chat?.querySelector('.ss-info');
      if (btn) btn.textContent = '▴';
    }
  }

  layoutChats();
  persistOpenChats();
}

function wireResize() {
  window.addEventListener('resize', () => layoutChats());
}

async function init() {
  ensureUI();

  activeUser = await getActiveUser();
  if (!activeUser) return;

  wireDropdown();
  wireResize();

  await refreshThreads();
  updateBadge();

  await restoreChatsAfterLoad();

  wireRealtime();
  startPolling(); // <- ensures new messages appear instantly even if realtime doesn’t fire
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.error('[messages.js] init error:', err));
});

window.addEventListener('beforeunload', () => {
  stopPolling();
});
