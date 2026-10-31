import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {applyFarmCommands,FarmActionError,type FarmCommand} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createGameRules} from '../supabase/functions/_shared/meadow-game-rules204.ts';
const now=Date.parse('2026-10-30T10:00:00Z');
function assert(value:unknown,message='Assertion failed'):asserts value{if(!value)throw Error(message);}
function eq(a:unknown,b:unknown,message='Values differ'){assert(JSON.stringify(a)===JSON.stringify(b),message+': '+JSON.stringify(a)+' != '+JSON.stringify(b));}
function state(objects:any[]=[],level=1):any{return{version:1,tutorial:earnedTutorial(),coins:5000,level,xp:0,rep:0,active:'willow',orderIndex:0,sharedPantryVersion:1,farms:{willow:{objects,inventory:{wheat:30,carrot:20,flour:10},orders:[],expansionLevel:3,shop:{unlocked:false,stock:{},earned:0}}}};}
const run=(s:any,type:string,target?:string,data?:any,time=now,map='willow')=>applyFarmCommands(s,[{type,target,data,map}],time);
function denied(fn:()=>unknown,code?:string){let error;try{fn();}catch(e){error=e;}assert(error instanceof FarmActionError,'Invalid action must be rejected deliberately');if(code)eq(error.code,code);}
Deno.test('Canonical mini-game records use only verified database round summaries',()=>{
 const s=state();s.minigames={records:{eggs:{wins:99,level:100,bestScore:99999}},rewards:{}};
 const result=applyFarmCommands(s,[{type:'shop.check'}],now,{roundRecords:[{game:'eggs',level:3,wins:2,bestScore:1400}]});eq(result.save.minigames.records.eggs,{wins:2,level:3,bestScore:1400});eq(s.minigames.records.eggs.level,100);
 denied(()=>applyFarmCommands(s,[{type:'shop.check'}],now,{roundRecords:[{game:'unknown',level:3,wins:2,bestScore:1400}]}));
});
Deno.test('Verified build undo restores only an owned move on clear original tiles',()=>{
 let s=state([{id:'plot',type:'plot',x:4,y:3,stage:1}]);s=run(s,'build.move','plot',{x:7,y:5}).save;eq(s.lastMove.from.x,4);
 s=run(s,'build.place',undefined,{id:'block','item':'tree',x:4,y:3,rotation:0}).save;denied(()=>run(s,'build.undo'));eq(s.farms.willow.objects[0].x,7);
 s=run(s,'build.sell','block').save;s=run(s,'build.undo').save;eq([s.farms.willow.objects[0].x,s.farms.willow.objects[0].y],[4,3]);eq(s.lastMove,null);denied(()=>run(s,'build.undo'));
});
Deno.test('Server crop cycle uses seed cost, water bonus, real elapsed time and mastery',()=>{
 const original=state([{id:'plot',type:'plot',x:4,y:3,stage:0}]);
 let s=run(original,'plot.till','plot').save;s=run(s,'plot.plant','plot',{crop:'carrot'}).save;
 eq(s.coins,4997);eq(s.farms.willow.objects[0].plantedAt,now);eq(original.coins,5000,'Input is never mutated');
 denied(()=>run(s,'plot.harvest','plot'), 'NOT_READY');
 s=run(s,'plot.water','plot').save;eq(s.coins,4996);denied(()=>run(s,'plot.water','plot'));
 const result=run(s,'plot.harvest','plot',{},now+135000);s=result.save;
 eq(result.results[0].count,4);eq(s.farms.willow.inventory.carrot,24);eq(s.coins,4998);eq(s.xp,8);
 eq(s.farms.willow.objects[0].plantedAt,0);eq(s.journal.progress.harvest,1);eq(s.journal.day,'2026-10-30');
 denied(()=>run(s,'plot.harvest','plot',{},now+135000),'NOT_READY');
});
Deno.test('Oversized, injected, unsupported and partially invalid batches do not mutate the canonical farm',()=>{
 const s=state([{id:'plot',type:'plot',x:4,y:3,stage:1}]),before=JSON.stringify(s);
 for(const data of [{crop:'carrot',gold:99999},{crop:'carrot',plantedAt:1},{crop:'carrot',output:10000},{crop:'__proto__'}])denied(()=>run(s,'plot.plant','plot',data));
 denied(()=>run(s,'wallet.credit','plot',{gold:99999}),'UNSUPPORTED_FARM_ACTION');
 denied(()=>applyFarmCommands(s,[],now));denied(()=>applyFarmCommands(s,Array(33).fill({type:'shop.check'}),now));
 denied(()=>applyFarmCommands(s,[{type:'plot.plant',target:'plot',data:{crop:'carrot'}},{type:'plot.harvest',target:'plot'}],now));
 eq(JSON.stringify(s),before,'A rejected command batch has no partial effects');
});
Deno.test('All four field sizes keep existing output and seed arithmetic',()=>{
 for(let tier=0;tier<4;tier++){
  const s=state([{id:'plot',type:'plot',tier,x:4,y:3,stage:1}]),a=(tier+1)**2;
  const planted=run(s,'plot.plant','plot',{crop:'carrot'}).save;eq(planted.coins,5000-3*a);
  const ready=run(planted,'plot.harvest','plot',{},now+135000);eq(ready.results[0].count,a*(3+tier));
 }
});
Deno.test('Care all has its level gate/cost; animal collection cannot be repeated early',()=>{
 const bird={id:'hen',type:'chicken',x:4,y:3,hunger:20,clean:20,happy:20,lastCare:now,needsAt:now,lastProductAt:now-30000};
 denied(()=>run(state([bird]),'animal.care_all'));
 let s=run(state([bird],5),'animal.care_all').save;eq(s.coins,4990);eq(s.farms.willow.objects[0].hunger,100);
 const result=run(s,'animal.care','hen',{action:'collect'});s=result.save;eq(s.farms.willow.inventory.egg,1);
 const repeated=run(s,'animal.care','hen',{action:'collect'});eq(repeated.save.farms.willow.inventory.egg,1);eq(repeated.save.xp,s.xp);
 denied(()=>run(s,'animal.care','hen',{action:'feed',count:999}));
});
Deno.test('Production consumes exact ingredients and only completes server-ready batches',()=>{
 let s=state([{id:'oven',type:'kitchen',x:4,y:3,tier:0}],2);s=run(s,'craft.queue','oven',{recipe:'flour'}).save;
 eq(s.farms.willow.inventory.wheat,27);eq(s.farms.willow.objects[0].jobs[0].finishAt,now+35000);
 denied(()=>run(s,'craft.collect','oven'),'NOT_READY');denied(()=>run(s,'craft.queue','oven',{recipe:'flour',output:9999}));
 const result=run(s,'craft.collect','oven',{},now+35000);eq(result.save.farms.willow.inventory.flour,12);eq(result.save.xp,6);
 denied(()=>run(result.save,'craft.collect','oven',{},now+35000),'NOT_READY');
});
Deno.test('Passive shop sales use their saved clock and never create a new buyer on repeated checks',()=>{
 let s=state([{id:'stall',type:'stall',x:4,y:3}]);s=run(s,'shop.stock',undefined,{item:'flour',count:5}).save;
 eq(s.farms.willow.inventory.flour,5);eq(s.farms.willow.shop.stock.flour,5);
 s=run(s,'shop.check',undefined,{},now+45000).save;eq(s.coins,5024);eq(s.farms.willow.shop.stock.flour,4);
 s=run(s,'shop.check',undefined,{},now+45000).save;eq(s.coins,5024);eq(s.farms.willow.shop.stock.flour,4);
 denied(()=>run(s,'shop.stock',undefined,{item:'flour',count:1000}));
});
Deno.test('Vendor delivery gets prices from trusted definitions, never the saved display award',()=>{
 const s=state(),v=createGameRules(now).vendorDefs[0];s.farms.willow.orders=[{...v,id:'order-one',reward:999999,rep:9999}];
 const result=run(s,'vendor.deliver','order-one').save;
 eq(result.coins,5075);eq(result.rep,16);eq(result.xp,18);eq(result.farms.willow.inventory.wheat,27);eq(result.farms.willow.inventory.carrot,18);
 denied(()=>run(result,'vendor.deliver','order-one'));
});
Deno.test('Flowers and apples retain existing rewards and do not collect again before regrowth',()=>{
 const original=state([{id:'flowers',type:'flowers',x:4,y:3,plantedAt:now-240000},{id:'apples',type:'orchard',x:6,y:3,tier:3,lastFruitAt:now-120000}]);
 let s=run(original,'flowers.harvest','flowers').save;eq(s.coins,5008);eq(s.xp,5);eq(s.farms.willow.inventory.nectar,1);
 denied(()=>run(s,'flowers.harvest','flowers'),'NOT_READY');
 s=run(s,'fruit.harvest','apples').save;eq(s.farms.willow.inventory.apple,11);eq(s.xp,13);
 denied(()=>run(s,'fruit.harvest','apples'),'NOT_READY');
});
Deno.test('New chickens use a free coop space and ambiguous same-map IDs fail closed',()=>{
 let s=state([{id:'coop',type:'coop',x:4,y:3,tier:0}]);
 s=run(s,'build.place',undefined,{id:'hen',item:'chicken',x:4,y:3}).save;
 eq(s.farms.willow.objects[1].coopId,'coop');eq(s.farms.willow.objects[1].x,4);
 s.farms.willow.objects.push({id:'hen',type:'chicken',x:5,y:3});
 denied(()=>run(s,'animal.care','hen',{action:'collect'}));
});
Deno.test('Grass-only footprints, collision checks, rotations and upgrades retain the game grid',()=>{
 let s=state();s=run(s,'build.place',undefined,{id:'barn',item:'barn',x:4,y:3,rotation:0}).save;eq(s.coins,4780);
 s=run(s,'build.place',undefined,{id:'tree',item:'tree',x:6,y:3,rotation:0}).save;
 denied(()=>run(s,'build.upgrade','barn',{expected:0}));
 s=run(s,'build.move','tree',{x:7,y:5}).save;s=run(s,'build.upgrade','barn',{expected:0}).save;eq(s.coins,4520);
 for(let rotation=0;rotation<4;rotation++)s=run(s,'build.rotate','barn',{rotation}).save;
 denied(()=>run(s,'build.place',undefined,{id:'bad',item:'tree',x:0,y:0,rotation:0}));
 denied(()=>run(s,'build.place',undefined,{id:'bad',item:'tree',x:4,y:3,rotation:0}));
 denied(()=>run(s,'build.place',undefined,{id:'bad',item:'tree',x:7,y:5,rotation:0,price:0}));
});
Deno.test('Homes and paid perks cannot be forged, sold with residents, or copied through action data',()=>{
 const s=state([{id:'coop',type:'coop',x:4,y:3,tier:0},{id:'hen',type:'chicken',coopId:'coop',x:4,y:3,hunger:90,clean:90,happy:90,needsAt:now}],5);
 denied(()=>run(s,'build.sell','coop'));denied(()=>run(s,'build.upgrade','coop',{expected:0,autoWater:true}));
 denied(()=>run(s,'build.place',undefined,{id:'coop',item:'well',x:7,y:5,rotation:0}));
 const moved=run(s,'build.move','coop',{x:7,y:5}).save;eq(moved.farms.willow.objects[1].coopId,'coop');eq(moved.farms.willow.objects[1].x,7);
});

