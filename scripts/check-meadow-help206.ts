import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=Date.parse('2026-10-30T10:00:00Z');
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m);}
function eq(a:unknown,b:unknown){assert(JSON.stringify(a)===JSON.stringify(b),JSON.stringify(a)+' != '+JSON.stringify(b));}
const hen=()=>({id:'hen',type:'chicken',x:5,y:3,hunger:40,clean:90,happy:40,needsAt:now,lastCare:now});
function state():any{return{version:1,coins:100,level:1,xp:0,active:'willow',sharedPantryVersion:1,farms:{willow:{objects:[{id:'plot',type:'plot',x:4,y:3,crop:'carrot',stage:1,plantedAt:now-600000},hen()],inventory:{},orders:[],expansionLevel:3}}};}
Deno.test('Trusted visitor help is applied before harvest and never awarded twice',()=>{
 const s=state(),row={id:'help-1',map_id:'willow',target_id:'plot',target_cycle:s.farms.willow.objects[0].plantedAt,action:'water'};
 const a=applyFarmCommands(s,[{type:'plot.harvest',target:'plot'}],now,{pendingHelp:[row]});eq(a.results[0].count,4);eq(a.help,[{id:'help-1',outcome:'applied'}]);eq(s.farms.willow.objects[0].wateredUntil,undefined);
 const b=applyFarmCommands(a.save,[{type:'shop.check'}],now,{pendingHelp:[row]});eq(b.help,a.help);eq(b.save.farms.willow.inventory.carrot,4);eq(b.save.friendHelpApplied['help-1'],'applied');
});
Deno.test('Stale crop cycles and moved/deleted targets are acknowledged without changing another object',()=>{
 const s=state(),rows=[{id:'stale',map_id:'willow',target_id:'plot',target_cycle:1,action:'water'},{id:'missing',map_id:'willow',target_id:'removed',action:'feed'},{id:'wrong-map',map_id:'coast',target_id:'hen',action:'feed'}];
 const a=applyFarmCommands(s,[{type:'shop.check'}],now,{pendingHelp:rows});assert(a.help.every(h=>h.outcome==='not_needed'));eq(a.save.farms.willow.objects[1].hunger,40);eq(a.save.coins,100);eq(a.save.xp,0);
});
Deno.test('Animal helping hands settle real needs, add at most 20, and never collect produce or spend gold',()=>{
 const s=state(),a=applyFarmCommands(s,[{type:'shop.check'}],now,{pendingHelp:[{id:'feed',map_id:'willow',target_id:'hen',action:'feed'},{id:'cheer',map_id:'willow',target_id:'hen',action:'cheer'}]});
 eq(a.save.farms.willow.objects[1].hunger,60);eq(a.save.farms.willow.objects[1].happy,60);eq(a.save.farms.willow.inventory.egg,undefined);eq(a.save.coins,100);eq(a.save.xp,0);eq(a.events,[]);
});
Deno.test('Visitor help is never accepted from command data and failed actions leave input untouched',()=>{
 const s=state(),before=JSON.stringify(s);let e;try{applyFarmCommands(s,[{type:'shop.check',data:{pendingHelp:[{id:'forged',action:'water'}]}}],now);}catch(x){e=x;}assert(e instanceof FarmActionError);eq(JSON.stringify(s),before);
 let failed;try{applyFarmCommands(s,[{type:'wallet.credit'}],now,{pendingHelp:[{id:'legit',map_id:'willow',target_id:'hen',action:'feed'}]});}catch(x){failed=x;}assert(failed instanceof FarmActionError);eq(JSON.stringify(s),before);
});
