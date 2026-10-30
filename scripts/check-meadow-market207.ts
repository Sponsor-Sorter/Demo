import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=Date.parse('2026-10-30T10:00:00Z'),id='10000000-0000-4000-8000-000000000001';
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m);}
function eq(a:unknown,b:unknown){assert(JSON.stringify(a)===JSON.stringify(b),JSON.stringify(a)+' != '+JSON.stringify(b));}
function state():any{return{version:1,tutorial:earnedTutorial(),coins:100,level:8,xp:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[],inventory:{carrot:20,bread:20},orders:[],expansionLevel:3}}};}
const proof=(extra:any={})=>({id,game:'market_pack',goal:3,map:'willow',verified:true,won:true,expires_at:now+600000,...extra});
const run=(s:any,rounds:any[]=[proof()],data:any={round:id,item:'carrot'})=>applyFarmCommands(s,[{type:'market.sell',data}],now,{marketRounds:rounds});
function denied(fn:()=>unknown){let e;try{fn();}catch(x){e=x;}assert(e instanceof FarmActionError,'Expected deliberate rejection, got '+String(e));}
Deno.test('Market sales use verified goals, shared goods and current server prices',()=>{
 const s=state(),r=run(s);eq(r.save.coins,136);eq(r.save.farms.willow.inventory.carrot,17);eq(r.save.xp,8);eq(r.marketSales,[{id,map:'willow'}]);eq(s.coins,100);eq(r.events.filter((e:any)=>e.event==='sell').length,1);
 s.farms.willow.objects.push({id:'bench',type:'packingbench',x:4,y:3});const upgraded=run(s);eq(upgraded.results[0].gold,39);
});
Deno.test('Cart capacity, item unlocks and exact stock remain authoritative',()=>{
 const s=state();denied(()=>run(s,[proof({goal:6})]));s.farms.willow.objects.push({id:'cart',type:'marketcart',x:4,y:3});eq(run(s,[proof({goal:6})]).results[0].amount,6);
 s.farms.willow.inventory.carrot=5;denied(()=>run(s,[proof({goal:6})]));s.level=1;denied(()=>run(s,[proof()],{round:id,item:'bread'}));denied(()=>run(s,[proof()],{round:id,item:'unknown'}));
});
Deno.test('Unverified, lost, expired, cross-map and non-market rounds cannot sell anything',()=>{
 const s=state();for(const row of [proof({verified:false}),proof({won:false}),proof({expires_at:now-1}),proof({expires_at:null}),proof({map:'coast'}),proof({game:'milk'}),proof({goal:7}),proof({goal:1.5})])denied(()=>run(s,[row]));denied(()=>run(s,[]));
 denied(()=>run(s,[proof()],{round:id,item:'carrot',gold:99999}));denied(()=>run(s,[proof()],{round:id,item:'carrot',amount:6}));
});
Deno.test('A single proof cannot pay twice in a batch and failed batches leave state unchanged',()=>{
 const s=state(),before=JSON.stringify(s);denied(()=>applyFarmCommands(s,[{type:'market.sell',data:{round:id,item:'carrot'}},{type:'market.sell',data:{round:id,item:'bread'}}],now,{marketRounds:[proof()]}));eq(JSON.stringify(s),before);
});
