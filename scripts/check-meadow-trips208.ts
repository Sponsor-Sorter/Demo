import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=Date.parse('2026-10-30T10:00:00Z');
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m);}
function eq(a:unknown,b:unknown){assert(JSON.stringify(a)===JSON.stringify(b),JSON.stringify(a)+' != '+JSON.stringify(b));}
function state():any{return{version:1,coins:100,level:8,xp:0,active:'willow',sharedPantryVersion:1,journey:{projects:{jetty:3,outpost:3}},farms:{willow:{objects:[],inventory:{wheat:10},orders:[],expansionLevel:3}}};}
const run=(s:any,type:string,data:any={},time=now)=>applyFarmCommands(s,[{type,data}],time);
function denied(fn:()=>unknown){let e;try{fn();}catch(x){e=x;}assert(e instanceof FarmActionError,'Expected deliberate rejection, got '+String(e));}
function start(kind='fishing'){let s=run(state(),'trip.begin',{kind}).save;const id=s.journey.pendingTrip.id;s=run(s,'trip.start',{run:id}).save;return {s,run:id,attempt:s.journey.pendingTrip.attempt.id};}
Deno.test('Fishing begins with exact bait/cost and derives its catch from three timed casts',()=>{
 const a=start();eq(a.s.coins,80);eq(a.s.farms.willow.inventory.wheat,9);const payload={run:a.run,attempt:a.attempt,actions:[{t:0},{t:Math.PI/2.4},{t:Math.PI/2.4+Math.PI/2.6}]};
 denied(()=>run(a.s,'trip.collect',payload,now));const r=run(a.s,'trip.collect',payload,now+3000);eq(r.results[0].score,100);eq(r.save.farms.willow.inventory.goldencarp,2);assert(!r.save.journey.pendingTrip);denied(()=>run(r.save,'trip.collect',payload,now+3000));
 denied(()=>run(r.save,'trip.begin',{kind:'fishing'},now+3001));
});
Deno.test('A failed cast cannot become a perfect catch through client score/output injection',()=>{
 const a=start();for(const extra of [{score:100},{goods:{goldencarp:100}},{elapsed:20}])denied(()=>run(a.s,'trip.collect',{run:a.run,attempt:a.attempt,actions:[{t:0},{t:1},{t:2}],...extra},now+3000));
 denied(()=>run(a.s,'trip.collect',{run:a.run,attempt:a.attempt,actions:[{t:0},{t:.01},{t:.02}]},now+3000));denied(()=>run(a.s,'trip.collect',{run:a.run,attempt:a.attempt,actions:[{t:0},{t:1},{t:2}]},now+1200000));
});
Deno.test('Woodland uses issued target names and waits for completion or the real timeout',()=>{
 const a=start('woodland'),targets=a.s.journey.pendingTrip.attempt.targets,actions=targets.map((item:string,i:number)=>({t:i*.2,item}));
 const r=run(a.s,'trip.collect',{run:a.run,attempt:a.attempt,actions},now+3000);eq(r.results[0].score,100);eq(r.save.farms.willow.inventory.blackberry,5);eq(r.save.farms.willow.inventory.hazelnut,2);eq(r.save.farms.willow.inventory.wildherbs,3);
 denied(()=>run(a.s,'trip.collect',{run:a.run,attempt:a.attempt,actions:[]},now+1000));const timeout=run(a.s,'trip.collect',{run:a.run,attempt:a.attempt,actions:[]},now+45000);eq(timeout.results[0].score,0);eq(timeout.save.farms.willow.inventory.blackberry,1);
});
Deno.test('Retry, pause and resume use server clocks; old attempts and paused collection fail',()=>{
 const a=start('woodland');let s=run(a.s,'trip.pause',{run:a.run,attempt:a.attempt},now+1000).save;denied(()=>run(s,'trip.collect',{run:a.run,attempt:a.attempt,actions:[]},now+90000));
 s=run(s,'trip.resume',{run:a.run,attempt:a.attempt},now+90000).save;denied(()=>run(s,'trip.collect',{run:a.run,attempt:a.attempt,actions:[]},now+91000));
 s=run(s,'trip.start',{run:a.run},now+91000).save;denied(()=>run(s,'trip.collect',{run:a.run,attempt:a.attempt,actions:[]},now+150000));assert(s.journey.pendingTrip.attempt.id!==a.attempt);eq(s.coins,100);
});
