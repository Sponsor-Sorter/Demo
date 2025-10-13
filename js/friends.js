// ./js/friends.js
import { supabase } from './supabaseClient.js';

// Simple toast fallback
let toast = (msg) => { try { console.log(msg); } catch (_) {} };

/* =========================
   Core helpers
========================= */

function isSponsorType(t) {
  // decide using the normalized value
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
  // fallback: simple title-case
  return s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1));
}

// Minimal user details for cards (include type so we can build the profile link)
async function getUserSummary(userId) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('username, profile_pic, "userType"')   // quoted column name
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
    .limit(limit * 3); // overfetch a bit, then slice after dedupe
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

// Build result row UI (adds "View Profile" button)
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

    /* ---------- Pending ---------- */
    if (pendingListEl) {
      const pend = rows.filter(r => r.status === 'pending');
      pendingListEl.innerHTML = '';

      for (const r of pend) {
        const isOutgoing = r.user_id === myId;          // you sent the request
        const otherId    = isOutgoing ? r.friend_id : r.user_id;
        const { username, avatar, typeNice, profileUrl } = await getUserSummary(otherId);

        const card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '8px 0';

        // Column layout so buttons are BELOW the identity row
        card.innerHTML = `
          <div class="card-body" style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;width:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <img src="${avatar}" alt="@${username}" width="60" height="60" style="border-radius:50%;object-fit:cover;background:#222;">
              <span style="font-weight:600;">@${username}</span>
              ${typeNice ? `<span style="opacity:.9;font-size:.9em;padding:2px 8px;border-radius:999px;background:#444a;color:#ddd;">${typeNice}</span>` : ''}
              ${isOutgoing
                ? `<span style="opacity:.9;font-size:.9em;padding:2px 8px;border-radius:999px;background:#444a;color:#ddd;">Sent</span>`
                : `<span style="opacity:.9;font-size:.9em;padding:2px 8px;border-radius:999px;background:#444a;color:#ddd;">Received</span>`
              }
            </div>
            <div class="btns" style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap; margin:5px;"></div>
          </div>
        `;

        const btnWrap = card.querySelector('.btns');

        // View Profile (shown for both incoming & outgoing)
        const viewBtn = document.createElement('a');
        viewBtn.href = profileUrl;
        viewBtn.textContent = 'Profile';
        viewBtn.style.cssText = `
          text-decoration:none; background:#6b7280; color:#fff; margin:5px;
          border:1px solid #4b5563; padding:7px 12px; border-radius:9px;
        `;

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
          btnWrap.appendChild(viewBtn);
          btnWrap.appendChild(btnRemove);
        } else {
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

          btnWrap.appendChild(viewBtn);
          btnWrap.appendChild(btnAccept);
          btnWrap.appendChild(btnRemove);
        }

        pendingListEl.appendChild(card);
      }
    }

    /* ---------- Friends (accepted) ---------- */
    if (acceptedListEl) {
      const acc = rows.filter(r => r.status === 'accepted');
      acceptedListEl.innerHTML = '';

      for (const r of acc) {
        const otherId = r.user_id === myId ? r.friend_id : r.user_id;
        const { username, avatar, typeNice, profileUrl } = await getUserSummary(otherId);

        const card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '8px 0';

        card.innerHTML = `
          <div class="card-body" style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;width:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <img src="${avatar}" alt="@${username}" width="60" height="60" style="border-radius:50%;object-fit:cover;background:#222;">
              <span style="font-weight:600;">@${username}</span>
              ${typeNice ? `<span style="opacity:.9;font-size:.9em;padding:2px 8px;border-radius:999px;background:#444a;color:#ddd;">${typeNice}</span>` : ''}
            </div>
            <div class="btns" style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap; margin:5px !important;">
              <a href="${profileUrl}" style="
                text-decoration:none;background:#6b7280;color:#fff;border:1px solid #4b5563;
                padding:7px 12px;border-radius:9px;">Profile</a>
              <button class="btn-remove" style="
                background:#c62828;color:#fff;border:1px solid #a61f1f;box-shadow:none !important;  margin:5px
                padding:7px 12px;border-radius:9px;cursor:pointer;">
                Remove
              </button>
              <button class="btn-block" style="
                background:#5a5a5a;color:#fff;border:1px solid #444;box-shadow:none; margin:5px
                padding:7px 12px;border-radius:9px;cursor:pointer;">
                Block
              </button>
            </div>
          </div>
        `;

        card.querySelector('.btn-remove').addEventListener('click', async () => {
          await cancelFriendRequest({ withUserId: otherId });
          renderFriendsUI(opts);
        });
        card.querySelector('.btn-block').addEventListener('click', async () => {
          await blockUser({ withUserId: otherId });
          renderFriendsUI(opts);
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
