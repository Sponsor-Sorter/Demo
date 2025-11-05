// ./js/friends.js
import { supabase } from './supabaseClient.js';
import { injectUserBadge } from './badges.js'; // badges for the accepted-friend modal

// Simple toast fallback
let toast = (msg) => { try { console.log(msg); } catch (_) {} };

/* =========================
   Core helpers
========================= */

function isSponsorType(t) {
  return prettyUserType(t) === 'sponsor';
}

function profileLinkFor(userId, username, userType) {
  const base = isSponsorType(userType) ? 'viewprofiles.html' : 'viewprofile.html';
  const q = new URLSearchParams({ username: username || '' }).toString();
  return `${base}?${q}`;
}

function prettyUserType(t) {
  const s = (t || '').toString().toLowerCase();
  if (!s) return '';
  if (s.includes('besponsored') || s === 'sponsee') return 'sponsee';
  if (s.includes('sponsor') || s.includes('brand') || s.includes('advertiser')) return 'sponsor';
  return s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1));
}

// Minimal user details for cards (include type + email so we can build badges)
async function getUserSummary(userId) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('username, profile_pic, "userType", email')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const username = data?.username || '-';
  const rawType  = data?.userType ?? '';
  const niceType = prettyUserType(rawType);
  return {
    username,
    typeRaw: rawType,
    typeNice: niceType,
    email: data?.email || null,
    profileUrl: profileLinkFor(userId, username, rawType),
    avatar: resolveProfilePicURL(data?.profile_pic)
  };
}

// auth.uid()
async function getMyUserId() {
  const { data: session } = await supabase.auth.getSession();
  const authUid = session?.session?.user?.id;
  if (!authUid) throw new Error('Not logged in');
  return authUid;
}

