// ./js/groupOffers.js
// Friends + Groups — Group Offers
// - Invites panel lives just ABOVE #groups-list
// - Group image: from storage bucket "group-logos/groups/<group_id>/<file>?cb=<ISO>"
//   Fallback: "grouplogo.png"
// - Accept flow only marks invite accepted AFTER membership insert OK; shows real errors
// - Post-commit notifications + best-effort email via alerts.js (no in-DB triggers)

import { supabase } from './supabaseClient.js';
import * as Alerts from './alerts.js';

// ---------- Safe helpers for alerts integration (fallbacks if not exported) ----------
const notifyOfferUpdate = Alerts?.notifyOfferUpdate || (async (payload) => {
  try {
    const { to_user_id, offer_id, title, message } = payload || {};
    await supabase.from('user_notifications').insert([{
      user_id: to_user_id,
      title: title || 'Update',
      message: message || '',
      related_offer_id: offer_id || null,
      is_read: false
    }]);
    await bestEffortEmail(to_user_id, title || 'Update', message || '');
  } catch (_) {}
});
const insertNotification = Alerts?.insertNotification || (async ({ notification_uuid, email, type, title, message, related_offer_id }) => {
  try {
    await supabase.from('user_notifications').insert([{
      notification_uuid: notification_uuid || null,
      email: email || null,
      type: type || 'info',
      title: title || '',
      message: message || '',
      related_offer_id: related_offer_id || null,
      is_read: false
    }]);
  } catch (_) {}
});
const getNotificationInfo = Alerts?.getNotificationInfo || (async (user_id) => {
  try {
    const { data, error } = await supabase
      .from('users_extended_data')
      .select('user_id, email')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error) return {};
    return { notification_uuid: user_id, email: data?.email || null };
  } catch (_) { return {}; }
});

async function bestEffortEmail(to_user_id, subject, text) {
  try {
    const info = await getNotificationInfo(to_user_id);
    const to = info?.email;
    if (!to) return;
    try {
      await supabase.functions.invoke('sendNotificationEmail', { body: { to, subject, text } });
    } catch (_) {}
  } catch (_) {}
}

// ---------- UI helpers ----------
const toast = (msg) => { try { console.log(msg); } catch {} };
const ALLOWED_STATUS = new Set(['pending', 'active', 'completed', 'cancelled']);

