(() => {
 'use strict';
 // Staged protocol 4 transport. The game must migrate every mutation before
 // attaching it or enrolling players; a snapshot is never a command fallback.
 const clone=v=>JSON.parse(JSON.stringify(v)),safe=n=>Number.isSafeInteger(n)&&n>=0;
 function create(a){
  const account=a.owner(),storageKey='meadow-farm-command-v1:'+account;
  let revision=a.revision,job=null,running=false,stopped=false,conflict=null;
  const error=(message,code)=>Object.assign(Error(message),{code});
  const same=()=>!stopped&&a.owner()===account;
  function load(){
   if(!account||!safe(revision))throw error('Connect to your saved farm first.','ACCOUNT_REQUIRED');
   const text=a.storage.getItem(storageKey);if(!text)return;
   const stored=JSON.parse(text);
   if(stored.version!==1||stored.owner!==account||!stored.body||typeof stored.body.request_id!=='string'||!safe(stored.body.expected_revision)||!Array.isArray(stored.body.commands)||!stored.body.commands.length||stored.body.commands.length>32)throw error('Your pending farm action needs review.','PENDING_ACTION_INVALID');
   job=stored.body;
  }
  function persist(body){a.storage.setItem(storageKey,JSON.stringify({version:1,owner:account,body}));}
  function clear(){a.storage.removeItem(storageKey);job=null;}
  async function send(){
   if(!same())throw error('Farm account changed.','ACCOUNT_CHANGED');
   if(running)throw error('Wait for your current farm action.','ACTION_BUSY');
   if(conflict)throw error('Review the newer farm before continuing.','FARM_CONFLICT');
   if(!job)return null;
   running=true;const request=clone(job);
   try{
    let reply;try{reply=await a.send(request,account);}catch{throw error('Your farm action is saved here. Reconnect to check its receipt.','ACTION_UNCERTAIN');}
    if(!same())throw error('Farm account changed.','ACCOUNT_CHANGED');
    const data=reply?.data,status=reply?.status;
    if(status===409&&data?.conflict&&safe(data.revision)&&data.save_data){conflict=clone(data);a.onConflict?.(clone(data));throw error('Another device saved this farm. Review it before continuing.','FARM_CONFLICT');}
    if(status===422||status===413){clear();throw error(data?.message||'This farm action is no longer available.',data?.error||'ACTION_REJECTED');}
    if(status===409&&data?.error==='COMMAND_ROLLOUT_PENDING')throw error('This farm is waiting for the verified game update.','ROLLOUT_PENDING');
    if(status!==200||!data?.ok||data.request_id!==request.request_id||!safe(data.revision)||!safe(data.accepted_revision)||data.accepted_revision!==request.expected_revision+1||data.revision<data.accepted_revision||!data.save_data||typeof data.save_data!=='object'||Array.isArray(data.save_data))throw error('Your farm action is saved here. Reconnect to check its receipt.','ACTION_UNCERTAIN');
    // An old accepted retry carries the CURRENT canonical state. Never apply
    // the obsolete candidate or rewind a locally observed newer revision.
    if(data.revision<revision)throw error('Load the latest online farm before continuing.','REVISION_CHANGED');
    await a.apply(clone(data.save_data),data.revision,clone(data.summary||{}));
    if(!same())throw error('Farm account changed.','ACCOUNT_CHANGED');
    revision=data.revision;clear();return clone(data);
   }finally{running=false;}
  }
  load();
  return {
   async run(commands){
    if(!same())throw error('Farm account changed.','ACCOUNT_CHANGED');
    if(job||running)throw error('Confirm the saved farm action before starting another.','ACTION_PENDING');
    if(!Array.isArray(commands)||commands.length<1||commands.length>32)throw error('Choose one to 32 farm actions.','INVALID_ACTION');
    const next={request_id:a.uuid(),expected_revision:revision,commands:clone(commands)};
    // A full or unavailable device store stops BEFORE a network mutation.
    persist(next);job=next;return send();
   },retry:send,
   async useRemote(){
    if(!same()||running||!conflict)throw error('No farm conflict is ready to review.','NO_CONFLICT');
    await a.apply(clone(conflict.save_data),conflict.revision,{});
    if(!same())throw error('Farm account changed.','ACCOUNT_CHANGED');
    revision=conflict.revision;clear();conflict=null;
   },
   async observe(save,nextRevision){
    if(!same())throw error('Farm account changed.','ACCOUNT_CHANGED');
    if(job||running||conflict)throw error('Confirm the pending action before loading another farm.','ACTION_PENDING');
    if(!safe(nextRevision)||nextRevision<revision)return false;
    await a.apply(clone(save),nextRevision,{});if(!same())throw error('Farm account changed.','ACCOUNT_CHANGED');revision=nextRevision;return true;
   },
   stop(){stopped=true;},
   status:()=>({owner:account,revision,running,pending:!!job,conflict:!!conflict,stopped})
  };
 }
 window.meadowFarmCommands={create};
})();
