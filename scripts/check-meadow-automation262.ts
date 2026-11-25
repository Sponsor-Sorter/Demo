import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {applyFarmCommands} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=Date.parse('2026-11-26T00:00:00Z');
function assert(v:unknown,message:string):asserts v{if(!v)throw Error(message);}
const tick=(s:any,at=now)=>applyFarmCommands(s,[{type:'workers.tick',map:'willow'}],at);
function farm(role='jay',kind='cow'):any{
 const target=role==='jay'?{id:'animal',type:kind,x:5,y:3,hunger:100,clean:100,happy:100,lastCare:now-60000,needsAt:now,lastProductAt:now-300000}:{id:'field',type:'plot',x:4,y:3,tier:0,crop:'carrot',stage:1,plantedAt:role==='jade'?now-600000:0};
 const stamina={x:7,y:5,map:'willow',jobs:0,drinkUntil:0};
 return{version:1,tutorial:earnedTutorial(),coins:10000,level:45,xp:0,rep:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[{id:'well',type:'well',x:3,y:2,tier:3,helperPlantMode:'previous',helpers:{jade:role!=='jade',rhys:role!=='rhys',jay:role!=='jay'}},target],inventory:{},orders:[],expansionLevel:3,shop:{unlocked:false,stock:{},earned:0},helperStamina:{[role]:stamina}}},_serverWorkers:{version:1,lastReturnAt:now,family:{[role]:stamina},leases:{}}};
}
for(const[kind,item]of [['chicken','egg'],['cow','milk'],['sheep','wool'],['goat','goatmilk'],['alpaca','fleece']])Deno.test('Jay collects healthy '+kind+' produce without a pinned farm project',()=>{
 let r=tick(farm('jay',kind));
 const lease=r.save._serverWorkers.leases.jay;
 assert(lease?.action==='care'&&lease.target==='animal','Ready produce must create an ordinary timed Jay care lease, even when all needs are healthy');
 assert(!r.save.farms.willow.inventory[item],'Selecting work cannot grant produce early');
 r=tick(r.save,lease.readyAt);assert(r.save.farms.willow.inventory[item]>0,'The completed care job collects the ready produce');
 const amount=r.save.farms.willow.inventory[item],again=tick(r.save,lease.readyAt);
 assert(again.save.farms.willow.inventory[item]===amount,'A repeated poll cannot duplicate produce');
});
Deno.test('Jay retains care cooldown, readiness and pause protections',()=>{
 const cooldown=farm();cooldown.farms.willow.objects[1].lastCare=now-45000;
 assert(!tick(cooldown).save._serverWorkers.leases.jay,'Ready produce does not bypass the existing care cooldown');
 const waiting=farm();waiting.farms.willow.objects[1].lastProductAt=now;
 assert(!tick(waiting).save._serverWorkers.leases.jay,'A healthy animal without ready produce creates no fake work');
 const paused=farm();paused.farms.willow.objects[0].helpers.jay=true;
 assert(!tick(paused).save._serverWorkers.leases.jay,'Pausing Jay still prevents animal collection');
 const hungry=farm();Object.assign(hungry.farms.willow.objects[1],{lastProductAt:now,hunger:60});
 assert(tick(hungry).save._serverWorkers.leases.jay?.action==='care','An animal needing care is still helped before produce is ready');
});
for(const role of ['jade','rhys','jay'])for(const upgrade of [{tier:3,jobs:12,drink:12},{tier:4,jobs:16,drink:11},{tier:7,wellGemTier:4,jobs:140,drink:4}])Deno.test(role+' walks, completes the full well break and resumes at stage '+(upgrade.wellGemTier?'crystal4':upgrade.tier),()=>{
 const initial=farm(role);Object.assign(initial.farms.willow.objects[0],{tier:upgrade.tier,wellGemTier:upgrade.wellGemTier||0});initial.farms.willow.helperStamina[role].jobs=upgrade.jobs;
 let r=tick(initial),actor=r.save.farms.willow.helperStamina[role];const walk=actor.returning;
 assert(walk?.path.length>1&&walk.readyAt>now,'Exhaustion must begin a timed real walk to the well');
 assert(actor.drinkUntil===0&&!r.save._serverWorkers.leases[role],'No drink or productive work starts before arrival');
 r=tick(r.save,walk.readyAt-1);assert(!r.save.farms.willow.helperStamina[role].drinkUntil,'Walking cannot finish early');
 r=tick(r.save,walk.readyAt);actor=r.save.farms.willow.helperStamina[role];const until=actor.drinkUntil;
 assert(until===walk.readyAt+upgrade.drink*1000,'The upgraded well sets the full drinking duration');
 r=tick(r.save,until-1);assert(r.save.farms.willow.helperStamina[role].jobs===upgrade.jobs&&!r.save._serverWorkers.leases[role],'The last drinking millisecond cannot be skipped');
 r=tick(r.save,until);const next=r.save._serverWorkers.leases[role];
 assert(r.save.farms.willow.helperStamina[role].jobs===0&&next?.action===({jade:'harvest',rhys:'plant',jay:'care'}[role]),'The same farmer must resume its own productive role after the full break');
 r=tick(r.save,next.readyAt);assert(r.save.farms.willow.helperStamina[role].jobs===1,'The resumed job completes normally and uses one shift job');
});