function $(sel){ return document.querySelector(sel); }
function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'dataset' && v && typeof v === 'object') {
      for (const dk in v) n.dataset[dk] = v[dk];
    } else if (k.startsWith('on') && typeof v === 'function') {
      n.addEventListener(k.slice(2), v);
    } else if (v !== undefined && v !== null) n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
}
function esc(v) {
  return (v == null ? '' : String(v))
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function btnStyle(bg='#F6C62E', fg='#111') {
  return `background:${bg};color:${fg};border:1px solid #444;padding:8px 12px;border-radius:10px;cursor:pointer;box-shadow:none;`;
}

// ---------- Images (offers) ----------
function publicUrlFromOffersBucket(path) {
  if (!path) return null;
  const { data } = supabase.storage.from('offers').getPublicUrl(path);
  return data?.publicUrl || null;
}
function normalizeImages(raw) {
  let arr = raw;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { arr = [arr]; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map(String).filter(Boolean);
}
function allImageUrls(offer) {
  const keys = normalizeImages(offer?.offer_images);
  return keys.map(publicUrlFromOffersBucket).filter(Boolean);
}
function imageGrid(urls, size = 120) {
  const box = el('div', { style: `display:grid;grid-template-columns:repeat(2,1fr);grid-auto-rows:${size/2}px;gap:6px;` });
  urls.slice(0,4).forEach(u => {
    box.append(el('img', {
      src: u, alt: 'offer image',
      style: `width:${size/2 - 3}px;height:${size/2 - 3}px;object-fit:cover;border-radius:8px;border:1px solid #333;`
    }));
  });
  return box;
}

// ---------- Group image lookup (bucket: group-logos) ----------
const groupLogoCache = new Map(); // group_id -> url or 'grouplogo.png'

function cacheBust(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cb=${encodeURIComponent(new Date().toISOString())}`;
}

async function listGroupLogoPath(groupId) {
  // Lists files under "group-logos/groups/<groupId>" and returns first (by name desc)
  try {
    const folder = `groups/${groupId}`;
    const { data, error } = await supabase.storage
      .from('group-logos')
      .list(folder, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'desc' } });
    if (error || !data?.length) return null;
    return `${folder}/${data[0].name}`;
  } catch {
    return null;
  }
}

async function resolveGroupImageUrl(groupId, groupRecord) {
  if (!groupId) return 'grouplogo.png';
  if (groupLogoCache.has(groupId)) return groupLogoCache.get(groupId);

  // 1) Direct absolute URL fields (if you already store it)
  const directUrl = [groupRecord?.logo_url, groupRecord?.image_url, groupRecord?.avatar_url, groupRecord?.image]
    .find(u => typeof u === 'string' && /^https?:/i.test(u));
  if (directUrl) {
    const final = cacheBust(directUrl);
    groupLogoCache.set(groupId, final);
    return final;
  }

  // 2) Relative path fields that belong to group-logos bucket
  const relPath = [groupRecord?.logo_path, groupRecord?.image_path, groupRecord?.avatar_path]
    .find(p => typeof p === 'string' && p && !/^https?:/i.test(p));
  if (relPath) {
    try {
      const { data } = supabase.storage.from('group-logos').getPublicUrl(relPath);
      const final = cacheBust(data?.publicUrl || 'grouplogo.png');
      groupLogoCache.set(groupId, final);
      return final;
    } catch {
      // fall through to 3)
    }
  }

  // 3) List the folder "group-logos/groups/<groupId>" and take latest by name desc
  const listedPath = await listGroupLogoPath(groupId);
  if (listedPath) {
    const { data } = supabase.storage.from('group-logos').getPublicUrl(listedPath);
    const final = cacheBust(data?.publicUrl || 'grouplogo.png');
    groupLogoCache.set(groupId, final);
    return final;
  }

  // 4) Fallback
  groupLogoCache.set(groupId, 'grouplogo.png');
  return 'grouplogo.png';
}

// ---------- Badges & layout ----------
function badge(status) {
  const s = (status || '').toLowerCase();
  const color = s==='pending' ? '#F6C62E' : s==='active' ? 'green' : s==='completed' ? '#6fe3d9' : s==='cancelled' ? '#ff7676' : '#ddd';
  return el('span', { style: 'display:inline-block;padding:2px 8px;border-radius:10px;margin-left:6px;background:'+color+';color:#222;font-size:.8rem;' }, s || '-');
}

// Build/ensure the host (offers area only — invites panel is handled separately now)
function ensureScaffold() {
  let host = $('#group-offers-host');
  if (!host) {
    host = el('div', { id: 'group-offers-host', style: 'width:min(1100px,96vw);margin:auto auto;' });
    document.body.prepend(host);
  }
  let tabs = $('#group-offer-tabs');
  if (!tabs) {
    tabs = el('div', { id: 'group-offer-tabs', style: 'display:flex;justify-content:center;gap:8px;margin:10px auto 8px auto;flex-wrap:wrap;' });
    host.append(tabs);
  }
  let container = $('#group-offers-container');
  if (!container) {
    container = el('div', { id: 'group-offers-container', style: 'margin:12px auto;display:block;' });
    host.append(container);
  }
  return { host, tabs, container };
}

// New: ensure the invites panel lives just ABOVE #groups-list
function ensureInvitesPanel() {
  let panel = $('#pending-group-invites');
  const gl = $('#groups-list');

  const panelProps = {
    id: 'pending-group-invites',
    style: 'margin:8px 0 16px 0;padding:12px;border:1px solid #233;border-radius:12px;background:#0a1020;color:#e9f1ff;display:none;'
  };

  if (gl) {
    if (!panel) panel = el('div', panelProps);
    const parent = gl.parentElement || document.body;
    if (panel.parentElement !== parent || panel.nextElementSibling !== gl) {
      parent.insertBefore(panel, gl); // anchor directly before the groups list
    }
    return panel;
  }

  // Fallback: if #groups-list not present yet, attach to host so it's visible
  const { host } = ensureScaffold();
  if (!panel) panel = el('div', panelProps);
  if (panel.parentElement !== host) host.append(panel);
  return panel;
}

// ---------- Auth & usernames ----------
async function getMyUser() {
  const { data } = await supabase.auth.getSession();
  const u = data?.session?.user;
  return { id: u?.id || null, email: u?.email || null };
}
async function usernamesByIds(ids) {
  if (!ids?.length) return {};
  const { data, error } = await supabase.from('users_extended_data').select('user_id, username').in('user_id', ids);
  if (error) return {};
  const map = {};
  (data || []).forEach(r => { map[r.user_id] = r.username; });
  return map;
}
async function usernameOf(uid) {
  const m = await usernamesByIds([uid]);
  return m[uid] || '';
}
async function getMyRoleInGroup(groupId) {
  const me = await getMyUser();
  const { data, error } = await supabase
    .from('friend_group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', me.id)
    .maybeSingle();
  if (error) return { isMember:false, isAdmin:false, role:null };
  const role = (data?.role || '').toLowerCase();
  return { isMember: !!data, isAdmin: ['owner','admin'].includes(role), role };
}

// ---------- Data: offers/members/responses ----------
async function loadGroupOffers(groupId) {
  const { data, error } = await supabase
    .from('group_offers')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending:false });
  if (error) throw error;
  const list = Array.isArray(data) ? data : [];
  list.forEach(o => o.status = (o.status || 'pending').toLowerCase());
  return list;
}
async function loadResponses(groupId) {
  const { data, error } = await supabase
    .from('group_offer_responses')
    .select('id, offer_id, member_user_id, status, private_offer_id, accepted_at, rejected_at, completed_at, live_url')
    .eq('group_id', groupId);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
async function loadMembers(groupId) {
  const { data, error } = await supabase
    .from('friend_group_members')
    .select('user_id, role')
    .eq('group_id', groupId)
    .order('joined_at', { ascending:true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ---------- Pending Group Invites (schema-aligned) ----------
async function loadPendingInvitesForMe(myUserId) {
  if (!myUserId) return [];
  const { data, error } = await supabase
    .from('friend_group_invites')
    .select('id, group_id, inviter_id, invitee_id, status, created_at, responded_at')
    .eq('invitee_id', myUserId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) { console.warn('Invite load failed:', error.message); return []; }
  return data || [];
}
async function loadGroupsMeta(groupIds) {
  if (!groupIds?.length) return {};
  // Pull * because image fields may vary; we'll list storage anyway if absent.
  const { data, error } = await supabase
    .from('friend_groups')
    .select('*')
    .in('id', groupIds);
  if (error) { console.warn('Groups meta failed:', error.message); return {}; }
  const map = {};
  (data || []).forEach(g => { map[g.id] = g; });
  return map;
}

// Broadcast so external groups list can refresh (if present)
function refreshGroupsListUI(groupIdOptional) {
  try { window.dispatchEvent(new CustomEvent('groups:list:refresh', { detail: { groupId: groupIdOptional || null } })); } catch {}
  try { if (window.GroupsList?.refresh) window.GroupsList.refresh(); } catch {}
}

// Accept/decline invite with defensive error handling
async function acceptInvite(inv, myUser) {
  // Use INSERT (cleaner RLS) and allow duplicate (already member) via code 23505
  const { error: memberErr } = await supabase
    .from('friend_group_members')
    .insert([{
      group_id: inv.group_id,
      user_id: myUser.id,
      role: 'member'
    }]);

  if (memberErr && memberErr.code !== '23505') {
    console.warn('Join failed:', memberErr);
    throw new Error(memberErr?.message || 'Permission denied (RLS) joining group.');
  }

  // Invite -> accepted
  await supabase
    .from('friend_group_invites')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', inv.id);

  // Notify inviter
  const meName = await usernameOf(myUser.id);
  await notifyOfferUpdate({
    to_user_id: inv.inviter_id,
    offer_id: null,
    type: 'group_invite',
    title: 'Group Invitation Accepted',
    message: `${meName ? '@'+meName : 'A user'} accepted your group invite.`
  });

  // Ask groups list to update
  refreshGroupsListUI(inv.group_id);
}

async function declineInvite(inv, myUser) {
  const { error } = await supabase
    .from('friend_group_invites')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', inv.id);
  if (error) throw error;

  const meName = await usernameOf(myUser.id);
  await notifyOfferUpdate({
    to_user_id: inv.inviter_id,
    offer_id: null,
    type: 'group_invite',
    title: 'Group Invitation Declined',
    message: `${meName ? '@'+meName : 'A user'} declined your group invite.`
  });
}

async function renderPendingInvites(panel, invites, groupsMap, usernames, onAction) {
  panel.innerHTML = '';
  if (!invites?.length) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const header = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;' }, [
    el('div', { style: 'font-weight:700;font-size:1.05rem;' }, `Group Invites — Pending (${invites.length})`),
    el('button', { style: btnStyle('#1f2937','#e9f1ff') }, 'Hide')
  ]);
  header.lastChild.addEventListener('click', () => { panel.style.display = 'none'; });

  const body = el('div', { style: 'margin-top:10px;display:grid;grid-template-columns:1fr;gap:10px;' });

  // Make one DOM pass quickly, then resolve images async to keep UI snappy
  invites.forEach(inv => {
    const g = groupsMap[inv.group_id] || {};
    const inviterName = usernames[inv.inviter_id] ? '@' + usernames[inv.inviter_id] : '(unknown)';

    const row = el('div', { style: 'display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;border:1px solid #1f2b3f;border-radius:10px;padding:10px;background:#000;' });

    const avatar = el('img', {
      src: 'grouplogo.png', // default while we resolve actual image
      alt: 'group',
      style: 'width:65px;height:65px;object-fit:cover;border-radius:8px;background:#111;'
    });

    // Resolve actual image now
    (async () => {
      try {
        const url = await resolveGroupImageUrl(inv.group_id, g);
        avatar.src = url || 'grouplogo.png';
      } catch {
        avatar.src = 'grouplogo.png';
      }
    })();

    const left = el('div', {}, [
      el('div', { style: 'font-size:1rem;color:#e6f1ff;font-weight:600;' }, esc(g.name || g.title || 'Untitled Group')),
      el('div', { style: 'font-size:.9rem;color:#9ad1ff;margin-top:2px;' }, `Invited by ${inviterName} • ${fmtDate(inv.created_at)}`),
      g.description ? el('div', { style: 'font-size:.85rem;color:#bcd;margin-top:6px;' }, esc(g.description)) : null
    ].filter(Boolean));

    const right = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;' });
    const acceptBtn = el('button', { style: btnStyle('green','#fff') }, 'Accept');
    const declineBtn = el('button', { style: btnStyle('red','#fff') }, 'Decline');
    acceptBtn.addEventListener('click', () => onAction('accept', inv));
    declineBtn.addEventListener('click', () => onAction('decline', inv));
    right.append(acceptBtn, declineBtn);

    row.append(avatar, left, right);
    body.append(row);
  });

  panel.append(header, body);
}

// ---------- Realtime ----------
function subscribeGroup(groupId, onChange) {
  try {
    const ch1 = supabase
      .channel(`grp_offers_${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_offers', filter: `group_id=eq.${groupId}` }, () => onChange?.())
      .subscribe();
    const ch2 = supabase
      .channel(`grp_offer_responses_${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_offer_responses', filter: `group_id=eq.${groupId}` }, () => onChange?.())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  } catch (e) { console.warn('Realtime subscribe failed:', e); return () => {}; }
}

// ---------- Accept/Reject offer ----------
async function acceptOfferForMember({ offer, groupId, me, usernames }) {
  const payload = {
    group_id: groupId,
    offer_id: offer.id,
    member_user_id: me.id,
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    rejected_at: null
  };
  const { data: respRows, error: respErr } = await supabase
    .from('group_offer_responses')
    .upsert([payload], { onConflict: 'offer_id,member_user_id', ignoreDuplicates: false })
    .select()
    .limit(1);
  if (respErr) throw respErr;
  const response = respRows?.[0];

  if (!response?.private_offer_id) {
    const sponsee_username = usernames[me.id] || (await usernameOf(me.id)) || '';
    const sponsee_email = me.email || null;

    const privatePayload = {
      sponsor_id: offer.sponsor_id || null,
      sponsor_username: offer.sponsor_username || null,
      sponsor_email: offer.sponsor_email || null,
      sponsor_company: offer.sponsor_company || null,
      sponsee_username, sponsee_email,
      offer_title: offer.offer_title || null,
      offer_description: offer.offer_description || null,
      offer_amount: offer.offer_amount || null,
      offer_images: normalizeImages(offer.offer_images),
      platforms: Array.isArray(offer.platforms) ? offer.platforms : null,
      job_type: offer.job_type || null,
      deliverable_type: offer.deliverable_type || null,
      payment_schedule: offer.payment_schedule || null,
      sponsorship_duration: offer.sponsorship_duration || null,
      deadline: offer.deadline || null,
      instructions: offer.instructions || null,
      optional_file: offer.optional_file || null,
      creation_date: new Date().toISOString().slice(0,10),
      status: 'accepted',
      active: true,
      group_offer: true,
      stage: 3
    };
    const { data: poRows, error: poErr } = await supabase
      .from('private_offers')
      .insert([privatePayload])
      .select('id')
      .limit(1);
    if (!poErr && poRows && poRows[0]) {
      await supabase.from('group_offer_responses').update({ private_offer_id: poRows[0].id }).eq('id', response.id);
    }
  }

  try {
    if (offer?.sponsor_id) {
      const uname = (await usernameOf(me.id)) || 'A member';
      await notifyOfferUpdate({
        to_user_id: offer.sponsor_id,
        offer_id: offer.id,
        type: 'group_offer_response',
        title: 'Group Offer Accepted',
        message: `${uname} accepted your group offer “${offer.offer_title || 'Offer'}”.`
      });
    }
  } catch (nerr) { console.warn('notifyOfferUpdate (accept) failed:', nerr?.message || nerr); }
}
async function rejectOfferForMember({ offer, groupId, me }) {
  const { error } = await supabase
    .from('group_offer_responses')
    .upsert([{
      group_id: groupId,
      offer_id: offer.id,
      member_user_id: me.id,
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      accepted_at: null
    }], { onConflict: 'offer_id,member_user_id', ignoreDuplicates: false });
  if (error) throw error;

  try {
    if (offer?.sponsor_id) {
      const uname = (await usernameOf(me.id)) || 'A member';
      await notifyOfferUpdate({
        to_user_id: offer.sponsor_id,
        offer_id: offer.id,
        type: 'group_offer_response',
        title: 'Group Offer Declined',
        message: `${uname} declined your group offer “${offer.offer_title || 'Offer'}”.`
      });
    }
  } catch (nerr) { console.warn('notifyOfferUpdate (reject) failed:', nerr?.message || nerr); }
}

// ---------- NEW: Completion reconciliation + deadline finalization ----------
async function _loadResponsesForOfferId(offerId) {
  const { data, error } = await supabase
    .from('group_offer_responses')
    .select('id, offer_id, member_user_id, status, private_offer_id, completed_at, live_url')
    .eq('offer_id', offerId);
  if (error) return [];
  return data || [];
}
async function _loadPrivateOffersByIds(ids) {
  if (!ids?.length) return [];
  const { data, error } = await supabase
    .from('private_offers')
    .select('id, stage, status, sponsor_live_confirmed, sponsee_live_confirmed, live_url')
    .in('id', ids);
  if (error) return [];
  return data || [];
}
/** If a member's private offer is live, ensure response shows 'completed'. */
async function reconcileResponsesAgainstPrivateOffers(offerId) {
  try {
    const resps = await _loadResponsesForOfferId(offerId);
    const acceptedWithPO = resps.filter(r => (r.status || '').toLowerCase() === 'accepted' && r.private_offer_id);
    if (!acceptedWithPO.length) return;

    const mapById = new Map(acceptedWithPO.map(r => [r.private_offer_id, r]));
    const poList = await _loadPrivateOffersByIds(acceptedWithPO.map(r => r.private_offer_id));
    if (!poList.length) return;

    const now = new Date().toISOString();
    const toComplete = poList.filter(po =>
      (po?.sponsor_live_confirmed === true) ||
      (String(po?.status || '').toLowerCase() === 'live') ||
      (typeof po?.stage === 'number' && po.stage >= 4) ||
      (!!po?.live_url)
    );

    for (const po of toComplete) {
      const row = mapById.get(po.id);
      if (!row) continue;
      await supabase
        .from('group_offer_responses')
        .update({ status: 'completed', completed_at: now, live_url: po.live_url || row.live_url || null })
        .eq('id', row.id)
        .neq('status', 'completed');
    }
  } catch (_) {}
}
function _deadlinePassed(offer) {
  if (!offer?.deadline) return false;
  try {
    const d = new Date(offer.deadline + 'T23:59:59');
    return Date.now() > d.getTime();
  } catch { return false; }
}
// Attempt insert into a table; if relation missing, return { ok:false, missing:true }
async function _tryInsert(table, rows) {
  try {
    const { error } = await supabase.from(table).insert(rows);
    if (error) {
      if (String(error?.message || '').toLowerCase().includes('does not exist') || error?.code === '42P01') {
        return { ok:false, missing:true, error };
      }
      return { ok:false, missing:false, error };
    }
    return { ok:true, missing:false };
  } catch (e) {
    return { ok:false, missing:false, error:e };
  }
}
// Try select; if relation missing, return { ok:false, missing:true }
async function _trySelect(table, cols, filter) {
  try {
    let q = supabase.from(table).select(cols);
    if (filter?.in) q = q.in(filter.in.key, filter.in.vals);
    const { data, error } = await q;
    if (error) {
      if (String(error?.message || '').toLowerCase().includes('does not exist') || error?.code === '42P01') {
        return { ok:false, missing:true, data:[] };
      }
      return { ok:false, missing:false, data:[], error };
    }
    return { ok:true, missing:false, data: data || [] };
  } catch (e) {
    return { ok:false, missing:false, data:[], error:e };
  }
}

/** Finalize after deadline: create payouts for completed members and close offer. */
async function finalizeGroupOfferAndCreatePayouts(offer, ctx) {
  try {
    if ((offer.status || '').toLowerCase() === 'completed') return;

    // Pull fresh responses for this offer
    const resps = await _loadResponsesForOfferId(offer.id);
    const completed = resps.filter(r => (r.status || '').toLowerCase() === 'completed' && r.member_user_id);
    const total = Number(offer?.offer_amount || 0);

    if (!completed.length) {
      // No completed members — just mark the group offer completed
      await supabase.from('group_offers').update({ status: 'completed' }).eq('id', offer.id);
      await ctx.onRefresh?.();
      return;
    }

    const each = total > 0 ? (total / completed.length) : 0;

    // Avoid duplicate payouts — check existing in offer_payouts or fallback to payouts
    const poIds = completed.map(r => r.private_offer_id).filter(Boolean);
    let existingIds = [];

    // First try offer_payouts
    let chk = await _trySelect('offer_payouts', 'offer_id', { in: { key: 'offer_id', vals: poIds }});
    if (chk.ok) {
      existingIds = (chk.data || []).map(x => x.offer_id);
    } else if (chk.missing) {
      // Fallback to payouts table
      const chk2 = await _trySelect('payouts', 'offer_id', { in: { key: 'offer_id', vals: poIds }});
      if (chk2.ok) existingIds = (chk2.data || []).map(x => x.offer_id);
      // else ignore — treat as none existing
    }

    const toPay = completed
      .filter(r => r.private_offer_id && !existingIds.includes(r.private_offer_id))
      .map(r => ({ private_offer_id: r.private_offer_id, user_id: r.member_user_id }));

    if (toPay.length) {
      // Try preferred table (offer_payouts)
      const rowsOfferPayouts = toPay.map(x => ({
        offer_id: x.private_offer_id,
        user_id: x.user_id,
        amount: each,
        status: 'pending'
      }));
      const i1 = await _tryInsert('offer_payouts', rowsOfferPayouts);
      if (!i1.ok && i1.missing) {
        // Fallback to payouts
        const rowsPayouts = toPay.map(x => ({
          offer_id: x.private_offer_id,
          sponsee_id: x.user_id,
          payout_amount: each,
          status: 'pending',
          payout_user_role: 'sponsee'
        }));
        await _tryInsert('payouts', rowsPayouts);
      }
    }

    // Close the group offer
    await supabase.from('group_offers').update({ status: 'completed' }).eq('id', offer.id);

    // Notify completed members + sponsor (best effort)
    try {
      for (const r of completed) {
        await supabase.from('user_notifications').insert([{
          notification_uuid: r.member_user_id,
          type: 'info',
          title: 'Group Offer Finalized',
          message: `Finalized: you have a pending payout of $${each.toFixed(2)}.`,
          related_offer_id: offer.id,
          is_read: false
        }]);
      }
      if (offer?.sponsor_id) {
        await supabase.from('user_notifications').insert([{
          notification_uuid: offer.sponsor_id,
          type: 'info',
          title: 'Group Offer Finalized',
          message: `Payouts queued for ${completed.length} member(s).`,
          related_offer_id: offer.id,
          is_read: false
        }]);
      }
    } catch (_) {}

    await ctx.onRefresh?.();
  } catch (e) {
    alert('Finalize failed: ' + (e?.message || e));
  }
}

// ---------- Renderers ----------
function renderTabs(root, counters, onChange) {
  root.innerHTML = '';
  const mkBtn = (key, label) => {
    const count = counters[key] || 0;
    const b = el('button', { class: 'tab-btn', 'data-status': key, style: 'margin-right:8px;padding:8px 12px;border-radius:10px;border:1px solid #333;background:#111;color:#eee;box-shadow:none;' }, `${label} (${count})`);
    b.addEventListener('click', () => onChange(key));
    return b;
  };
  root.append(mkBtn('pending','Pending'), mkBtn('active','Active'), mkBtn('completed','Completed'));
}

function renderParticipants(offer, ctx) {
  const { members, responses, usernames, me, isMember } = ctx;
  const wrap = el('div', { style: 'margin-top:10px;padding:10px;border:1px dashed #334;border-radius:10px;background:#0a1020;' });

  const byMember = new Map();
  (responses[offer.id] || []).forEach(r => byMember.set(r.member_user_id, (r.status || '').toLowerCase()));

  const completedIds = members.filter(m => byMember.get(m.user_id) === 'completed').map(m => m.user_id);
  const acceptedOnlyIds = members.filter(m => byMember.get(m.user_id) === 'accepted').map(m => m.user_id);
  const rejectedIds = members.filter(m => byMember.get(m.user_id) === 'rejected').map(m => m.user_id);
  const pendingIds  = members.map(m => m.user_id).filter(uid =>
    !completedIds.includes(uid) && !acceptedOnlyIds.includes(uid) && !rejectedIds.includes(uid)
  );

  const chips = (ids, bg) => {
    const box = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;' });
    ids.forEach(uid => {
      const label = '@' + (usernames[uid] || 'user');
      box.append(el('span', { style: `padding:3px 8px;border-radius:999px;background:${bg};color:#111;font-size:.82rem;` }, label));
    });
    return box;
  };

  // Show Completed distinctly so it's clear who qualified for payout
  if (completedIds.length) {
    wrap.append(
      el('div', { style:'color:#c7dcfc;font-size:.95rem;' }, `Completed (${completedIds.length})`),
      chips(completedIds, '#7de36f')
    );
  }

  wrap.append(
    el('div', { style:'color:#c7dcfc;font-size:.95rem;margin-top:4px;' }, `Accepted (${acceptedOnlyIds.length})`),
    chips(acceptedOnlyIds, '#b5f3ee'),
    el('div', { style:'color:#c7dcfc;font-size:.95rem;margin-top:4px;' }, `Pending (${pendingIds.length})`),
    chips(pendingIds, '#F6C62E')
  );
  if (rejectedIds.length) {
    wrap.append(
      el('div', { style:'color:#c7dcfc;font-size:.95rem;margin-top:4px;' }, `Rejected (${rejectedIds.length})`),
      chips(rejectedIds, '#ff7676')
    );
  }

  const total = Number(offer?.offer_amount || 0);
  if (total > 0) {
    let msg;
    if (completedIds.length > 0) {
      const each = total / completedIds.length;
      const pct  = 100 / completedIds.length;
      msg = `Per-member payout (completed members): ${fmtMoney(each)} each (${pct.toFixed(2)}%).`;
    } else if (acceptedOnlyIds.length > 0) {
      const each = total / acceptedOnlyIds.length;
      const pct  = 100 / acceptedOnlyIds.length;
      msg = `If all accepted members complete: ${fmtMoney(each)} each (${pct.toFixed(2)}%).`;
    } else {
      msg = `Total pot: ${fmtMoney(total)}. Share is calculated based on members who complete before the deadline.`;
    }
    wrap.append(el('div', { style:'margin-top:8px;color:#c7dcfc;font-size:.92rem;' }, msg));
  }

  if ((offer.status === 'active' || offer.status === 'pending') && isMember) {
    const myStatus = byMember.get(me.id) || 'pending';
    const ctrl = el('div', { style:'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;' });

    if (myStatus === 'pending') {
      const acceptBtn = el('button', { style: btnStyle('green','#fff') }, 'Accept Offer');
      const rejectBtn = el('button', { style: btnStyle('#ff7676','#fff') }, 'Reject');
      acceptBtn.addEventListener('click', async () => { try { await ctx.onAccept(offer); toast('Accepted. Private offer created (stage 3).'); } catch (e){ alert('Could not accept: '+(e?.message||e)); } });
      rejectBtn.addEventListener('click', async () => { try { await ctx.onReject(offer); toast('You rejected this offer.'); } catch (e){ alert('Could not reject: '+(e?.message||e)); } });
      ctrl.append(acceptBtn, rejectBtn);
    } else if (myStatus === 'accepted') {
      ctrl.append(el('span', { style:'padding:6px 10px;border:1px solid #3a6;border-radius:9px;background:#132;color:#8f8;' }, 'You accepted ✓'));
    } else if (myStatus === 'rejected') {
      ctrl.append(el('span', { style:'padding:6px 10px;border:1px solid #833;border-radius:9px;background:#311;color:#f88;' }, 'You rejected this offer'));
    } else if (myStatus === 'completed') {
      ctrl.append(el('span', { style:'padding:6px 10px;border:1px solid #468;border-radius:9px;background:#123;color:#adf;' }, 'Completed 🎉'));
    }
    wrap.append(ctrl);
  }

  return wrap;
}

function renderCard(offer, ctx) {
  const urls = allImageUrls(offer);
  const mainUrl = urls[0] || null;
  const { isAdmin } = ctx;

  const card = el('div', { style:'display:grid;grid-template-columns:120px 1fr;gap:14px;align-items:stretch;background:#181818;border:1px solid #233;border-radius:14px;padding:12px;margin:10px auto;' });

  const left = el('div', {});
  if (urls.length <= 1) {
    left.append(el('img', { src: mainUrl || './logos.png', alt:'offer image', style:'width:120px;height:120px;object-fit:cover;border-radius:10px;border:1px solid #333;' }));
  } else {
    left.append(imageGrid(urls, 120));
  }

  const titleRow = el('div', { style:'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' }, [
    el('strong', { style:'font-size:1.05rem;color:#e9f1ff;' }, esc(offer.offer_title || 'Untitled')),
    badge(offer.status)
  ]);

  const meta1 = el('div', { style:'font-size:.92rem;color:#c7dcfc;margin-top:4px;' }, `Amount: ${fmtMoney(offer.offer_amount)} · Deadline: ${offer.deadline ? esc(offer.deadline) : '-' } · Created: ${fmtDate(offer.created_at)}`);
  const meta2 = el('div', { style:'font-size:.9rem;color:#9ad1ff;margin-top:4px;' }, `Sponsor: ${esc(offer.sponsor_company || offer.sponsor_username || offer.sponsor_email || '-')}`);
  const desc  = el('div', { style:'font-size:.9rem;color:#bcd;' }, esc((offer.offer_description || '').slice(0,240) + ((offer.offer_description || '').length > 240 ? '…' : '')));

  const actions = el('div', { style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;' });
  const viewBtn = el('button', { style: btnStyle('#2563eb','#fff') }, 'View Details');
  viewBtn.addEventListener('click', () => showDetailsModal(offer, urls));
  actions.append(viewBtn);

  if (isAdmin) {
    const mk = (label, s, c) => {
      const b = el('button', { style: btnStyle(c, '#fff') }, label);
      b.addEventListener('click', () => setOfferStatus(offer, s, ctx));
      return b;
    };
    if (offer.status !== 'active')    actions.append(mk('Set Active','active','#2563eb'));
    if (offer.status !== 'completed') actions.append(mk('Mark Completed','completed','green'));
    if (offer.status !== 'cancelled') actions.append(mk('Cancel Offer','cancelled','red'));

    // NEW: explicit Finalize & Payout button when deadline passed and not completed
    if (_deadlinePassed(offer) && (offer.status !== 'completed')) {
      const finalizeBtn = el('button', { style: btnStyle('#8b5cf6','#fff') }, 'Finalize & Payout');
      finalizeBtn.addEventListener('click', () => finalizeGroupOfferAndCreatePayouts(offer, ctx));
      actions.append(finalizeBtn);
    }
  }

  const right = el('div', {}, [titleRow, meta1, meta2, desc, actions]);
  if (offer.status === 'active' || offer.status === 'pending') {
    right.append(renderParticipants(offer, ctx));
  }

  card.append(left, right);
  return card;
}

function renderList(container, list, ctx) {
  container.innerHTML = '';
  if (!list.length) {
    container.append(el('div', { style:'color:#9fb3d4;padding:16px;border:1px dashed #334;border-radius:10px;' }, 'No offers.'));
    return;
  }
  list.forEach(o => container.append(renderCard(o, ctx)));
}

function showDetailsModal(offer, urls = null) {
  const images = urls || allImageUrls(offer);
  let currentIdx = 0;
  const safeImg = (i) => images[i] || './logos.png';

  const root = document.createElement('div');
  root.innerHTML = `
    <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;"></div>
    <div class="modal-content"
         style="position:fixed;left:50%;top:3%;transform:translateX(-50%);width:min(1000px,96vw);max-height:80vh;background:black;border:1px solid #233;border-radius:14px;padding:12px;z-index:9999;box-shadow:0 18px 60px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden;margin-top:20px;">
      <div style="flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:4px 6px 10px;">
        <div style="font-size:1.1rem;color:#e9f1ff;font-weight:600;letter-spacing:.2px;">
          ${esc(offer.offer_title || 'Offer')}
        </div>
        <button id="modal-close" style="background:#F6C62E;color:#111;border:0;border-radius:9px;padding:7px 12px;cursor:pointer;">Close</button>
      </div>
      <div class="modal-body" style="flex:1 1 auto;overflow:auto;padding:6px 6px 10px 6px;">
        <div style="display:grid;grid-template-columns:1fr 160px;gap:12px;align-items:start;">
          <div style="background:black;border:1px solid #233;border-radius:12px;padding:10px;display:flex;align-items:center;justify-content:center;">
            <img id="gallery-main" src="${safeImg(currentIdx)}" alt="offer image" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;"/>
          </div>
          <div id="gallery-thumbs" style="display:flex;flex-direction:column;gap:8px;height:fit-content;overflow:auto;padding-right:2px;"></div>
        </div>
        <div style="margin-top:14px;padding:12px;border:1px solid #233;border-radius:12px;background:black;color:#c7dcfc;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
            <div><div style="opacity:.75;font-size:.85rem;">Status</div><div style="font-weight:600;color:#e6f1ff;">${esc((offer.status || '').toLowerCase())}</div></div>
            <div><div style="opacity:.75;font-size:.85rem;">Amount</div><div style="font-weight:600;color:#e6f1ff;">${fmtMoney(offer.offer_amount)}</div></div>
            <div><div style="opacity:.75;font-size:.85rem;">Deadline</div><div style="font-weight:600;color:#e6f1ff;">${esc(offer.deadline || '-')}</div></div>
            <div><div style="opacity:.75;font-size:.85rem;">Deliverable</div><div style="font-weight:600;color:#e6f1ff;">${esc(offer.deliverable_type || '-')}</div></div>
            <div><div style="opacity:.75;font-size:.85rem;">Job Type</div><div style="font-weight:600;color:#e6f1ff;">${esc(offer.job_type || '-')}</div></div>
            <div><div style="opacity:.75;font-size:.85rem;">Payment</div><div style="font-weight:600;color:#e6f1ff;">${esc(offer.payment_schedule || '-')}</div></div>
            <div style="grid-column:1 / -1;">
              <div style="opacity:.75;font-size:.85rem;margin-bottom:4px;">Instructions</div>
              <div style="white-space:pre-wrap;line-height:1.45;max-height:180px;overflow:auto;padding:10px;border:1px solid #233;border-radius:10px;background:#0a1322;color:#d9e6ff;">
                ${esc(offer.instructions || '-')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  const backdrop = root.querySelector('.modal-backdrop');
  const closeBtn = root.querySelector('#modal-close');
  const mainImg  = root.querySelector('#gallery-main');
  const thumbsEl = root.querySelector('#gallery-thumbs');

  images.forEach((u, idx) => {
    const t = document.createElement('img');
    t.src = u; t.alt = 'thumb';
    t.style.cssText = `width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;border:2px solid ${idx===0?'#F6C62E':'#333'};cursor:pointer;background:#111;`;
    t.addEventListener('click', () => select(idx));
    thumbsEl.appendChild(t);
  });
  function select(idx) {
    currentIdx = idx;
    mainImg.src = (images[idx] || './logos.png');
    thumbsEl.querySelectorAll('img').forEach((img, i) => img.style.borderColor = (i===idx ? '#F6C62E' : '#333'));
  }

  const escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  const arrowsHandler = (e) => {
    if (images.length <= 1) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = (e.key === 'ArrowRight') ? (currentIdx + 1) % images.length : (currentIdx - 1 + images.length) % images.length;
    select(next);
  };
  document.addEventListener('keydown', escHandler, true);
  document.addEventListener('keydown', arrowsHandler, true);

  function closeModal(){
    document.removeEventListener('keydown', escHandler, true);
    document.removeEventListener('keydown', arrowsHandler, true);
    root.remove();
  }
  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);

  document.body.appendChild(root);
}

