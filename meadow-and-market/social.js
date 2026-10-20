(() => {
 'use strict';
 let api,identity='',channel=null,refreshing=false,logRows=[],summary={requests:0,visits:0},helpBusy=false;
 const animalTypes=['chicken','cow','sheep','goat','alpaca'],icons={visit:'👋',water:'💧',feed:'🥕',cheer:'💛'};
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function applyHelp(state,event,rules={},now=Date.now()){
  state.friendHelpApplied ||= {};const old=state.friendHelpApplied[event.id];if(old)return {outcome:old,duplicate:true};
  const farm=state.farms?.[event.map_id],o=farm?.objects?.find(o=>o.id===event.target_id);let outcome='not_needed';
  if(o&&event.action==='water'&&o.type==='plot'&&o.plantedAt&&Number(o.plantedAt)===Number(event.target_cycle)&&!o.wateredUntil){o.wateredUntil=now+(rules.crops?.[o.crop]?.time||60000)*3;outcome='applied'}
  if(o&&animalTypes.includes(o.type)&&['feed','cheer'].includes(event.action)){rules.settleAnimal?.(o);const key=event.action==='feed'?'hunger':'happy',before=Number(o[key])||0;if(before<100){o[key]=Math.min(100,before+20);o.needsAt=now;o.lastCare=now;outcome='applied'}}
  state.friendHelpApplied[event.id]=outcome;return {outcome,duplicate:false};
 }
 function user(){return api?.user()?.id||''}
 async function deliver(){
  if(!api.canApply())return;const who=user(),client=api.client();const r=await client.from('meadow_market_visit_events').select('id,owner_id,map_id,action,target_id,target_cycle,outcome').eq('owner_id',who).eq('outcome','pending').neq('action','visit').order('created_at').limit(100);
  if(r.error||who!==user()||!api.canApply())return;
  let changed=false;for(const row of r.data||[]){if(row.owner_id!==who)continue;const result=applyHelp(api.state(),row,api.rules);if(!result.duplicate)changed=true;row.outcome=result.outcome}
  if(!(r.data||[]).length)return;if(changed){api.save();api.render()}
  try{await api.flush()}catch{return}
  if(who!==user())return;await client.rpc('meadow_market_ack_help',{p_events:r.data.map(row=>({id:row.id,outcome:row.outcome}))})
 }
 async function refresh(){
  if(!api?.ready()||document.hidden||refreshing)return;refreshing=true;const who=user();
  try{
   if(identity!==who){identity=who;summary={requests:0,visits:0};logRows=[];if(channel)api.client().removeChannel(channel);channel=api.client().channel('meadow-visitors-'+who).on('postgres_changes',{event:'*',schema:'public',table:'meadow_market_visit_events',filter:'owner_id=eq.'+who},()=>refresh()).subscribe()}
   const client=api.client(),since=api.state().visitorLogSeenAt||'1970-01-01T00:00:00.000Z';
   const [requests,visits]=await Promise.all([client.from('meadow_market_friendships').select('id',{count:'exact',head:true}).eq('recipient_id',who).eq('status','pending'),client.from('meadow_market_visit_events').select('id',{count:'exact',head:true}).eq('owner_id',who).gt('created_at',since)]);
   if(who!==user())return;if(!requests.error)summary.requests=requests.count||0;if(!visits.error)summary.visits=visits.count||0;
   await deliver();window.meadowNotifications?.refresh();
  }catch(e){console.warn('Meadow visitor updates unavailable',e?.message)}finally{refreshing=false}
 }
 function describe(row){const target=escape(row.target_name||'a farm friend');if(row.action==='visit')return 'Visited your farm';const words={water:'Watered '+target,feed:'Fed '+target,cheer:'Played with '+target};return words[row.action]||'Helped around the farm'}
 async function showLog(){
  api.modal('<div class="sheet-head"><div><small class="eyebrow">FARM FRIENDS</small><h2>Visitor log</h2></div><button class="close-button" data-close="modal-dialog">×</button></div><p class="visitor-log-summary">See who stopped by and the helping hands they left. Only accepted friends can help. Help never spends your gold, removes items, or harvests your crops.</p><button class="small-button full-button" id="visitor-log-listen">🔊 Jay: visiting and helping</button><button class="small-button full-button" id="visitor-log-refresh">Refresh visitor log</button><div id="visitor-log-entries">Loading your visitors…</div><button class="small-button full-button" id="visitor-log-back">Back to farm friends</button>');
  document.getElementById('visitor-log-back').onclick=api.friends;document.getElementById('visitor-log-refresh').onclick=showLog;document.getElementById('visitor-log-listen').onclick=()=>window.meadowAudio?.speak('jay-friend-visits');
  if(!api.ready()){document.getElementById('visitor-log-entries').textContent='Connect to online play to see visits from your farm friends.';return}
  const who=user();await deliver();const result=await api.client().from('meadow_market_visit_events').select('*,visitor:meadow_market_profiles!meadow_market_visit_events_visitor_id_fkey(display_name)').eq('owner_id',who).order('created_at',{ascending:false}).limit(100);const root=document.getElementById('visitor-log-entries');if(!root||who!==user())return;
  if(result.error){root.textContent='Your visitor log could not load. Close this window and try again when connected.';return}logRows=result.data||[];
  root.innerHTML=logRows.length?'<p class="sheet-copy">Your latest '+logRows.length+' visitor activities</p>'+logRows.map(row=>{const name=escape(row.visitor?.display_name||'Meadow Farmer'),area=escape(api.maps.find(m=>m.id===row.map_id)?.name||row.map_id),time=new Date(row.created_at).toLocaleString(),status=row.action==='visit'?'':row.outcome==='pending'?'Waiting for your farm to finish syncing':row.outcome==='not_needed'?'Already cared for, moved, or a newer crop — no changes needed':'Help delivered';return '<article class="visitor-entry"><span aria-hidden="true">'+icons[row.action]+'</span><div><strong>'+name+'</strong><p>'+describe(row)+'</p><small>'+area+' · '+escape(time)+'</small>'+(status?'<small>'+status+'</small>':'')+'</div><button class="small-button" data-return-visit="'+escape(row.visitor_id)+'">Visit back</button></article>'}).join(''):'<p class="visitor-log-empty">No visitors yet. Invite a farm friend, accept their request, and they can come over to help.</p>';
  root.querySelectorAll('[data-return-visit]').forEach(b=>b.onclick=()=>{const row=logRows.find(r=>r.visitor_id===b.dataset.returnVisit);if(row)api.visitFarmer?.(row.visitor_id,row.visitor?.display_name||'Meadow Farmer')});
  if(logRows.length){api.state().visitorLogSeenAt=logRows[0].created_at;api.save();summary.visits=0;window.meadowNotifications?.refresh()}
 }
 async function record(visit,action,target=''){
  if(!api.ready()||!visit)return null;const key=[visit.map,action,target].join(':'),request=visit.requests ||= {};request[key] ||= crypto.randomUUID();
  const result=await api.client().rpc('meadow_market_record_visit',{p_owner:visit.userId,p_map:visit.map,p_action:action,p_target:target,p_request:request[key]});
  if(result.error){api.notify(result.error.message||'Could not save your helping hand. Please try again.');return null}return result.data;
 }
 function candidates(visit,action){const farm=visit.save.farms?.[visit.map];return (farm?.objects||[]).filter(o=>action==='water'?o.type==='plot'&&o.plantedAt&&!o.wateredUntil&&!api.rules.cropReady(o,farm):animalTypes.includes(o.type)&&(action==='feed'?(o.hunger??100)<100:(o.happy??100)<100)).slice(0,40)}
 function mountVisit(visit){
  const overlay=document.getElementById('friend-visit-overlay');if(!overlay)return;for(const event of visit.sentHelp||[])applyHelp(visit.save,event,api.rules);
  let panel=overlay.querySelector('.visit-help-panel');if(panel)return;panel=document.createElement('section');panel.className='visit-help-panel';panel.setAttribute('aria-label','Help this farm friend');panel.innerHTML='<div class="visit-help-status">'+({water:'Your friend asks: water the crops. ',feed:'Your friend asks: feed the animals. ',cheer:'Your friend asks: play with the animals. '}[visit.save.helpWanted]||'')+'Three helping hands per friend each day · UTC reset</div><div class="visit-help-menu" hidden></div><button data-friend-help="water">💧 Water crops</button><button data-friend-help="feed">🥕 Feed animals</button><button data-friend-help="cheer">💛 Play with animals</button><button id="visit-help-listen" aria-label="Listen to Farmer Jay’s visiting guide">🔊</button>';overlay.append(panel);
  panel.querySelector('#visit-help-listen').onclick=()=>window.meadowAudio?.speak('jay-friend-visits');
  panel.querySelectorAll('[data-friend-help]').forEach(button=>button.onclick=()=>{const action=button.dataset.friendHelp,list=candidates(visit,action),menu=panel.querySelector('.visit-help-menu');menu.hidden=false;menu.innerHTML='<p>Choose a friend or field to help. Your farm goods stay safe.</p>'+list.map(o=>'<button data-help-target="'+escape(o.id)+'">'+icons[action]+' '+escape(o.name||api.rules.name(o))+'</button>').join('')+(list.length?'':'<p>Everything here is cared for. Try another activity or farm area.</p>')+'<button data-help-close>Close choices</button>';menu.querySelector('[data-help-close]').onclick=()=>menu.hidden=true;menu.querySelectorAll('[data-help-target]').forEach(b=>b.onclick=async()=>{if(helpBusy)return;helpBusy=true;b.disabled=true;try{const live=api.visit();if(live!==visit)return;const row=await record(visit,action,b.dataset.helpTarget);if(!row)return;visit.sentHelp ||= [];if(!visit.sentHelp.some(e=>e.id===row.id))visit.sentHelp.push(row);applyHelp(visit.save,row,api.rules);menu.hidden=true;panel.querySelector('.visit-help-status').textContent=row.duplicate?'You already left this helping hand today':(row.remaining??0)+' helping hands left today · help saved';api.redrawVisit();window.meadowAudio?.play('care');api.notify('Helping hand saved for your friend')}finally{helpBusy=false;b.disabled=false}})});
  if(!api.state().friendHelpIntroduced){api.state().friendHelpIntroduced=true;api.save();window.meadowAudio?.speak('jay-friend-visits')}
 }
 window.meadowSocial={applyHelp,refresh,showLog,mountVisit,record,summary:()=>summary,attach(a){api=a;window.addEventListener('meadow-cloud-ready',()=>{refresh();if(document.querySelector('#modal-dialog[open] #visitor-log-entries'))showLog()});window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});setInterval(refresh,30000);refresh()}};
})();
