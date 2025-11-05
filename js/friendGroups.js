// ./js/friendGroups.js
import { supabase } from './supabaseClient.js';

// DO NOT import alerts.js here
let toast = (msg) => { try { console.log(msg); } catch (_) {} };

/* =========================
   Helpers
========================= */

// auth.uid()
async function getMyUserId() {
  const { data: session } = await supabase.auth.getSession();
  const authUid = session?.session?.user?.id;
  if (!authUid) throw new Error('Not logged in');
  return authUid;
}

async function getUserIdByUsername(username) {
  const uname = username?.startsWith('@') ? username.slice(1) : username;
  if (!uname) throw new Error('username required');
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('user_id, username')
    .ilike('username', uname)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.user_id) throw new Error(`User '${username}' not found`);
  return data.user_id;
}

async function usernameForUserId(uid) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('username')
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();
  if (error) return '-';
  return data?.username || '-';
}

// basic user row for cards (username + profile_pic)
async function getUserBasics(uid) {
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('username, profile_pic')
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();
  if (error) return { username: '-', profile_pic: null };
  return { username: data?.username || '-', profile_pic: data?.profile_pic || null };
}

async function getGroupById(groupId) {
  const { data, error } = await supabase
    .from('friend_groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Storage bucket used for group logos
const GROUP_IMAGE_BUCKET = 'group-logos';

// LocalStorage helpers (fallback when DB has no image column)
const LS_KEY_PREFIX = 'groupImagePath:';
function lsGet(groupId) {
  try { return localStorage.getItem(`${LS_KEY_PREFIX}${groupId}`) || null; } catch { return null; }
}
function lsSet(groupId, path) {
  try { localStorage.setItem(`${LS_KEY_PREFIX}${groupId}`, path || ''); } catch {}
}
function lsDel(groupId) {
  try { localStorage.removeItem(`${LS_KEY_PREFIX}${groupId}`); } catch {}
}

// Replace your current publicUrlForBucketPath with this
function publicUrlForBucketPath(path, bust = '') {
  if (!path) return 'logos.png';

  // If it's already a full URL, just (optionally) add the cache-buster.
  if (/^https?:\/\//i.test(path)) {
    return bust
      ? path + (path.includes('?') ? '&' : '?') + `cb=${encodeURIComponent(bust)}`
      : path;
  }

  // Normalize and detect bucket if the saved path includes one
  let key = String(path).replace(/^\/+/, '');
  let bucket = GROUP_IMAGE_BUCKET; // default: 'group-logos'

  // If the first segment looks like an explicit bucket, honor it.
  // e.g., "logos/abc.png"  -> bucket = 'logos', key = 'abc.png'
  //       "group-logos/groups/1/img.png" -> bucket = 'group-logos', key = 'groups/1/img.png'
  const firstSeg = key.split('/')[0].toLowerCase();
  if (firstSeg === 'logos' || firstSeg === 'group-logos') {
    bucket = firstSeg;
    key = key.split('/').slice(1).join('/');
  }

  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    let url = data?.publicUrl || 'logos.png';
    if (bust) url += (url.includes('?') ? '&' : '?') + `cb=${encodeURIComponent(bust)}`;
    return url;
  } catch {
    return 'logos.png';
  }
}

// ---- Group Offers show/hide helpers (keep invites panel visible) ----
function showGroupOffersFor(groupId) {
  // ensure the offers area is visible
  const tabs = document.getElementById('group-offer-tabs');
  const ctr  = document.getElementById('group-offers-container');
  if (tabs) tabs.style.display = 'flex';
  if (ctr)  ctr.style.display  = 'block';

  // ask groupOffers.js to render the selected group
  try {
    if (window.GroupOffers?.show) {
      window.GroupOffers.show(groupId);
    } else {
      // fallback: event that groupOffers.js listens to
      window.dispatchEvent(new CustomEvent('friend-group:view', { detail: { groupId } }));
    }
  } catch (e) {
    console.warn('showGroupOffersFor failed:', e?.message || e);
  }
}

function hideGroupOffersSection() {
  // do NOT clear innerHTML; just hide so we don't fight its internals
  const tabs = document.getElementById('group-offer-tabs');
  const ctr  = document.getElementById('group-offers-container');
  if (tabs) tabs.style.display = 'none';
  if (ctr)  ctr.style.display  = 'none';
}


// ---- Badges integration helpers ----
async function _badges() {
  try { return await import('./badges.js'); } catch { return null; }
}

// Get a user's email (needed by badges.js)
async function getUserEmailById(userId) {
  try {
    const { data, error } = await supabase
      .from('users_extended_data')
      .select('email')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data?.email || null;
  } catch { return null; }
}

// User avatar resolver (logos bucket), matches friends.js
function resolveUserAvatarURL(profilePic) {
  if (!profilePic) return 'logos.png';
  if (/^https?:\/\//i.test(profilePic)) return profilePic;
  try {
    const { data } = supabase.storage.from('logos').getPublicUrl(profilePic);
    return data?.publicUrl || 'logos.png';
  } catch {
    return 'logos.png';
  }
}

// Upload an image -> { path, publicUrl }
async function uploadGroupImage(groupId, file) {
  if (!file) return null;
  const safeName = `${Date.now()}-${(file.name || 'image').replace(/[^\w.\-]+/g, '_')}`;
  const path = `groups/${groupId}/${safeName}`;
  const { error } = await supabase.storage
    .from(GROUP_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || 'image/png' });
  if (error) throw error;
  const { data } = supabase.storage.from(GROUP_IMAGE_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data?.publicUrl || null };
}

// Which column (if any) holds an image path for this row?
function groupImageColumn(g) {
  if (!g) return null;
  if ('image_path' in g)  return 'image_path';
  if ('image' in g)       return 'image';
  if ('image_url' in g)   return 'image_url';
  if ('group_image' in g) return 'group_image';
  return null;
}

// Optional "Allow Offers" column (various spellings)
function allowOffersColumn(g) {
  if (!g) return null;
  if ('allow_offers' in g) return 'allow_offers';
  if ('allowOffers' in g)  return 'allowOffers';
  return null;
}

// Resolve the best image URL to show for a group (DB column or fallback to localStorage)
function resolveGroupImageURL(g) {
  const imgCol = groupImageColumn(g);
  const bust   = g?.updated_at || g?.created_at || Date.now().toString();
  if (imgCol && g?.[imgCol]) return publicUrlForBucketPath(g[imgCol], bust);
  const lsPath = lsGet(g?.id);
  if (lsPath) return publicUrlForBucketPath(lsPath, bust);
  return 'grouplogo.png';
}

// ---- Notifications (group invites) ----
// Safe, dynamic use of alerts.js if present; otherwise fallback to direct inserts.
// Never blocks UI; emails are "best effort" via Edge Function after DB commit.

async function _dynAlerts() {
  try { return await import('./alerts.js'); } catch { return null; }
}

async function _getNotifyRow(user_id) {
  // notification_uuid + email + alert_email toggle
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('notification_uuid, email, alert_email')
    .eq('user_id', user_id)
    .maybeSingle();
  if (error) return { notification_uuid: null, email: null, alert_email: true };
  return {
    notification_uuid: data?.notification_uuid || null,
    email: data?.email || null,
    alert_email: data?.alert_email !== false // default true
  };
}

async function _insertNotif({ notification_uuid, email, type, title, message, related_offer_id = null }) {
  if (!notification_uuid || !email) return;

  // Try central alerts.js first
  try {
    const Alerts = await _dynAlerts();
    if (Alerts?.insertNotification) {
      await Alerts.insertNotification({ notification_uuid, email, type, title, message, related_offer_id });
      return;
    }
  } catch {}

  // Fallback direct insert
  try {
    await supabase.from('user_notifications').insert([{
      notification_uuid, email, type: type || 'info',
      title, message, read: false, related_offer_id, created_at: new Date().toISOString()
    }]);
  } catch (_) {}
}

async function _bestEffortEmail(to, subject, text) {
  if (!to) return;
  try {
    await supabase.functions.invoke('sendNotificationEmail', { body: { to, subject, text } });
  } catch (_) {}
}

/** Notify a user they were invited to a group */
async function notifyGroupInvite({ invitee_id, groupId, inviter_id }) {
  try {
    const [g, inviterName] = await Promise.all([
      getGroupById(groupId),
      usernameForUserId(inviter_id)
    ]);

    const { notification_uuid, email, alert_email } = await _getNotifyRow(invitee_id);
    if (!notification_uuid || !email) return;

    const title = `Group invite: ${g?.name || 'a group'}`;
    const message = `@${inviterName || 'someone'} invited you to join “${g?.name || 'Group'}”. Open Groups to accept.`;

    await _insertNotif({ notification_uuid, email, type: 'group_invite', title, message });

    if (alert_email) {
      await _bestEffortEmail(email, title, message);
    }
  } catch (e) {
    console.warn('notifyGroupInvite failed:', e?.message || e);
  }
}

/** (Optional) Notify inviter when invite is accepted/declined */
async function notifyInviteStatus({ inviter_id, invitee_id, groupId, status }) {
  try {
    const [g, inviteeName] = await Promise.all([
      getGroupById(groupId),
      usernameForUserId(invitee_id)
    ]);

    const { notification_uuid, email, alert_email } = await _getNotifyRow(inviter_id);
    if (!notification_uuid || !email) return;

    const isAccepted = String(status).toLowerCase() === 'accepted';
    const title   = isAccepted ? 'Group Invitation Accepted' : 'Group Invitation Declined';
    const message = `@${inviteeName || 'user'} ${isAccepted ? 'accepted' : 'declined'} your invite to “${g?.name || 'Group'}”.`;

    await _insertNotif({ notification_uuid, email, type: 'group_invite_status', title, message });
    if (alert_email) await _bestEffortEmail(email, title, message);
  } catch (_) {}
}


/* =========================
   Groups CRUD
========================= */

export async function createGroup({ name, description = '', visibility = 'private', imageFile = null, allowOffers = false }) {
  try {
    if (!name) throw new Error('Group name required');
    const myId = await getMyUserId();

    // Try insert WITH allow_offers (current schema supports it). Fallback if legacy.
    let newGroup = null;
    {
      const insertPayload = { owner_id: myId, name, description, visibility, allow_offers: !!allowOffers };
      let ins = await supabase.from('friend_groups').insert([insertPayload]).select().maybeSingle();
      if (ins.error && /column .*allow_offers/i.test(ins.error.message || '')) {
        ins = await supabase.from('friend_groups').insert([{ owner_id: myId, name, description, visibility }]).select().maybeSingle();
      }
      if (ins.error) throw ins.error;
      newGroup = ins.data;
    }

   // Optional: upload image and persist *public URL* into image_path
if (imageFile) {
  try {
    const uploaded = await uploadGroupImage(newGroup.id, imageFile);

    // Always resolve a public URL string (we want to store the URL, not the storage key)
    const publicUrl =
      uploaded?.publicUrl ||
      supabase.storage.from(GROUP_IMAGE_BUCKET).getPublicUrl(uploaded?.path || '').data?.publicUrl ||
      null;

    if (publicUrl) {
      const usedCol = await persistGroupImageURL(newGroup.id, publicUrl);
      if (usedCol) newGroup[usedCol] = publicUrl; // reflect locally for immediate UI use
    }

    // Keep localStorage fallback around for any legacy readers
    if (uploaded?.path) lsSet(newGroup.id, uploaded.path);
  } catch (imgErr) {
    console.warn('Group image upload failed:', imgErr);
  }
}


    // Auto-add owner to members
   // Auto-add creator to the group as ADMIN (valid roles: 'member' | 'admin').
// Note: the actual owner is tracked in friend_groups.owner_id.
try {
  const myId2 = await getMyUserId();

  // avoid duplicate row if something retried
  const { data: existing, error: exErr } = await supabase
    .from('friend_group_members')
    .select('user_id')
    .eq('group_id', newGroup.id)
    .eq('user_id', myId2)
    .maybeSingle();
  if (exErr) throw exErr;

  if (!existing?.user_id) {
    const { error: insErr } = await supabase
      .from('friend_group_members')
      .insert([{ group_id: newGroup.id, user_id: myId2, role: 'admin' }], { returning: 'minimal' });
    if (insErr) throw insErr;
  }
} catch (mErr) {
  console.warn('Owner auto-member add failed:', mErr?.message || mErr);
}


    toast('Group created.');
    return newGroup;
  } catch (err) {
    console.error(err);
    toast(`Create group failed: ${err.message || err}`);
    return null;
  }
}

export async function deleteGroup({ groupId }) {
  try {
    if (!groupId) throw new Error('groupId required');

    await supabase.from('friend_group_members').delete().eq('group_id', groupId);

    const { error } = await supabase
      .from('friend_groups')
      .delete()
      .eq('id', groupId);

    if (error) throw error;

    lsDel(groupId);

    toast('Group deleted.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Delete failed: ${err.message || err}`);
    return false;
  }
}

export async function updateGroup({ groupId, name, description, visibility }) {
  try {
    if (!groupId) throw new Error('groupId required');
    const patch = {};
    if (name != null) patch.name = name;
    if (description != null) patch.description = description;
    if (visibility != null) patch.visibility = visibility;
    if (!Object.keys(patch).length) return true;

    const { error } = await supabase
      .from('friend_groups')
      .update(patch)
      .eq('id', groupId);

    if (error) throw error;
    toast('Group updated.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Update failed: ${err.message || err}`);
    return false;
  }
}

// Persist the *public URL* into the group's image column.
// Tries image_path first; gracefully falls back to common legacy names.
async function persistGroupImageURL(groupId, publicUrl) {
  if (!groupId || !publicUrl) return null;

  const tryCols = ['image_path', 'image_url', 'image', 'group_image'];
  for (const col of tryCols) {
    const { error } = await supabase
      .from('friend_groups')
      .update({ [col]: publicUrl })
      .eq('id', groupId);

    if (!error) return col;

    // If it failed for a reason other than "column doesn't exist", bubble it up.
    if (!/column .* does not exist/i.test(error?.message || '')) throw error;
  }
  return null;
}


// Called from the settings modal
async function updateGroupSettings({ groupId, patch = {}, imageFile = null }) {
  // If a new image was provided, upload and persist the *public URL* immediately
  if (imageFile) {
    const uploaded = await uploadGroupImage(groupId, imageFile);
    if (uploaded) {
      const publicUrl =
        uploaded.publicUrl ||
        supabase.storage.from(GROUP_IMAGE_BUCKET).getPublicUrl(uploaded.path || '').data?.publicUrl ||
        null;

      if (publicUrl) {
        // Write directly to image_path (or fallback column) irrespective of what's in `patch`
        await persistGroupImageURL(groupId, publicUrl);
      }

      // keep legacy fallback
      if (uploaded.path) lsSet(groupId, uploaded.path);
    }
  }

  // Apply other field updates (name/description/visibility/allow_offers)
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('friend_groups').update(patch).eq('id', groupId);
    if (error) throw error;
  }
}


/* =========================
   Membership + Roles
========================= */

export async function listMyGroups() {
  const myId = await getMyUserId();

  // Owner groups
  const { data: ownRows, error: ownErr } = await supabase
    .from('friend_groups')
    .select('*')
    .eq('owner_id', myId);
  if (ownErr) throw ownErr;

  // Groups where I'm a member
  const { data: memRows, error: memErr } = await supabase
    .from('friend_group_members')
    .select('group_id')
    .eq('user_id', myId);
  if (memErr) throw memErr;

  const memberIds = Array.from(new Set((memRows || []).map(r => r.group_id)));
  let memberGroups = [];
  if (memberIds.length) {
    const { data: mg, error: mgErr } = await supabase
      .from('friend_groups')
      .select('*')
      .in('id', memberIds);
    if (mgErr) throw mgErr;
    memberGroups = mg || [];
  }

  // Merge + dedupe + sort newest first
  const map = new Map();
  [...(ownRows || []), ...memberGroups].forEach(g => map.set(g.id, g));
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}


export async function listGroupMembers(groupId) {
  const { data, error } = await supabase
    .from('friend_group_members')
    .select('user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addMemberByUsername({ groupId, username }) {
  try {
    if (!groupId || !username) throw new Error('groupId and username required');
    const targetId = await getUserIdByUsername(username);

    // Avoid duplicates
    const { data: existing } = await supabase
      .from('friend_group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', targetId)
      .maybeSingle();
    if (existing?.user_id) {
      toast(`@${username} is already a member.`);
      return true;
    }

    const { error } = await supabase
      .from('friend_group_members')
      .insert([{ group_id: groupId, user_id: targetId, role: 'member' }], { returning: 'minimal' });

    if (error) throw error;
    toast(`@${username} added to group.`);
    return true;
  } catch (err) {
    console.error(err);
    toast(`Could not add member: ${err.message || err}`);
    return false;
  }
}

export async function removeMember({ groupId, memberUserId }) {
  try {
    const { error } = await supabase
      .from('friend_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);

    if (error) throw error;
    toast('Member removed.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Remove failed: ${err.message || err}`);
    return false;
  }
}

export async function leaveGroup({ groupId }) {
  try {
    const myId = await getMyUserId();
    const { error } = await supabase
      .from('friend_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', myId);

    if (error) throw error;
    toast('You left the group.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Leave failed: ${err.message || err}`);
    return false;
  }
}

// Roles
export async function promoteToAdmin({ groupId, memberUserId }) {
  try {
    const { error } = await supabase
      .from('friend_group_members')
      .update({ role: 'admin' })
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);
    if (error) throw error;
    toast('Promoted to admin.');
    return true;
  } catch (err) { console.error(err); toast(err.message || err); return false; }
}
export async function demoteToMember({ groupId, memberUserId }) {
  try {
    const { error } = await supabase
      .from('friend_group_members')
      .update({ role: 'member' })
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);
    if (error) throw error;
    toast('Demoted to member.');
    return true;
  } catch (err) { console.error(err); toast(err.message || err); return false; }
}

/* =========================
   Invites
========================= */

export async function sendInvite({ groupId, username }) {
  try {
    if (!groupId || !username) throw new Error('groupId and username required');

    const inviter = await getMyUserId();
    const invitee = await getUserIdByUsername(username);

    // Upsert-like: if pending exists, short-circuit
    const { data: existing } = await supabase
      .from('friend_group_invites')
      .select('id,status')
      .eq('group_id', groupId)
      .eq('invitee_id', invitee)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing?.id) {
      toast('Invite already pending.');
      return true;
    }

    // Create invite (RLS: owner/admin allowed by your new policy)
    const { error } = await supabase
      .from('friend_group_invites')
      .insert([{ group_id: groupId, inviter_id: inviter, invitee_id: invitee, status: 'pending' }], { returning: 'minimal' });

    if (error) throw error;

    // Post-commit: notify invitee (in-app + email)
    notifyGroupInvite({ invitee_id: invitee, groupId, inviter_id: inviter }); // fire & forget

    toast('Invite sent.');
    return true;
  } catch (err) {
    console.error(err);
    toast(`Invite failed: ${err.message || err}`);
    return false;
  }
}


export async function listInvites(groupId) {
  const { data, error } = await supabase
    .from('friend_group_invites')
    .select('id, invitee_id, status, created_at')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function revokeInvite({ inviteId }) {
  const { error } = await supabase
    .from('friend_group_invites')
    .update({ status: 'revoked', responded_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw error;
  toast('Invite revoked.');
  return true;
}

// For the invitee (expose globally for dashboard header badge or elsewhere)
export async function listMyPendingInvites() {
  const me = await getMyUserId();
  const { data, error } = await supabase
    .from('friend_group_invites')
    .select('id, group_id, inviter_id, status, created_at')
    .eq('invitee_id', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function acceptInvite({ inviteId }) {
  const me = await getMyUserId();
  const { data: inv, error: invErr } = await supabase
    .from('friend_group_invites')
    .select('group_id, invitee_id, status')
    .eq('id', inviteId).maybeSingle();
  if (invErr) throw invErr;
  if (!inv || inv.status !== 'pending' || inv.invitee_id !== me) throw new Error('Invite not valid.');

  // idempotent insert
  const { data: existing } = await supabase
    .from('friend_group_members')
    .select('user_id').eq('group_id', inv.group_id).eq('user_id', me).maybeSingle();
  if (!existing?.user_id) {
    const { error: insErr } = await supabase
      .from('friend_group_members')
      .insert([{ group_id: inv.group_id, user_id: me, role: 'member' }], { returning: 'minimal' });
    if (insErr) throw insErr;
  }

  const { error } = await supabase
    .from('friend_group_invites')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw error;
  toast('Invite accepted.');
  return true;
}

export async function declineInvite({ inviteId }) {
  const me = await getMyUserId();
  const { data: inv, error: invErr } = await supabase
    .from('friend_group_invites')
    .select('invitee_id, status')
    .eq('id', inviteId).maybeSingle();
  if (invErr) throw invErr;
  if (!inv || inv.status !== 'pending' || inv.invitee_id !== me) throw new Error('Invite not valid.');
  const { error } = await supabase
    .from('friend_group_invites')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw error;
  toast('Invite declined.');
  return true;
}

/* =========================
   Dropdown + search utils (for Invite modal)
========================= */

// Debounce utility
function debounce(fn, delay = 250) {
  let t = 0;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function ensureDropdownContainer(anchorEl) {
  let dd = document.getElementById('invite-suggest-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'invite-suggest-dropdown';
    dd.style.position = 'fixed';
    dd.style.zIndex = '3105';
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

// Search users by partial uname, filter excluded
async function searchUsersForInvite(fragment, excludeSet, limit = 8) {
  const q = (fragment || '').trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('users_extended_data')
    .select('user_id, username, profile_pic')
    .ilike('username', `%${q}%`)
    .order('username', { ascending: true })
    .limit(limit * 3);
  if (error) throw error;
  const filtered = (data || []).filter(r => !excludeSet.has(r.user_id));
  return filtered.slice(0, limit);
}

async function buildInviteSuggestRow(user, onChoose) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.justifyContent = 'space-between';
  row.style.padding = '10px 12px';
  row.style.gap = '12px';
  row.style.borderRadius = '10px';
  row.style.cursor = 'default';

  const left = document.createElement('div');
  left.style.display = 'flex';
  left.style.alignItems = 'center';
  left.style.gap = '12px';

  const img = document.createElement('img');
  img.src = resolveUserAvatarURL(user.profile_pic);
  img.alt = user.username || '';
  img.width = 36;
  img.height = 36;
  img.style.borderRadius = '50%';
  img.style.objectFit = 'cover';
  img.style.background = '#222';

  const uname = document.createElement('div');
  uname.innerHTML = `<strong>@${user.username || 'user'}</strong>`;

  left.appendChild(img);
  left.appendChild(uname);

  const inviteBtn = document.createElement('button');
  inviteBtn.textContent = 'Invite';
  inviteBtn.style.cssText = `
    background:#2563eb;color:#fff;border:1px solid #1d4ed8;
    padding:6px 10px;border-radius:9px;cursor:pointer;
  `;
  inviteBtn.addEventListener('click', (e) => { e.stopPropagation(); onChoose(user); });

  row.appendChild(left);
  row.appendChild(inviteBtn);

  row.addEventListener('mouseenter', () => { row.style.background = '#3a3a40'; });
  row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

  // Clicking row fills input
  row.addEventListener('click', () => onChoose(user, { fillOnly: true }));

  return row;
}

/* =========================
   Settings Modal (owner only)
========================= */

function closeModal(el) {
  if (!el) return;
  if (el._escHandler) document.removeEventListener('keydown', el._escHandler, true);
  el.remove();
}

async function openGroupSettingsModal(groupId, onSaved = null) {
  const g = await getGroupById(groupId);
  if (!g) { toast('Group not found.'); return; }

  const overlay = document.createElement('div');
  overlay.id = 'group-settings-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.45);
    z-index:3000; display:flex; align-items:center; justify-content:center;
  `;

  const imgCol = groupImageColumn(g);
  const allowCol = allowOffersColumn(g);
  const curImgUrl = resolveGroupImageURL(g);

  const modal = document.createElement('div');
  modal.style.cssText = `
    width:min(560px, 92vw); background:rgb(47,47,52);
    border:1px solid #444; border-radius:14px; box-shadow:0 10px 28px rgba(0,0,0,.35);
    padding:16px; color:#ddd;
  `;
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <strong style="font-size:1.05rem">Group Settings</strong>
      <button id="gs-close" style="background:red;color:#fff;border:1px solid #444;padding:6px 10px;border-radius:8px;cursor:pointer;box-shadow:none;">Close</button>
    </div>

    <div style="display:flex; gap:12px; align-items:center; margin-bottom:10px;">
      <img id="gs-current-img" src="${curImgUrl}" alt="${g.name}" width="64" height="64"
           style="border-radius:10px; object-fit:cover; background:#222;" />
      <div style="flex:1;">
        <label style="display:block;margin-bottom:6px;">Change Image</label>
        <input id="gs-image" type="file" accept="image/*" />
      </div>
    </div>

    <div style="display:grid;grid-template-columns: 1fr; gap:10px;">
      <div>
        <label>Name</label>
        <input id="gs-name" type="text" value="${escapeHtml(g.name || '')}" style="width:70%;padding:8px;border-radius:8px;border:1px solid #555;background:#2e2e33;color:#eee;">
      </div>
      <div>
        <label>Description</label>
        <textarea id="gs-desc" rows="3" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#2e2e33;color:#eee;">${escapeHtml(g.description || '')}</textarea>
      </div>
      <div>
        <label>Visibility</label>
        <select id="gs-visibility" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#2e2e33;color:#eee;">
          ${['private','friends','public'].map(v => `<option value="${v}" ${g.visibility===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      ${allowOffersColumn(g) ? `
      <label style="display:flex;align-items:center;gap:8px;">
        <input id="gs-allow" type="checkbox" ${g.allow_offers ? 'checked' : ''} />
        Allow Offers
      </label>` : ''}
    </div>

    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
      <button id="gs-save" style="background:#2563eb;color:#fff;border:1px solid #1d4ed8;padding:8px 12px;border-radius:9px;cursor:pointer;">Save</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close handlers
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
  modal.querySelector('#gs-close').addEventListener('click', () => closeModal(overlay));
  const handleEscClose = (e) => { if (e.key === 'Escape') closeModal(overlay); };
  overlay._escHandler = handleEscClose;
  document.addEventListener('keydown', handleEscClose, true);

  // Save
  modal.querySelector('#gs-save').addEventListener('click', async () => {
    try {
      const name = modal.querySelector('#gs-name').value.trim();
      const description = modal.querySelector('#gs-desc').value.trim();
      const visibility = modal.querySelector('#gs-visibility').value;
      const imgInput = modal.querySelector('#gs-image');
      const imageFile = (imgInput?.files && imgInput.files[0]) ? imgInput.files[0] : null;

      const patch = {};
      if (name !== (g.name || '')) patch.name = name;
      if (description !== (g.description || '')) patch.description = description;
      if (visibility !== (g.visibility || 'private')) patch.visibility = visibility;

      if (allowOffersColumn(g)) {
        const allow = modal.querySelector('#gs-allow').checked;
        if (allow !== !!g.allow_offers) patch['allow_offers'] = allow;
      }

      await updateGroupSettings({ groupId, patch, imageFile });
      toast('Group settings updated.');
      closeModal(overlay);
      if (onSaved) await onSaved();
    } catch (err) {
      console.error(err);
      toast(`Save failed: ${err.message || err}`);
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* =========================
   Rendering (UI)
========================= */
/* =========================
   Member Actions Modal (admin/owner)
   - Opens when an admin/owner clicks a member's avatar
   - Uses existing helpers: getUserBasics, resolveUserAvatarURL,
     and membership actions: promoteToAdmin, demoteToMember, removeMember
========================= */
async function openMemberActionsModal({ groupId, member, myId, iAmOwner, iAmAdmin, containerEl }) {
  // member: { user_id, role }
  const { username, profile_pic } = await getUserBasics(member.user_id);

  // Permissions mirror the old inline buttons logic
  const canPromote = (iAmOwner && member.user_id !== myId) ||
                     (!iAmOwner && iAmAdmin && member.role === 'member' && member.user_id !== myId);
  const canDemote  = (iAmOwner && member.user_id !== myId && member.role === 'admin');
  const canRemove  = (iAmOwner && member.user_id !== myId) ||
                     (iAmAdmin && !iAmOwner && member.role === 'member' && member.user_id !== myId);

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.45);
    z-index:3100; display:flex; align-items:center; justify-content:center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    width:min(520px, 92vw); background:rgb(47,47,52);
    border:1px solid #444; border-radius:14px; box-shadow:0 10px 28px rgba(0,0,0,.35);
    padding:16px; color:#ddd;
  `;
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <strong style="font-size:1.05rem">Member actions</strong>
      <button id="ma-close" style="background:red;color:#fff;border:1px solid #444;padding:6px 10px;border-radius:8px;cursor:pointer;box-shadow:none;">Close</button>
    </div>

    <div style="display:flex; gap:12px; align-items:center; margin-bottom:14px;">
      <img src="${resolveUserAvatarURL(profile_pic)}" alt="@${username}" width="64" height="64"
           style="border-radius:50%; object-fit:cover; background:#222;" />
      <div>
        <div><strong>@${username}</strong></div>
        <div class="muted">Current role: <strong>${member.role}</strong></div>
      </div>
    </div>

    <div id="ma-actions" style="display:flex; flex-direction:column; gap:8px;">
      ${canPromote && member.role === 'member' ? `
        <button id="ma-promote" style="background:#0e4597;color:#fff;border:1px solid #178a41;padding:8px 10px;border-radius:8px;cursor:pointer;">Promote to admin</button>
      ` : ''}

      ${canDemote && member.role === 'admin' ? `
        <button id="ma-demote" style="background:#f59e0b;color:#222;border:1px solid #b45309;padding:8px 10px;border-radius:8px;cursor:pointer;">Demote to member</button>
      ` : ''}

      <button id="ma-remove" ${canRemove ? '' : 'disabled'}
        style="background:#c62828;color:#fff;border:1px solid #a61f1f;padding:8px 10px;border-radius:8px;cursor:${canRemove?'pointer':'not-allowed'};opacity:${canRemove?1:.6};">
        Remove from group
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => {
    document.removeEventListener('keydown', esc, true);
    overlay.remove();
  };
  modal.querySelector('#ma-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc, true);

  // Actions
  const refresh = async () => { await renderGroupMembersBlock(groupId, containerEl); };

  const btnPromote = modal.querySelector('#ma-promote');
  if (btnPromote) btnPromote.addEventListener('click', async () => {
    await promoteToAdmin({ groupId, memberUserId: member.user_id });
    await refresh(); close();
  });

  const btnDemote = modal.querySelector('#ma-demote');
  if (btnDemote) btnDemote.addEventListener('click', async () => {
    await demoteToMember({ groupId, memberUserId: member.user_id });
    await refresh(); close();
  });

  const btnRemove = modal.querySelector('#ma-remove');
  if (btnRemove && !btnRemove.disabled) btnRemove.addEventListener('click', async () => {
    await removeMember({ groupId, memberUserId: member.user_id });
    await refresh(); close();
  });
}

// Track currently open group in the members panel for toggle behavior
let openMembers = { groupId: null, container: null };

export async function renderGroupsUI(opts = {}) {
  const listEl    = document.getElementById(opts.groupListId   || 'groups-list');
  const membersEl = document.getElementById(opts.groupMembersId || 'groups-members');

  try {
    const myId  = await getMyUserId();
    const groups = await listMyGroups(); // your existing helper (owner's groups)

    // --- Aggregate pending/active offers for these groups in one call ---
    const groupIds = groups.map(g => g.id).filter(Boolean);
    const countsByGroup = {}; // { [groupId]: { pending: number, active: number } }
    if (groupIds.length) {
      const { data: offerRows, error: offersErr } = await supabase
        .from('group_offers')
        .select('group_id, status')
        .in('group_id', groupIds);

      if (offersErr) throw offersErr;

      (offerRows || []).forEach(row => {
        const gid = row.group_id;
        const s   = (row.status || '').toLowerCase();
        if (!countsByGroup[gid]) countsByGroup[gid] = { pending: 0, active: 0 };
        if (s === 'pending') countsByGroup[gid].pending++;
        else if (s === 'active') countsByGroup[gid].active++;
      });
    }

    // --- Render list ---
    if (listEl) {
      listEl.innerHTML = '';
      for (const g of groups) {
        const ownerName = await usernameForUserId(g.owner_id);
        const imgUrl    = resolveGroupImageURL(g);
        const cts       = countsByGroup[g.id] || { pending: 0, active: 0 };

        const pill = (label, bg, border, color='#111') =>
          `<small style="margin-left:6px;padding:2px 8px;border:1px solid ${border};border-radius:999px;color:${color};background:${bg};font-weight:600;display:inline-flex">${label}</small>`;

        const pendingPill = cts.pending > 0
          ? pill(`pending ${cts.pending}`, '#F6C62E', '#b48a0a')
          : '';

        const activePill  = cts.active > 0
          ? pill(`active ${cts.active}`, '#50ffa4', '#1c8c57')
          : '';

        const allowOffersPill = (allowOffersColumn(g) && g.allow_offers)
          ? pill('offers on', '#1f3825', '#3b824e', '#9be7ae')
          : '';

        const row = document.createElement('div');
        row.className = 'card';
        row.style.margin = '8px 0';
        row.innerHTML = `
          <div class="card-body" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <img data-role="group-image" src="${imgUrl}" alt="${g.name}" width="65" height="65"
                   style="border-radius:8px;object-fit:cover;background:#222;" />
              <div style="text-align:left;">
                <div>
                  <strong>${g.name}</strong>
                  <small style="opacity:.7;display:inline-flex!important">(${g.visibility})</small>
                  ${allowOffersPill}
                  ${pendingPill}
                  ${activePill}
                </div>
                <div class="muted">@${ownerName}</div>
                ${g.description ? `<div style="margin-top:4px;">${g.description}</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap;">
              <button class="btn-view" data-id="${g.id}" style="
                background:#6b7280;color:#fff;border:1px solid #4b5563;
                padding:7px 12px;border-radius:9px;cursor:pointer;box-shadow:none;">View</button>
              <button class="btn-del" data-id="${g.id}" style="
                background:#c62828;color:#fff;border:1px solid #a61f1f;
                padding:7px 12px;border-radius:9px;cursor:pointer;box-shadow:none;">Delete</button>
            </div>
          </div>
        `;
        listEl.appendChild(row);

        // Owner can click image to open settings modal
        const imgEl = row.querySelector('img[data-role="group-image"]');
        if (g.owner_id === myId) {
          imgEl.style.cursor = 'pointer';
          imgEl.title = 'Edit group settings';
          imgEl.addEventListener('click', async () => {
            await openGroupSettingsModal(g.id, async () => { await renderGroupsUI(opts); });
          });
        }
      }

     // Wire buttons (view/delete with proper toggle behavior)
listEl.querySelectorAll('.btn-view').forEach(btn => {
  btn.addEventListener('click', async () => {
    const gid = btn.getAttribute('data-id');

    // If this group is already open → toggle CLOSED (members + offers)
    if (openMembers.groupId === gid && openMembers.container === membersEl) {
      membersEl.innerHTML = '';
      hideGroupOffersSection();
      openMembers = { groupId: null, container: null };
      return;
    }

    // Otherwise open this group's members + offers
    await renderGroupMembersBlock(gid, membersEl);
    showGroupOffersFor(gid);
    openMembers = { groupId: gid, container: membersEl };
  });
});

listEl.querySelectorAll('.btn-del').forEach(btn => {
  btn.addEventListener('click', async () => {
    const gid = btn.getAttribute('data-id');
    await deleteGroup({ groupId: gid });

    // If the deleted group was open, close both panes
    if (openMembers.groupId === gid && openMembers.container) {
      openMembers.container.innerHTML = '';
      hideGroupOffersSection();
      openMembers = { groupId: null, container: null };
    }
    await renderGroupsUI(opts);
  });
});

    }
  } catch (err) {
    console.error(err);
    toast(`Groups UI error: ${err.message || err}`);
  }
}


/* ------- Members block (avatars clickable for admin actions; shows user badges) ------- */
async function renderGroupMembersBlock(groupId, containerEl) {
  if (!containerEl) return;
  containerEl.setAttribute('data-group-id', groupId); // so other modules can detect current group
  containerEl.innerHTML = '';
  try {
    const g = await getGroupById(groupId);
    if (!g) {
      containerEl.innerHTML = '<div class="card"><div class="card-body">Group not found.</div></div>';
      return;
    }
    const myId = await getMyUserId();
    const members = await listGroupMembers(groupId);
    const myRow = members.find(m => m.user_id === myId);
    const iAmOwner = g.owner_id === myId;
    const iAmAdmin = iAmOwner || myRow?.role === 'admin';

    const excludeSet = new Set(members.map(m => m.user_id));
    excludeSet.add(g.owner_id); // don’t suggest owner for invites

    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.innerHTML = `
      <div class="card-header" style="margin-bottom:15px;"><strong>${g.name}</strong> members</div>
      <div class="card-body">
        <div id="gm-list" style="
          display:grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap:50px; align-items:stretch;
        "></div>

        <div id="gm-actions" style="margin-top:14px; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;padding-top:30px;">
          <button id="gm-invite-btn" type="button" style="
            background:#2563eb;color:#fff;border:1px solid #1d4ed8;box-shadow:none;
            padding:7px 12px;border-radius:9px;cursor:pointer;">Invite</button>
        </div>

        <div id="gm-pending" style="margin-top:12px;"></div>
      </div>
    `;
    containerEl.appendChild(wrap);

    // Render members as cards (no inline action buttons)
    const list = wrap.querySelector('#gm-list');
    list.innerHTML = members.length ? '' : '<div class="muted">No members yet.</div>';

    for (const m of members) {
      const { username, profile_pic } = await getUserBasics(m.user_id);

      const card = document.createElement('div');
      card.style.cssText = `
        background:#2f2f34; border:1px solid #444; border-radius:12px;
        padding:12px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px;
        min-height: 160px; height: 100%;width: 180px; min-
      `;

      const img = document.createElement('img');
      img.src = resolveUserAvatarURL(profile_pic);
      img.alt = username || '';
      img.width = 72; img.height = 72;
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      img.style.background = '#222';

      // If admin/owner and not myself, clicking avatar opens the actions modal
      if ((iAmOwner || iAmAdmin) && m.user_id !== myId) {
        img.style.cursor = 'pointer';
        img.title = 'Member actions';
        img.addEventListener('click', () => openMemberActionsModal({
          groupId, member: m, myId, iAmOwner, iAmAdmin, containerEl
        }));
      }

      const nameEl = document.createElement('div');
      nameEl.innerHTML = `@${username} <small class="muted">(${m.role})</small>`;
      nameEl.style.wordBreak = 'break-word';

      // Badges slot
      const badgeSlotId = `gm-badges-${groupId}-${m.user_id}`;
      const badgesEl = document.createElement('div');
      badgesEl.id = badgeSlotId;
      badgesEl.className = 'gm-badges';
      badgesEl.style.cssText = 'margin-top:6px; min-height:28px;';

      // Optional hint for admins
      if ((iAmOwner || iAmAdmin) && m.user_id !== myId) {
        const hint = document.createElement('div');
        hint.className = 'muted';
        hint.style.fontSize = '.82rem';
        hint.textContent = 'Click avatar for actions';
        card.appendChild(hint);
      }

      // Compose card
      card.prepend(img);
      card.appendChild(nameEl);
      card.appendChild(badgesEl);
      list.appendChild(card);

      // Inject badges (uses badges.js). We pass sponsee_email because members are creators.
      try {
        const email = await getUserEmailById(m.user_id);
        const Badges = await _badges();
        if (Badges?.injectUserBadge && email) {
          // emailField 'sponsee_email' matches how private_offers rows are written for creators
          Badges.injectUserBadge(email, `#${badgeSlotId}`, 'sponsee_email');
        }
      } catch (e) {
        console.warn('Badge inject failed for', m.user_id, e?.message || e);
      }
    }

    // Invite modal
    wrap.querySelector('#gm-invite-btn').addEventListener('click', () =>
      openInviteModal({
        groupId,
        excludeSet,
        onDone: async () => { await renderGroupMembersBlock(groupId, containerEl); }
      })
    );

    // Pending invites summary
    const pendingWrap = wrap.querySelector('#gm-pending');
    try {
      const pending = await listInvites(groupId);
      pendingWrap.innerHTML = pending.length ? `<div class="muted">Pending invites: ${pending.length}</div>` : '';
    } catch {}
  } catch (err) {
    console.error(err);
    containerEl.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message || err}</div></div>`;
  }
}



/* ---------- Combined Invite Modal (single + bulk, with typeahead) ---------- */
function openInviteModal({ groupId, excludeSet, onDone }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;z-index:3100;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;`;

  const modal = document.createElement('div');
  modal.style.cssText = `width:min(640px,92vw);background:#2f2f34;border:1px solid #444;border-radius:14px;box-shadow:0 10px 28px rgba(0,0,0,.35);padding:16px;color:#ddd;`;
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <strong>Invite members</strong>
      <button id="iv-close" style="background:red;color:#fff;border:1px solid #444;padding:6px 10px;border-radius:8px;cursor:pointer;box-shadow:none;">Close</button>
    </div>

    <!-- Single invite -->
    <div>
      <div class="muted" style="margin-bottom:6px;">Search or type an @username</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <input id="iv-username" type="text" placeholder="@username" style="flex:1;padding:8px;border-radius:8px;border:1px solid #555;background:#212126;color:#eee;" autocomplete="off">
        <button id="iv-send" style="background:#2563eb;color:#fff;border:1px solid #1d4ed8;padding:8px 12px;border-radius:9px;cursor:pointer;">Invite</button>
      </div>
    </div>

    <details id="iv-bulk" style="margin-top:8px;">
      <summary style="cursor:pointer;outline:none;">Bulk invite</summary>
      <div class="muted" style="margin:8px 0 6px;">Paste @usernames separated by spaces, commas, or new lines.</div>
      <textarea id="bi-input" rows="5" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#212126;color:#eee;"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
        <button id="bi-run" style="background:#6b7280;color:#fff;border:1px solid #4b5563;padding:8px 12px;border-radius:9px;cursor:pointer;">Send invites</button>
      </div>
    </details>

    <hr style="border-color:#444;margin:14px 0;">
    <div><strong>Pending invites</strong></div>
    <div id="iv-list" style="margin-top:8px;"></div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  modal.querySelector('#iv-close').addEventListener('click', close);

  // ---- Typeahead dropdown wiring (same pattern as before) ----
  const single = modal.querySelector('#iv-username');
  const sendBtn = modal.querySelector('#iv-send');

  function ensureDropdownContainer(anchorEl) {
    let dd = document.getElementById('invite-suggest-dropdown');
    if (!dd) {
      dd = document.createElement('div');
      dd.id = 'invite-suggest-dropdown';
      dd.style.position = 'fixed';
      dd.style.zIndex = '3105';
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
    const r = anchorEl.getBoundingClientRect();
    dd.style.left = `${r.left}px`;
    dd.style.top  = `${r.bottom + 6}px`;
    dd.style.width = `${Math.max(r.width, 260)}px`;
    return dd;
  }
  const showDropdown = (dd) => dd.style.display = 'block';
  const hideDropdown = (dd) => { dd.style.display = 'none'; dd.innerHTML = ''; };
  const debounce = (fn, delay = 220) => { let t=0; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; };

  async function searchUsersForInvite(fragment, excludeSet, limit = 8) {
    const q = (fragment || '').trim();
    if (!q) return [];
    const { data, error } = await supabase
      .from('users_extended_data')
      .select('user_id, username, profile_pic')
      .ilike('username', `%${q}%`)
      .order('username', { ascending: true })
      .limit(limit * 3);
    if (error) throw error;
    const filtered = (data || []).filter(r => !excludeSet.has(r.user_id));
    return filtered.slice(0, limit);
  }
  function buildInviteSuggestRow(user, onChoose) {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 12px;gap:12px;border-radius:10px;cursor:default;`;
    const left = document.createElement('div');
    left.style.cssText = `display:flex;align-items:center;gap:12px;`;
    const img = document.createElement('img');
    img.src = resolveUserAvatarURL(user.profile_pic);
    img.alt = user.username || '';
    img.width = 36; img.height = 36;
    img.style.borderRadius = '50%'; img.style.objectFit = 'cover'; img.style.background = '#222';
    const uname = document.createElement('div');
    uname.innerHTML = `<strong>@${user.username || 'user'}</strong>`;
    left.appendChild(img); left.appendChild(uname);
    const btn = document.createElement('button');
    btn.textContent = 'Invite';
    btn.style.cssText = `background:#2563eb;color:#fff;border:1px solid #1d4ed8;padding:6px 10px;border-radius:9px;cursor:pointer;`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onChoose(user); });
    row.appendChild(left); row.appendChild(btn);
    row.addEventListener('mouseenter', () => { row.style.background = '#3a3a40'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
    row.addEventListener('click', () => onChoose(user, { fillOnly: true }));
    return row;
  }

  let dd;
  const debouncedSearch = debounce(async () => {
    const q = (single.value || '').trim();
    if (!q) { if (dd) hideDropdown(dd); return; }
    try {
      dd = ensureDropdownContainer(single);
      dd.innerHTML = `<div style="padding:8px 10px;color:#ccc;">Searching…</div>`;
      showDropdown(dd);

      const results = await searchUsersForInvite(q, excludeSet, 8);
      dd.innerHTML = '';
      if (!results.length) {
        dd.innerHTML = `<div style="padding:8px 10px;color:#aaa;">No matches.</div>`;
        return;
      }
      for (const user of results) {
        const row = buildInviteSuggestRow(user, async (u, opts = {}) => {
          if (opts?.fillOnly) {
            single.value = `@${u.username}`;
            single.focus();
            return;
          }
          await sendInvite({ groupId, username: `@${u.username}` });
          hideDropdown(dd);
          single.value = '';
          await renderPendingInvites();
          if (onDone) onDone();
        });
        dd.appendChild(row);
      }
      showDropdown(dd);
    } catch (err) {
      console.error(err);
      dd = ensureDropdownContainer(single);
      dd.innerHTML = `<div style="padding:8px 10px;color:#f88;">${err.message || err}</div>`;
      showDropdown(dd);
    }
  }, 220);

  single.addEventListener('input', debouncedSearch);
  single.addEventListener('focus', () => { if (single.value?.trim()) debouncedSearch(); });
  ['scroll', 'resize'].forEach(evt => {
    window.addEventListener(evt, () => {
      const el = document.getElementById('invite-suggest-dropdown');
      if (!el || el.style.display === 'none') return;
      const r = single.getBoundingClientRect();
      el.style.left = `${r.left}px`; el.style.top = `${r.bottom + 6}px`; el.style.width = `${Math.max(r.width, 260)}px`;
    }, { passive: true });
  });
  document.addEventListener('click', (e) => {
    const el = document.getElementById('invite-suggest-dropdown');
    if (!el || el.style.display === 'none') return;
    if (single.contains(e.target) || el.contains(e.target)) return;
    hideDropdown(el);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const el = document.getElementById('invite-suggest-dropdown'); if (el) hideDropdown(el); } });

  // manual single send
  sendBtn.addEventListener('click', async () => {
    const v = (single.value || '').trim();
    if (!v) return;
    await sendInvite({ groupId, username: v.startsWith('@') ? v : `@${v}` });
    single.value = '';
    hideDropdown(document.getElementById('invite-suggest-dropdown') || { style: { display: 'none' }, innerHTML: '' });
    await renderPendingInvites();
    if (onDone) onDone();
  });

  // bulk send
  modal.querySelector('#bi-run').addEventListener('click', async () => {
    const raw = modal.querySelector('#bi-input').value || '';
    const names = Array.from(new Set(raw
      .split(/[\s,]+/g)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.startsWith('@') ? s : '@'+s)
    ));
    if (!names.length) { toast('No usernames found.'); return; }

    let sent = 0, skip = 0, fail = 0;
    for (const u of names) {
      try {
        const uid = await getUserIdByUsername(u);
        if (excludeSet.has(uid)) { skip++; continue; }
        const ok = await sendInvite({ groupId, username: u });
        if (ok) sent++; else fail++;
      } catch { fail++; }
    }
    toast(`Invites: sent ${sent}${skip ? `, skipped existing ${skip}` : ''}${fail ? `, failed ${fail}` : ''}.`);
    await renderPendingInvites();
    if (onDone) onDone();
  });

  // pending list
  const listEl = modal.querySelector('#iv-list');
  async function renderPendingInvites() {
    listEl.innerHTML = `<div class="muted">Loading…</div>`;
    try {
      const rows = await listInvites(groupId);
      listEl.innerHTML = rows.length ? '' : `<div class="muted">No pending invites.</div>`;
      for (const r of rows) {
        const { username } = await getUserBasics(r.invitee_id);
        const row = document.createElement('div');
        row.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed #444;`;
        row.innerHTML = `
          <div>@${username} <small class="muted">(${r.status})</small></div>
          <div>
            <button data-id="${r.id}" class="iv-revoke" style="background:#c62828;color:#fff;border:1px solid #a61f1f;padding:6px 10px;border-radius:9px;cursor:pointer;">Revoke</button>
          </div>
        `;
        row.querySelector('.iv-revoke').addEventListener('click', async () => {
          await revokeInvite({ inviteId: r.id });
          await renderPendingInvites();
          if (onDone) onDone();
        });
        listEl.appendChild(row);
      }
    } catch (e) {
      listEl.innerHTML = `<div style="color:#f88;">${e.message || e}</div>`;
    }
  }
  renderPendingInvites();
}


/* ---------- Bulk Invite Modal ---------- */

function openBulkInviteModal({ groupId, excludeSet, onDone }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;z-index:3100;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;`;
  const modal = document.createElement('div');
  modal.style.cssText = `width:min(560px,92vw);background:#2f2f34;border:1px solid #444;border-radius:14px;box-shadow:0 10px 28px rgba(0,0,0,.35);padding:16px;color:#ddd;`;
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <strong>Bulk invite</strong>
      <button id="bi-close" style="background:red;color:#fff;border:1px solid #444;padding:6px 10px;border-radius:8px;cursor:pointer;box-shadow:none;">Close</button>
    </div>
    <div class="muted" style="margin-bottom:6px;">Paste @usernames separated by spaces, commas, or new lines.</div>
    <textarea id="bi-input" rows="6" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#212126;color:#eee;"></textarea>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
      <button id="bi-run" style="background:#6b7280;color:#fff;border:1px solid #4b5563;padding:8px 12px;border-radius:9px;cursor:pointer;">Send invites</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector('#bi-close').addEventListener('click', () => overlay.remove());
  modal.querySelector('#bi-run').addEventListener('click', async () => {
    const raw = modal.querySelector('#bi-input').value || '';
    const names = Array.from(new Set(raw
      .split(/[\s,]+/g)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.startsWith('@') ? s : '@'+s)
    ));
    if (!names.length) { toast('No usernames found.'); return; }

    let sent = 0, skip = 0, fail = 0;
    for (const u of names) {
      try {
        const uid = await getUserIdByUsername(u);
        if (excludeSet.has(uid)) { skip++; continue; }
        const ok = await sendInvite({ groupId, username: u });
        if (ok) sent++; else fail++;
      } catch { fail++; }
    }
    toast(`Invites: sent ${sent}${skip ? `, skipped existing ${skip}` : ''}${fail ? `, failed ${fail}` : ''}.`);
    overlay.remove();
    if (onDone) onDone();
  });
}

/* ---------- Wire-up ---------- */

document.addEventListener('DOMContentLoaded', () => {
  const createForm = document.getElementById('group-create-form');
  const nameInput  = document.getElementById('group-name');
  const descInput  = document.getElementById('group-desc');
  const visSelect  = document.getElementById('group-visibility');
  const imgInput   = document.getElementById('group-image'); // optional <input type="file" />
  const allowCb    = document.getElementById('group-allow-offers'); // optional <input type="checkbox" />

  if (createForm && nameInput) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (nameInput.value || '').trim();
      const description = (descInput?.value || '').trim();
      const visibility = (visSelect?.value || 'private');
      const imageFile  = (imgInput?.files && imgInput.files[0]) ? imgInput.files[0] : null;
      const allowOffers = !!(allowCb?.checked);

      const g = await createGroup({ name, description, visibility, imageFile, allowOffers });
      if (g) {
        nameInput.value = '';
        if (descInput) descInput.value = '';
        if (visSelect) visSelect.value = 'private';
        if (imgInput) imgInput.value = '';
        if (allowCb) allowCb.checked = false;
        await renderGroupsUI({});
      }
    });
  }

  if (document.getElementById('groups-list')) {
    renderGroupsUI({});
  }
});

window.FriendGroupsAPI = {
  createGroup,
  deleteGroup,
  updateGroup,
  listMyGroups,
  listGroupMembers,
  addMemberByUsername, // still available programmatically, but not exposed in UI
  removeMember,
  leaveGroup,
  promoteToAdmin,
  demoteToMember,
  sendInvite,
  listInvites,
  revokeInvite,
  listMyPendingInvites,
  acceptInvite,
  declineInvite,
  renderGroupsUI
};

// Allow other modules (groupOffers.js) to force-refresh the groups list
window.GroupsList = {
  refresh: () => renderGroupsUI({})
};


