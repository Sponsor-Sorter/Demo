// Validate the existing fishing/woodland interactions from a server-started
// attempt. Scores and goods are derived here; callers never submit a score.
type Data=Record<string,any>;
export function tripCommand(type:string,d:Data,c:Data):Data|null{
 if(!type.startsWith('trip.'))return null;
 const {s,W,now,fields,fail,xp}=c,J=W.meadowJourneyCore,j=J.get(s);
 const pending=()=>{const p=j.pendingTrip;if(!p||now-p.startedAt>=1200000)fail('Start a new trip before collecting.');return p;};
 const success=(r:Data)=>{if(!r?.ok)fail(r?.error||'This trip is unavailable.');if(r.xp)xp(r.xp);return r;};
 switch(type){
  case 'trip.begin':fields(d,['kind']);if(!['fishing','woodland'].includes(d.kind))fail('Choose a fishing or woodland trip.');return success(J.beginTrip(s,d.kind,now));
  case 'trip.start':{
   fields(d,['run']);const p=pending();if(d.run!==p.id)fail('This trip changed. Reopen its current round.');
   const attempt:Data={id:crypto.randomUUID(),startedAt:now,pausedAt:0,pausedMs:0};
   if(p.kind==='woodland')attempt.targets=Array.from({length:12},()=>['blackberry','hazelnut','wildherbs'][crypto.getRandomValues(new Uint32Array(1))[0]%3]);
   p.attempt=attempt;return {ok:true,run:p.id,kind:p.kind,attempt:attempt.id,targets:attempt.targets||null};}
  case 'trip.pause':case 'trip.resume':{
   fields(d,['run','attempt']);const p=pending(),a=p.attempt;if(!a||p.id!==d.run||a.id!==d.attempt)fail('This trip attempt changed.');
   if(type==='trip.pause'){if(!a.pausedAt)a.pausedAt=now;}else if(a.pausedAt){a.pausedMs+=now-a.pausedAt;a.pausedAt=0;}
   return {ok:true};}
  case 'trip.collect':{
   fields(d,['run','attempt','actions']);const p=pending(),a=p.attempt;if(!a||a.pausedAt||d.run!==p.id||d.attempt!==a.id)fail('Resume the current trip before collecting.');
   if(!Array.isArray(d.actions)||d.actions.length>256)fail('This trip has too many actions.');
   const elapsed=Math.max(0,(now-a.startedAt-a.pausedMs)/1000);let last=-1,score=0;
   const timed=(event:Data,gap:number)=>{fields(event,p.kind==='fishing'?['t']:['t','item']);const t=event.t;if(typeof t!=='number'||!Number.isFinite(t)||t<0||t>elapsed+.5||last>=0&&t-last<gap-.000001)fail('This trip’s action timing is invalid.');last=t;return t;};
   if(p.kind==='fishing'){
    if(d.actions.length!==3)fail('Finish all three casts first.');let phase=0,previous=0;
    for(let i=0;i<3;i++){const t=timed(d.actions[i],.45);phase+=(t-previous)*(2.2+i*.2);previous=t;score+=Math.round(Math.max(0,100-Math.abs(Math.sin(phase))*100));}
    score=Math.round(score/3);
   }else if(p.kind==='woodland'){
    let found=0,wrong=0;
    for(const e of d.actions){const t=timed(e,.1);if(found>=12||t+wrong*3>45+.5||!['blackberry','hazelnut','wildherbs'].includes(e.item))fail('This woodland pick is no longer available.');if(e.item===a.targets[found])found++;else wrong++;}
    if(found<12&&elapsed+wrong*3<45-.5)fail('Finish the basket or let the round end before collecting.');
    score=found>=12?Math.max(0,100-wrong*7):Math.round(found/12*100);
   }else fail('Unknown trip.');
   const r=success(J.completeTrip(s,p.kind,score,p.id));for(const [id,count]of Object.entries(r.goods||{}))W.meadowAlmanac.record(id,count);return {...r,score};}
  default:return fail('Unknown trip action.');
 }
}
