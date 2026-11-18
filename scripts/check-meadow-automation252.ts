import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {applyFarmCommands} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createWorkerController} from '../supabase/functions/_shared/meadow-workers205.ts';
const now=Date.parse('2026-11-18T09:00:00Z');
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m);}
function eq(a:unknown,b:unknown,m='Values differ'){assert(JSON.stringify(a)===JSON.stringify(b),m+': '+JSON.stringify(a)+' != '+JSON.stringify(b));}
function state():any{return{version:1,tutorial:earnedTutorial(),coins:100000,level:45,xp:0,rep:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[{id:'well',type:'well',x:3,y:2,tier:3,autoWater:true,helperPlantMode:'previous',helperCrop:'wheat',helpers:{jade:true,rhys:true,jay:true}},{id:'ready',type:'plot',x:4,y:3,tier:0,stage:1,crop:'carrot',plantedAt:now-600000}],inventory:{carrot:0,wheat:30,flour:0},orders:[],expansionLevel:3,shop:{unlocked:false,stock:{},earned:0}}}};}
const run=(s:any,type:string,target?:string,data:any={},time=now,map=s.active)=>applyFarmCommands(s,[{type,target,data,map}],time);
function hire(s:any,id='rowan',map='willow'){s=run(s,'workers.hire',id).save;return run(s,'workers.assign',id,{x:4,y:4,expectedMap:null},now,map).save;}

Deno.test('A reachable job is not starved by more than 32 preserved unreachable targets',()=>{
 let s=state();const f=s.farms.willow;
 // Older retained farms may contain inaccessible placements. They must not
 // prevent a reachable field from being worked, or be moved by the scheduler.
 const inaccessible=Array.from({length:40},(_,i)=>({id:'legacy-'+i,type:'plot',x:45,y:45,tier:0,stage:1,crop:'carrot',plantedAt:now-600000}));
 f.objects.splice(1,0,...inaccessible);s=hire(s);const r=run(s,'workers.tick');
 eq(r.save._serverWorkers.leases['hire-rowan']?.target,'ready','Worker should find the reachable field after inaccessible ones');
 eq(r.save.farms.willow.objects.filter((o:any)=>o.id.startsWith('legacy-')),inaccessible,'Preserved placements stay intact');
});

Deno.test('An idle family farmer respects a hired worker lease later in crew order',()=>{
 let s=state();s.farms.willow.objects.push({id:'second',type:'plot',x:5,y:4,tier:0,stage:1,crop:'wheat',plantedAt:now-600000});
 s=hire(s);s=run(s,'workers.tick').save;eq(s._serverWorkers.leases['hire-rowan'].target,'ready');
 s.farms.willow.objects[0].helpers.jade=false;
 s=run(s,'workers.tick',undefined,{},now+100).save;
 eq(s._serverWorkers.leases.jade?.target,'second','Family should choose the unreserved job');
 eq(s._serverWorkers.leases['hire-rowan'].target,'ready');
});

