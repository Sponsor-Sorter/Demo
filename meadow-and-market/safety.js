(() => {
 'use strict';
 let api,acceptedOwner='',rulesPending=null;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const owner=()=>api?.user()?.id||'';
 async function request(action,extra={}){
  const who=owner();if(!who)throw Error('Connect your farm to use community controls.');
  const result=await api.client().rpc('meadow_market_social_safety',{p_action:action,...extra});
  if(who!==owner())throw Error('Your account changed. Please reopen this screen.');
  if(result.error)throw Error(result.error.message||'Could not save. Please try again.');
  if(result.data?.rules_version===1)acceptedOwner=who;return result.data;
 }
 function dialog(title){
  const d=document.createElement('dialog');d.className='meadow-safety-dialog';d.setAttribute('aria-label',title);
  d.innerHTML='<header><h2>'+escape(title)+'</h2><button class="close-button" aria-label="Close safety controls">×</button></header><div class="safety-body"></div><p class="safety-status" role="status"></p>';
  document.body.append(d);d.querySelector('header button').onclick=()=>d.close();d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;
 }
 function error(d,e){if(d.isConnected)d.querySelector('.safety-status').textContent=e.message||'Please try again.'}
 async function ensureRules(){
  const who=owner();if(who&&acceptedOwner===who)return true;if(rulesPending)return rulesPending;
  rulesPending=(async()=>{try{const info=await request('status');if(info.rules_version===1)return true;
   return await new Promise(resolve=>{const d=dialog('Our farm community');let agreed=false;
    d.querySelector('.safety-body').innerHTML='<p>Keep farm names and interactions friendly. No harassment, hate, sexual content, scams, cheating or personal information. Respect other players.</p><p>You can report or block a farm from Friends, a visit or the visitor log. Reports are reviewed; breaking the rules can lead to a removed name or restricted social access.</p><p><a href="community.html" target="_blank" rel="noopener">Read the community rules</a></p><button class="primary-button full-button" id="safety-accept">Agree & continue</button>';
    d.addEventListener('close',()=>resolve(agreed&&who===owner()),{once:true});
    d.querySelector('#safety-accept').onclick=async e=>{e.target.disabled=true;try{await request('accept_rules');agreed=true;d.close()}catch(err){error(d,err);e.target.disabled=false}};
   });
  }catch(e){api.notify(e.message);return false}})();
  try{return await rulesPending}finally{rulesPending=null}
 }
 function show(target,name='Meadow Farmer'){
  if(!target||target===owner())return;const who=owner(),d=dialog('Farm safety'),body=d.querySelector('.safety-body');
  body.innerHTML='<h3>'+escape(name)+'</h3><label>Report reason<select id="safety-reason"><option value="name">Inappropriate farm name</option><option value="harassment">Harassment or unsafe behaviour</option><option value="cheating">Cheating or exploit</option><option value="other">Something else</option></select></label><label>Details (optional)<textarea id="safety-details" maxlength="500" rows="3" placeholder="What happened? Do not include passwords or personal details."></textarea></label><button class="primary-button full-button" id="safety-report">Send report</button><hr><p>Blocking removes your connection and pending help, and hides your farms from each other. You can unblock in Settings.</p><button class="small-button full-button" id="safety-block">Block this farm</button>';
  let reportId='',reportText='';
  body.querySelector('#safety-report').onclick=async e=>{const button=e.target;button.disabled=true;try{if(who!==owner())throw Error('Your account changed. Reopen this screen.');
   const reason=body.querySelector('#safety-reason').value,details=body.querySelector('#safety-details').value.trim(),payload=JSON.stringify([reason,details]);
   if(payload!==reportText){reportId=crypto.randomUUID();reportText=payload}
   await request('report',{p_target:target,p_reason:reason,p_details:details,p_request:reportId});
   if(d.isConnected){d.querySelector('.safety-status').textContent='Report received. Thank you. You can also block this farm.';button.textContent='Report sent'}
  }catch(err){error(d,err);button.disabled=false}};
  body.querySelector('#safety-block').onclick=async e=>{const b=e.target;b.disabled=true;try{if(who!==owner())throw Error('Your account changed. Reopen this screen.');await request('block',{p_target:target});d.close();if(api.visit()?.userId===target)api.closeVisit();api.refreshFriends();api.notify('Farm blocked. Manage blocked farms in Settings.')}catch(err){error(d,err);b.disabled=false}};
 }
 async function manage(){
  const who=owner(),d=dialog('Community & blocked farms'),body=d.querySelector('.safety-body');body.textContent='Loading…';
  try{const info=await request('status');if(!d.isConnected||who!==owner())return;
   body.innerHTML='<p><a href="community.html" target="_blank" rel="noopener">Community rules & reporting</a></p><p>Unblocking does not restore a friend connection. Both players must connect again.</p>'+((info.blocked||[]).map(b=>'<div class="safety-blocked"><span>'+escape(b.name||'Meadow Farmer')+'</span><button class="small-button" data-unblock="'+escape(b.user_id)+'">Unblock</button></div>').join('')||'<p>No blocked farms.</p>');
   body.querySelectorAll('[data-unblock]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{if(who!==owner())throw Error('Your account changed. Reopen this screen.');await request('unblock',{p_target:b.dataset.unblock});b.parentElement.remove();api.refreshFriends();d.querySelector('.safety-status').textContent='Farm unblocked.'}catch(e){error(d,e);b.disabled=false}});
  }catch(e){body.textContent='';error(d,e)}
 }
 function mount(root){root?.querySelectorAll('[data-safety-user]').forEach(card=>{if(card.querySelector('[data-farm-safety]'))return;const b=document.createElement('button');b.className='small-button safety-link';b.dataset.farmSafety='';b.textContent='Report / block';b.onclick=()=>show(card.dataset.safetyUser,card.dataset.safetyName);card.append(b)})}
 window.meadowSafety={attach(a){api=a},ensureRules,show,manage,mount,escape};
})();
