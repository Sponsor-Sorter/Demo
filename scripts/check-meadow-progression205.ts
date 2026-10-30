import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createGameRules} from '../supabase/functions/_shared/meadow-game-rules204.ts';
const now=Date.parse('2026-10-30T10:00:00Z');
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m);}
function eq(a:unknown,b:unknown){assert(JSON.stringify(a)===JSON.stringify(b),JSON.stringify(a)+' != '+JSON.stringify(b));}
const rules=()=>createGameRules(now) as any;
function state(level=20):any{return{version:1,coins:100000,level,xp:0,rep:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[],inventory:Object.fromEntries(Object.keys(rules().crops).map(id=>[id,200])),orders:[],expansionLevel:3,shop:{unlocked:false,stock:{},earned:0}}}};}
const run=(s:any,type:string,target?:string,data:any={},time=now,map='willow')=>applyFarmCommands(s,[{type,target,data,map}],time);
function denied(fn:()=>unknown){let e;try{fn();}catch(x){e=x;}assert(e instanceof FarmActionError,'Expected deliberate command rejection, got '+String(e));}
Deno.test('Village projects, customer cooldowns and relationship rewards use the reviewed rules',()=>{
 let s=state();s.farms.east={...s.farms.willow,objects:[]};const J=rules().window.meadowJourneyCore;
 const first=J.projectStatus(s,'outpost');assert(first?.can);const before=s.coins,expected=first.step;
 s=run(s,'journey.restore','outpost',{expected:0}).save;eq(s.coins,before-expected.gold+expected.reward);eq(s.journey.projects.outpost,1);denied(()=>run(s,'journey.restore','outpost',{expected:0}));
 s.journey.projects.outpost=3;s.journey.projects.cafe=3;s.journey.projects.bakery=3;s.journey.projects.hall=3;
 const definition=rules(),customer=definition.window.meadowJourneyData.customers[0],q=definition.window.meadowJourneyCore.contract(s,customer.id,definition.crops),n=s.coins;
 s=run(s,'customer.deliver',customer.id,{serial:0}).save;eq(s.coins,n+q.gold);eq(s.journey.customers[customer.id].deliveries,1);
 denied(()=>run(s,'customer.deliver',customer.id,{serial:1}));denied(()=>run(s,'customer.deliver',customer.id,{serial:0},now+120000));
 for(let serial=1;serial<3;serial++)s=run(s,'customer.deliver',customer.id,{serial},now+serial*120000).save;
 const gold=s.coins;s=run(s,'relationship.claim',customer.id+':3').save;eq(s.coins,gold+100);denied(()=>run(s,'relationship.claim',customer.id+':3'));
});
Deno.test('Per-farm focus, training and planner settings cannot inject prices, ranks or practice',()=>{
 let s=state();s.farms.coast={...s.farms.willow,objects:[]};s=run(s,'focus.choose','grower',{},now,'coast').save;
 eq(s.active,'willow');eq(s.farmProgress.farms.coast.active,'grower');denied(()=>run(s,'focus.upgrade','grower',{expected:0},now,'coast'));
 s.farmProgress.farms.coast.practice.harvest=20;const gold=s.coins;s=run(s,'focus.upgrade','grower',{expected:0},now,'coast').save;eq(s.coins,gold-300);eq(s.farmProgress.farms.coast.ranks.grower,1);
 denied(()=>run(s,'focus.choose','keeper',{},now+1000,'coast'));denied(()=>run(s,'career.train','jade',{expected:0,gold:0}));
 s=run(s,'planner.pin',undefined,{kind:'recipe',id:'bread',amount:4}).save;eq(s.farmPlan.goal.amount,4);s=run(s,'planner.settings',undefined,{helpers:true,keepGold:false}).save;eq(s.farmPlan.keepGold,false);
 denied(()=>run(s,'planner.pin',undefined,{kind:'recipe',id:'bread',amount:4,reward:1000}));
});
Deno.test('Greenhouse and nursery use real elapsed time, exact supplies, homes and one-time care',()=>{
 let s=state();s.journey={projects:{cafe:2,bakery:2}};s=run(s,'greenhouse.upgrade',undefined,{expected:0}).save;s=run(s,'greenhouse.plant',undefined,{index:0,crop:'strawberry'}).save;
 denied(()=>run(s,'greenhouse.harvest',undefined,{index:0}));const count=s.farms.willow.inventory.strawberry;s=run(s,'greenhouse.harvest',undefined,{index:0},now+300000).save;eq(s.farms.willow.inventory.strawberry,count+15);denied(()=>run(s,'greenhouse.harvest',undefined,{index:0},now+300000));
 s=run(s,'nursery.upgrade',undefined,{expected:0}).save;s.farms.willow.objects=[{id:'coop',type:'coop',x:4,y:3,tier:3},...['a','b'].map(id=>({id,type:'chicken',coopId:'coop',x:4,y:3,friendship:{points:1000,last:{}},hunger:95,clean:95,happy:95,needsAt:now}))];
 s=run(s,'nursery.breed',undefined,{first:'willow:a',second:'willow:b'}).save;const id=s.journey.nursery.jobs[0].id;
 for(const action of ['feed','brush','play'])s=run(s,'nursery.care',id,{action}).save;denied(()=>run(s,'nursery.care',id,{action:'feed'}));denied(()=>run(s,'nursery.settle',id,{home:'coop'}));
 s=run(s,'nursery.settle',id,{home:'coop'},now+600000).save;eq(s.journey.nursery.raised,1);eq(s.farms.willow.objects.at(-1).coopId,'coop');denied(()=>run(s,'nursery.settle',id,{home:'coop'},now+600000));
});
Deno.test('Weekly and journal claims reject stale dates and duplicate payouts',()=>{
 let s=state();const R=rules();R.window.meadowVillageOrders.bind({items:R.crops});const q=R.window.meadowVillageOrders.contract(s,now),gold=s.coins;
 s=run(s,'weekly.deliver',q.key+':0').save;eq(s.coins,gold+q.gold);denied(()=>run(s,'weekly.deliver',q.key+':0'));denied(()=>run(s,'weekly.deliver','2020-01-01:1'));
 s.journal={day:'2026-10-30',progress:{plant:3,harvest:3,care:2},claimed:[],bonus:false};const before=s.coins;
 for(const id of ['plant','harvest','care'])s=run(s,'journal.claim',id,{day:'2026-10-30'}).save;s=run(s,'journal.bonus',undefined,{day:'2026-10-30'}).save;eq(s.coins,before+235);
 denied(()=>run(s,'journal.bonus',undefined,{day:'2026-10-30'}));denied(()=>run(s,'journal.claim','plant',{day:'2026-10-30'},now+86400000));
});
Deno.test('Story, almanac, artisan and fair claims award once and require earned progress',()=>{
 let s=state();denied(()=>run(s,'almanac.claim','first-five'));s.almanac={seen:{carrot:true,wheat:true,strawberry:true,corn:true,tomato:true},totals:{},claimed:[]};let gold=s.coins;s=run(s,'almanac.claim','first-five').save;eq(s.coins,gold+80);denied(()=>run(s,'almanac.claim','first-five'));
 s.artisanMastery={version:1,batches:{flour:20},claimed:{},signature:{}};gold=s.coins;s=run(s,'artisan.claim','flour',{expected:3}).save;eq(s.coins,gold+60);denied(()=>run(s,'artisan.claim','flour',{expected:3}));s=run(s,'artisan.choose','flour').save;eq(s.artisanMastery.signature.kitchen,'flour');
 denied(()=>run(s,'fair.enter',undefined,{category:'crop',entry:'carrot'}));s.journey={projects:{hall:2}};s=run(s,'fair.enter',undefined,{category:'crop',entry:'carrot'}).save;denied(()=>run(s,'fair.enter',undefined,{category:'crop',entry:'carrot'}));denied(()=>run(s,'fair.claim','2'));
 const R=rules(),g=R.window.meadowStory.chapters.flatMap((c:any)=>c.goals).find((g:any)=>R.window.meadowStory.progress(s,g)>=g.target);assert(g,'Fixture needs an earned story goal');gold=s.coins;s=run(s,'story.claim',g.id).save;eq(s.coins,gold+g.reward);denied(()=>run(s,'story.claim',g.id));
});
Deno.test('Travel pays opening costs once, shares the pantry and fits starter assets on real grass',()=>{
 let s=state(7),gold=s.coins;const before=JSON.stringify(s.farms.willow.inventory);s=run(s,'map.visit',undefined,{destination:'east'}).save;eq(s.coins,gold-650);eq(s.active,'east');eq(s.farms.east.objects.length,0);eq(JSON.stringify(s.farms.willow.inventory),before);
 s=run(s,'map.visit',undefined,{destination:'willow'},now,'east').save;s=run(s,'map.visit',undefined,{destination:'east'}).save;eq(s.coins,gold-650);
 s=run(s,'map.visit',undefined,{destination:'coast'},now,'east').save;eq(s.farms.coast.objects.length,6);eq(JSON.stringify(s.farms.coast.inventory),before);eq(s.farms.coast.objects.filter((o:any)=>o.type==='plot').length,2);
 denied(()=>run(state(1),'map.visit',undefined,{destination:'coast'}));denied(()=>run(s,'map.visit',undefined,{destination:'town'},now,'coast'));
});
Deno.test('Well and production settings expose no way to mint paid slots, watering or clocks',()=>{
 let s=state();s.farms.willow.objects=[{id:'well',type:'well',x:4,y:3},{id:'oven',type:'kitchen',x:6,y:3}];
 s=run(s,'well.settings','well',{helpers:{jade:false,rhys:false,jay:true},mode:'previous',crop:'carrot',cap:20}).save;eq(s.farms.willow.objects[0].helpers.jay,true);
 s=run(s,'craft.settings','oven',{enabled:true,recipe:'bread',cap:40}).save;eq(s.farms.willow.objects[1].autoCap,40);
 denied(()=>run(s,'well.settings','well',{helpers:{jade:false,rhys:false,jay:false},mode:'previous',crop:'carrot',cap:20,autoWater:true}));denied(()=>run(s,'craft.settings','oven',{enabled:true,recipe:'bread',cap:40,queueSlots:8}));
 denied(()=>run(s,'journey.trip_complete',undefined,{score:100}));
});