// ---------- Listing pills (best-effort) ----------
function updateGroupPills(groupId, counters) {
  try {
    const node = document.querySelector(`[data-group-id="${groupId}"]`);
    if (!node) return;
    let pillHost = node.querySelector('.group-pills');
    if (!pillHost) {
      pillHost = document.createElement('div');
      pillHost.className = 'group-pills';
      pillHost.style.marginTop = '6px';
      pillHost.style.display = 'flex';
      pillHost.style.gap = '6px';
      node.appendChild(pillHost);
    }
    const mk = (txt, bg) => {
      const s = document.createElement('span');
      s.textContent = txt;
      s.style.padding = '2px 8px';
      s.style.borderRadius = '999px';
      s.style.fontSize = '.78rem';
      s.style.background = bg;
      s.style.color = '#111';
      s.style.border = '1px solid #333';
      return s;
    };
    pillHost.innerHTML = '';
    if (counters.active) pillHost.appendChild(mk(`Active Offers: ${counters.active}`, '#409140'));
    if (counters.pending) pillHost.appendChild(mk(`Pending Offers: ${counters.pending}`, '#F6C62E'));
  } catch {}
}

// ---------- Admin: status changes ----------
async function setOfferStatus(offer, newStatus, ctx) {
  try {
    const s = (newStatus || '').toLowerCase();
    if (!ALLOWED_STATUS.has(s)) { alert('Invalid status.'); return; }

    const { error } = await supabase.from('group_offers').update({ status: s }).eq('id', offer.id);
    if (error) throw error;

    toast(`Offer status updated to "${s}".`);

    try {
      if (s === 'active' && Array.isArray(ctx.members)) {
        for (const m of ctx.members) {
          if (!m?.user_id) continue;
          await notifyOfferUpdate({
            to_user_id: m.user_id,
            offer_id: offer.id,
            type: 'group_offer_status',
            title: 'Group Offer Active',
            message: `“${offer.offer_title || 'Offer'}” is now active — accept if you want in.`
          });
        }
      }
      if (offer.sponsor_id) {
        await notifyOfferUpdate({
          to_user_id: offer.sponsor_id,
          offer_id: offer.id,
          type: 'group_offer_status',
          title: `Group Offer ${s.charAt(0).toUpperCase() + s.slice(1)}`,
          message: `Your group offer “${offer.offer_title || 'Offer'}” status is now ${s}.`
        });
      }
    } catch (_) {}

    await ctx.onRefresh?.();
  } catch (e) { alert('Could not update status: ' + (e?.message || e)); }
}

