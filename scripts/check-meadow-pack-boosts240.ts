import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createGameRules} from '../supabase/functions/_shared/meadow-game-rules204.ts';
import {createFarmBaseline} from '../supabase/functions/_shared/meadow-farm-origin212.ts';
const now=Date.parse('2026-11-12T12:00:00Z');
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
const eq=(a:unknown,b:unknown)=>assert(JSON.stringify(a)===JSON.stringify(b),`${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const close=(a:number,b:number)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);
const grants=['welcome_garden','coop_charm','market_makeover'].map((sku,i)=>({id:'grant-'+i,sku,charges:3,revokedAt:null}));
const owned=['collection_pack_welcome','collection_pack_coop','collection_pack_market'];
function initial(){const s:any=createFarmBaseline(now,{friend_code:'QA-BOOST240',display_name:'Pack acceptance'}).save;s.level=20;s.farms.willow.objects=[];s.farms.back=JSON.parse(JSON.stringify(s.farms.willow));return s;}
const run=(s:any,type:string,target?:string,at=now,map='willow',data:any={})=>applyFarmCommands(s,[{type,target,map,data}],at,{ownedCollections:owned,packGrants:grants});
function denied(fn:()=>unknown){try{fn();}catch(e){if(e instanceof FarmActionError)return;throw e;}throw Error('Invalid paid action was accepted');}
function rules(s:any,at=now){const R:any=createGameRules(at),W=R.window;W.meadowPackBoosts.bind({state:()=>s,items:R.crops});return {R,W,B:W.meadowPackBoosts};}
Deno.test('Booster activation consumes one server-owned charge, does not stack, and survives reload',()=>{
 let s=initial();denied(()=>applyFarmCommands(s,[{type:'pack.activate',target:'welcome_garden'}],now));
 s=run(s,'pack.activate','welcome_garden').save;eq(s.packBenefits.used['grant-0'],1);eq(s.packBenefits.windows[0].until,now+900000);
 denied(()=>run(s,'pack.activate','welcome_garden',now+1));denied(()=>run(s,'pack.activate','unknown'));denied(()=>run(s,'pack.activate','welcome_garden',now,'willow',{duration:1}));
 s=JSON.parse(JSON.stringify(s));s.active='back';s=run(s,'pack.activate','welcome_garden',now+1,'back').save;eq(s.packBenefits.used['grant-0'],2);s.active='willow';
 s=run(s,'pack.activate','welcome_garden',now+900000).save;eq(s.packBenefits.used['grant-0'],3);
 denied(()=>run(s,'pack.activate','welcome_garden',now+1800000));
});
Deno.test('Crop speed integrates mid-cycle activation and exact expiry, with independent farm scope',()=>{
 let s=initial();const p={id:'field',type:'plot',crop:'carrot',plantedAt:now-30000,growthSettledAt:now-30000,growthBonusMs:0,stage:1,x:4,y:3};s.farms.willow.objects=[p];
 s=run(s,'pack.activate','welcome_garden').save;let {W,B}=rules(s);const plot=s.farms.willow.objects[0];
 close(B.extra('crop',plot,now-30000,now+10000),2500);close(B.extra('crop','back',now,now+10000),0);
 close(B.extra('crop',plot,now,now+1000000),225000);
 close(B.remaining('crop',plot,1000000,now),800000);
 const boosted=W.meadowCropGrowth.calculate(plot,{time:45000},s.farms.willow.objects,now+50000);close(boosted.packMs,12500);close(boosted.progress,92500/135000);
 // A crop longer than this booster must finish at the unboosted speed afterward.
 close(B.remaining('crop',plot,1200000,now),975000);
});
Deno.test('Placement bonus starts when placed, closes when stored, follows transfers and never duplicates',()=>{
 let s=initial(),p={id:'decor',type:owned[0],x:4,y:3,rotation:0},field={id:'field',type:'plot',crop:'carrot',plantedAt:now-1000,stage:1,x:7,y:5};s.farms.willow.objects=[p,field];s.farms.back.objects=[{...field,id:'other-field'}];
 s=run(s,'shop.check').save;let {B}=rules(s);close(B.extra('crop','willow',now-10000,now+10000),500);
 // Two copies in an old test snapshot still provide only one placement effect.
 s.farms.willow.objects.push({...p,id:'duplicate'});s=run(s,'shop.check',undefined,now+5000).save;({B}=rules(s));close(B.rate('crop','willow',now+5000),.05);
 s.farms.willow.objects=[field];s.farms.back.objects.push(p);s=run(s,'shop.check',undefined,now+10000).save;({B}=rules(s));close(B.extra('crop','willow',now,now+20000),500);close(B.extra('crop','back',now,now+20000),500);
 s.active='back';s=run(s,'build.put_away','decor',now+20000,'back').save;({B}=rules(s));close(B.rate('crop','back',now+20001),0);
});
Deno.test('Chicken boost changes readiness without changing cow production or animal care requirements',()=>{
 let s=initial();s.farms.willow.objects=['chicken','cow'].map((type,i)=>({id:'animal'+i,type,x:4+i,y:3,lastProductAt:now,hunger:95,clean:95,happy:95}));
 s=run(s,'pack.activate','coop_charm').save;const {W}=rules(s),[hen,cow]=s.farms.willow.objects;
 assert(!W.meadowAnimals.ready(hen,now+23999),'Egg completed early');assert(W.meadowAnimals.ready(hen,now+24000),'25% production speed not applied');assert(!W.meadowAnimals.ready(cow,now+24000),'Cow incorrectly boosted');hen.hunger=0;assert(!W.meadowAnimals.ready(hen,now+30000),'Boost bypassed care');
});
Deno.test('Moving a growing field carries earned boost time without backdating the destination bonus',()=>{
 let s=initial();s.farms.willow.objects=[{id:'field',type:'plot',crop:'carrot',plantedAt:now,stage:1,x:4,y:3}];
 s=run(s,'pack.activate','welcome_garden').save;
 s=run(s,'build.move','field',now+20000,'willow',{x:4,y:3,destination:'back'}).save;
 let {W,R}=rules(s,now+30000),p=s.farms.back.objects.find((o:any)=>o.id==='field');
 close(W.meadowCropGrowth.calculate(p,R.crops.carrot,s.farms.back.objects,now+30000).packMs,5000);
 s.active='back';s=run(s,'pack.activate','welcome_garden',now+30000,'back').save;
 ({W,R}=rules(s,now+40000));p=s.farms.back.objects.find((o:any)=>o.id==='field');
 close(W.meadowCropGrowth.calculate(p,R.crops.carrot,s.farms.back.objects,now+40000).packMs,7500);
 s=run(s,'build.move','field',now+40000,'back',{x:7,y:5}).save;s=run(s,'build.undo',undefined,now+40000,'back').save;
 ({W,R}=rules(s,now+50000));p=s.farms.back.objects.find((o:any)=>o.id==='field');
 close(W.meadowCropGrowth.calculate(p,R.crops.carrot,s.farms.back.objects,now+50000).packMs,10000);
 W.meadowCropGrowth.start(p,'carrot',now+50000);close(W.meadowCropGrowth.calculate(p,R.crops.carrot,s.farms.back.objects,now+50000).packMs,0);
});
Deno.test('A chicken keeps earned production time through a farm move and starts a clean cycle after collection',()=>{
 let s=initial();s.farms.willow.objects=[{id:'hen',type:'chicken',x:4,y:3,lastProductAt:now,lastCare:now,needsAt:now,hunger:95,clean:95,happy:95}];
 s=run(s,'pack.activate','coop_charm').save;s=run(s,'build.move','hen',now+10000,'willow',{x:4,y:3,destination:'back'}).save;
 let {W}=rules(s,now+25000),hen=s.farms.back.objects.find((o:any)=>o.id==='hen');
 close(hen.packEggMs,2500);assert(!W.meadowAnimals.ready(hen,now+27499),'Moved hen completed early');assert(W.meadowAnimals.ready(hen,now+27500),'Moving discarded earned egg progress');
 s.active='back';s=run(s,'animal.care','hen',now+27500,'back',{action:'collect'}).save;
 ({W}=rules(s,now+50000));hen=s.farms.back.objects.find((o:any)=>o.id==='hen');
 assert(!W.meadowAnimals.ready(hen,now+55000),'Collected egg reused the old cycle bonus');assert(W.meadowAnimals.ready(hen,now+57500),'New cycle did not finish normally');
});
Deno.test('Offline shop sales use each sale time, fractional carry and the correct map',()=>{
 let s=initial();for(const f of Object.values(s.farms) as any[]){f.objects=[{id:'stall',type:'stall',x:4,y:3}];f.shop={unlocked:true,stock:{carrot:50},lastSaleAt:now,tier:0,earned:0};}
 s=run(s,'pack.activate','market_makeover').save;
 const result=run(s,'shop.check',undefined,now+990000).save;
 const {R}=rules(s);const base=R.crops.carrot.sell,boostedSales=19; // sale exactly at 15:00 is outside [start,end).
 eq(result.farms.willow.shop.earned-result.farms.back.shop.earned,Math.floor(base*boostedSales*.25));
 const one=run(result,'shop.check',undefined,now+990000).save;eq(one.coins,result.coins);
});
Deno.test('Revoking a grant removes remaining charges and stops its active bonus without changing scores',()=>{
 let s=initial();s.farms.willow.objects=[{id:'field',type:'plot',crop:'carrot',plantedAt:now-1000,stage:1,x:7,y:5}];s=run(s,'pack.activate','welcome_garden').save;const before=JSON.stringify(s.minigames||{}),revoked=grants.map(g=>g.sku==='welcome_garden'?{...g,revokedAt:now+10000}:g);
 s=applyFarmCommands(s,[{type:'shop.check'}],now+20000,{ownedCollections:owned.slice(1),packGrants:revoked}).save;
 const {B}=rules(s);close(B.extra('crop','willow',now,now+30000),2500);eq(B.status('welcome_garden','willow',now+20000).remaining,0);
 denied(()=>applyFarmCommands(s,[{type:'pack.activate',target:'welcome_garden'}],now+20000,{ownedCollections:owned.slice(1),packGrants:revoked}));eq(JSON.stringify(s.minigames||{}),before);
});
