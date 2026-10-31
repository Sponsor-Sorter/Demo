import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=Date.parse('2026-10-30T10:00:00Z');
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m);}
function eq(a:unknown,b:unknown){assert(JSON.stringify(a)===JSON.stringify(b),JSON.stringify(a)+' != '+JSON.stringify(b));}
function state(level=20):any{return{version:1,tutorial:earnedTutorial(),coins:10000,level,xp:0,rep:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[{id:'well',type:'well',x:3,y:2,tier:3,autoWater:true,helperPlantMode:'previous',helperCrop:'wheat',helpers:{jade:true,rhys:true,jay:true}},{id:'plot',type:'plot',x:4,y:3,tier:0,stage:1,crop:'carrot',plantedAt:now-600000}],inventory:{carrot:0,wheat:30,flour:0},orders:[],expansionLevel:3,shop:{unlocked:false,stock:{},earned:0}}}};}
const run=(s:any,type:string,target?:string,data:any={},time=now,map='willow')=>applyFarmCommands(s,[{type,target,data,map}],time);
function denied(fn:()=>unknown){let e;try{fn();}catch(x){e=x;}assert(e instanceof FarmActionError,'Expected deliberate rejection, got '+String(e));}
function hired(s:any,map='willow'){s=run(s,'workers.hire','rowan').save;return run(s,'workers.assign','rowan',{x:4,y:4,expectedMap:null},now,map).save;}
Deno.test('Hiring and reassignment enforce level, exact price, clear tiles and explicit old farm',()=>{
 denied(()=>run(state(10),'workers.hire','rowan'));let s=hired(state());eq(s.coins,9350);eq(s.workforce.rowan.map,'willow');denied(()=>run(s,'workers.hire','rowan'));denied(()=>run(s,'workers.assign','rowan',{x:3,y:2,expectedMap:'willow'}));
 s.farms.coast={...s.farms.willow,objects:[],inventory:s.farms.willow.inventory};denied(()=>run(s,'workers.assign','rowan',{x:4,y:4,expectedMap:null},now,'coast'));s=run(s,'workers.assign','rowan',{x:4,y:4,expectedMap:'willow'},now,'coast').save;eq(s.workforce.rowan.map,'coast');
 denied(()=>run(s,'workers.tick',undefined,{task:'plot',readyAt:1}));
});
Deno.test('Worker polling cannot finish a lease early, replay it or collect a changed task',()=>{
 let s=hired(state());let out=run(s,'workers.tick');s=out.save;const lease=s._serverWorkers.leases['hire-rowan'];assert(lease?.target==='plot');eq(s.farms.willow.inventory.carrot,0);
 for(let i=0;i<4;i++)s=run(s,'workers.tick').save;eq(s.farms.willow.inventory.carrot,0);eq(s.workforce.rowan.jobs,0);
 s=run(s,'workers.tick',undefined,{},lease.readyAt).save;eq(s.farms.willow.inventory.carrot,3);eq(s.workforce.rowan.jobs,1);eq(s.farms.willow.objects[1].plantedAt,0);
 s=run(s,'workers.tick',undefined,{},lease.readyAt).save;eq(s.farms.willow.inventory.carrot,3);eq(s.workforce.rowan.jobs,1);
 let other=hired(state());other=run(other,'workers.tick').save;const until=other._serverWorkers.leases['hire-rowan'].readyAt;other=run(other,'plot.harvest','plot',{},now+1000).save;other=run(other,'workers.tick',undefined,{},until).save;eq(other.farms.willow.inventory.carrot,3);eq(other.workforce.rowan.jobs,0);
});
Deno.test('Bounded offline return replants the last crop and waters it only with the owned license',()=>{
 let s=hired(state());s=run(s,'workers.tick').save;const r=run(s,'workers.return',undefined,{},now+600000);s=r.save;eq(r.results[0].completed.map((j:any)=>j.action),['harvest','plant','water']);eq(s.farms.willow.inventory.carrot,3);const p=s.farms.willow.objects[1];eq(p.crop,'carrot');eq(p.plantedAt,now+600000);assert(p.wateredUntil>now+600000);eq(s.workforce.rowan.jobs,3);eq(s.coins,9348);
 const again=run(s,'workers.return',undefined,{},now+600000);eq(again.results[0].completed,[]);eq(again.save.coins,s.coins);
 let dry=hired(state());dry.farms.willow.objects[0].autoWater=false;dry=run(dry,'workers.tick').save;const d=run(dry,'workers.return',undefined,{},now+600000);eq(d.results[0].completed.map((j:any)=>j.action),['harvest','plant']);eq(d.save.farms.willow.objects[1].wateredUntil,0);
});
Deno.test('Other maps automate against their own objects and caps, sharing only the pantry',()=>{
 let s=state();s.farms.coast={...s.farms.willow,objects:JSON.parse(JSON.stringify(s.farms.willow.objects)),inventory:s.farms.willow.inventory};s=hired(s,'coast');s=run(s,'workers.tick').save;const r=run(s,'workers.return',undefined,{},now+600000);s=r.save;assert(r.results[0].completed.every((x:any)=>x.map==='coast'));eq(s.farms.willow.objects[1].plantedAt,now-600000);eq(s.farms.coast.objects[1].plantedAt,now+600000);eq(s.farms.willow.inventory.carrot,3);eq(s.active,'willow');eq(s.farmProgress.farms.coast.practice.harvest,1);
 let cap=hired(state());cap.farms.willow.objects[0].helperCropCap=2;cap=run(cap,'workers.tick').save;const c=run(cap,'workers.return',undefined,{},now+600000);eq(c.results[0].completed.map((x:any)=>x.action),['harvest']);
});
Deno.test('Drink breaks and missing paths block work; clients cannot forge walkable terrain',()=>{
 let s=hired(state());Object.assign(s.workforce.rowan,{jobs:12,x:3,y:3});s=run(s,'workers.tick').save;eq(s.workforce.rowan.drinkUntil,now+12000);assert(!s._serverWorkers.leases['hire-rowan']);s=run(s,'workers.tick',undefined,{},now+11000).save;assert(!s._serverWorkers.leases['hire-rowan']);s=run(s,'workers.tick',undefined,{},now+12000).save;eq(s.workforce.rowan.jobs,0);assert(s._serverWorkers.leases['hire-rowan']);
 const blocked=hired(state());blocked.farms.willow.objects[1].x=45;blocked.farms.willow.objects[1].y=45;blocked.farms.willow.workerTerrain=[{x:45,y:45}];const out=run(blocked,'workers.tick');eq(out.results[0].workers.find((w:any)=>w.worker==='hire-rowan').status,'idle');
});
Deno.test('Family roles use all three farmers; leases are cancelled when they are paused or moved',()=>{
 let s=state();s.farms.willow.objects[0].helpers={jade:false,rhys:false,jay:false};let r=run(s,'workers.tick');s=r.save;eq(s._serverWorkers.leases.jade.action,'harvest');assert(!s._serverWorkers.leases.rhys);
 const finish=s._serverWorkers.leases.jade.readyAt;s=run(s,'workers.tick',undefined,{},finish).save;eq(s.farms.willow.inventory.carrot,3);
 s=run(s,'workers.tick',undefined,{},finish+3000).save;eq(s._serverWorkers.leases.rhys.action,'plant');
 s=run(s,'well.settings','well',{helpers:{jade:false,rhys:true,jay:false},crop:'carrot',mode:'previous',cap:0},finish+3001).save;s=run(s,'workers.tick',undefined,{},finish+60000).save;eq(s.farms.willow.objects[1].plantedAt,0);assert(!s._serverWorkers.leases.rhys);
});
Deno.test('Planner protects ingredients and helpers collect production without duplicate craft credit',()=>{
 let s=hired(state());s.farms.willow.objects.push({id:'oven',type:'kitchen',x:6,y:3,autoWork:true,autoCap:2,autoRecipe:'flour'});s.farms.willow.objects[1].plantedAt=now;s.farms.willow.objects[0].autoWater=false;
 s=run(s,'workers.tick').save;const l=s._serverWorkers.leases['hire-rowan'];eq(l.action,'make');s=run(s,'workers.tick',undefined,{},l.readyAt).save;eq(s.farms.willow.objects[2].jobs.length,1);eq(s.farms.willow.inventory.wheat,27);
 s=run(s,'workers.tick',undefined,{},l.readyAt+40000).save;const collect=s._serverWorkers.leases['hire-rowan'];eq(collect.action,'collect');const r=run(s,'workers.tick',undefined,{},collect.readyAt);s=r.save;eq(s.farms.willow.inventory.flour,2);eq(s.artisanMastery.batches.flour,1);eq(s.almanac.totals.flour,2);eq(r.events.filter((e:any)=>e.event==='craft').length,1);
});
Deno.test('Moved targets and lesson reservations cancel stale jobs rather than teleporting a worker',()=>{
 let s=hired(state());s=run(s,'workers.tick').save;const until=s._serverWorkers.leases['hire-rowan'].readyAt;s=run(s,'build.move','plot',{x:7,y:5},now+1000).save;const moved=run(s,'workers.tick',undefined,{},until);eq(moved.save.farms.willow.inventory.carrot,0);eq(moved.save.workforce.rowan.jobs,0);
 let p=hired(state());p=run(p,'workers.protect','plot',{enabled:true}).save;p=run(p,'workers.tick').save;assert(!p._serverWorkers.leases['hire-rowan']);p=run(p,'workers.tick',undefined,{},now+120001).save;assert(p._serverWorkers.leases['hire-rowan']);
});
Deno.test('Return catch-up preserves a partly used shift instead of granting free stamina',()=>{
 let s=hired(state());s.farms.willow.objects[0].tier=0;s.workforce.rowan.jobs=1;s=run(s,'workers.tick').save;const r=run(s,'workers.return',undefined,{},now+60000);eq(r.results[0].completed.length,1);eq(r.save.workforce.rowan.jobs,2);eq(r.results[0].completed[0].action,'harvest');
});
Deno.test('Drink breaks start after the worker walks to the well',()=>{
 let s=hired(state());Object.assign(s.workforce.rowan,{jobs:12,x:7,y:5});s=run(s,'workers.tick').save;const path=s.workforce.rowan.returning;assert(path&&path.readyAt>now);eq(s.workforce.rowan.drinkUntil,0);
 s=run(s,'workers.tick',undefined,{},path.readyAt-1).save;eq(s.workforce.rowan.drinkUntil,0);s=run(s,'workers.tick',undefined,{},path.readyAt).save;eq(s.workforce.rowan.drinkUntil,path.readyAt+12000);eq(s.workforce.rowan.x,path.to.x);eq(s.workforce.rowan.y,path.to.y);
});
Deno.test('The family keeps separate stamina at each farm when travelling',()=>{
 let s=state();s.farms.willow.objects[0].helpers.jade=false;s=run(s,'workers.tick').save;const until=s._serverWorkers.leases.jade.readyAt;s=run(s,'workers.tick',undefined,{},until).save;eq(s.farms.willow.helperStamina.jade.jobs,1);
 s.farms.coast=JSON.parse(JSON.stringify(state().farms.willow));s.farms.coast.objects[0].helpers.jade=false;s=run(s,'map.visit',undefined,{destination:'coast'},until).save;s=run(s,'workers.tick',undefined,{},until,'coast').save;eq(s.farms.coast.helperStamina.jade.jobs,0);
 s=run(s,'map.visit',undefined,{destination:'willow'},until,'coast').save;s=run(s,'workers.tick',undefined,{},until).save;eq(s.farms.willow.helperStamina.jade.jobs,1);eq(s._serverWorkers.family.jade.map,'willow');
});
Deno.test('All three family farmers can help from the first player level',()=>{
 const s=state(1);s.farms.willow.objects[0].helpers={jade:false,rhys:false,jay:false};const r=run(s,'workers.tick');eq(r.results[0].workers.map((w:any)=>w.worker).sort(),['jade','jay','rhys']);assert(r.save._serverWorkers.leases.jade);
});
Deno.test('Grouped lesson protection uses only owned targets and expires on the server clock',()=>{
 let s=hired(state());s=run(s,'workers.protect_many',undefined,{ids:['plot','well'],enabled:true}).save;s=run(s,'workers.tick').save;assert(!s._serverWorkers.leases['hire-rowan']);
 denied(()=>run(s,'workers.protect_many',undefined,{ids:['missing'],enabled:true}));denied(()=>run(s,'workers.protect_many',undefined,{ids:['__proto__'],enabled:true}));denied(()=>run(s,'workers.tick',undefined,{},now,'constructor'));
 s=run(s,'workers.protect_many',undefined,{ids:['plot','missing'],enabled:false}).save;s=run(s,'workers.tick').save;assert(s._serverWorkers.leases['hire-rowan']);
});
Deno.test('A hired worker waters a new crop before older optional production chores',()=>{
 let s=state();const p=s.farms.willow.objects[1];p.plantedAt=now;p.lastHelperAt=now;
 s.farms.willow.objects.push({id:'oven',type:'kitchen',x:6,y:3,autoWork:true,autoRecipe:'flour',jobs:[]});
 s=hired(s);s=run(s,'workers.tick').save;const water=s._serverWorkers.leases['hire-rowan'];eq(water.action,'water');
 s=run(s,'workers.tick',undefined,{},water.readyAt).save;assert(s.farms.willow.objects[1].wateredUntil>water.readyAt);
 s=run(s,'workers.tick',undefined,{},water.readyAt+12000).save;eq(s._serverWorkers.leases['hire-rowan'].action,'make');
});
