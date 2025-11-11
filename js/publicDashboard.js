// public/js/publicdashboard.js (icons for Linked Platforms; no money; grey empty stars; CTAs under avatar)
import { supabase } from './supabaseClient.js';

const $ = (id) => document.getElementById(id);
const q = (sel) => document.querySelector(sel);
const log = (...a) => console.log('[publicdashboard]', ...a);

/* -------- Slug (prefer ?u=, fallback /u/<slug>) -------- */
function getSlugFromLocation() {
  const qp = new URLSearchParams(location.search).get('u');
  if (qp) return decodeURIComponent(qp);
  const path = (location.pathname || '').replace(/\/+$/, '');
  const m = path.match(/\/u\/([^/]+)$/i);
  if (m && m[1] && m[1].toLowerCase() !== 'index.html') return decodeURIComponent(m[1]);
  return '';
}

/* ---------------- Utils ---------------- */
function resolveProfilePic(val) {
  if (!val) return '../logos.png';
  if (/^https?:\/\//i.test(val)) return val;
  return `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${val}`;
}
function initialAvatar(name){ const s=String(name||'SS').trim(); return s? s[0].toUpperCase() : 'S'; }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function niceName(k){ const s=String(k||'').toLowerCase();
  const map={yt:'YouTube',youtube:'YouTube',ig:'Instagram',instagram:'Instagram',tiktok:'TikTok',tt:'TikTok',x:'X',twitter:'X',twitch:'Twitch',fb:'Facebook',facebook:'Facebook'};
  return map[s]||s.charAt(0).toUpperCase()+s.slice(1);
}
function guessHandleUrl(kind,value){
  const v=String(value||'').replace(/^@/,''); const k=String(kind||'').toLowerCase();
  if(k==='youtube'||k==='yt') return `https://youtube.com/@${v}`;
  if(k==='instagram'||k==='ig')return `https://instagram.com/${v}`;
  if(k==='tiktok'||k==='tt')   return `https://tiktok.com/@${v}`;
  if(k==='x'||k==='twitter')   return `https://x.com/${v}`;
  if(k==='twitch')             return `https://twitch.tv/${v}`;
  if(k==='facebook'||k==='fb') return `https://facebook.com/${v}`;
  if(/^https?:\/\//i.test(value)) return value;
  return '#';
}
function safeArray(x){ if(!x) return []; if(Array.isArray(x)) return x; try{const p=typeof x==='string'?JSON.parse(x):x; return Array.isArray(p)?p:[]}catch{return[];} }

/* -------- Platform icons (use your existing files) -------- */
const ASSET_BASE = '../'; // public page sits under /u/, assets are one level up
function platformIconSrc(kind){
  const k = String(kind||'').toLowerCase();
  const map = {
    youtube: 'youtubelogo.png', yt: 'youtubelogo.png',
    instagram: 'instagramlogo.png', ig: 'instagramlogo.png',
    tiktok: 'tiktoklogo.png', tt: 'tiktoklogo.png',
    twitter: 'twitterlogo.png', x: 'twitterlogo.png',
    twitch: 'twitchlogo.png',
    facebook: 'facebooklogo.png', fb: 'facebooklogo.png'
  };
  const file = map[k] || 'logos.png';
  return ASSET_BASE + file;
}
function makeHandleIcon(kind, value){
  const a = document.createElement('a');
  a.className = 'handle';
  a.target = '_blank';
  a.rel = 'noopener';
  a.href = guessHandleUrl(kind, value);
  a.title = `${niceName(kind)}: ${String(value).startsWith('@')? value : '@'+value}`;

  const img = document.createElement('img');
  img.src = platformIconSrc(kind);
  img.alt = niceName(kind);
  img.style.width = '30px';
  img.style.height = '30px';
  img.style.verticalAlign = '-4px';
  img.style.display = 'inline-block';
  img.style.objectFit = 'contain';
  img.style.borderRadius = '10px';

  a.textContent = ''; // icon only
  a.appendChild(img);
  return a;
}
function makePlatformIcon(kind){
  const span = document.createElement('span');
  span.className = 'handle';
  span.title = niceName(kind);

  const img = document.createElement('img');
  img.src = platformIconSrc(kind);
  img.alt = niceName(kind);
  img.style.width = '22px';
  img.style.height = '22px';
  img.style.verticalAlign = '-4px';
  img.style.display = 'inline-block';
  img.style.objectFit = 'contain';

  span.textContent = '';
  span.appendChild(img);
  return span;
}

/* -------- Remove/Hide any money UI still in the HTML -------- */
function removeAmountColumn(tableEl){
  if (!tableEl) return;
  const ths = tableEl.querySelectorAll('thead th');
  let idx = -1;
  ths.forEach((th, i) => {
    const t = (th.textContent || '').trim().toLowerCase();
    if (t.includes('amount')) idx = i;
  });
  if (idx === -1) return;
  ths[idx]?.remove();
  tableEl.querySelectorAll('tbody tr').forEach(tr => {
    if (tr.children[idx]) tr.children[idx].remove();
  });
}
function stripMoneyUI(){
  const vol = $('kpi-volume');
  if (vol) vol.closest('.card')?.remove();
  const recentTable = document.querySelector('.recent-deals table, fieldset.recent-deals table, table.recent-deals');
  removeAmountColumn(recentTable);
  const histTable = document.querySelector('.Archived-deals table, fieldset.Archived-deals table, table.Archived-deals');
  removeAmountColumn(histTable);
}

/* --------------- SEO --------------- */
function setOG(p){
  const title=`${p.username||'Creator'} — Sponsor Sorter`;
  const desc=p.title||p.about_yourself||'Creator profile and reviews.';
  const img=resolveProfilePic(p.profile_pic);
  document.title = `${p.username || 'Public Profile'} — Sponsor Sorter`;
  const add=(attr,name,content)=>{ const m=document.createElement('meta'); m.setAttribute(attr==='property'?'property':'name',name); m.setAttribute('content',content); document.head.appendChild(m); };
  add('property','og:title',title); add('property','og:description', String(desc||'').slice(0,180)); add('property','og:image',img);
  add('name','twitter:title',title); add('name','twitter:description', String(desc||'').slice(0,180));
}

/* --------------- Stars (filled vs empty colors) --------------- */
function renderStarsInto(containerEl, avg){
  if (!containerEl) return;
  containerEl.innerHTML = '';
  const n = Number(avg);
  const full = Math.max(0, Math.min(5, Math.floor(isFinite(n) ? n : 0)));
  for (let i = 1; i <= 5; i++){
    const span = document.createElement('span');
    span.className = 'star ' + (i <= full ? 'full' : 'empty');
    span.textContent = '★';
    containerEl.appendChild(span);
  }
}

/* --------------- Renderers --------------- */
function moveCTAsUnderAvatar(){
  const pic = q('.profile-picture');
  const ctas = q('.cta-row');
  if (pic && ctas && ctas.parentElement !== pic) {
    pic.appendChild(ctas);
  }
}

function renderProfile(p){
  // avatar
  const av=$('avatar');
  if(p.profile_pic){ const img=document.createElement('img'); img.src=resolveProfilePic(p.profile_pic); img.alt=p.username||'Avatar'; av.replaceWith(img); }
  else { av.textContent = initialAvatar(p.username); }

  // header + pills
  const role = p.user_type==='besponsored' ? 'Sponsee' : (p.user_type ? 'Sponsor' : '');
  if(role){ const el=$('role-pill'); el.style.display='inline-flex'; el.textContent=role; }
  if(p.location){ const el=$('loc-pill'); el.style.display='inline-flex'; el.textContent=p.location; }
  if(typeof p.review_count==='number'){ const el=$('reviews-pill'); el.style.display='inline-flex'; el.textContent=`${p.review_count} review${p.review_count===1?'':'s'}`; }

  // details
  $('user-username').textContent = p.username || '—';
  $('user-location').textContent = p.location || '—';
  $('user-gender').textContent   = p.title || '—';
  const ctEl = $('contenttype'); if (ctEl) ctEl.textContent = p.contenttype || '—';
  $('about').textContent         = p.about_yourself || '—';

  // rating
  renderStarsInto($('stars'), p.avg_rating);
  $('avg').textContent   = (p.avg_rating||p.avg_rating===0)? Number(p.avg_rating).toFixed(2) : '—';

  // handles/platforms → ICONS ONLY
  const handlesWrap = $('handles'); handlesWrap.innerHTML='';
  const handles = (p.social_handles && typeof p.social_handles==='object')? p.social_handles : null;
  const platforms = safeArray(p.platforms);
  if(!handles && platforms.length===0){
    handlesWrap.innerHTML = `<span class="muted">No platforms connected.</span>`;
  } else {
    const frag=document.createDocumentFragment();
    if(handles){
      Object.entries(handles).forEach(([k,v])=>{
        if(!v) return;
        frag.appendChild(makeHandleIcon(k, v));
      });
    }
    if(!handles || platforms.length){
      platforms.forEach(pf => frag.appendChild(makePlatformIcon(pf)));
    }
    handlesWrap.appendChild(frag);
    const linked = $('linked-accounts');
    if (linked) linked.innerHTML = handlesWrap.innerHTML;
  }

  // put CTAs under the avatar column
  moveCTAsUnderAvatar();

  setOG(p);
}

function renderKPIs(k){
  $('kpi-total').textContent     = (k?.total_offers ?? 0).toLocaleString();
  $('kpi-active').textContent    = (k?.active_offers ?? 0).toLocaleString();
  $('kpi-completed').textContent = (k?.completed_offers ?? 0).toLocaleString();
}

function renderRecentDeals(rows){
  const tb=$('recent-deals-body'); tb.innerHTML='';
  if(!rows?.length){ tb.innerHTML=`<tr><td colspan="5" class="muted">No recent deals.</td></tr>`; return; }
  const frag=document.createDocumentFragment();
  rows.forEach(r=>{
    const created=r.created_at? new Date(r.created_at):null;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${r.sponsee_username ?? '—'}</td>
      <td>${r.status ?? '—'}</td>
      <td>${created ? created.toLocaleDateString() : '—'}</td>
      <td>${r.deadline ?? '—'}</td>
      <td>${r.live_date ?? '—'}</td>`;
    frag.appendChild(tr);
  });
  tb.appendChild(frag);
}

function renderHistory(rows){
  const tb=$('history-body'); tb.innerHTML='';
  if(!rows?.length){ tb.innerHTML=`<tr><td colspan="6" class="muted">No completed/archived deals yet.</td></tr>`; return; }
  const frag=document.createDocumentFragment();
  rows.forEach(r=>{
    const created=r.created_at? new Date(r.created_at):null;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${r.sponsee_username ?? '—'}</td>
      <td>${created ? created.toLocaleDateString() : '—'}</td>
      <td>${r.live_date ?? '—'}</td>
      <td>${r.deadline ?? '—'}</td>
      <td>${r.sponsor_to_sponsee ?? '—'}</td>
      <td>${r.sponsee_to_sponsor ?? '—'}</td>`;
    frag.appendChild(tr);
  });
  tb.appendChild(frag);
}

function renderReviews(items){
  const wrap=$('reviews'); wrap.innerHTML='';
  if(!items||!items.length){ wrap.innerHTML=`<div class="muted">No reviews yet.</div>`; return; }
  const frag=document.createDocumentFragment();
  items.forEach(r=>{
    const d=new Date(r.created_at);
    const el=document.createElement('div'); el.className='review';
    el.innerHTML=`<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
        <div class="stars">${/* fallback if CSS disabled */''}</div>
        <div class="muted" style="font-size:12px;">${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div style="margin-top:4px;color:#dbe7ff;">${escapeHtml(r.review_text||'')}</div>
      <div class="muted" style="margin-top:6px;font-size:12px;">by ${r.reviewer_role==='sponsor'?'Sponsor':'Sponsee'}</div>`;
    frag.appendChild(el);
    // render star objs into the inner .stars
    const starsEl = el.querySelector('.stars');
    renderStarsInto(starsEl, r.rating);
  });
  wrap.appendChild(frag);
}

/* ---------------- Load ---------------- */
async function load(){
  // strip any money UI first so headers match our row cells
  stripMoneyUI();

  const slug=getSlugFromLocation();
  if(!slug){ q('.wrap').innerHTML=`<p class="err">Profile link is missing.</p>`; return; }

  // Profile
  const { data: profile, error: perr } = await supabase
    .from('public_user_profiles')
    .select('user_id, slug, username, title, company_name, location, about_yourself, user_type, platforms, social_handles, profile_pic, created_at, avg_rating, review_count, contenttype')
    .eq('slug', slug)
    .maybeSingle();

  if (perr) { console.error(perr); q('.wrap').innerHTML=`<p class="err">This public profile is unavailable or disabled.</p>`; return; }
  if (!profile || profile.slug == null) { q('.wrap').innerHTML=`<p class="err">This public profile is unavailable or disabled.</p>`; return; }

  renderProfile(profile);

  // KPIs (counts only)
  const { data: kpi } = await supabase.rpc('get_public_summary', { p_slug: slug });
  renderKPIs(Array.isArray(kpi) ? kpi[0] : kpi);

  // Recent deals (no amount)
  const { data: recents } = await supabase.rpc('get_public_recent_deals', { p_slug: slug, p_limit: 6 });
  renderRecentDeals(recents || []);

  // History (no amount)
  const { data: history } = await supabase.rpc('get_public_history', { p_slug: slug, p_limit: 20 });
  renderHistory(history || []);

  // Reviews (view)
  const { data: reviews } = await supabase
    .from('public_profile_reviews')
    .select('created_at, rating, review_text, reviewer_role')
    .eq('slug', slug)
    .order('created_at', { ascending: false })
    .limit(6);

  renderReviews(reviews || []);
}

load().catch(e => { console.error(e); q('.wrap').innerHTML=`<p class="err">Unexpected error loading profile.</p>`; });
