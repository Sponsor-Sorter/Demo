import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {applyFarmCommands} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=Date.parse('2026-11-25T10:00:00Z');
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m);}
function fixture(role:string):any{
 const target=role==='jay'?{id:'job',type:'hive',x:7,y:5,tier:2,honey:8,lastHoneyAt:now}:{id:'job',type:'plot',x:7,y:5,tier:0,crop:'carrot',stage:1,plantedAt:role==='jade'?now-600000:0};
 const walls=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(dx||dy)walls.push({id:'wall'+dx+'_'+dy,type:'flowers',x:7+dx,y:5+dy,plantedAt:now});
 const stamina={x:3,y:3,jobs:0,drinkUntil:0,map:'willow'};
 return{version:1,tutorial:earnedTutorial(),coins:10000,level:20,xp:0,rep:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[{id:'well',type:'well',x:3,y:2,tier:3,helpers:{jade:role!=='jade',rhys:role!=='rhys',jay:role!=='jay'}},target,...walls],inventory:{carrot:0,wheat:30,flour:0},orders:[],expansionLevel:3,helperStamina:{[role]:stamina},shop:{unlocked:false,stock:{},earned:0}}},_serverWorkers:{version:1,lastReturnAt:now,family:{[role]:stamina},leases:{}}};
}
const tick=(s:any,t=now)=>applyFarmCommands(s,[{type:'workers.tick',map:'willow'}],t);
for(const role of ['jade','rhys','jay'])Deno.test(role+' reports unreachable work distinctly, then clears the reason when a normal path opens',()=>{
 const input=fixture(role),r=tick(input),worker=r.results[0].workers.find((w:any)=>w.worker===role);
 assert(worker.status==='blocked_work',JSON.stringify(worker));assert(r.save._serverWorkers.family[role].workBlocked===true);
 assert(!r.save._serverWorkers.leases[role]);assert(r.save.coins===10000&&r.save.xp===0);
 const clear=r.save;clear.farms.willow.objects=clear.farms.willow.objects.filter((o:any)=>o.id!=='wall-1_0');
 const resumed=tick(clear,now+1000);assert(!resumed.save._serverWorkers.family[role].workBlocked);
 assert(resumed.save._serverWorkers.leases[role]?.target==='job','Opening a real route permits an ordinary timed lease');
});
Deno.test('No available job remains idle and never invents a path warning',()=>{
 const s=fixture('rhys');s.farms.willow.objects=s.farms.willow.objects.filter((o:any)=>o.id!=='job');
 const r=tick(s);assert(r.results[0].workers.find((w:any)=>w.worker==='rhys').status==='idle');assert(!r.save._serverWorkers.family.rhys.workBlocked);assert(r.save.coins===10000);
});
Deno.test('Well exhaustion still requires the original full drink and preserves upgrade efficiency',()=>{
 const s=fixture('rhys');s.farms.willow.objects=s.farms.willow.objects.filter((o:any)=>!o.id.startsWith('wall'));
 Object.assign(s.farms.willow.helperStamina.rhys,{jobs:12,x:3,y:3});
 let r=tick(s);assert(r.save._serverWorkers.family.rhys.drinkUntil===now+12000);assert(!r.save._serverWorkers.leases.rhys);
 r=tick(r.save,now+11999);assert(r.save._serverWorkers.family.rhys.jobs===12&&!r.save._serverWorkers.leases.rhys);
 r=tick(r.save,now+12000);assert(r.save._serverWorkers.family.rhys.jobs===0);assert(r.save._serverWorkers.leases.rhys?.target==='job');
 const upgraded=fixture('rhys');upgraded.farms.willow.objects=upgraded.farms.willow.objects.filter((o:any)=>!o.id.startsWith('wall'));upgraded.farms.willow.objects[0].tier=4;upgraded.farms.willow.helperStamina.rhys.jobs=12;
 const next=tick(upgraded);assert(next.save._serverWorkers.leases.rhys?.target==='job');assert(!next.save._serverWorkers.family.rhys.drinkUntil,'Higher well retains its longer original shift');
});