// ---------- Controller ----------
let currentGroupId = null;
let unsubRealtime = null;

async function refreshInvitesPanel() {
  const panel = ensureInvitesPanel();          // anchored above #groups-list
  const me = await getMyUser();
  const invites = await loadPendingInvitesForMe(me.id);

  const inviterIds = Array.from(new Set(invites.map(i => i.inviter_id)));
  const usernames = await usernamesByIds(inviterIds);
  const groupsMap = await loadGroupsMeta(Array.from(new Set(invites.map(i => i.group_id))));

  await renderPendingInvites(panel, invites, groupsMap, usernames, async (action, inv) => {
    try {
      if (action === 'accept') {
        await acceptInvite(inv, me); // throws on RLS 403 etc.
        toast('Joined group.');
        refreshGroupsListUI(inv.group_id);
        window.dispatchEvent(new CustomEvent('friend-group:view', { detail: { groupId: inv.group_id } }));
      } else if (action === 'decline') {
        await declineInvite(inv, me);
        toast('Invite declined.');
      }
    } catch (err) {
      alert('Could not process invite: ' + (err?.message || err));
    } finally {
      await refreshInvitesPanel(); // keep panel fresh
    }
  });
}

async function renderForGroup(groupId) {
  if (!groupId) return;

  if (currentGroupId !== groupId && unsubRealtime) {
    unsubRealtime();
    unsubRealtime = null;
  }
  currentGroupId = groupId;

  const { tabs, container } = ensureScaffold();

  const me = await getMyUser();
  const role = await getMyRoleInGroup(groupId);
  const isAdmin = role.isAdmin;
  const isMember = role.isMember;

  let state = { offers: [], responses: {}, members: [], usernames: {} };

  async function refresh() {
    try {
      await refreshInvitesPanel(); // keep invites panel fresh

      const [offers, responsesRaw, members] = await Promise.all([
        loadGroupOffers(groupId),
        loadResponses(groupId),
        loadMembers(groupId)
      ]);

      const respMap = {};
      (responsesRaw || []).forEach(r => { (respMap[r.offer_id] ||= []).push(r); });

      const userIds = Array.from(new Set(members.map(m => m.user_id)));
      const usernames = await usernamesByIds(userIds);

      state = { offers, responses: respMap, members, usernames };

      // 🔄 NEW: best-effort reconciliation — flips accepted → completed when their private offer is live
      for (const o of offers) {
        await reconcileResponsesAgainstPrivateOffers(o.id);
      }

      // (Optional) NEW: auto-finalize overdue group offers (idempotent)
      if (isAdmin) {
        for (const o of offers) {
          if (_deadlinePassed(o) && (o.status !== 'completed')) {
            await finalizeGroupOfferAndCreatePayouts(o, { onRefresh: refresh });
          }
        }
      }

      const counters = {
        pending:   offers.filter(o => o.status === 'pending').length,
        active:    offers.filter(o => o.status === 'active').length,
        completed: offers.filter(o => o.status === 'completed' || o.status === 'cancelled').length
      };
      renderTabs(tabs, counters, setTab);
      const def = counters.pending ? 'pending' : (counters.active ? 'active' : 'completed');
      setTab(def, offers);

      updateGroupPills(groupId, counters);
    } catch (e) {
      container.innerHTML = `<div style="color:#ff9a9a;">Failed to load group offers: ${esc(e?.message || e)}</div>`;
    }
  }

  function setTab(key, offersAll) {
    const src = Array.isArray(offersAll) ? offersAll : (state.offers || []);
    const offers =
      key === 'pending'   ? src.filter(o => o.status === 'pending') :
      key === 'active'    ? src.filter(o => o.status === 'active')  :
                            src.filter(o => o.status === 'completed' || o.status === 'cancelled');

    const ctxBase = {
      isAdmin, isMember,
      me,
      members: state.members,
      responses: state.responses,
      usernames: state.usernames,
      onAccept: async (offer) => { await acceptOfferForMember({ offer, groupId: currentGroupId, me, usernames: state.usernames }); await refresh(); },
      onReject: async (offer) => { await rejectOfferForMember({ offer, groupId: currentGroupId, me }); await refresh(); },
      onRefresh: refresh
    };

    const { container } = ensureScaffold();
    container.innerHTML = '';
    if (!offers.length) {
      container.append(el('div', { style:'color:#9fb3d4;padding:16px;border:1px dashed #334;border-radius:10px;' }, 'No offers.'));
      return;
    }
    offers.forEach(o => container.append(renderCard(o, ctxBase)));

    Array.from(tabs.querySelectorAll('button.tab-btn')).forEach(b => {
      const on = b.dataset.status === key;
      b.style.background = on ? '#F6C62E' : '#111';
      b.style.color = on ? '#111' : '#eee';
    });
  }

  if (!unsubRealtime) {
    unsubRealtime = subscribeGroup(currentGroupId, refresh);
    window.addEventListener('focus', refresh, { passive: true });
  }
  await refresh();
}

