// ./js/AffiliateAdmin.js
//
// Admin dashboard logic for Affiliates/Partners.
//
// - Review Affiliate Applications (approve/reject via RPC)
// - Create/Update partner (affiliate-register)
// - Ensure/Set referral link (affiliate-ensure-referral-link / affiliate-set-referral-code)
// - List partners with filter (shows username)
// - View partner totals (computed locally, rate*amount with $10 fallback)
// - Show platform stats from SNAPSHOT (stats_snapshot) with live fallback
// - Approve all pending conversions (Edge Fn: affiliate-approve-pending)
// - Mark all approved as paid (Edge Fn: affiliate-mark-approved-paid)
//
// HTML container: <div id="admin-affiliate-section"></div>

import { supabase } from './supabaseClient.js';
import { notifyOfferUpdate } from './alerts.js';

/* =========================
   Utilities
   ========================= */

function slugifyCode(s){
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const DEBUG_STATS = false;

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}
function getFunctionsBaseUrl() {
  return supabase.functionsUrl || `${location.origin}/functions/v1`;
}
async function callFunction(name, { method = 'POST', query = '', body } = {}) {
  const token = await getAccessToken();
  const url = `${getFunctionsBaseUrl()}/${name}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  try { return await res.json(); } catch { return { ok: false, error: `Bad JSON from ${name}` }; }
}
function esc(v) { if (v == null) return ''; return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtMoney(n){ return '$' + Number(n || 0).toFixed(2); }
function fmtDate(s){ return s ? new Date(s).toLocaleString() : ''; }
function fmtNum(n){ return (n==null || isNaN(n)) ? '—' : Number(n).toLocaleString(); }

/* Inject tiny stylesheet for the icon grid */
function ensureStyles(){
  if (document.getElementById('aa-styles')) return;
  const st = document.createElement('style');
  st.id = 'aa-styles';
  st.textContent = `
    .aa-links-wrap{ display:flex; justify-content:center; margin-top:8px; }
    .aa-icons-grid{ display:grid; grid-template-columns: repeat(8, 22px); gap:8px; width:max-content; justify-content:center; align-content:start; }
    @media (max-width:1200px){ .aa-icons-grid{ grid-template-columns: repeat(8, 22px); } }
    .aa-ico{ width:22px;height:22px;margin:5px;border-radius:6px;overflow:hidden;display:inline-flex;justify-content:center;align-items:center;background:#111;border:1px solid #2b2b2b;}
    .aa-ico img{ width:100%;height:100%;display:block; }
    .aa-user-stat{ opacity:.85;font-size:.92em;line-height:1.2; }
    .aa-inline{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .aa-input{ background:#1a1a1a;color:#eee;border:1px solid #2b2b2b;border-radius:8px;padding:6px 8px; }
    .aa-btn{ padding:6px 10px;border-radius:8px;border:1px solid #2b2b2b;background:#2b76ff;color:#fff;cursor:pointer; }
  `;
  document.head.appendChild(st);
}

/* =========================
   Referral-link helpers
   ========================= */

function normalizeReferralRow(row){
  if (!row || typeof row !== 'object') return null;
  const code =
    row.referral_code ??
    row.code ??
    row.slug ??
    row.token ??
    row.ref_code ??
    null;
  return code ? { ...row, referral_code: String(code) } : null;
}
function parseEnsureLinkResponse(res){
  const possibleLinkObjs = [
    res?.link, res?.data?.link, res?.referral_link, res?.data?.referral_link, res?.result?.link,
  ].filter(Boolean);
  let link = possibleLinkObjs.find(l => l && (l.referral_code || l.code || l.slug || l.token || l.ref_code));
  if (!link) {
    const code = res?.referral_code ?? res?.code ?? res?.slug ?? res?.token ?? res?.ref_code ?? null;
    if (code) link = { referral_code: String(code) };
  }
  return normalizeReferralRow(link);
}
async function ensureReferralLink({ user_id, partner_id, preferred_code, allow_override=false }){
  const body = {
    user_id,
    partner_id,
    preferred_code,
    desired_code: preferred_code,
    requested_code: preferred_code,
    ref: preferred_code,
    slug: preferred_code,
    code: preferred_code,
    allow_override,
    overwrite: allow_override,
    force: allow_override
  };
  const res = await callFunction('affiliate-ensure-referral-link', { body });
  if (DEBUG_STATS) console.debug('[aff-admin] ensure-referral-link raw:', res);
  if (!res || res.ok === false) return null;
  return parseEnsureLinkResponse(res);
}
/** Try to set/rename the code to an exact value. Uses an admin function if it exists,
 *  and falls back to ensureReferralLink with override flags. */
async function setReferralCode({ user_id, partner_id, code }){
  const desired = slugifyCode(code);
  if (!desired) return { ok:false, error:'empty code' };

  // 1) If you have a dedicated admin function, try that first.
  try{
    const res = await callFunction('affiliate-set-referral-code', { body:{ user_id, partner_id, code: desired } });
    if (res?.ok && (res.link || res.referral_code)) {
      const link = normalizeReferralRow(res.link) || { referral_code: res.referral_code };
      return { ok:true, link };
    }
  }catch(e){ /* ignore and fall back */ }

  // 2) Fall back to ensure with override-ish knobs.
  const ensured = await ensureReferralLink({ user_id, partner_id, preferred_code: desired, allow_override: true });
  if (ensured?.referral_code) return { ok:true, link: ensured };

  return { ok:false, error:'Could not set referral code' };
}

/* =========================
   Snapshot helpers
   ========================= */

function numbersFromSnapshot(snap){
  if (!snap || typeof snap !== 'object') {
    return { yt:null, yt_subs:null, yt_views:null, yt_videos:null, tt:null, tw:null, ig:null, fb:{followers:null, likes:null}, collected_at:null };
  }
  const get = (o,p) => p.split('.').reduce((a,k)=>(a && a[k] != null ? a[k] : undefined), o);
  const firstNum = (root, paths) => {
    for (const p of paths){
      const v = get(root,p);
      if (v != null && !isNaN(Number(v))) return Number(v);
    }
    return null;
  };
  const yt_subs   = firstNum(snap, ['yt','youtube.subscribers','youtube.subscriber_count','youtube.statistics.subscriberCount','channel.statistics.subscriberCount','data.youtube.subscribers']);
  const yt_views  = firstNum(snap, ['youtube.views','youtube.viewCount','youtube.statistics.viewCount','channel.statistics.viewCount','data.youtube.views','items.0.statistics.viewCount']);
  const yt_videos = firstNum(snap, ['youtube.videos','youtube.videoCount','youtube.statistics.videoCount','channel.statistics.videoCount','data.youtube.videos','items.0.statistics.videoCount']);
  const yt = (yt_subs != null ? yt_subs : yt_views);

  const tt  = firstNum(snap, ['tt','tiktok.followers','profile.follower_count','data.tiktok.followers']);
  const tw  = firstNum(snap, ['tw','twitch.followers','profile.followers','data.twitch.followers']);
  const ig  = firstNum(snap, ['ig','instagram.followers','account.followers_count','data.instagram.followers']);
  const fbF = firstNum(snap, ['fb.followers','facebook.followers','facebook.insights.page_followers','data.facebook.followers']);
  const fbL = firstNum(snap, ['fb.likes','facebook.likes','facebook.insights.page_likes','data.facebook.likes']);
  const collected_at = get(snap,'collected_at') || get(snap,'at') || null;
  return { yt, yt_subs, yt_views, yt_videos, tt, tw, ig, fb:{ followers: fbF, likes: fbL }, collected_at };
}

/* =========================
   Live fallback (only if snapshot missing)
   ========================= */

const platformCache = new Map();

function normalizeAdminPayload(payload){
  const r = payload?.stats ?? payload?.data ?? payload ?? {};
  const pick = (obj, paths) => { for (const p of paths){ const v = p.split('.').reduce((a,k)=>(a&&a[k]!=null?a[k]:undefined), obj); if (v!=null && !isNaN(Number(v))) return Number(v); } return null; };
  return {
    yt: pick(r,['yt','youtube.subscribers','channel.statistics.subscriberCount']),
    tt: pick(r,['tt','tiktok.followers','profile.follower_count']),
    tw: pick(r,['tw','twitch.followers','profile.followers']),
    ig: pick(r,['ig','instagram.followers','account.followers_count']),
    fb: {
      followers: pick(r,['fb.followers','facebook.followers','facebook.insights.page_followers']),
      likes:     pick(r,['fb.likes','facebook.likes','facebook.insights.page_likes']),
    },
  };
}
async function fetchPlatformStatsForUser(user_id){
  if (!user_id) return {};
  if (platformCache.has(user_id)) return platformCache.get(user_id);
  let out = {};
  try{
    const token = await getAccessToken();
    const qs = new URLSearchParams({ user_id, uid:user_id }).toString();
    const url = `${getFunctionsBaseUrl()}/affiliate-admin-get-stats?${qs}`;
    const res = await fetch(url, { headers:{ Authorization:`Bearer ${token}` } });
    const payload = await res.json();
    out = normalizeAdminPayload(payload);
    if (DEBUG_STATS) console.debug('[aff-admin] live stats', user_id, payload, out);
  }catch(e){ if (DEBUG_STATS) console.debug('[aff-admin] live stats error', e); }
  platformCache.set(user_id, out);
  return out;
}

/* =========================
   Icon utilities
   ========================= */

function platformFromUrl(u){
  try{
    const h = new URL(u).hostname.replace(/^www\./,'');
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
    if (h.includes('instagram.com')) return 'instagram';
    if (h.includes('tiktok.com'))    return 'tiktok';
    if (h.includes('twitter.com') || h.includes('x.com')) return 'twitter';
    if (h.includes('facebook.com'))  return 'facebook';
    if (h.includes('twitch.tv'))     return 'twitch';
  }catch{}
  return null;
}
function iconCandidates(platform){ return [`./${platform}logo.png`, `../${platform}logo.png`]; }
function iconTitle(platform){
  return ({ youtube:'YouTube', tiktok:'TikTok', twitch:'Twitch', instagram:'Instagram', facebook:'Facebook', twitter:'Twitter' }[platform] || platform);
}
function wireIconFallbacks(scope){
  scope.querySelectorAll('img.aa-ico-img[data-srcs]').forEach(img=>{
    const list = (img.dataset.srcs || '').split('|').filter(Boolean);
    img.dataset.idx = '0';
    img.src = list[0] || '';
    img.onerror = () => {
      let i = Number(img.dataset.idx || '0') + 1;
      if (i < list.length){ img.dataset.idx = String(i); img.src = list[i]; }
      else { img.onerror = null; img.remove(); }
    };
  });
}
function iconsGridHtml(links){
  if (!Array.isArray(links) || !links.length) return '';
  const seen = new Set();
  const items = [];
  for (const raw of links){
    const url = String(raw).trim();
    if (!url) continue;
    const pf = platformFromUrl(url);
    if (!pf) continue;
    const key = `${pf}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const srcs = iconCandidates(pf).join('|');
    items.push(
      `<a class="aa-ico" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(iconTitle(pf))}">
         <img class="aa-ico-img" data-srcs="${esc(srcs)}" alt="${esc(pf)}">
       </a>`
    );
  }
  if (!items.length) return '';
  return `<div class="aa-icons-grid">${items.join('')}</div>`;
}

/* =========================
   Renderers
   ========================= */

function renderShell(root){
  ensureStyles();
  root.innerHTML = `
    <div class="aa-grid" style="display:grid;gap:16px;grid-template-columns:1fr 1fr;">
      <section class="aa-card" style="grid-column:1/-1;padding:12px;border:1px solid #444;border-radius:10px;">
        <h3 style="margin-top:0;">Affiliate Applications (Admin Review)</h3>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <label>Status
            <select id="aa-app-status" style="margin-left:6px;">
              <option value="pending">Pending (submitted/under_review)</option>
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <input id="aa-app-user" type="text" placeholder="Filter by user_id…" style="flex:1;min-width:220px">
          <button id="aa-app-refresh">Refresh</button>
        </div>
        <div id="aa-apps"></div>
      </section>

      <section class="aa-card" style="padding:12px;border:1px solid #444;border-radius:10px;">
        <h3>Create / Update Partner</h3>
        <div style="display:grid;gap:8px;">
          <label>User ID <input id="aa-user-id" type="text" placeholder="uuid" class="aa-input" style="width:100%"></label>
          <label>Partner Type
            <select id="aa-partner-type" style="width:100%" class="aa-input">
              <option value="affiliate">affiliate</option>
              <option value="agency">agency</option>
              <option value="reseller">reseller</option>
            </select>
          </label>
          <label>Commission Rate (%) <input id="aa-rate" type="number" step="0.01" min="0" max="100" value="10" class="aa-input"></label>
          <label><input id="aa-active" type="checkbox" checked> Active</label>
          <div class="aa-inline">
            <button id="aa-register-btn" class="aa-btn">Save Partner</button>
            <button id="aa-ensure-link-btn" class="aa-btn">Ensure Referral Link</button>
          </div>
          <div id="aa-ensure-result" style="font-size:.9em;opacity:.8"></div>
        </div>
      </section>

      <section class="aa-card" style="padding:12px;border:1px solid #444;border-radius:10px;">
        <h3>Partners</h3>
        <div class="aa-inline" style="margin-bottom:8px;">
          <input id="aa-filter-user" type="text" placeholder="Filter by user_id…" style="flex:1" class="aa-input">
          <button id="aa-refresh-list" class="aa-btn">Refresh</button>
        </div>
        <div id="aa-list"></div>
      </section>

      <section class="aa-card" style="grid-column:1/-1;padding:12px;border:1px solid #444;border-radius:10px;">
        <h3>Selected Partner</h3>
        <div id="aa-details"></div>
      </section>

      <section class="aa-card" style="grid-column:1/-1;padding:12px;border:1px solid #444;border-radius:10px;">
        <h3>Conversions</h3>
        <div style="margin-bottom:8px;"><button id="aa-mark-paid" class="aa-btn">Mark Selected Paid</button></div>
        <div id="aa-conversions"></div>
      </section>
    </div>
  `;
}

function renderPartnerTable(el, partners, usernameMap){
  if (!partners?.length){ el.innerHTML = `<p>No affiliates found.</p>`; return; }
  const rows = partners.map(p=>{
    const uname = usernameMap.get(p.user_id) || p.user_id;
    return `
      <tr>
        <td>${esc(p.id)}</td>
        <td title="${esc(p.user_id)}">${esc(uname)}</td>
        <td>${esc(p.partner_type)}</td>
        <td>${Number(p.commission_rate).toFixed(2)}%</td>
        <td>${p.active ? 'Active' : 'Inactive'}</td>
        <td><button class="aa-view aa-btn" data-id="${p.id}">View</button></td>
      </tr>`;
  }).join('');
  el.innerHTML = `
    <table border="1" cellspacing="0" cellpadding="6" style="width:100%">
      <thead>
        <tr><th>Partner ID</th><th>User</th><th>Type</th><th>Rate</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  el.querySelectorAll('.aa-view').forEach(btn=>btn.addEventListener('click', ()=>loadPartner(btn.dataset.id)));
}

function userStatsBlock(snapNums){
  const { yt_subs, yt_views, yt_videos, tt, tw, ig, fb, collected_at } = snapNums || {};
  const lines = [];
  if (collected_at) lines.push(`<div class="aa-user-stat">as of ${esc(fmtDate(collected_at))}</div>`);

  const dots = [];
  if (tt!=null) dots.push(`TT: ${fmtNum(tt)}`);
  if (tw!=null) dots.push(`TW: ${fmtNum(tw)}`);
  if (ig!=null) dots.push(`IG: ${fmtNum(ig)}`);
  if (fb?.followers!=null || fb?.likes!=null) dots.push(`FB: ${fmtNum(fb?.followers)} / ${fmtNum(fb?.likes)}`);

  const ytBits = [];
  if (yt_subs != null) ytBits.push(`${fmtNum(yt_subs)} subs`);
  if (yt_views != null) ytBits.push(`${fmtNum(yt_views)} views`);
  if (yt_videos != null) ytBits.push(`${fmtNum(yt_videos)} videos`);
  if (ytBits.length) dots.push(`YT: ${ytBits.join(' / ')}`);

  if (dots.length) lines.push(`<div class="aa-user-stat">${dots.join(' • ')}</div>`);
  return lines.join('');
}

function renderPartnerDetails(el, partner, username, link, stats){
  const code = link?.referral_code || 'N/A';
  const linkUrl  = link?.referral_code ? `${window.location.origin}/?ref=${esc(link.referral_code)}` : '';

  el.innerHTML = `
    <div style="display:grid;gap:10px;">
      <div><strong>User:</strong> ${esc(username || partner.user_id)}</div>
      <div><strong>Partner Type:</strong> ${esc(partner.partner_type)}</div>
      <div><strong>Commission Rate:</strong> ${Number(partner.commission_rate).toFixed(2)}%</div>
      <div><strong>Status:</strong> ${partner.active ? 'Active' : 'Inactive'}</div>

      <div><strong>Referral Code:</strong> <code>${esc(code)}</code></div>
      ${linkUrl ? `<div class="aa-inline"><strong>Referral URL:</strong> <input id="aa-link-url" class="aa-input" style="flex:1" value="${linkUrl}" readonly><button id="aa-copy-url" class="aa-btn">Copy</button></div>` : ''}

      <div class="aa-inline">
        <input id="aa-code-input" class="aa-input" placeholder="set referral code (e.g. fitstyle)" value="${esc(slugifyCode(code) || slugifyCode(username) || '')}" style="flex:1;min-width:200px">
        <button id="aa-code-update" class="aa-btn">Set referral code</button>
      </div>

      <div>
        <strong>Affiliate Totals</strong>
        <ul style="margin:6px 0 0 16px;">
          <li class="card">Total Conversions: ${stats.total_conversions}</li>
          <li class="card">Unique Referred Users: ${stats.unique_referred_users}</li>
          <li class="card">Total GMV: ${fmtMoney(stats.total_gmv)}</li>
          <li class="card">Pending Commission: ${fmtMoney(stats.pending_commission)}</li>
          <li class="card">Approved Commission: ${fmtMoney(stats.approved_commission)}</li>
          <li class="card">Paid Commission: ${fmtMoney(stats.paid_commission)}</li>
        </ul>
      </div>

      <div class="aa-inline">
        <button id="aa-approve-pending" class="aa-btn" style="background:#27ae60;">Approve All Pending</button>
        <button id="aa-pay-approved" class="aa-btn" style="background:#8e44ad;">Mark All Approved Paid</button>
      </div>
    </div>`;
}

function statsBadgeRow(s){
  const parts = [];
  if (s?.tt!=null) parts.push(`TT: ${fmtNum(s.tt)}`);
  if (s?.tw!=null) parts.push(`TW: ${fmtNum(s.tw)}`);
  if (s?.ig!=null) parts.push(`IG: ${fmtNum(s.ig)}`);
  if (s?.fb?.followers!=null || s?.fb?.likes!=null) parts.push(`FB: ${fmtNum(s.fb?.followers)} / ${fmtNum(s.fb?.likes)}`);
  if (s?.yt_subs != null || s?.yt_views != null || s?.yt_videos != null) {
    const bits = [];
    if (s.yt_subs  != null) bits.push(`${fmtNum(s.yt_subs)} subs`);
    if (s.yt_views != null) bits.push(`${fmtNum(s.yt_views)} views`);
    if (s.yt_videos!= null) bits.push(`${fmtNum(s.yt_videos)} videos`);
    parts.push(`YT: ${bits.join(' / ')}`);
  } else if (s?.yt != null) {
    parts.push(`YT: ${fmtNum(s.yt)}`);
  }
  return parts.length ? parts.join(' • ') : '—';
}

function renderApplicationsTable(el, apps, usernameMap, statsPerUser, snapNumsPerApp){
  if (!apps?.length){ el.innerHTML = `<p>No applications.</p>`; return; }

  const rows = apps.map(a=>{
    const aud = a.audience || {};
    const uname = usernameMap.get(a.user_id) || a.user_id;

    const snapNums = snapNumsPerApp.get(a.id) || {};
    const userRowStats = statsPerUser.get(a.user_id) || {};

    const linksHtml = iconsGridHtml(Array.isArray(a.links) ? a.links : []);

    const submittedBlk = `
      <div>${fmtDate(a.created_at)}</div>
      <div style="margin-top:6px;font-size:.93em;opacity:.95">
        <div><b>Niche:</b> ${esc(aud.niche || '-')}</div>
        <div><b>Regions:</b> ${esc(aud.regions || '-')}</div>
        <div><b>Monthly Clicks:</b> ${fmtNum(aud.monthly_clicks)}</div>
      </div>
    `;

    const pitchBlk = `<div style="white-space:pre-wrap;">${esc(a.pinch || a.pitch || '')}</div>`;

    return `
      <tr>
        <td style="white-space:nowrap;vertical-align:top">${submittedBlk}</td>

        <td style="vertical-align:top">
          <div><b>${esc(uname)}</b></div>
          ${userStatsBlock(snapNums)}
          <div style="margin-top:4px;opacity:.9;font-size:.95em">${statsBadgeRow(userRowStats)}</div>
        </td>

        <td style="vertical-align:top">${esc(a.partner_type || 'affiliate')}</td>
        <td style="text-align:right;vertical-align:top">${a.desired_rate!=null ? Number(a.desired_rate).toFixed(2)+'%' : '-'}</td>
        <td style="vertical-align:top">${esc(a.status)}</td>
        <td style="max-width:340px;vertical-align:top">${pitchBlk}</td>

        <td style="min-width:240px;vertical-align:top">
          ${linksHtml ? `<div class="aa-links-wrap" style="margin-bottom:8px;">${linksHtml}</div>` : ''}
          <div class="aa-inline">
            <input class="aa-app-name aa-input" data-id="${esc(a.id)}" placeholder="partner name (optional)" style="flex:1;min-width:150px">
            <input class="aa-app-rate aa-input" data-id="${esc(a.id)}" type="number" step="0.01" min="0" max="100" value="${a.desired_rate ?? ''}" placeholder="%" style="width:90px">
          </div>
          <div class="aa-inline" style="margin-top:8px;">
            <button class="aa-approve aa-btn" data-id="${esc(a.id)}">Approve</button>
            <button class="aa-reject aa-btn" data-id="${esc(a.id)}" style="background:#e74c3c;">Reject</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div style="overflow:auto;">
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%">
        <thead>
          <tr>
            <th>Submitted</th><th>User</th><th>Type</th><th>Desired %</th><th>Status</th><th>Audience</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  wireIconFallbacks(el);

  el.querySelectorAll('.aa-approve').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.dataset.id;
      const rateEl = el.querySelector(`.aa-app-rate[data-id="${CSS.escape(id)}"]`);
      const nameEl = el.querySelector(`.aa-app-name[data-id="${CSS.escape(id)}"]`);
      const rate = rateEl?.value ? Number(rateEl.value) : null;
      const name = nameEl?.value?.trim() || null;
      await approveApplication(id, name, rate);
      await loadApplications();
      await loadPartnerList();
    });
  });
  el.querySelectorAll('.aa-reject').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      await rejectApplication(btn.dataset.id);
      await loadApplications();
    });
  });
}

