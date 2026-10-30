(() => {
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const rootUI=['view','mode','orientation','selected','moving','placing','visitorLogSeenAt','travelGuide119','upgradeHelpSeen77','farmerName'];
 const tutorialUI=['started','paused','introduced','seenContexts','metPeople','tour','unlockAnnouncements','moveAreaHints'];
 const clubUI=['queue','rounds','roundResults','pending','adResults','adGames','adPending'];
 const displayBooks=['artisanMastery','homestead','almanac','cropMastery','farmLife'];
 function preferences(s){
  const p={root:{},tutorial:{},journey:{},progress:{},club:{},collections:{},books:{},farms:{}};
  for(const k of rootUI)if(own(s,k)&&s[k]!==undefined)p.root[k]=clone(s[k]);
  for(const [k,v]of Object.entries(s))if(/(?:Heard\d*|Introduced\d*)$/.test(k)&&typeof v==='boolean')p.root[k]=v;
  for(const k of tutorialUI)if(s.tutorial&&own(s.tutorial,k)&&s.tutorial[k]!==undefined)p.tutorial[k]=clone(s.tutorial[k]);
  for(const k of ['heard','pinned'])if(s.journey&&own(s.journey,k)&&s.journey[k]!==undefined)p.journey[k]=clone(s.journey[k]);
  if(s.farmProgress?.heard)p.progress.heard=clone(s.farmProgress.heard);
  for(const k of clubUI)if(s.club&&own(s.club,k)&&s.club[k]!==undefined)p.club[k]=clone(s.club[k]);
  if(s.collectionState?.pending)p.collections.pending=clone(s.collectionState.pending);if(typeof s.collectionState?.introduced==='boolean')p.collections.introduced=s.collectionState.introduced;
  for(const k of displayBooks)if(s[k]?.heard!==undefined)p.books[k]={heard:clone(s[k].heard)};
  for(const [id,f]of Object.entries(s.farms||{})){
   const ui={};for(const k of ['productionGuide120','artisanGuide126','wellGuide124','shopGuide130'])if(typeof f[k]==='boolean')ui[k]=f[k];
   const tabs=Object.fromEntries((f.objects||[]).filter(o=>['recipes','helpers'].includes(o.productionTab)).map(o=>[o.id,o.productionTab]));
   if(Object.keys(ui).length||Object.keys(tabs).length)p.farms[id]={...ui,tabs};
  }
  return p;
 }
 function merge(canonical,ui){
  const next=clone(canonical),safe=preferences(ui);
  Object.assign(next,safe.root);
  next.tutorial={...next.tutorial,...safe.tutorial};next.journey={...next.journey,...safe.journey};next.farmProgress={...next.farmProgress,...safe.progress};next.club={...next.club,...safe.club};
  next.collectionState={...next.collectionState,...safe.collections};
  for(const [k,v]of Object.entries(safe.books))next[k]={...next[k],...v};
  for(const [id,p]of Object.entries(safe.farms)){const f=next.farms?.[id];if(!f)continue;const {tabs,...flags}=p;Object.assign(f,flags);for(const o of f.objects||[])if(tabs[o.id])o.productionTab=tabs[o.id];}
  return next;
 }
 function withoutUI(state){const s=clone(state);for(const k of Object.keys(s))if(rootUI.includes(k)||/(?:Heard\d*|Introduced\d*)$/.test(k)&&typeof s[k]==='boolean')delete s[k];
  for(const k of tutorialUI)if(s.tutorial)delete s.tutorial[k];for(const k of ['heard','pinned'])if(s.journey)delete s.journey[k];if(s.farmProgress)delete s.farmProgress.heard;
  for(const k of clubUI)if(s.club)delete s.club[k];
  if(s.collectionState){delete s.collectionState.pending;delete s.collectionState.introduced;}
  for(const k of displayBooks)if(s[k]){delete s[k].heard;if(!Object.keys(s[k]).length)delete s[k];}
  for(const f of Object.values(s.farms||{})){for(const k of ['productionGuide120','artisanGuide126','wellGuide124','shopGuide130'])delete f[k];for(const o of f.objects||[])delete o.productionTab;}
  // Adding an empty display container must not look like a resource mutation.
  for(const k of ['tutorial','journey','farmProgress','club','collectionState'])if(s[k]&&!Object.keys(s[k]).length)delete s[k];return s;
 }
 const fingerprint=s=>JSON.stringify(sort(withoutUI(s)));
 function changedPaths(a,b,path='',out=[]){if(out.length>=8||JSON.stringify(a)===JSON.stringify(b))return out;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)){out.push(path);return out;}for(const k of new Set([...Object.keys(a),...Object.keys(b)])){changedPaths(a[k],b[k],path?path+'.'+k:k,out);if(out.length>=8)break;}return out;}
 function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
 function create(a){
  if(typeof a.send!=='function'||typeof a.persist!=='function'||typeof a.apply!=='function')throw Error('The online farm connection is incomplete.');
  const account=a.owner(),key='meadow-ui-v1:'+account;
  let canonical=clone(a.canonical),canonicalHash=fingerprint(canonical),busy=false,inFlight=null,refreshPromise=null,maintenancePromise=null,stopped=false,storageWarning=false;
  const same=()=>!stopped&&a.owner()===account;
  function writeUI(s){const p=preferences(s);for(const k of ['selected','moving','placing','view','mode'])delete p.root[k];a.storage.setItem(key,JSON.stringify({version:1,owner:account,preferences:p}));return p;}
  function apply(save,revision,summary){
   if(!same())throw Error('Farm account changed.');
   if(!Number.isSafeInteger(save.coins)||save.coins<0||!Number.isSafeInteger(save.level)||save.level<1||!save.farms?.willow||!save.farms[save.active])throw Error('Your online farm needs review.');
   const next=merge(save,a.state());next._cloudRevision=revision;
   writeUI(next);a.persist(next,revision,account); // Synchronous, before display or receipt removal.
   canonical=clone(save);canonical._cloudRevision=revision;canonicalHash=fingerprint(canonical);a.apply(next,revision,account);a.onResult?.(summary);a.render();
  }
  const transport=window.meadowFarmCommands.create({owner:a.owner,revision:a.revision,storage:a.storage,uuid:a.uuid,send:a.send,apply,onConflict:a.onConflict});
  async function execute(commands,options={}){
   if(!same())throw Object.assign(Error('Farm account changed.'),{code:'ACCOUNT_CHANGED'});
   if(busy)throw Object.assign(Error('Wait for your saved farm action.'),{code:'ACTION_BUSY'});
   busy=true;a.pending?.(true);const screen=a.screen?.();
   try{const reply=await transport.run(commands);if(same()){
    if(options.after&&(!a.screen||a.screen()===screen))options.after(reply);
    if(!options.quiet&&reply?.summary?.messages?.length)a.notify(reply.summary.messages.at(-1));
   }return reply;}finally{busy=false;a.pending?.(false);}
  }
  function launch(fn){const promise=fn();inFlight=promise;promise.catch(e=>{if(same()){a.onProblem?.(e,transport.status());a.notify(e.name==='QuotaExceededError'?'This device cannot save your farm. Free space or export a backup, then retry.':e.message||'Your saved action is waiting for a connection.');}}).finally(()=>{if(inFlight===promise)inFlight=null;});return promise;}
  function restoreUI(){
   let data;try{data=JSON.parse(a.storage.getItem(key)||'null');}catch{return;}
   if(data?.version!==1||data.owner!==account||!data.preferences)return;
   const p=data.preferences,ui={...p.root,...p.books,tutorial:p.tutorial,journey:p.journey,farmProgress:p.progress,club:p.club,collectionState:p.collections,farms:Object.fromEntries(Object.entries(p.farms||{}).map(([id,f])=>{const {tabs,...flags}=f;return[id,{...flags,objects:Object.entries(tabs||{}).map(([id,productionTab])=>({id,productionTab}))}];}))},next=merge(merge(canonical,a.state()),ui);
   a.apply(next,a.revision,account);a.render();
  }
  return {
   route(type,target,data={},map=a.state().active,options={}){if(busy||inFlight||maintenancePromise||refreshPromise){a.notify('Wait for your saved farm action.');return true;}launch(()=>execute([{type,map,...(target==null?{}:{target}),data}],options));return true;},
   run(commands,options){if(busy||inFlight||maintenancePromise||refreshPromise)return Promise.reject(Error('Wait for your saved farm action.'));return launch(()=>execute(commands,options));},
   maintenance(commands){
    const previous=maintenancePromise,earlierRefresh=refreshPromise,earlierFlight=inFlight;
    const task=(async()=>{if(previous)await previous;if(earlierFlight)await earlierFlight;if(earlierRefresh)await earlierRefresh;if(!same())throw Error('Farm account changed.');if(transport.status().pending)await transport.retry();return execute(commands,{quiet:true});})();
    maintenancePromise=task;task.catch(e=>{if(same())a.notify(e.message||'Reconnect to save this farm action.');}).finally(()=>{if(maintenancePromise===task)maintenancePromise=null;});return task;
   },
   async retry(){if(busy)throw Error('Wait for your saved farm action.');busy=true;a.pending?.(true);try{return await transport.retry();}finally{busy=false;a.pending?.(false);}},
   async flush(){let reply;if(maintenancePromise)reply=await maintenancePromise;if(inFlight)reply=await inFlight;if(refreshPromise)reply=await refreshPromise;if(transport.status().pending)reply=await this.retry();return reply;},
   refreshReceipts(){
    if(refreshPromise)return refreshPromise;
    const earlier=maintenancePromise;
    refreshPromise=(async()=>{if(earlier)await earlier;if(inFlight)await inFlight;if(transport.status().pending)await transport.retry();if(!same())return;return execute([{type:'shop.check',map:a.state().active}],{quiet:true});})().finally(()=>{refreshPromise=null;});
    return refreshPromise;
   },
   async useRemote(){return transport.useRemote();},
   async observe(save,revision){return transport.observe(save,revision);},
   saveUI(){
    if(!same())return true;
    try{
     if(fingerprint(a.state())!==canonicalHash){
      a.onDrift?.(changedPaths(withoutUI(canonical),withoutUI(a.state())));
      const safe=merge(canonical,a.state());a.apply(safe,canonical._cloudRevision??a.revision,account);a.render();a.persist(safe,canonical._cloudRevision??a.revision,account);
      a.notify('This action needs the updated game. Your online farm is safe.');return true;
     }
     writeUI(a.state());a.persist(a.state(),canonical._cloudRevision??a.revision,account);storageWarning=false;
    }catch{if(!storageWarning){storageWarning=true;a.notify('This device cannot save your farm. Free space or export a backup, then retry.');}}return true;
   },
   restoreUI,stop(){stopped=true;transport.stop();},
   status:()=>({...transport.status(),busy:busy||!!maintenancePromise||!!refreshPromise,stopped}),
   isCanonical:()=>fingerprint(a.state())===canonicalHash,
   ownsState:s=>s===a.state(),
   canonical:()=>clone(canonical)
  };
 }
 let active=null,waiting=false;
 window.meadowCommandUI={create,preferences,merge,withoutUI,attach(a){if(a.protocol!==4)throw Error('Command UI requires an authoritative farm.');if(active)active.stop();active=create(a);waiting=false;return active;},active:()=>!!active,stateIs:s=>active?.ownsState(s)||false,required:()=>!!active||waiting,setWaiting(value){waiting=!!value;},route:(...args)=>active?.route(...args)||false,run:(...args)=>active?active.run(...args):Promise.reject(Error('Connect to your online farm first.')),maintenance:(...args)=>active?active.maintenance(...args):Promise.reject(Error('Connect to your online farm first.')),flush:()=>active?.flush(),refreshReceipts:()=>active?.refreshReceipts(),retry:()=>active?.retry(),useRemote:()=>active?.useRemote(),observe:(...args)=>active?.observe(...args),status:()=>active?.status(),saveUI:()=>active?.saveUI()||waiting,stop(){active?.stop();active=null;waiting=false;}};
})();
