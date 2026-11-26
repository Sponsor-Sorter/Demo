// Server-owned worker scheduling. A request may poll or finish a saved lease;
// it never supplies the worker's task, clock, output or offline duration.
type Data=Record<string,any>;
type Cell={x:number;y:number};
type Search={allowed:Set<string>;found:Map<string,Data>;queue:Data[];cursor:number};
const key=(p:Cell)=>p.x+','+p.y;
export function createWorkerController(c:Data){
 const {s,W,R,now,api,fp,grass,home,animal,area,plotYield,seedCost,unlockedCrop,event,fields,fail,integer}=c;
 const well=(f:Data)=>f.objects.filter((o:Data)=>o.type==='well').sort((a:Data,b:Data)=>W.meadowWells.stats(b).stage-W.meadowWells.stats(a).stage)[0];
 const fruitProgress=(o:Data)=>o.lastFruitAt?Math.min(1,(now-o.lastFruitAt)/(120000*W.meadowProgress.pollinationFactor(s,owner(o)))):1;
 const owner=(o:Data)=>Object.keys(s.farms).find(k=>s.farms[k].objects.includes(o));
 const fruitYield=(o:Data)=>[2,4,7,11][Math.max(0,Math.min(3,Math.floor(Number(o.tier)||0)))];
 const seed=(o:Data,w:Data,map:string)=>{const fallback=w?.helperCrop||R.maps.find((m:Data)=>m.id===map)?.crops[0]||'carrot';return W.meadowPlanner.cropFor(W.meadowPlanting.crop(w,api.items[o.crop]?o.crop:null,fallback),w,o)||fallback;};
 const canPlant=(o:Data,w:Data,id:string,f:Data)=>unlockedCrop(id)&&W.meadowPlanner.plantAllowed(id)!==false&&W.meadowPlanting.canPlant(w,id,f.inventory,Object.values(s.farms).flatMap((f:any)=>f.objects),plotYield);
 W.meadowPlanner.bind({...api,maps:R.maps,plotYield,fruitYield,canPlanCrop:(w:Data,id:string,o:Data)=>canPlant(o,w,id,s.farms[s.active])&&(!o||s.coins>=seedCost(o,id))});
 W.meadowFarmWork.bind({...api,crops:api.items,well,area,yield:plotYield,fruitProgress,fruitYield,isAnimal:animal,home,seed,seedCost,canPlant,
  event:(action:string,map:string)=>{if(['harvest','fruit','honey','plant','water','till'].includes(action))event(action,1,map);W.meadowPlanner.invalidate();}});
 let assignmentMap=s.active;
 W.meadowRoster.bind({...api,valid:(p:Cell)=>integer(p?.x,-32,48)&&integer(p?.y,-32,48)&&cells(assignmentMap).some(q=>key(q)===key(p)),refresh:()=>{}});
 let work:Data;
 function book(){if(!work){s._serverWorkers||={version:1,lastReturnAt:now,family:{},leases:{}};work=s._serverWorkers;work.family||={};work.leases||={};}return work;}
 const terrain=new Map<string,Cell[]>();
 function cells(map:string):Cell[]{
  if(terrain.has(map))return terrain.get(map)!;
  const f=s.farms[map],outline=R.areaOutlines[map]||R.meadowOutline,p=map==='willow'?{x:7,y:26.5,w:.87,h:.70}:{x:7,y:15,w:.87,h:.76},step=100/12,bx=50-step,by=50-11*step/2;
  const vertices=outline.map(([x,y]:number[])=>{const cx=(x-p.x)/p.w-bx,cy=(y-p.y)/p.h-by;return{x:(cx+cy)/step,y:(cy-cx)/step};});
  const minX=Math.max(-32,Math.floor(Math.min(...vertices.map((v:Cell)=>v.x)))-1),maxX=Math.min(48,Math.ceil(Math.max(...vertices.map((v:Cell)=>v.x)))+1),minY=Math.max(-32,Math.floor(Math.min(...vertices.map((v:Cell)=>v.y)))-1),maxY=Math.min(48,Math.ceil(Math.max(...vertices.map((v:Cell)=>v.y)))+1),blocked=new Set<string>();
  for(const o of f.objects){if(o.type==='plot'||animal(o)&&home(o,f)||R.catalog.find((d:Data)=>d.id===o.type)?.walkable)continue;const z=fp(o);for(let x=o.x;x<o.x+z.w;x++)for(let y=o.y;y<o.y+z.h;y++)blocked.add(key({x,y}));}
  const result:Cell[]=[];for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)if((Number(f.expansionLevel)>=3||y<7+(Number(f.expansionLevel)||0))&&!blocked.has(key({x,y}))&&grass(x,y,map))result.push({x,y});
  terrain.set(map,result);return result;
 }
 // Request-scoped geometry only: never retain a player's objects, paths or
 // assignments across requests/accounts. Reuse one traversal for every job
 // considered from the same worker position, with the original BFS order.
 const boundaries=new Map<string,Cell[]>(),searches=new Map<string,Search>(),unreachable=new Map<string,Set<string>>();
 function edges(t:Data,map:string){const p=fp(t),id=JSON.stringify([map,t.x,t.y,p.w,p.h]);if(!boundaries.has(id))boundaries.set(id,cells(map).filter(q=>q.x>=t.x-1&&q.x<=t.x+p.w&&q.y>=t.y-1&&q.y<=t.y+p.h));return boundaries.get(id)!;}
 function search(start:Cell,map:string){
  const id=map+':'+key(start);if(searches.has(id))return searches.get(id)!;
  const allowed=new Set(cells(map).map(key)),found=new Map<string,Data>(),queue:Data[]=[],field={allowed,found,queue,cursor:0};searches.set(id,field);if(!allowed.has(key(start)))return field;
  const first={...start,distance:0,previous:'',order:0};found.set(key(start),first);queue.push(first);return field;
 }
 function route(start:Cell,goals:Cell[],map:string):{to:Cell;distance:number;path:Cell[]}|null{
  const field=search(start,map),{allowed,found,queue}=field,wanted=new Set(goals.map(key));let end:Data|undefined;for(const goal of goals){const entry=found.get(key(goal));if(entry&&(!end||entry.order<end.order))end=entry;}
  // Expand only as far as this route needs. A later job can continue the same
  // queue; near, already reachable work does not require a full-map scan.
  while(!end&&field.cursor<queue.length){const a=queue[field.cursor++];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const b={x:a.x+dx,y:a.y+dy},k=key(b);if(found.has(k)||!allowed.has(k)||dx&&dy&&(!allowed.has(key({x:a.x+dx,y:a.y}))||!allowed.has(key({x:a.x,y:a.y+dy}))))continue;const next={...b,distance:a.distance+Math.hypot(dx,dy),previous:key({x:a.x,y:a.y}),order:queue.length};found.set(k,next);queue.push(next);if(!end&&wanted.has(k))end=next;}}
  if(!end)return null;
  const path:Cell[]=[];let at:Data|undefined=end;while(at){path.push({x:at.x,y:at.y});at=at.previous?found.get(at.previous):undefined;}return{to:{x:end.x,y:end.y},distance:end.distance,path:path.reverse()};
 }
 function position(data:Data,map:string){const available=cells(map);if(!available.length)return null;const p={x:Math.round(data.x??well(s.farms[map])?.x??4),y:Math.round(data.y??well(s.farms[map])?.y??3)};return available.find(q=>key(q)===key(p))||available.slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];}
 function onMap<T>(map:string,fn:()=>T):T{const old=s.active;s.active=map;try{return c.runOnMap(map,fn);}finally{s.active=old;}}
 function task(role:string,skip:Set<string>,map:string){return onMap(map,()=>{
  for(const [id,until]of Object.entries(book().protected?.[map]||{}))if(Number(until)>now)skip.add(id);
  if(role==='all')return W.meadowFarmWork.task(role,skip,map);
  // Match the three established family roles, with planned work first.
  const f=s.farms[map],w=well(f),ordered=f.objects.filter((o:Data)=>!skip.has(o.id)).slice().sort((a:Data,b:Data)=>W.meadowPlanner.priority(b)-W.meadowPlanner.priority(a)||(a.lastHelperAt||0)-(b.lastHelperAt||0));
  for(const o of ordered){let action:string|undefined;
   if(role==='jade'){if(['kitchen','workshop'].includes(o.type)&&W.meadowProduction.helperTask(o)==='collect')action='collect';else if(o.type==='plot'&&o.plantedAt&&W.meadowCropGrowth.calculate(o,api.items[o.crop],f.objects).stage>=3)action='harvest';else if(['tree','orchard'].includes(o.type)&&fruitProgress(o)>=1)action='fruit';}
   if(role==='rhys'){if(['kitchen','workshop'].includes(o.type)&&W.meadowProduction.helperTask(o)==='make')action='make';else if(o.type==='plot'&&!o.plantedAt){if(!o.stage)action='till';else{const id=seed(o,w,map),cost=seedCost(o,id,map);if(canPlant(o,w,id,f)&&s.coins>=cost&&W.meadowPlanner.seedAllowed(cost))action='plant';}}}
   if(role==='jay'){if(o.type==='plot'&&o.plantedAt&&!o.wateredUntil&&w?.autoWater&&s.coins>=area(o)&&W.meadowCropGrowth.calculate(o,api.items[o.crop],f.objects).stage<3)action='water';else if(o.type==='hive'){W.meadowApiary.settle(f,o);if(o.honey>0)action='honey';}else if(o.type==='stall'&&W.meadowShopPlan.needed(f))action='stock';else if(animal(o)&&now-(o.lastCare||0)>45000&&(o.hunger<95||o.clean<95||o.happy<95||W.meadowAnimals.ready(o)))action='care';}
   if(action)return{...(home(o,f)||o),id:o.id,helperAction:action,label:action};
  }return null;
 });}
 function candidate(role:string,map:string,data:Data,skip=new Set<string>(),preferred?:string):Data|null{
  const start=position(data,map);if(!start)return null;
  const f=s.farms[map],blocked=new Set(skip),id=map+':'+key(start),known=unreachable.get(id);if(known)for(const target of known)blocked.add(target);
  if(preferred&&!blocked.has(preferred)){const others=new Set<string>(f.objects.filter((o:Data)=>o.id!==preferred).map((o:Data)=>o.id));const t=task(role,others,map),r=t&&route(start,edges(t,map),map);if(t&&r)return{task:t,route:r,from:start};}
  let t=task(role,blocked,map),r=t&&route(start,edges(t,map),map);if(t&&r)return{task:t,route:r,from:start};if(!t||known)return null;
  // Keep the ordinary first-job path cheap. Only an inaccessible first job
  // needs the full exclusion set; workers sharing this start reuse it.
  const found=search(start,map).found,excluded=new Set<string>();for(const o of f.objects)if(!edges(home(o,f)||o,map).some(q=>found.has(key(q))))excluded.add(o.id);unreachable.set(id,excluded);for(const target of excluded)blocked.add(target);
  t=task(role,blocked,map);r=t&&route(start,edges(t,map),map);return t&&r?{task:t,route:r,from:start}:null;
 }
 function perform(role:string,map:string,t:Data){return onMap(map,()=>{
  const done=W.meadowFarmWork.perform(role,t,map);
  // Jade's original orchard job uses the manual fruit reward; hired workers
  // use the established generic five-XP task.
  if(done&&role==='jade'&&t.helperAction==='fruit'){api.xp(Math.max(0,Math.min(3,Number(t.tier)||0)));event('harvest',1,map);}return done;
 });}
 function signature(map:string,target:string){const o=s.farms[map].objects.find((o:Data)=>o.id===target);if(!o)return '';const h=home(o,s.farms[map]);return JSON.stringify([o.type,o.x,o.y,o.rotation||0,o.tier||0,o.plantedAt||0,o.lastFruitAt||0,o.lastProductAt||0,(o.jobs||[]).map((j:Data)=>[j.id,j.startAt,j.finishAt]),h&&[h.id,h.x,h.y,h.rotation||0,h.tier||0]]);}
 function crew(){const b=book();return [...['jade','rhys','jay'].map(id=>{
  const previous=b.family[id],f=s.farms[s.active];f.helperStamina||={};
  if(previous?.map&&previous.map!==s.active){delete s.farms[previous.map]?.helperStamina?.[id]?.returning;delete b.leases[id];}
  f.helperStamina[id]||=previous?.map===s.active?previous:{jobs:0,drinkUntil:0};
  const data=f.helperStamina[id];data.map=s.active;b.family[id]=data;return{id,role:id,map:s.active,data};}),...W.meadowRoster.owned().filter((w:Data)=>w.map&&s.farms[w.map]).map((w:Data)=>({id:w.id,role:'all',map:w.map,data:s.workforce[w.key]}))];}
 function revalidateReturn(w:Data,target:Data){
  const d=w.data,r=d.returning,path=r.path||[],open=search(r.from||position(d,w.map)||r.to,w.map).allowed;
  const clear=(a:Cell,b:Cell)=>{const dx=b.x-a.x,dy=b.y-a.y;return Math.abs(dx)<=1&&Math.abs(dy)<=1&&!!(dx||dy)&&open.has(key(b))&&(!dx||!dy||open.has(key({x:b.x,y:a.y}))&&open.has(key({x:a.x,y:b.y})));};
  const end=path.at(-1);
  if(path.length&&open.has(key(path[0]))&&path.every((p:Cell,i:number)=>!i||clear(path[i-1],p))&&end.x===r.to.x&&end.y===r.to.y&&edges(target,w.map).some(p=>key(p)===key(end)))return;
  // Building while a saved walk is in flight can occupy its destination,
  // a path cell or a diagonal corner. Keep only the elapsed, still-clear
  // prefix, then plan a fresh walk; never arrive inside the new obstacle.
  let reached:Cell|undefined=path[0]&&open.has(key(path[0]))?path[0]:undefined,distance=0;
  for(let i=1;reached&&i<path.length;i++){const a=path[i-1],b=path[i];distance+=Math.hypot(b.x-a.x,b.y-a.y);if(!clear(a,b)||distance*960>Math.max(0,now-r.startedAt))break;reached=b;}
  if(reached)Object.assign(d,{x:reached.x,y:reached.y});
  delete d.returning;
 }
 function resting(w:Data){const target=well(s.farms[w.map]),p=W.meadowWells.stats(target),d=w.data,wellKey=target?[target.id,target.x,target.y].join(':'):'';
  if(d.drinkUntil>now)return true;
  if(d.drinkUntil){d.drinkUntil=0;d.jobs=0;}
  if(d.returning&&d.returning.well!==wellKey)delete d.returning;
  if(d.returning)revalidateReturn(w,target);
  if(d.returning){
   if(d.returning.readyAt>now)return true;
   Object.assign(d,{x:d.returning.to.x,y:d.returning.to.y,drinkUntil:now+p.drink*1000});delete d.returning;return true;
  }
  if((d.jobs||0)>=p.jobs){
   const start=position(d,w.map),path=start&&target&&route(start,edges(target,w.map),w.map);delete book().leases[w.id];
   if(target&&!path){d.restBlocked=true;return true;}delete d.restBlocked;
   if(path&&path.distance>0)d.returning={well:wellKey,from:start,to:path.to,path:path.path,startedAt:now,readyAt:now+Math.ceil(path.distance*960)};
   else d.drinkUntil=now+p.drink*1000;
   return true;
  }delete d.restBlocked;return false;
 }
 function tick(){const b=book(),out:Data[]=[],reserved=new Map<string,Set<string>>(),members=crew();
  // Reserve existing jobs before considering an idle worker. Hired workers
  // appear after the family; their in-flight jobs still own their targets.
  for(const w of members){const lease=b.leases[w.id];if(!lease||lease.map!==w.map||lease.revision!==(w.data.revision||0)||well(s.farms[w.map])?.helpers?.[w.id])continue;const set=reserved.get(w.map)||new Set<string>();set.add(lease.target);reserved.set(w.map,set);}
  for(const w of members){
   const data=w.data,paused=well(s.farms[w.map])?.helpers?.[w.id];delete data.workBlocked;if(paused){delete b.leases[w.id];delete data.returning;out.push({worker:w.id,map:w.map,status:'paused'});continue;}
   if(resting(w)){out.push(data.restBlocked?{worker:w.id,map:w.map,status:'blocked',reason:'Leave a clear path to the family well.'}:data.returning?{worker:w.id,map:w.map,status:'returning',...data.returning}:{worker:w.id,map:w.map,status:'drink',until:data.drinkUntil});continue;}
   let lease=b.leases[w.id];if(lease&&(lease.map!==w.map||lease.revision!==(data.revision||0))){delete b.leases[w.id];lease=null;}
   if(lease&&now>=lease.readyAt){
    const skip=new Set<string>(s.farms[w.map].objects.filter((o:Data)=>o.id!==lease.target).map((o:Data)=>o.id)),fresh=candidate(w.role,w.map,data,skip);
    const done=!!fresh&&fresh.task.id===lease.target&&fresh.task.helperAction===lease.action&&lease.signature===signature(w.map,lease.target)&&perform(w.role,w.map,fresh.task);
    if(done){Object.assign(data,{x:fresh!.route.to.x,y:fresh!.route.to.y,jobs:(data.jobs||0)+1,lastJobAt:now,cooldownUntil:now+(w.role==='all'?12000:2500)});}
    delete b.leases[w.id];out.push({worker:w.id,map:w.map,status:done?'completed':'changed',target:lease.target,action:lease.action});continue;
   }
   if(lease){const set=reserved.get(w.map)||new Set();set.add(lease.target);reserved.set(w.map,set);out.push({worker:w.id,...lease,status:'working'});continue;}
   if(data.cooldownUntil>now){out.push({worker:w.id,map:w.map,status:'waiting',until:data.cooldownUntil});continue;}
   const skip=reserved.get(w.map)||new Set<string>(),found=candidate(w.role,w.map,data,new Set(skip));if(!found){
    // An available job behind an obstacle is not an empty work list. Keep the
    // original path/rest rules and tell the player what needs to be cleared.
    const blocked=!!task(w.role,new Set(skip),w.map);if(blocked)data.workBlocked=true;
    out.push({worker:w.id,map:w.map,status:blocked?'blocked_work':'idle',...(blocked?{reason:'Leave a clear walking path to available farm jobs.'}:{})});continue;
   }
   const duration=1600+Math.ceil(found.route.distance*960);
   lease={map:w.map,revision:data.revision||0,target:found.task.id,action:found.task.helperAction,signature:signature(w.map,found.task.id),from:found.from,to:found.route.to,path:found.route.path,startedAt:now,readyAt:now+(w.role==='all'?Math.max(12000,duration):duration)};b.leases[w.id]=lease;
   skip.add(lease.target);reserved.set(w.map,skip);out.push({worker:w.id,...lease,status:'working'});
  }
  b.lastReturnAt=now;return {ok:true,workers:out};
 }
 function catchup(){const b=book(),from=b.lastReturnAt||now;b.lastReturnAt=now;if(now-from<60000)return {ok:true,completed:[]};const completed:Data[]=[];
  // Only assigned hired workers run while the game is away. Never back-date a
  // new planting or production job, and never claim more than three ready jobs.
  for(const w of crew().filter(w=>w.role==='all')){const p=W.meadowWells.stats(well(s.farms[w.map])),d=w.data;
   // A hire/reassignment resets lastJobAt. The farm's old absence cursor must
   // not grant work on a map this worker only just joined.
   const elapsed=now-Math.max(from,Number(d.lastJobAt)||0);if(elapsed<60000)continue;
   delete b.leases[w.id];if(d.drinkUntil>now)continue;if(d.drinkUntil||(d.jobs||0)>=p.jobs&&elapsed>=p.drink*1000+12000){d.drinkUntil=0;d.jobs=0;delete d.returning;}
   let preferred:string|undefined;const count=Math.min(3,Math.floor(elapsed/12000),Math.max(0,p.jobs-(d.jobs||0)));
   for(let i=0;i<count;i++){const next=candidate('all',w.map,d,new Set(),preferred);if(!next||!perform('all',w.map,next.task))break;Object.assign(d,{x:next.route.to.x,y:next.route.to.y,jobs:(d.jobs||0)+1,lastJobAt:now,pending:null,cooldownUntil:now+12000});completed.push({worker:w.id,map:w.map,target:next.task.id,action:next.task.helperAction});preferred=['harvest','plant'].includes(next.task.helperAction)?next.task.id:undefined;}
  }return {ok:true,completed};
 }
 function command(type:string,target:unknown,d:Data,map:string):Data|null{
  switch(type){
   case 'workers.hire':fields(d,[]);if(typeof target!=='string'||!W.meadowRoster.hire(target))fail('Check this worker’s level and hiring cost.');return {ok:true};
   case 'workers.assign':{
    fields(d,['x','y','expectedMap']);if(typeof target!=='string'||!W.meadowRoster.catalog.some((w:Data)=>w.id===target))fail('Choose a hired worker.');const data=s.workforce?.[target as string];if(!data||d.expectedMap!==data.map)fail('This worker’s farm changed. Confirm their current assignment.');assignmentMap=map;
    if(!W.meadowRoster.assign(target,map,{x:d.x,y:d.y},true))fail('Place this worker on clear, unlocked walking grass.');delete data.returning;delete book().leases['hire-'+target];return {ok:true};}
   case 'workers.tick':fields(d,[]);return tick();
   case 'workers.return':fields(d,[]);return catchup();
   case 'workers.protect':case 'workers.protect_many':{
    fields(d,type==='workers.protect'?['enabled']:['ids','enabled']);const ids=type==='workers.protect'?[target]:d.ids;
    if(!Array.isArray(ids)||ids.length>1000||typeof d.enabled!=='boolean'||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||['__proto__','constructor','prototype'].includes(id)||d.enabled&&!s.farms[map].objects.some((o:Data)=>o.id===id)))fail('Choose current lesson items.');
    const b=book();b.protected||={};b.protected[map]||={};for(const id of ids){if(d.enabled)b.protected[map][id]=now+120000;else delete b.protected[map][id];}return {ok:true};}
   default:return null;
  }
 }
 return {command,arrive:()=>{crew();},invalidate:()=>{terrain.clear();boundaries.clear();searches.clear();unreachable.clear();W.meadowPlanner.invalidate();}};
}