/* =========================
   Totals calculator (rate * amount with $10 fallback)
   ========================= */

async function computeAffiliateTotals(partner){
  const DEFAULT_SIGNUP_PRICE = 10;
  const ratePct = Number(partner?.commission_rate ?? 0);
  const rate = ratePct / 100;

  // Read conversions for this partner
  const { data: rows, error } = await supabase
    .from('affiliate_conversions')
    .select('status, amount, referred_user_id')
    .eq('partner_id', partner.id);

  if (error || !rows?.length) {
    return {
      total_conversions: 0,
      unique_referred_users: 0,
      total_gmv: 0,
      pending_commission: 0,
      approved_commission: 0,
      paid_commission: 0
    };
  }

  let total_conversions = 0;
  let total_gmv = 0;
  let pending_commission = 0;
  let approved_commission = 0;
  let paid_commission = 0;
  const seen = new Set();

  for (const r of rows) {
    total_conversions += 1;
    const price = Number(r.amount ?? 0) || DEFAULT_SIGNUP_PRICE;
    total_gmv += price;
    if (r.referred_user_id) seen.add(r.referred_user_id);

    const commission = price * rate;
    const s = String(r.status || '').toLowerCase();
    if (s === 'pending') pending_commission += commission;
    else if (s === 'approved') approved_commission += commission;
    else if (s === 'paid') paid_commission += commission;
  }

  return {
    total_conversions,
    unique_referred_users: seen.size,
    total_gmv,
    pending_commission,
    approved_commission,
    paid_commission
  };
}