Deno.test('Permanent landmark proof replaces cached flags and rejects unknown themes',()=>{
 const s=state();s.journey={sharedLandmarks:['hall']};
 const empty=applyFarmCommands(s,[{type:'shop.check'}],now,{sharedLandmarks:[]});eq(empty.save.journey.sharedLandmarks,[]);
 const verified=applyFarmCommands(s,[{type:'shop.check'}],now,{sharedLandmarks:['river','garden','garden']});eq(verified.save.journey.sharedLandmarks,['garden','river']);eq(s.journey.sharedLandmarks,['hall']);
 denied(()=>applyFarmCommands(s,[{type:'shop.check'}],now,{sharedLandmarks:['invented']}));
});
Deno.test('Putting away an owned decoration keeps ownership and permits one later placement without refunding gold',()=>{
 const s=state([{id:'treasure',type:'collection_001',x:4,y:3}]),context={ownedCollections:['collection_001']};s.lastMove={map:'willow',id:'treasure'};
 const stored=applyFarmCommands(s,[{type:'build.put_away',target:'treasure'}],now,context).save;
 eq(stored.coins,s.coins);eq(stored.farms.willow.objects,[]);eq(stored.collectionState.owned,['collection_001']);eq(stored.lastMove,null);
 const placed=applyFarmCommands(stored,[{type:'build.place',data:{id:'placed-again',item:'collection_001',x:4,y:3,rotation:0}}],now,context).save;
 eq(placed.farms.willow.objects.length,1);eq(placed.coins,s.coins);
 denied(()=>applyFarmCommands(placed,[{type:'build.place',data:{id:'duplicate',item:'collection_001',x:7,y:5,rotation:0}}],now,context));
 denied(()=>applyFarmCommands(s,[{type:'build.put_away',target:'treasure'}],now,{ownedCollections:[]}));
});
