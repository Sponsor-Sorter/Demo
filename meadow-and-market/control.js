(() => {
 'use strict';
 let api,identity='',latest=null,loading=null,attempted='',shown='',dialog;
 const seen=new Set(),appeals=new Map();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const owner=()=>api?.user()?.id||'';
 const build=()=>Number(/[?&]v=(\d+)/.exec(document.querySelector('script[src^="game.js?"]')?.getAttribute('src')||'')?.[1])||222;
 function blocked(){return !!owner()&&owner()===identity&&latest?.enforced===true&&(latest.session_expired===true||latest.moderation?.banned===true||(latest.runtime?.maintenance===true&&!latest.admitted));}
 async function request(action,data={}){
  const who=owner();if(!who||!api.client())throw Error('Connect to your farm first.');
  const r=await api.client().rpc('meadow_market_control_service',{p_action:action,p_data:['status','admit'].includes(action)?{...data,build:build()}:data});
  if(who!==owner())throw Error('Account changed. Reopen your account notices.');
  if(r.error)throw Object.assign(Error(r.error.code==='28000'?'Sign in again to review your farm account.':r.error.message||'Account notices are unavailable.'),{code:r.error.code==='28000'?'SESSION_EXPIRED':r.error.code});
  return r.data;
 }
 function label(d){return d.kind==='moderation.ban'?'Farm access paused':d.kind==='moderation.restrict'?'Social and new ranked play restricted':'Community warning';}
 async function refresh(){
  if(!owner()){identity='';latest=null;dialog?.close();return}if(loading)return loading;
  const who=owner();if(identity!==who){identity=who;latest=null;attempted='';shown='';seen.clear();appeals.clear();dialog?.close();}
  loading=(async()=>{
   latest=await request('status');const admissionKey=who+':'+latest.enforced;
   if(latest.game_account_ready!==false&&latest.enforced&&!latest.admitted&&!latest.moderation?.banned&&!latest.runtime?.maintenance&&attempted!==admissionKey){attempted=admissionKey;latest=await request('admit');}
   for(const notice of latest.runtime?.notices||[]){const key='notice:'+notice.id;if(!seen.has(key)){seen.add(key);api.notify(notice.title+' · '+notice.message);}}
  const warnings=(latest.moderation?.decisions||[]).filter(d=>(d.kind==='moderation.warning'&&!d.acknowledged_at)||d.kind==='moderation.restrict'),key=blocked()?'blocked:'+(latest.moderation?.decisions||[]).map(d=>d.id).join(',')+':'+latest.runtime?.maintenance:warnings.map(d=>d.id).join(',');
   if(!key)shown='';else if(key!==shown&&!document.querySelector('dialog[open]')){shown=key;open();}
  })().catch(e=>{if(e.code==='SESSION_EXPIRED'&&who===owner()){latest={enforced:true,session_expired:true};if(!document.querySelector('dialog[open]'))open();return}throw e}).finally(()=>loading=null);return loading;
 }
 async function open(){
  if(!owner()){api?.notify('Sign in to review your farm account.');return}if(identity!==owner())latest=null;
  if(!latest)try{await refresh()}catch(e){api?.notify(e.message);return}
  if(dialog?.open)return;
  const who=owner();dialog=document.createElement('dialog');dialog.className='meadow-safety-dialog meadow-control-dialog';dialog.setAttribute('aria-label','Your farm account notices');
  const decisions=latest?.moderation?.decisions||[],notices=latest?.runtime?.notices||[];
  dialog.innerHTML='<header><h2>Your farm account</h2><button class="close-button" aria-label="Close account notices">×</button></header><div class="safety-body">'+
   (latest?.session_expired?'<p>Your sign-in session has ended. Your saved farm is retained. Open Account & recovery below to sign in again.</p>':'')+
   (latest?.runtime?.maintenance?'<p>Farm maintenance is in progress. Existing admitted sessions can finish their work. New game sessions are paused; saved farms and account help remain available.</p>':'')+
   decisions.map(d=>'<section class="control-decision"><h3>'+esc(label(d))+'</h3><p>'+esc(d.reason)+'</p><small>Until '+esc(new Date(d.expires_at).toLocaleString())+'</small>'+(d.kind==='moderation.warning'&&!d.acknowledged_at?'<button class="small-button full-button" data-warning="'+esc(d.id)+'">I have read this warning</button>':'')+'<details><summary>Ask for a review</summary><label>Your explanation<textarea maxlength="2000" rows="3" data-reason="'+esc(d.id)+'"></textarea></label><button class="small-button full-button" data-appeal="'+esc(d.id)+'">Send appeal</button></details></section>').join('')+
   notices.map(n=>'<section class="control-decision"><h3>'+esc(n.title)+'</h3><p>'+esc(n.message)+'</p></section>').join('')+
   (!decisions.length&&!notices.length&&!latest?.runtime?.maintenance&&!latest?.session_expired?'<p>No account restrictions or notices.</p>':'')+
   '<button class="small-button full-button" id="control-account">Account, recovery & settings</button><p><a href="mailto:meadowmarkets@sponsorsorter.com">Contact Meadow Markets support</a></p></div><p class="safety-status" role="status"></p>';
  document.body.append(dialog);const current=dialog,status=t=>{if(current.isConnected&&who===owner())current.querySelector('.safety-status').textContent=t;};
  current.querySelector('header button').onclick=()=>current.close();current.addEventListener('close',()=>current.remove(),{once:true});
  current.querySelector('#control-account').onclick=()=>{current.close();document.getElementById('settings-button')?.click();};
  for(const button of current.querySelectorAll('[data-warning]'))button.onclick=async()=>{button.disabled=true;try{await request('ack',{decision:button.dataset.warning});status('Warning acknowledged.');button.textContent='Acknowledged';await refresh()}catch(e){status(e.message);button.disabled=false}};
  for(const button of current.querySelectorAll('[data-appeal]'))button.onclick=async()=>{button.disabled=true;try{const id=button.dataset.appeal,reason=current.querySelector('[data-reason="'+id+'"]').value.trim();if(reason.length<5)throw Error('Please explain what you would like reviewed.');if(!appeals.has(id))appeals.set(id,crypto.randomUUID());const r=await request('appeal',{decision:id,request_id:appeals.get(id),reason});status('Appeal received. Reference: '+r.reference);button.textContent=r.duplicate?'Appeal already received':'Appeal sent';}catch(e){status(e.message);button.disabled=false}};
  current.showModal();
 }
 function intercept(e){
  if(!blocked()||e.target.closest?.('[data-close],.close-button,#build-done,#build-minimize,#settings-button'))return;
  if(e.target.closest?.('#farm-land,.farm-hud,.scene-actions,#map-switch,#roster-button,#friends-button,#vip-pill')){e.preventDefault();e.stopImmediatePropagation();open();}
 }
 function attach(a){
  api=a;const update=()=>refresh().catch(e=>{if(/Sign in again/.test(e.message))api.notify(e.message)});
  for(const event of ['meadow-cloud-ready','meadow-control-refresh','online'])window.addEventListener(event,update);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
  for(const event of ['pointerdown','click'])document.addEventListener(event,intercept,true);
  setInterval(()=>{if(!document.hidden)update()},30000);update();
 }
 window.meadowControl={attach,refresh,open,blocked};
})();