/* =========================
   Data loaders
   ========================= */

async function loadApplications(){
  const el = document.getElementById('aa-apps');
  const status = document.getElementById('aa-app-status')?.value || 'pending';
  const filterUser = document.getElementById('aa-app-user')?.value.trim();

  let q = supabase.from('affiliate_applications')
    .select('id,user_id,partner_type,desired_rate,status,created_at,pitch,audience,links,stats_snapshot,stats_captured_at')
    .order('created_at', { ascending: false });

  if (status === 'pending') q = q.in('status', ['submitted','under_review']);
  else if (status === 'approved') q = q.eq('status', 'approved');
  else if (status === 'rejected') q = q.eq('status', 'rejected');
  else if (status === 'draft') q = q.eq('status', 'draft');
  if (filterUser) q = q.eq('user_id', filterUser);

  const { data, error } = await q;
  if (error){ el.innerHTML = `<p>Error loading applications: ${esc(error.message)}</p>`; return; }

  const apps = data || [];
  if (!apps.length){ el.innerHTML = `<p>No applications.</p>`; return; }

  const userIds = [...new Set(apps.map(a=>a.user_id).filter(Boolean))];
  const usernameMap = new Map();
  if (userIds.length){
    const { data: urows } = await supabase.from('users_extended_data').select('user_id,username').in('user_id', userIds);
    (urows||[]).forEach(r=>usernameMap.set(r.user_id, r.username));
  }

  const snapNumsPerApp = new Map();
  apps.forEach(a => {
    const sn = numbersFromSnapshot(a.stats_snapshot);
    sn.collected_at = a.stats_captured_at || sn.collected_at || null;
    snapNumsPerApp.set(a.id, sn);
  });

  const statsPerUser = new Map();
  await Promise.all(userIds.map(async uid=>{
    const hasSnap = apps.some(a => a.user_id===uid && a.stats_snapshot && Object.keys(a.stats_snapshot||{}).length);
    statsPerUser.set(uid, hasSnap ? {} : await fetchPlatformStatsForUser(uid));
  }));

  renderApplicationsTable(el, apps, usernameMap, statsPerUser, snapNumsPerApp);
}