// ---------- Wiring ----------
function tryWireGroupsListClicks() {
  const gl = $('#groups-list');
  if (!gl) return;
  gl.addEventListener('click', (e) => {
    const t = e.target; if (!t) return;
    let node = t;
    while (node && node !== gl) {
      const gid = node.getAttribute?.('data-group-id');
      if (gid) { renderForGroup(gid); return; }
      if (node.tagName === 'A') {
        try {
          const u = new URL(node.getAttribute('href'), window.location.origin);
          const qid = u.searchParams.get('groupId');
          if (qid) { renderForGroup(qid); return; }
        } catch {}
      }
      node = node.parentElement;
    }
  }, { capture:true });
}

function observeMembersPanel() {
  const panel = $('#groups-members');
  if (!panel) return;
  const pickGid = () => {
    const gid = panel.getAttribute('data-group-id');
    if (gid) return gid;
    const child = panel.querySelector('[data-group-id]');
    if (child) return child.getAttribute('data-group-id');
    return null;
  };
  const initial = pickGid();
  if (initial) renderForGroup(initial);
  const mo = new MutationObserver(() => {
    const gid = pickGid();
    if (gid && gid !== currentGroupId) renderForGroup(gid);
  });
  mo.observe(panel, { attributes:true, childList:true, subtree:true });
}

window.addEventListener('friend-group:view', (ev) => {
  const gid = ev?.detail?.groupId;
  if (gid) renderForGroup(gid);
});
window.GroupOffers = { show: (groupId) => renderForGroup(groupId) };

async function main() {
  ensureScaffold();            // offers area
  ensureInvitesPanel();        // mount invites above #groups-list
  await refreshInvitesPanel(); // and populate it

  const params = new URLSearchParams(location.search);
  const groupId = params.get('groupId');
  if (groupId) renderForGroup(groupId);

  tryWireGroupsListClicks();
  observeMembersPanel();
}
document.addEventListener('DOMContentLoaded', main);

