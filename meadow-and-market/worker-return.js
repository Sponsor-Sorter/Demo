(() => {
 'use strict';let api,pending=false,awayFrom=0,working=false;
 const minimum=60000,maxJobs=3;
 async function catchUp(a,from,now=Date.now()){
  if(window.meadowCommandUI?.required())return null;
  if(working||!Number.isFinite(from)||now-from<minimum||a.ready?.()===false)return null;
  const s=a.state(),start=Math.max(from,Number(s.workerReturnAt)||0),workers=a.workers().filter(w=>w.map&&s.farms[w.map]);
  if(now-start<minimum||!workers.length)return null;
  working=true;s.workerReturnAt=now;
  const report={from:start,at:now,jobs:0,workers:0,maps:[],actions:{}};
  // Persist the return cursor before work. A crash/reload cannot replay the same allowance.
  try{
   a.save();
   for(const worker of workers){
    if(a.ready?.()===false||document.hidden)break;
    const data=s.workforce?.[worker.key],map=worker.map,f=s.farms[map];if(!data||data.map!==map)continue;
    const benefit=a.benefit(f),rest=Math.max(0,Number(benefit.drink)||0)*1000;
    if(data.drinkUntil>now)continue;
    if(data.drinkUntil||((data.jobs||0)>=benefit.jobs&&now-start>=rest+12000)){data.jobs=0;data.drinkUntil=0}
    const allowance=Math.min(maxJobs,Math.floor((now-start)/12000),Math.max(0,benefit.jobs-(data.jobs||0)));
    let count=0,follow=null;const skipped=new Set();
    for(let n=0;n<allowance;n++){
     if(a.ready?.()===false||document.hidden||data.map!==map)break;
     const skip=follow?new Set(f.objects.filter(o=>o.id!==follow).map(o=>o.id)):skipped;
     let task=a.task('all',skip,map),checked=0;
     while(task&&!a.reachable(f,data,task)){skip.add(task.id);if(++checked>=32){task=null;break}const next=a.task('all',skip,map);if(next?.id===task.id){task=null;break}task=next}
     if(!task)break;
     const done=a.perform('all',task,map);
     if(!done){skipped.add(task.id);follow=null;continue}
     data.jobs=(data.jobs||0)+1;data.lastJobAt=now;data.pending=null;report.jobs++;count++;
     report.actions[task.helperAction]=(report.actions[task.helperAction]||0)+1;
     // Finish a harvested field's chosen replant/water sequence before choosing another target.
     follow=['harvest','plant'].includes(task.helperAction)?task.id:null;
     await a.yieldFrame();
    }
    if(count){report.workers++;if(!report.maps.includes(map))report.maps.push(map)}
    a.save();
   }
   if(report.jobs){s.workerReturnReport=report;a.save();a.complete?.(report)}
   return report;
  }finally{working=false}
 }
 async function tick(now=Date.now()){
  if(!api||!pending||working||document.hidden||api.ready?.()===false)return;
  if(now-awayFrom<minimum){pending=false;return}
  pending=false;
  try{await catchUp(api,awayFrom,now)}catch(error){console.warn('Meadow worker return paused',error?.message)}
 }
 window.meadowWorkerReturn={catchUp,tick,running:()=>working,attach(a){api=a;awayFrom=Math.max(Number(a.loadedSeen())||Date.now(),Number(a.state().workerReturnAt)||0);pending=true;
  document.addEventListener('visibilitychange',()=>{if(document.hidden){awayFrom=Date.now();pending=true}else tick()});
  window.addEventListener('meadow-cloud-ready',()=>tick());setInterval(()=>tick(),1000);
 }};
})();