async function loadPartnerList(){
  const el = document.getElementById('aa-list');
  const filter = document.getElementById('aa-filter-user').value.trim();

  let query = supabase.from('affiliate_partners').select('*').order('created_at', { ascending: false });
  if (filter) query = query.eq('user_id', filter);

  const { data, error } = await query;
  if (error){ el.innerHTML = `<p>Error loading partners: ${esc(error.message)}</p>`; return; }

  const partners = data || [];
  const ids = [...new Set(partners.map(p=>p.user_id))];
  const usernameMap = new Map();
  if (ids.length){
    const { data: urows } = await supabase.from('users_extended_data').select('user_id,username').in('user_id', ids);
    (urows||[]).forEach(r=>usernameMap.set(r.user_id, r.username));
  }
  renderPartnerTable(el, partners, usernameMap);
}

async function loadPartner(partnerId){
  const elDetails = document.getElementById('aa-details');
  const elConvs   = document.getElementById('aa-conversions');

  const { data: partner, error: pErr } = await supabase
    .from('affiliate_partners')
    .select('*')
    .eq('id', partnerId)
    .maybeSingle();

  if (pErr || !partner){
    elDetails.innerHTML = `<p>Partner not found.</p>`;
    elConvs.innerHTML='';
    return;
  }

  // username (nice-to-have)
  let username = '';
  try{
    const { data: u } = await supabase
      .from('users_extended_data')
      .select('username')
      .eq('user_id', partner.user_id)
      .maybeSingle();
    username = u?.username || '';
  }catch{}

  // ---- Try to read the link first (may be blocked by RLS) ----
  let link = null;
  let readErr = null;
  try{
    const { data: linkRow } = await supabase
      .from('referral_links')
      .select('*')
      .eq('user_id', partner.user_id)
      .maybeSingle();
    link = normalizeReferralRow(linkRow);
  }catch(e){ readErr = e; }

  // ---- If missing or unreadable, ensure via Edge Function and USE ITS RETURN ----
  if (!link?.referral_code) {
    try {
      const ensured = await ensureReferralLink({ user_id: partner.user_id, partner_id: partner.id });
      if (ensured?.referral_code) {
        link = ensured;
      } else {
        const { data: linkRow2 } = await supabase
          .from('referral_links')
          .select('*')
          .eq('user_id', partner.user_id)
          .maybeSingle();
        link = normalizeReferralRow(linkRow2);
      }
    } catch(e) {
      if (readErr) console.debug('[aff-admin] referral_links read error:', readErr);
      console.debug('[aff-admin] ensure-referral-link error:', e);
    }
  }

  // ---- Totals (compute locally for correctness) ----
  let totals = await computeAffiliateTotals(partner);

  // ---- Render ----
  renderPartnerDetails(elDetails, partner, username, link, totals);

  // Wire the "copy URL" helper
  elDetails.querySelector('#aa-copy-url')?.addEventListener('click', ()=>{
    const inp = elDetails.querySelector('#aa-link-url');
    if (!inp) return;
    inp.select(); inp.setSelectionRange(0, 99999);
    document.execCommand('copy');
    uiToast('Copied referral URL.');
  });

  // Wire the "Set referral code" action
  const btnSet = elDetails.querySelector('#aa-code-update');
  const inpSet = elDetails.querySelector('#aa-code-input');
  if (btnSet && inpSet){
    btnSet.onclick = async ()=>{
      const desired = slugifyCode(inpSet.value);
      if (!desired) return uiToast('Enter a code (letters & numbers).');
      const result = await setReferralCode({ user_id: partner.user_id, partner_id: partner.id, code: desired });
      if (result.ok){
        uiToast(`Referral code set to “${desired}”.`);
        // Re-read & re-render to show new code
        await loadPartner(partnerId);
      }else{
        uiToast(result.error || 'Could not set referral code.');
      }
    };
  }

  // ---- Conversions list ----
  const { data: convs, error: cErr } = await supabase
    .from('affiliate_conversions').select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  if (cErr){ elConvs.innerHTML = `<p>Error loading conversions: ${esc(cErr.message)}</p>`; }
  else { renderConversions(elConvs, convs || [], partner.commission_rate);
}

  // ---- Mark selected paid ----
  const markBtn = document.getElementById('aa-mark-paid');
  markBtn.onclick = async ()=>{
    const ids = Array.from(document.querySelectorAll('.aa-cb:checked')).map(cb=>cb.value);
    if (!ids.length) return uiToast('Select at least one conversion.');
    const res = await callFunction('affiliate-mark-paid', { body:{ conversion_ids: ids } });
    if (res?.ok){ uiToast(`Marked ${ids.length} conversion(s) as paid.`); await loadPartner(partnerId); }
    else { uiToast(`Error: ${res?.message || res?.error || 'Unknown'}`); }
  };

  // ---- Approve all pending ----
  const btnApprovePending = elDetails.querySelector('#aa-approve-pending');
  if (btnApprovePending) {
    btnApprovePending.onclick = async () => {
      btnApprovePending.textContent = 'Approving…';
      const res = await callFunction('affiliate-approve-pending', { body: { partner_id: partner.id } });
      if (res?.ok) {
        uiToast(`Approved ${res.updated_count || 0} pending conversion(s).`);
        await loadPartner(partnerId);
      } else {
        uiToast(res?.message || res?.error || 'Could not approve pending.');
        btnApprovePending.textContent = 'Approve All Pending';
      }
    };
  }

// ---- Mark all approved as paid ----
const btnPayApproved = elDetails.querySelector('#aa-pay-approved');
if (btnPayApproved) {
  btnPayApproved.onclick = async () => {
    btnPayApproved.textContent = 'Marking…';

    const res = await callFunction('affiliate-mark-approved-paid', { body: { partner_id: partner.id } });

    if (res?.ok) {
      // Send a notification to each affected partner user
      if (Array.isArray(res.partner_user_ids) && res.partner_user_ids.length) {
        await Promise.all(
          res.partner_user_ids.map(uid =>
            notifyOfferUpdate({
              to_user_id: uid,
              offer_id: null,
              type: 'offer_update',
              title: 'Affiliate payout sent',
              message: `We just marked ${res.updated_count ?? 0} commission(s) as Paid.`
            })
          )
        );
      } else {
        // Fallback: notify the current partner’s user
        await notifyOfferUpdate({
          to_user_id: partner.user_id,
          offer_id: null,
          type: 'offer_update',
          title: 'Affiliate payout sent',
          message: `We just marked ${res.updated_count ?? 0} commission(s) as Paid.`
        });
      }

      uiToast(`Marked ${res.updated_count ?? 0} approved conversion(s) paid.`);
      await loadPartner(partnerId);
    } else {
      uiToast(res?.message || res?.error || 'Could not mark approved paid.');
      btnPayApproved.textContent = 'Mark All Approved Paid';
    }
  };
}

}