// Storage logos bucket → public URL, with safe fallback
function resolveProfilePicURL(profilePic) {
  if (!profilePic) return 'logos.png';
  if (/^https?:\/\//i.test(profilePic)) return profilePic;
  try {
    const { data } = supabase.storage.from('logos').getPublicUrl(profilePic);
    return data?.publicUrl || `logos.png`;
  } catch {
    return 'logos.png';
  }
}

// Direction-agnostic friendship row
async function getFriendshipRow(myUserId, otherUserId) {
  const { data, error } = await supabase
    .from('user_friendships')
    .select('id, user_id, friend_id, status, created_at, accepted_at')
    .or(`and(user_id.eq.${myUserId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${myUserId})`)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

const isPending  = (row) => row?.status === 'pending';
const isAccepted = (row) => row?.status === 'accepted';

/* =========================
   Actions
========================= */

export async function sendFriendRequest({ toUsername = null, toUserId = null }) {
  try {
    const myId = await getMyUserId();
    let targetId = toUserId;

    if (!targetId && toUsername) {
      const uname = toUsername.startsWith('@') ? toUsername.slice(1) : toUsername;
      const { data, error } = await supabase
        .from('users_extended_data')
        .select('user_id')
        .ilike('username', uname)
        .limit(1).maybeSingle();
      if (error) throw error;
      if (!data?.user_id) throw new Error(`User '${toUsername}' not found`);
      targetId = data.user_id;
    }

    if (!targetId) throw new Error('Target user not specified');
    if (myId === targetId) throw new Error("You can't friend yourself.");

    const existing = await getFriendshipRow(myId, targetId);
    if (existing) {
      if (isAccepted(existing)) throw new Error('You are already friends.');
      if (isPending(existing))  throw new Error('Friend request already pending.');
    }

    const { error } = await supabase
      .from('user_friendships')
      .insert([{ user_id: myId, friend_id: targetId, status: 'pending' }]);

    if (error) throw error;
    toast('Friend request sent.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Could not send request: ${err.message || err}`);
    return false;
  }
}

export async function acceptFriendRequest({ fromUserId }) {
  try {
    const myId = await getMyUserId();
    const row = await getFriendshipRow(myId, fromUserId);
    if (!row) throw new Error('Request not found');
    if (isAccepted(row)) { toast('Already friends.'); return true; }

    const { error } = await supabase
      .from('user_friendships')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', row.id);

    if (error) throw error;
    toast('Friend request accepted.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Could not accept: ${err.message || err}`);
    return false;
  }
}

export async function cancelFriendRequest({ withUserId }) {
  try {
    const myId = await getMyUserId();
    const row = await getFriendshipRow(myId, withUserId);
    if (!row) { toast('No request/friendship found.'); return true; }

    const { error } = await supabase
      .from('user_friendships')
      .delete()
      .eq('id', row.id);

    if (error) throw error;
    toast('Removed.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Could not remove: ${err.message || err}`);
    return false;
  }
}

export async function blockUser({ withUserId }) {
  try {
    const myId = await getMyUserId();
    let row = await getFriendshipRow(myId, withUserId);

    if (!row) {
      const { data, error } = await supabase
        .from('user_friendships')
        .insert([{ user_id: myId, friend_id: withUserId, status: 'blocked' }])
        .select()
        .maybeSingle();
      if (error) throw error;
      row = data;
    } else {
      const { error } = await supabase
        .from('user_friendships')
        .update({ status: 'blocked', accepted_at: null })
        .eq('id', row.id);
      if (error) throw error;
    }
    toast('User blocked.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Could not block: ${err.message || err}`);
    return false;
  }
}

export async function unblockUser({ withUserId }) {
  try {
    const myId = await getMyUserId();
    const row = await getFriendshipRow(myId, withUserId);
    if (!row || row.status !== 'blocked') { toast('No block in place.'); return true; }
    const { error } = await supabase
      .from('user_friendships')
      .delete()
      .eq('id', row.id);
    if (error) throw error;
    toast('User unblocked.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Could not unblock: ${err.message || err}`);
    return false;
  }
}

/* =========================
   Search dropdown (positioned under input)
========================= */

// Debounce
function debounce(fn, delay = 250) {
  let t = 0;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// Supersession guard for concurrent searches
let searchSeq = 0;

// Strong client-side de-dupe
function dedupeUsers(rows) {
  const byId = new Set();
  const byName = new Set();
  const out = [];
  for (const r of rows || []) {
    const id = r?.user_id;
    const name = (r?.username || '').trim().toLowerCase();
    const key = id || name;
    if (!key) continue;
    if (id && byId.has(id)) continue;
    if (!id && name && byName.has(name)) continue;
    if (id) byId.add(id);
    if (name) byName.add(name);
    out.push(r);
  }
  return out;
}

// Search users by partial username (excludes me) with dedupe
async function searchUsersByUsernameFragment(fragment, myId, limit = 8) {
  const q = (fragment || '').trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('user_id, username, profile_pic')
    .ilike('username', `%${q}%`)
    .neq('user_id', myId)
    .order('username', { ascending: true })
    .limit(limit * 3);
  if (error) throw error;
  return dedupeUsers(data).slice(0, limit);
}

// Fetch richer details (no fragile column list)
async function getUserDetailRow(userId) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) { return null; }
  return data;
}

function connectedProvidersFromRow(row) {
  const out = new Set();
  if (Array.isArray(row?.oauth_providers)) {
    row.oauth_providers.forEach(p => out.add(String(p).toLowerCase()));
  }
  ['youtube','twitch','instagram','tiktok','twitter','facebook','snapchat','discord']
    .forEach(k => { if (row?.[`${k}_connected`]) out.add(k); });
  return [...out];
}

function providerIconSrc(provider) {
  const map = {
    youtube: 'youtubelogo.png',
    twitch: 'twitchlogo.png',
    instagram: 'instagramlogo.png',
    tiktok: 'tiktoklogo.png',
    twitter: 'twitterlogo.png',
    x: 'twitterlogo.png',
    facebook: 'facebooklogo.png',
    snapchat: 'snaplogo.png',
    discord: 'discord.png'
  };
  return map[provider] || 'logos.png';
}

// Build result row UI (search dropdown)
async function buildResultRow(myId, user) {
  const row = document.createElement('div');
  row.className = 'friend-suggest-row';
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.justifyContent = 'space-between';
  row.style.padding = '10px 12px';
  row.style.gap = '12px';
  row.style.borderRadius = '10px';

  const left = document.createElement('div');
  left.style.display = 'flex';
  left.style.alignItems = 'center';
  left.style.gap = '12px';

  const img = document.createElement('img');
  img.src = resolveProfilePicURL(user.profile_pic);
  img.alt = user.username || '';
  img.width = 44;
  img.height = 44;
  img.style.borderRadius = '50%';
  img.style.objectFit = 'cover';
  img.style.background = '#222';

  const meta = document.createElement('div');
  meta.style.display = 'flex';
  meta.style.flexDirection = 'column';
  meta.style.gap = '4px';

  const uname = document.createElement('div');
  uname.innerHTML = `<strong>@${user.username || 'user'}</strong>`;

  const sub = document.createElement('div');
  sub.style.display = 'flex';
  sub.style.alignItems = 'center';
  sub.style.gap = '8px';

  const detail = await getUserDetailRow(user.user_id);
  const userTypeRaw  = detail?.userType || '';
  const userTypeNice = prettyUserType(userTypeRaw);

  if (userTypeNice) {
    const pill = document.createElement('span');
    pill.textContent = userTypeNice;
    pill.style.padding = '2px 8px';
    pill.style.borderRadius = '999px';
    pill.style.fontSize = '.85em';
    pill.style.background = '#444a';
    pill.style.color = '#ddd';
    sub.appendChild(pill);
  }

  const providers = connectedProvidersFromRow(detail || {});
  if (providers.length) {
    const icons = document.createElement('span');
    providers.slice(0, 6).forEach(p => {
      const i = document.createElement('img');
      i.src = providerIconSrc(p);
      i.alt = p;
      i.title = p;
      i.width = 18; i.height = 18;
      i.style.borderRadius = '4px';
      i.style.verticalAlign = 'middle';
      i.style.marginRight = '6px';
      icons.appendChild(i);
    });
    sub.appendChild(icons);
  }

  meta.appendChild(uname);
  meta.appendChild(sub);
  left.appendChild(img);
  left.appendChild(meta);

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.gap = '8px';
  right.style.alignItems = 'center';

  const profileHref = profileLinkFor(user.user_id, user.username, userTypeRaw);
  const viewBtn = document.createElement('a');
  viewBtn.href = profileHref;
  viewBtn.textContent = 'Profile';
  viewBtn.style.cssText = `
    text-decoration:none; background:#6b7280; color:#fff; margin:5px
    border:1px solid #4b5563; padding:7px 12px; border-radius:9px;
  `;

  const btn = document.createElement('button');
  btn.textContent = 'Friend Request';
  btn.className = 'btn-request';
  btn.style.padding = '7px 12px';
  btn.style.borderRadius = '9px';

  try {
    const existing = await getFriendshipRow(myId, user.user_id);
    if (existing?.status === 'accepted') { btn.textContent = 'Friends'; btn.disabled = true; }
    else if (existing?.status === 'pending') { btn.textContent = 'Pending'; btn.disabled = true; }
  } catch {}

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const ok = await sendFriendRequest({ toUserId: user.user_id });
    if (!ok) btn.disabled = false;
  });

  right.appendChild(viewBtn);
  right.appendChild(btn);

  row.appendChild(left);
  row.appendChild(right);

  row.addEventListener('mouseenter', () => { row.style.background = '#3a3a40'; });
  row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

  return row;
}

/* =========================
   Dropdown positioning
========================= */

function ensureDropdownContainer(anchorEl) {
  let dd = document.getElementById('friend-suggest-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'friend-suggest-dropdown';
    dd.style.position = 'fixed';
    dd.style.zIndex = '2000';
    dd.style.minWidth = '260px';
    dd.style.background = 'rgb(47, 47, 52)';
    dd.style.border = '1px solid rgb(68, 68, 68)';
    dd.style.borderRadius = '13px';
    dd.style.boxShadow = '0 10px 28px rgba(0,0,0,.35)';
    dd.style.padding = '6px';
    dd.style.maxHeight = '320px';
    dd.style.overflowY = 'auto';
    dd.style.display = 'none';
    document.body.appendChild(dd);
  }
  positionDropdown(dd, anchorEl);
  return dd;
}
function positionDropdown(dd, anchorEl) {
  const r = anchorEl.getBoundingClientRect();
  dd.style.left = `${r.left}px`;
  dd.style.top  = `${r.bottom + 6}px`;
  dd.style.width = `${Math.max(r.width, 260)}px`;
}
function showDropdown(dd) { dd.style.display = 'block'; }
function hideDropdown(dd) { dd.style.display = 'none'; dd.innerHTML = ''; }

/* =========================
   Friend Action Modal (for accepted)
========================= */

function ensureActionModal() {
  let overlay = document.getElementById('friend-action-modal-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'friend-action-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 5000; display: none;
    background: rgba(0,0,0,.55);
  `;

  const modal = document.createElement('div');
  modal.id = 'friend-action-modal';
  modal.style.cssText = `
    background:#2b2b2f; color:#fff; width:min(92vw, 420px);
    border-radius:16px; box-shadow:0 18px 60px rgba(0,0,0,.45);
    margin: 10vh auto; padding: 22px 20px; position: relative;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = `
    position:absolute; right:12px; top:8px; background:none; border:none;
    color:#f44; font-size:28px; cursor:pointer; line-height:1;
  `;
  closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });

  modal.appendChild(closeBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
  document.addEventListener('keydown', (e) => {
    if (overlay.style.display !== 'none' && e.key === 'Escape') overlay.style.display = 'none';
  });

  return overlay;
}

function openFriendActionModal({ username, avatar, typeNice, profileUrl, userEmail, onRemove, onBlock }) {
  const overlay = ensureActionModal();
  const modal = overlay.querySelector('#friend-action-modal');

  // wipe content (& re-add close)
  modal.innerHTML = '';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = `
    position:absolute; right:12px; top:8px; background:none; border:none;
    color:#f44; font-size:28px; cursor:pointer; line-height:1;box-shadow:none;
  `;
  closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
  modal.appendChild(closeBtn);

  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:10px;';
  header.innerHTML = `
    <img src="${avatar}" alt="@${username}" style="width:66px;height:66px;border-radius:50%;object-fit:cover;background:#222;">
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div style="font-weight:700;font-size:1.05em;">@${username}</div>
      ${typeNice ? `<div style="opacity:.85;font-size:.9em;padding:2px 8px;border-radius:999px;background:#444a;color:#ddd;max-width:max-content;">${typeNice}</div>` : ''}
    </div>
  `;
  modal.appendChild(header);

  // BADGES ROW (supporter + tier + socials)
  const badgesRow = document.createElement('div');
  badgesRow.id = 'friend-badges-row';
  badgesRow.style.cssText = 'margin:6px 0 12px 0;';
  modal.appendChild(badgesRow);

  // Inject badges (choose email field by user type)
  if (userEmail) {
    const emailField = (typeNice === 'sponsor') ? 'sponsor_email' : 'sponsee_email';
    try {
      injectUserBadge(userEmail, '#friend-badges-row', emailField);
    } catch (e) {
      console.warn('badge inject failed:', e);
    }
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; margin-top:6px;';
  actions.innerHTML = `
    <a href="${profileUrl}" style="
      text-decoration:none;background:#6b7280;color:#fff;border:1px solid #4b5563;margin: auto;
      padding:9px 14px;border-radius:10px;">Profile</a>
    <button id="modal-remove" style="
      background:#c62828;color:#fff;border:1px solid #a61f1f;box-shadow:none; height:fit-content;
      padding:9px 14px;border-radius:10px;cursor:pointer;">Remove</button>
    <button id="modal-block" style="
      background:#5a5a5a;color:#fff;border:1px solid #444;box-shadow:none; height:fit-content;
      padding:9px 14px;border-radius:10px;cursor:pointer;">Block</button>
  `;
  modal.appendChild(actions);

  actions.querySelector('#modal-remove').addEventListener('click', async () => {
    overlay.style.display = 'none';
    await onRemove?.();
  });
  actions.querySelector('#modal-block').addEventListener('click', async () => {
    overlay.style.display = 'none';
    await onBlock?.();
  });

  overlay.style.display = 'block';
}

/* =========================
   Lists + UI
========================= */

export async function listMyFriendships() {
  const myId = await getMyUserId();
  const { data, error } = await supabase
    .from('user_friendships')
    .select('id, user_id, friend_id, status, created_at, accepted_at')
    .or(`user_id.eq.${myId},friend_id.eq.${myId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function renderFriendsUI(opts = {}) {
  const pendingListEl  = document.getElementById(opts.pendingListId  || 'friends-pending');
  const acceptedListEl = document.getElementById(opts.acceptedListId || 'friends-accepted');

  try {
    const myId = await getMyUserId();
    const rows = await listMyFriendships();

    // Two-column layout: Pending (left) | Friends (right)
    const columns = document.querySelector('.friends-columns');
    if (columns) {
      columns.style.display = 'grid';
      columns.style.gridTemplateColumns = '1fr 3fr';
      columns.style.gap = '14px';
      columns.style.alignItems = 'start';
    }

    /* ---------- Pending ---------- */
    if (pendingListEl) {
      const pend = rows.filter(r => r.status === 'pending');
      pendingListEl.innerHTML = '';

      for (const r of pend) {
        const isOutgoing = r.user_id === myId;
        const otherId    = isOutgoing ? r.friend_id : r.user_id;
        const { username, avatar, typeNice, profileUrl } = await getUserSummary(otherId);

        const card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '8px 0';

        card.innerHTML = `
          <div class="card-body" style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;width:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <img class="pending-avatar" src="${avatar}" alt="@${username}" width="60" height="60"
                   style="border-radius:50%;object-fit:cover;background:#222;cursor:pointer;">
              <span style="font-weight:600;">@${username}</span>
              ${typeNice ? `<span style="opacity:.9;font-size:.9em;padding:2px 8px;border-radius:999px;background:#444a;color:#ddd;">${typeNice}</span>` : ''}
              ${isOutgoing
                ? `<span style="opacity:.9;font-size:.9em;padding:2px 8px;border-radius:999px;background:#444a;color:#ddd;margin-left: 60px;
  margin-top: -30px;
  margin-bottom: 10px;;">Sent</span>`
                : `<span style="opacity:.9;font-size:.9em;padding:2px 8px;border-radius:999px;background:#444a;color:#ddd;margin-left: 60px;
  margin-top: -30px;
  margin-bottom: 10px;">Received</span>`
              }
            </div>
            <div class="btns" style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap; margin:5px;"></div>
          </div>
        `;

        // Avatar opens profile (no separate Profile button)
        const avatarEl = card.querySelector('.pending-avatar');
        avatarEl.addEventListener('click', () => { window.location.href = profileUrl; });
        avatarEl.setAttribute('role', 'button');
        avatarEl.setAttribute('tabindex', '0');
        avatarEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = profileUrl; }
        });

        const btnWrap = card.querySelector('.btns');

        // Remove button (red)
        const btnRemove = document.createElement('button');
        btnRemove.textContent = 'Remove';
        btnRemove.style.cssText = `
          background:#c62828;color:#fff;border:1px solid #a61f1f;box-shadow:none; margin:5px;
          padding:7px 12px;border-radius:9px;cursor:pointer;
        `;
        btnRemove.addEventListener('click', async () => {
          await cancelFriendRequest({ withUserId: otherId });
          renderFriendsUI(opts);
        });

        if (isOutgoing) {
          // Outgoing: only Remove
          btnWrap.appendChild(btnRemove);
        } else {
          // Incoming: Accept + Remove
          const btnAccept = document.createElement('button');
          btnAccept.textContent = 'Accept';
          btnAccept.style.cssText = `
            background:#22c55e; color:#fff; border:1px solid #178a41;  margin:5px
            padding:7px 12px; border-radius:9px; cursor:pointer;
          `;
          btnAccept.addEventListener('mouseenter', () => { btnAccept.style.background = '#16a34a'; });
          btnAccept.addEventListener('mouseleave', () => { btnAccept.style.background = '#22c55e'; });
          btnAccept.addEventListener('click', async () => {
            await acceptFriendRequest({ fromUserId: otherId });
            renderFriendsUI(opts);
          });

          btnWrap.appendChild(btnAccept);
          btnWrap.appendChild(btnRemove);
        }

        pendingListEl.appendChild(card);
      }
    }

    /* ---------- Friends (accepted) — small cards; avatar opens modal ---------- */
    if (acceptedListEl) {
      const acc = rows.filter(r => r.status === 'accepted');
      acceptedListEl.innerHTML = '';

      for (const r of acc) {
        const otherId = r.user_id === myId ? r.friend_id : r.user_id;
        const { username, avatar, typeNice, profileUrl, email } = await getUserSummary(otherId);

        const card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '8px 0';

        card.innerHTML = `
          <div class="card-body"
               style="display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;text-align:center;padding:14px 12px;">
            <button class="avatar-btn"
                    aria-label="Open actions for @${username}"
                    style="border:none;background:none;padding:0;cursor:pointer;line-height:0;border-radius:50%;box-shadow:none">
              <img src="${avatar}" alt="@${username}"
                   style="width:60px;height:60px;border-radius:50%;object-fit:cover;background:#222;
                          box-shadow:0 6px 18px rgba(0,0,0,.35);">
            </button>
            <div class="friend-name" style="font-weight:700;margin-top:4px;">@${username}</div>
            ${typeNice ? `
              <div class="friend-type"
                   style="opacity:.9;font-size:.9em;padding:4px 10px;border-radius:999px;background:#444a;color:#ddd;margin-top:2px;">
                ${typeNice}
              </div>` : ''}
          </div>
        `;

        // Avatar opens modal with actions + BADGES
        card.querySelector('.avatar-btn').addEventListener('click', () => {
          openFriendActionModal({
            username, avatar, typeNice, profileUrl, userEmail: email,
            onRemove: async () => {
              await cancelFriendRequest({ withUserId: otherId });
              renderFriendsUI(opts);
            },
            onBlock: async () => {
              await blockUser({ withUserId: otherId });
              renderFriendsUI(opts);
            }
          });
        });

        acceptedListEl.appendChild(card);
      }
    }

  } catch (err) {
    console.error(err);
    toast(`Friends UI error: ${err.message || err}`);
  }
}

/* =========================
   Wire-up
========================= */

document.addEventListener('DOMContentLoaded', () => {
  const form  = document.getElementById('friend-add-form');
  const input = document.getElementById('friend-username');

  // Hide the old submit button if present
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"], button:not([type])');
    if (submitBtn) submitBtn.style.display = 'none';
  }

  // Dropdown search with supersession guard
  let dd; // dropdown element
  const debouncedSearch = debounce(async () => {
    if (!input) return;
    const q = (input.value || '').trim();
    if (!q) { if (dd) hideDropdown(dd); return; }

    const mySeq = ++searchSeq;
    try {
      const myId = await getMyUserId();
      dd = ensureDropdownContainer(input);
      dd.innerHTML = `<div style="padding:8px 10px;color:#ccc;">Searching…</div>`;
      showDropdown(dd);

      const resultsRaw = await searchUsersByUsernameFragment(q, myId, 8);
      if (mySeq !== searchSeq) return;

      const results = dedupeUsers(resultsRaw);
      dd.innerHTML = '';
      if (!results.length) {
        dd.innerHTML = `<div style="padding:8px 10px;color:#aaa;">No matches.</div>`;
        return;
      }

      for (const u of results) {
        if (mySeq !== searchSeq) return;
        const row = await buildResultRow(myId, u);
        if (mySeq !== searchSeq) return;
        dd.appendChild(row);
      }
      showDropdown(dd);
      positionDropdown(dd, input);
    } catch (err) {
      if (mySeq !== searchSeq) return;
      console.error(err);
      dd = ensureDropdownContainer(input);
      dd.innerHTML = `<div style="padding:8px 10px;color:#f88;">${err.message || err}</div>`;
      showDropdown(dd);
    }
  }, 220);

  if (input) {
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', debouncedSearch);
    input.addEventListener('focus', () => {
      if (input.value?.trim()) debouncedSearch();
    });
    ['scroll', 'resize'].forEach(evt => {
      window.addEventListener(evt, () => {
        const el = document.getElementById('friend-suggest-dropdown');
        if (el && el.style.display !== 'none') positionDropdown(el, input);
      }, { passive: true });
    });
    document.addEventListener('click', (e) => {
      const el = document.getElementById('friend-suggest-dropdown');
      if (!el || el.style.display === 'none') return;
      if (input.contains(e.target) || el.contains(e.target)) return;
      hideDropdown(el);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const el = document.getElementById('friend-suggest-dropdown');
        if (el) hideDropdown(el);
      }
    });
  }

  // Render lists on load if the containers are present
  if (document.getElementById('friends-pending') || document.getElementById('friends-accepted')) {
    renderFriendsUI({});
  }
});

// Optional global
window.FriendsAPI = {
  sendFriendRequest,
  acceptFriendRequest,
  cancelFriendRequest,
  blockUser,
  unblockUser,
  listMyFriendships,
  renderFriendsUI
};
