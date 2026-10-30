import {createFarmBaseline} from '../supabase/functions/_shared/meadow-farm-origin212.ts';
import {applyFarmCommands} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
const now=1793354400000,profile={friend_code:'MEADOW-START',display_name:'Temporary starter'};
function assert(v:unknown,message='Assertion failed'):asserts v{if(!v)throw Error(message)}
Deno.test('Server starter is deterministic, fixed, grass-aligned and can never reset a current farm',()=>{
 const result=createFarmBaseline(now,profile),s=result.save,f=s.farms.willow;assert(s.coins===250&&s.level===1&&s.xp===0);assert(Object.keys(s.farms).length===1&&f.objects.length===9);assert(f.inventory.carrot===5&&f.inventory.egg===1);assert(JSON.stringify(result)===JSON.stringify(createFarmBaseline(now,profile)));
 assert(f.objects.filter((o:any)=>o.type==='plot').length===3);const hen=f.objects.find((o:any)=>o.type==='chicken'),coop=f.objects.find((o:any)=>o.id===hen.coopId);assert(hen.x===coop.x&&hen.y===coop.y);assert(!s.tutorial.rewarded.length&&s.orderIndex===3);
 // Moving each footprint to its current position reuses the authoritative
 // grass/collision validator. Housed chickens share their coop by design.
 for(const o of f.objects.filter((o:any)=>o.type!=='chicken'))applyFarmCommands(s,[{type:'build.move',target:o.id,data:{x:o.x,y:o.y}}],now);
 let rejected=false;try{applyFarmCommands(s,[{type:'farm.initialize'}],now)}catch{rejected=true}assert(rejected,'A normal command reset a farm');
});
Deno.test('Starter profile requires database-shaped identity fields',()=>{for(const p of [{}, {...profile,friend_code:'invalid code'},{...profile,display_name:'a'.repeat(81)}]){let failed=false;try{createFarmBaseline(now,p)}catch{failed=true}assert(failed)}});