function renderConversions(el, list, ratePct){
  if (!list?.length){ el.innerHTML = `<p>No conversions.</p>`; return; }

  const DEFAULT_SIGNUP_PRICE = 10;
  const rateNum = Number(ratePct ?? 0);
  const rate = isNaN(rateNum) ? 0 : rateNum / 100;
  const rateLabel = isNaN(rateNum) ? '—' : (
    Number.isInteger(rateNum) ? `${rateNum.toFixed(0)}%` : `${rateNum.toFixed(2)}%`
  );

  const rows = list.map(c=>{
    // price we base commission on
    const price = (c.amount != null && !isNaN(Number(c.amount))) ? Number(c.amount) : DEFAULT_SIGNUP_PRICE;

    // If a row already has a stored commission, use it; otherwise compute from rate
    const earned = (c.commission != null && !isNaN(Number(c.commission)))
      ? Number(c.commission)
      : price * rate;

    return `
      <tr>
        <td><input type="checkbox" class="aa-cb" value="${esc(c.id)}"></td>
        <td>${esc(c.referred_user_id || '-')}</td>
        <td>${esc(c.status)}</td>
        <!-- Amount column shows how much they EARNED for this conversion -->
        <td>${fmtMoney(earned)}</td>
        <!-- Commission column shows the partner's commission RATE for clarity -->
        <td>${rateLabel}</td>
        <td>${fmtDate(c.created_at)}</td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <table border="1" cellspacing="0" cellpadding="6" style="width:100%">
      <thead>
        <tr>
          <th></th>
          <th>Referred User</th>
          <th>Status</th>
          <th>Amount (Earned)</th>
          <th>Commission</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}


/* =========================
   Actions
   ========================= */

function uiToast(msg) {
  try {
    const div = document.createElement('div');
    div.textContent = msg;
    div.style.cssText = 'position:fixed;right:16px;bottom:16px;background:#111;color:#fff;border:1px solid #2b2b2b;padding:10px 14px;border-radius:8px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.25);';
    document.body.appendChild(div);
    setTimeout(()=>div.remove(), 2200);
  } catch { alert(msg); }
}

async function onSavePartner(){
  const user_id = document.getElementById('aa-user-id').value.trim();
  const partner_type = document.getElementById('aa-partner-type').value;
  const commission_rate = Number(document.getElementById('aa-rate').value || 0);
  const active = document.getElementById('aa-active').checked;

  if (!user_id) return uiToast('Enter a user_id.');
  if (commission_rate < 0 || commission_rate > 100) return uiToast('Rate must be 0..100.');

  const res = await callFunction('affiliate-register', { body:{ user_id, partner_type, commission_rate, active } });
  if (res?.ok){
    try { await ensureReferralLink({ user_id }); } catch {}
    uiToast('Partner saved.');
    document.getElementById('aa-filter-user').value = user_id;
    await loadPartnerList();
  } else {
    uiToast(`Error: ${res?.message || res?.error || 'Unknown'}`);
  }
}

async function onEnsureLink(){
  const user_id = document.getElementById('aa-user-id').value.trim();
  if (!user_id) return uiToast('Enter a user_id first.');
  const link = await ensureReferralLink({ user_id });
  const out = document.getElementById('aa-ensure-result');
  if (link?.referral_code){
    const full = `${window.location.origin}/?ref=${esc(link.referral_code)}`;
    out.innerHTML = `Referral code: <code>${esc(link.referral_code)}</code><br>URL: <input style="width:100%" class="aa-input" value="${full}" readonly>`;
    uiToast('Referral link ensured.');
  } else {
    out.textContent = `Error: could not ensure referral link.`;
  }
}

/* Approve / Reject via RPCs */

async function approveApplication(p_app_id, partner_name = null, rateMaybe = null) {
  const { data: app } = await supabase
    .from('affiliate_applications')
    .select('user_id')
    .eq('id', p_app_id)
    .maybeSingle();
  const uid = app?.user_id || null;

  const p_commission_rate = (rateMaybe == null || isNaN(Number(rateMaybe))) ? null : Number(rateMaybe);
  const p_note = (partner_name || '').trim() || null;

  const { error } = await supabase.rpc('approve_affiliate', {
    p_app_id,
    p_commission_rate,
    p_note
  });
  if (error) { uiToast(`Approve error: ${error.message || error}`); return; }

  // Try to create with the pretty code immediately
  const preferred = slugifyCode(partner_name) || null;
  try { if (uid) await ensureReferralLink({ user_id: uid, preferred_code: preferred }); } catch {}

  if (uid) {
    const msg = `You’ve been approved${partner_name ? ` as “${partner_name}”` : ''}${p_commission_rate!=null ? ` at ${p_commission_rate.toFixed(2)}%` : ''}.`;
    await notifyOfferUpdate({ to_user_id: uid, offer_id: null, type: 'offer_update', title: 'Affiliate application approved', message: msg });
  }
  uiToast('Application approved.');
}

async function rejectApplication(p_app_id) {
  const { data: app } = await supabase
    .from('affiliate_applications')
    .select('user_id')
    .eq('id', p_app_id)
    .maybeSingle();
  const uid = app?.user_id || null;

  const { error } = await supabase.rpc('reject_affiliate', { p_app_id });
  if (error) { uiToast(`Reject error: ${error.message || error}`); return; }

  if (uid) {
    await notifyOfferUpdate({
      to_user_id: uid, offer_id: null, type: 'offer_update',
      title: 'Affiliate application rejected',
      message: 'Thanks for applying. Unfortunately your application was not approved at this time.'
    });
  }
  uiToast('Application rejected.');
}

/* =========================
   Init
   ========================= */

document.addEventListener('DOMContentLoaded', async ()=>{
  const root = document.getElementById('admin-affiliate-section');
  if (!root) return;

  const { data:{ user } } = await supabase.auth.getUser();
  if (!user){ root.innerHTML = `<p>Please log in as admin.</p>`; return; }
  const { data: me } = await supabase.from('users_extended_data').select('is_admin').eq('user_id', user.id).maybeSingle();
  if (!me?.is_admin){ root.innerHTML = `<p>Admin access required.</p>`; return; }

  renderShell(root);

  document.getElementById('aa-app-refresh').addEventListener('click', loadApplications);
  document.getElementById('aa-app-user').addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadApplications(); });
  document.getElementById('aa-app-status').addEventListener('change', loadApplications);

  document.getElementById('aa-register-btn').addEventListener('click', onSavePartner);
  document.getElementById('aa-ensure-link-btn').addEventListener('click', onEnsureLink);
  document.getElementById('aa-refresh-list').addEventListener('click', loadPartnerList);
  document.getElementById('aa-filter-user').addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadPartnerList(); });

  await loadApplications();
  await loadPartnerList();
});
