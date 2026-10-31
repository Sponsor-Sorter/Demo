import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=Date.parse('2026-10-30T10:00:00Z');
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m);}
function eq(a:unknown,b:unknown){assert(JSON.stringify(a)===JSON.stringify(b),JSON.stringify(a)+' != '+JSON.stringify(b));}
function state():any{return{version:1,coins:250,level:1,xp:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[{id:'plot',type:'plot',x:4,y:3,stage:0}],inventory:{carrot:10},orders:[],expansionLevel:3}}};}
const run=(s:any,type:string,target?:string,data:any={},time=now,context:any={})=>applyFarmCommands(s,[{type,target,data}],time,context);
function denied(fn:()=>unknown){let e;try{fn();}catch(x){e=x;}assert(e instanceof FarmActionError,'Expected deliberate rejection');}
Deno.test('The first crop loop includes each real 10-gold lesson exactly once',()=>{
 let s=state();s=run(s,'plot.till','plot').save;eq(s.coins,260);s=run(s,'plot.plant','plot',{crop:'carrot'}).save;eq(s.coins,267);s=run(s,'plot.water','plot').save;eq(s.coins,276);
 const r=run(s,'plot.harvest','plot',{},now+135000);s=r.save;eq(s.coins,288);eq(r.results[0].lesson_rewards,['harvest']);eq(s.tutorial.rewarded,['till','plant','water','harvest']);
 s=run(s,'plot.plant','plot',{crop:'carrot'},now+135000).save;s=run(s,'plot.harvest','plot',{},now+270000).save;eq(s.coins,287);eq(s.tutorial.rewarded.length,4);
});
Deno.test('Ordinary sales use exact goods/prices and have a separate one-time selling lesson',()=>{
 let s=state();s=run(s,'market.sell_direct',undefined,{item:'carrot',count:3}).save;eq(s.coins,284);eq(s.farms.willow.inventory.carrot,7);eq(s.xp,2);
 s=run(s,'market.sell_direct',undefined,{item:'carrot',count:3}).save;eq(s.coins,308);eq(s.tutorial.rewarded,['sell']);
 denied(()=>run(s,'market.sell_direct',undefined,{item:'carrot',count:99}));denied(()=>run(s,'market.sell_direct',undefined,{item:'carrot',count:1,gold:1000}));
});
Deno.test('Visit lessons require a database-owned visit proof and never accept arbitrary lesson claims',()=>{
 const s=state();denied(()=>run(s,'lesson.claim','friends'));denied(()=>run(s,'lesson.claim','harvest'));denied(()=>run(s,'lesson.claim','friends',{visitedFriend:true}));
 const r=run(s,'lesson.claim','friends',{},now,{visitedFriend:true});eq(r.save.coins,260);eq(r.save.tutorial.rewarded,['friends']);denied(()=>run(r.save,'lesson.claim','friends',{},now,{visitedFriend:true}));
});
Deno.test('Invalid batches cannot partially award a tutorial bonus',()=>{
 const s=state(),before=JSON.stringify(s);denied(()=>applyFarmCommands(s,[{type:'plot.till',target:'plot'},{type:'wallet.credit'}],now));eq(JSON.stringify(s),before);
});
Deno.test('A recorded friend visit completes story and lesson once without trusting client counters',()=>{
 const s=state();denied(()=>run(s,'social.visit'));denied(()=>run(s,'social.visit',undefined,{visitedFriend:true},now,{visitedFriend:true}));denied(()=>run(s,'social.visit','forged',{},now,{visitedFriend:true}));
 const a=run(s,'social.visit',undefined,{},now,{visitedFriend:true});eq(a.save.homestead.stats.visit,1);eq(a.save.coins,260);eq(a.results[0].lesson_rewards,['friends']);
 const b=run(a.save,'social.visit',undefined,{},now,{visitedFriend:true});eq(b.save.homestead.stats.visit,1);eq(b.save.coins,260);eq(b.events,[]);
 const c=run(b.save,'story.claim','visit');eq(c.save.coins,360);denied(()=>run(c.save,'story.claim','visit'));
});
