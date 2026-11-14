(() => {
 'use strict';
 const contract='meadow-ad-policy-v1',cacheMs=300000;
 const defaults=Object.freeze({popup_every_completed_games:3,popup_min_interval_seconds:180});
 const envelopeKeys=['app','contract','policy_version','policy_sha256','target_min_build','target_max_build','effective_at','expires_at','enforcement','cache_max_age_seconds','parameters'];
 const integer=(v,min,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 const exact=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
 const parameters=p=>exact(p,Object.keys(defaults))&&integer(p.popup_every_completed_games,3,20)&&integer(p.popup_min_interval_seconds,180,3600);
 function timestamp(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return NaN;const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).toISOString()===v?t:NaN;}
 function canonical(p){return [contract,'app=meadow','policy_version='+p.policy_version,'target_min_build='+p.target_min_build,'target_max_build='+(p.target_max_build===null?'*':p.target_max_build),'effective_at='+p.effective_at,'expires_at='+p.expires_at,'cache_max_age_seconds=300','popup_every_completed_games='+p.parameters.popup_every_completed_games,'popup_min_interval_seconds='+p.parameters.popup_min_interval_seconds,''].join('\n');}
 function shape(p){return exact(p,envelopeKeys)&&p.app==='meadow'&&p.contract===contract&&p.enforcement==='accepted'&&p.cache_max_age_seconds===300&&integer(p.policy_version,1)&&integer(p.target_min_build,1)&&(p.target_max_build===null||integer(p.target_max_build,p.target_min_build))&&typeof p.policy_sha256==='string'&&/^[a-f0-9]{64}$/.test(p.policy_sha256)&&parameters(p.parameters)&&Number.isFinite(timestamp(p.effective_at))&&timestamp(p.expires_at)>timestamp(p.effective_at)&&timestamp(p.expires_at)-timestamp(p.effective_at)<=30*86400000;}
 async function digest(text){const bytes=new TextEncoder().encode(text),hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
 function create(options){
  const wall=options.now||Date.now,monotonic=options.monotonic||(()=>typeof performance!=='undefined'?performance.now():wall()),hash=options.digest||digest;
  let owner='',epoch=0,sequence=0,settled=0,entry=null,received=0,receivedWall=0,floor=0,floorHash='',fresh=false,reason='unread';
  const currentOwner=()=>String(options.owner()||'');
  function sync(){const who=currentOwner();if(who!==owner){owner=who;epoch++;sequence=0;settled=0;entry=null;received=0;receivedWall=0;floor=0;floorHash='';fresh=false;reason='account_changed';}return owner;}
  function begin(){sync();return {owner,epoch,sequence:++sequence,started:monotonic(),wall:wall()};}
  const same=t=>!!t&&sync()===t.owner&&epoch===t.epoch&&t.sequence>=settled;
  function failed(t){if(same(t)){settled=t.sequence;fresh=false;reason='commerce_failed';}}
  async function receive(value,t){
   if(!same(t))return false;
   let accepted=null,why=value==null?'no_policy':'invalid';
   if(shape(value)){
    const candidate=JSON.parse(JSON.stringify(value));
    try{if(await hash(canonical(candidate))===candidate.policy_sha256){const now=wall();if(candidate.target_min_build>options.build()||(candidate.target_max_build!==null&&candidate.target_max_build<options.build()))why='incompatible';else if(now<timestamp(candidate.effective_at))why='future';else if(now>=timestamp(candidate.expires_at))why='expired';else if(candidate.policy_version<floor||(candidate.policy_version===floor&&floorHash&&candidate.policy_sha256!==floorHash))why='rollback';else{accepted=candidate;why='accepted';}}}catch{why='invalid_digest';}
   }
   if(!same(t))return false;
   settled=t.sequence;entry=accepted;reason=why;received=t.started;receivedWall=t.wall;fresh=monotonic()>=received&&monotonic()-received<cacheMs&&wall()>=receivedWall&&wall()-receivedWall<cacheMs;
   if(accepted){floor=accepted.policy_version;floorHash=accepted.policy_sha256;}
   return true;
  }
  function suspend(){sync();epoch++;sequence=0;settled=0;fresh=false;reason='resume_refresh';}
  function snapshot(){
   sync();const now=wall(),elapsed=monotonic()-received,expired=entry&&now>=timestamp(entry.expires_at),available=!!owner&&fresh&&now>=receivedWall&&now-receivedWall<cacheMs&&elapsed>=0&&elapsed<cacheMs&&!expired;
   return {available,app:'meadow',contract,policy_version:available&&entry?entry.policy_version:null,policy_sha256:available&&entry?entry.policy_sha256:null,parameters:{...(available&&entry?entry.parameters:defaults)},reason:available?reason:expired?'expired':'stale',anti_rollback_version:floor};
  }
  return {begin,receive,failed,suspend,snapshot};
 }
 function clearPending(s){delete s.adPending;delete s.adPendingPolicy;}
 function pending(s,owner,p=defaults){
  if(!s.adPending)return null;
  let q=s.adPendingPolicy;
  if(q&&q.owner!==owner){clearPending(s);return null;}
  if(!q||!integer(q.base_games,0)||!integer(q.required_games,3,20)||!integer(q.gap_seconds,180,3600))q={owner,base_games:Math.max(0,(Number(s.adGames)||0)-3),required_games:3,gap_seconds:180};
  if(parameters(p)){q.required_games=Math.max(q.required_games,p.popup_every_completed_games);q.gap_seconds=Math.max(q.gap_seconds,p.popup_min_interval_seconds);}
  s.adPendingPolicy=q;return q;
 }
 function record(s,owner,p=defaults){
  if(!parameters(p))p=defaults;
  if(s.adPending){pending(s,owner,p);if(s.adPending)return;}
  const games=Number(s.adGames)||0;if(games>0&&games%p.popup_every_completed_games===0){s.adPending=true;s.adPendingPolicy={owner,base_games:Math.max(0,games-p.popup_every_completed_games),required_games:p.popup_every_completed_games,gap_seconds:p.popup_min_interval_seconds};}
 }
 function eligible(s,owner,p,now){const q=pending(s,owner,p);return !!q&&integer(s.adGames,0)&&s.adGames>=q.base_games+q.required_games&&now-(Number(s.lastPopupAt)||0)>=q.gap_seconds*1000;}
 function consume(s,now){clearPending(s);s.lastPopupAt=now;}
 window.meadowAdPolicy={contract,defaults,canonical,shape,create,record,pending,eligible,consume,clearPending};
})();
