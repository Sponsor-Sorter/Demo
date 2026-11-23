import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {applyFarmCommands} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=Date.parse('2026-11-23T10:00:00Z');
function assert(v:unknown,m='Assertion failed'):asserts v {if(!v)throw Error(m);}
function equal(a:unknown,b:unknown,m='Values differ'){assert(JSON.stringify(a)===JSON.stringify(b),m+': '+JSON.stringify(a)+' != '+JSON.stringify(b));}
const run=(s:any,type:string,target?:string,data:any={},at=now)=>applyFarmCommands(s,[{type,target,data,map:'willow'}],at).save;
function returning(){
 let s:any={version:1,tutorial:earnedTutorial(),coins:10000,level:20,xp:0,rep:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[{id:'well',type:'well',x:3,y:2,tier:3,autoWater:true,helpers:{jade:true,rhys:true,jay:true}},{id:'plot',type:'plot',x:4,y:3,tier:0,stage:1,crop:'carrot',plantedAt:now-600000}],inventory:{carrot:0,wheat:30,flour:0},orders:[],expansionLevel:3,shop:{unlocked:false,stock:{},earned:0}}}};
 s=run(s,'workers.hire','rowan');s=run(s,'workers.assign','rowan',{x:7,y:5,expectedMap:null});
 // Exhaustion is local fixture setup, never a live player-state adjustment.
 Object.assign(s.workforce.rowan,{jobs:12,x:7,y:5});s=run(s,'workers.tick');assert(s.workforce.rowan.returning?.path.length>1);return s;
}
Deno.test('A newly occupied well-arrival cell replans before drinking and resumes paid-for work after the full rest',()=>{
 let s=returning();const old=structuredClone(s.workforce.rowan.returning),to=old.to;
 s=run(s,'build.place',undefined,{id:'tree-on-arrival',item:'tree',x:to.x,y:to.y},now+2);
 s=run(s,'workers.tick',undefined,{},old.readyAt);let w=s.workforce.rowan;
 assert(w.x!==to.x||w.y!==to.y,'Worker must not arrive inside the newly placed tree');equal(w.jobs,12);equal(w.drinkUntil,0,'Blocked old arrival cannot start a drink');
 assert(w.returning&&w.returning.readyAt>old.readyAt,'The replacement walk needs its actual travel time');assert(w.returning.path.every((p:any)=>p.x!==to.x||p.y!==to.y));
 const arrival=w.returning.readyAt;s=run(s,'workers.tick',undefined,{},arrival);w=s.workforce.rowan;equal(w.drinkUntil,arrival+12000);equal(w.jobs,12);
 s=run(s,'workers.tick',undefined,{},arrival+11999);assert(!s._serverWorkers.leases['hire-rowan']);equal(s.workforce.rowan.jobs,12);
 s=run(s,'workers.tick',undefined,{},arrival+12000);equal(s.workforce.rowan.jobs,0);const next=s._serverWorkers.leases['hire-rowan'];assert(next?.action==='harvest','The worker resumes its real crop job after resting');
 s=run(s,'workers.tick',undefined,{},next.readyAt);equal(s.workforce.rowan.jobs,1);equal(s.farms.willow.inventory.carrot,3);
});
Deno.test('A newly occupied intermediate well-route cell is not crossed by the replacement route',()=>{
 let s=returning();const old=structuredClone(s.workforce.rowan.returning),block=old.path[1];
 s=run(s,'build.place',undefined,{id:'tree-on-walk',item:'tree',x:block.x,y:block.y},now+2);s=run(s,'workers.tick',undefined,{},now+500);
 const w=s.workforce.rowan;assert(w.returning,'A different route remains available');assert(w.returning.path.every((p:any)=>p.x!==block.x||p.y!==block.y),'Saved travel cannot pass through a new object');equal(w.jobs,12);equal(w.drinkUntil,0);
});
Deno.test('A new corner obstacle invalidates a diagonal well walk even when both path nodes remain clear',()=>{
 let s=returning();const old=structuredClone(s.workforce.rowan.returning),from=old.path[0],to=old.path[1];assert(from.x!==to.x&&from.y!==to.y);
 const corner={x:to.x,y:from.y};s=run(s,'build.place',undefined,{id:'tree-on-corner',item:'tree',...corner},now+2);s=run(s,'workers.tick',undefined,{},now+500);
 const path=s.workforce.rowan.returning?.path;assert(path?.length>1);
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(a.x!==b.x&&a.y!==b.y)assert(!(corner.x===b.x&&corner.y===a.y)&&!(corner.x===a.x&&corner.y===b.y),'Replacement route must not cut a newly blocked corner');}
});