Deno.test('Repeated polling over a long cross-map session preserves roles, caps and crop choices',()=>{
 let s=state();s.farms.willow.objects[0].helperCropCap=36;
 s.farms.willow.objects.push({id:'oven',type:'kitchen',x:6,y:3,autoWork:true,autoCap:6,autoRecipe:'flour',jobs:[]});
 for(const map of ['coast','back'])s.farms[map]=JSON.parse(JSON.stringify(s.farms.willow));
 for(const [id,map]of [['rowan','willow'],['ellis','coast'],['morgan','back']])s=hire(s,id,map);
 const beforeIDs=Object.entries(s.farms).map(([map,f]:[string,any])=>[map,f.objects.map((o:any)=>o.id)]);
 let visits=0,harvests=0,plants=0,waters=0,crafts=0;
 for(let elapsed=0;elapsed<=30*60000;elapsed+=3000){
  if(elapsed&&elapsed%60000===0){const destination=['willow','coast','back'][++visits%3];s=run(s,'map.visit',undefined,{destination},now+elapsed).save;}
  const r=run(s,'workers.tick',undefined,{},now+elapsed);s=r.save;
  for(const worker of r.results[0].workers){if(worker.status!=='completed')continue;if(worker.action==='harvest')harvests++;if(worker.action==='plant')plants++;if(worker.action==='water')waters++;if(worker.action==='collect')crafts++;}
  const targets=new Set();for(const lease of Object.values(s._serverWorkers.leases) as any[]){const key=lease.map+':'+lease.target;assert(!targets.has(key),'No workers reserve the same object on a map');targets.add(key);}
  for(const [map,f]of Object.entries(s.farms) as [string,any][]){
   const plot=f.objects.find((o:any)=>o.id==='ready');eq(plot.crop,'carrot','Previous-crop policy survives travel');
   const oven=f.objects.find((o:any)=>o.id==='oven');assert((s.farms.willow.inventory.flour||0)+(oven.jobs||[]).reduce((n:number,j:any)=>n+j.output,0)<=6,'Production cap remains respected');
   for(const w of Object.values(s.workforce) as any[])if(w.map===map)assert(w.jobs>=0&&w.jobs<=12,'Well shift remains bounded');
  }
 }
 assert(harvests>=3&&plants>=3&&waters>=3&&crafts>=1,'All assigned maps perform the crop/water/production loops');
 eq(Object.entries(s.farms).map(([map,f]:[string,any])=>[map,f.objects.map((o:any)=>o.id)]),beforeIDs,'Long sessions retain every placed object');
 const repeated=run(s,'workers.tick',undefined,{},now+30*60000);eq(repeated.save.farms.willow.inventory,s.farms.willow.inventory,'An immediate poll cannot create another harvest or batch');
 console.log(JSON.stringify({simulatedMinutes:30,visits,harvests,plants,waters,crafts,objectsPreserved:true}));
});

Deno.test('Crowded-farm scheduling reuses reachability instead of repeatedly scanning inaccessible jobs',()=>{
 const objects:any[]=[{id:'well',type:'well',x:3,y:2,helpers:{jade:true,rhys:true,jay:true}}];
 for(let i=0;i<40;i++)objects.push({id:'blocked-'+i,type:'plot',x:35,y:35});
 for(let i=0;i<9;i++)objects.push({id:'field-'+i,type:'plot',x:i,y:0});
 const s:any={active:'willow',coins:1000,farms:{willow:{objects,expansionLevel:3}},workforce:{}};
 const names=Array.from({length:9},(_,i)=>'worker-'+i);for(const id of names)s.workforce[id]={map:'willow',x:4,y:4};
 let taskScans=0,grassChecks=0;
 const noop=()=>{},W:any={
  meadowPlanner:{bind:noop,invalidate:noop},
  meadowFarmWork:{bind:noop,task:(_role:string,skip:Set<string>)=>{taskScans++;const o=objects.find(o=>o.type==='plot'&&!skip.has(o.id));return o?{...o,helperAction:'harvest'}:null;}},
  meadowRoster:{bind:noop,owned:()=>names.map(key=>({id:'hire-'+key,key,map:'willow'}))},
  meadowWells:{stats:()=>({stage:4,jobs:12,drink:12})}
 };
 const controller=createWorkerController({s,W,R:{maps:[],meadowOutline:[[0,0],[100,0],[100,100],[0,100]],areaOutlines:{},catalog:[]},now,api:{state:()=>s,items:{}},fp:()=>({w:1,h:1}),grass:(x:number,y:number)=>{grassChecks++;return x>=0&&x<9&&y>=0&&y<9;},home:()=>null,animal:()=>false,area:()=>1,plotYield:()=>3,seedCost:()=>1,unlockedCrop:()=>true,event:noop,fields:noop,fail:(message:string)=>{throw Error(message)},integer:(n:number,min:number,max:number)=>Number.isInteger(n)&&n>=min&&n<=max,runOnMap:(_map:string,fn:()=>unknown)=>fn()});
 controller.command('workers.tick',undefined,{},'willow');
 const leases=Object.values(s._serverWorkers.leases) as any[];
 eq(leases.length,9);eq(new Set(leases.map(l=>l.target)).size,9);assert(taskScans<=18,'Inaccessible jobs must not trigger repeated full task scans');
 for(const lease of leases)for(let i=1;i<lease.path.length;i++){const a=lease.path[i-1],b=lease.path[i];assert(Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1,'Routes use adjacent valid cells');assert(!(b.x===3&&b.y===2),'Routes do not cross the well');}
 console.log(JSON.stringify({workers:9,inaccessibleTargets:40,reachableJobs:leases.length,taskScans,grassChecks,requestScoped:true}));
});
