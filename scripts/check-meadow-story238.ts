import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createGameRules} from '../supabase/functions/_shared/meadow-game-rules204.ts';
import {createFarmBaseline} from '../supabase/functions/_shared/meadow-farm-origin212.ts';
const now=Date.parse('2026-11-12T05:00:00Z');
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
function denied(fn:()=>unknown){try{fn();}catch(e){if(e instanceof FarmActionError)return;throw e;}throw Error('Invalid farm action was accepted');}
const initial=()=>createFarmBaseline(now,{friend_code:'QA-STORY238',display_name:'Story acceptance'}).save as any;
const command=(s:any,type:string,target:string,data:any={},owned:string[]=[])=>applyFarmCommands(s,[{type,target,map:'willow',data}],now,{ownedCollections:owned});
Deno.test('Campaign preserves established goal IDs, values and claimed rewards',()=>{
 const R:any=createGameRules(now),story=R.window.meadowStory,all=story.chapters.flatMap((c:any)=>c.goals);
 assert(story.chapters.length===12,'Two narrative arcs plus ten established milestone chapters');
 assert(new Set(all.map((g:any)=>g.id)).size===all.length,'No duplicate reward IDs');
 for(const [id,reward,xp]of [['beds',60,15],['baskets',90,20],['flock',120,25]]){const g=all.find((g:any)=>g.id===id);assert(g&&g.reward===reward&&g.xp===xp,'Established reward changed: '+id);}
 const s=initial();s.homestead={stats:{plant:10,water:10,harvest:10,care:10},claimed:['beds','baskets','flock']};
 denied(()=>command(s,'story.claim','beds'));assert(s.homestead.claimed.length===3,'Rejected replay mutated input');
 assert(story.eligible(s,story.chapters[0].goals[1]),'Existing tilling completion was lost');
});
Deno.test('Story objectives advance in order and rewards cannot be replayed',()=>{
 let s=initial();s.level=20;s.coins=1000;s.xp=0;s.homestead={stats:{plant:5,water:5,harvest:5,care:3},claimed:[]};
 s.farms.willow.objects=[{id:'field',type:'plot',tier:1,stage:1,x:0,y:0},{id:'well',type:'well',tier:0,x:4,y:0},{id:'coop',type:'coop',tier:1,x:6,y:0},{id:'barn',type:'barn',tier:0,x:10,y:0},...Array.from({length:3},(_,i)=>({id:'hen'+i,type:'chicken',coopId:'coop',x:6,y:0,hunger:95,clean:95,happy:95,lastCare:now,lastProductAt:now})),{id:'cow',type:'cow',barnId:'barn',x:10,y:0,hunger:95,clean:95,happy:95,lastCare:now,lastProductAt:now}];
 const R:any=createGameRules(now),story=R.window.meadowStory,goals=story.chapters.slice(0,2).flatMap((c:any)=>c.goals);
 denied(()=>command(s,'story.claim',goals[1].id));denied(()=>command(s,'story.claim',goals[6].id));
 const before=s.coins;let expected=0;
 for(const goal of goals){expected+=goal.reward;s=command(s,'story.claim',goal.id).save;denied(()=>command(s,'story.claim',goal.id));}
 assert(s.homestead.claimed.length===12,'Every campaign step completes once');
 assert(s.coins===before+expected,'Campaign delivered unexpected gold');
 const reloaded=JSON.parse(JSON.stringify(s));denied(()=>command(reloaded,'story.claim',goals[0].id));
});
Deno.test('Paid keepsakes require server ownership, fit rotated footprints and stay unique',()=>{
 const R:any=createGameRules(now),packs=R.window.meadowPackCatalog;assert(packs.length===3,'Exactly three launch packs');
 for(const p of packs)for(let rotation=0;rotation<4;rotation++){
  let s=initial();const placement={id:'owned-pack',item:p.id,x:0,y:0,rotation};
  denied(()=>command(s,'build.place','',placement));
  let result:any;
  for(let y=-6;y<7&&!result;y++)for(let x=-8;x<20&&!result;x++){try{result=command(s,'build.place','',{...placement,x,y},[p.id]);}catch(e){if(!(e instanceof FarmActionError))throw e;}}
  assert(result,'No valid grass position for '+p.sku+' rotation '+rotation);s=result.save;
  assert(s.farms.willow.objects.some((o:any)=>o.type===p.id&&o.rotation===rotation),'Lost rotation');
  denied(()=>command(s,'build.place','',{...placement,id:'duplicate'},[p.id]));denied(()=>command(s,'build.sell','owned-pack',{},[p.id]));
  s=command(s,'build.put_away','owned-pack',{},[p.id]).save;assert(!s.farms.willow.objects.some((o:any)=>o.type===p.id),'Putting away left a placeable');
 }
});
Deno.test('Personalised sign text requires ownership and validates its content',()=>{
 const s=initial(),id='collection_pack_welcome';
 denied(()=>command(s,'keepsake.label',id,{text:'Our garden'}));denied(()=>command(s,'keepsake.label',id,{text:'<script>'},[id]));denied(()=>command(s,'keepsake.label',id,{text:'x'.repeat(21)},[id]));
 const changed=command(s,'keepsake.label',id,{text:'  Williams Farm  '},[id]).save;
 assert(changed.keepsakeLabels[id]==='Williams Farm','Sign text was not saved canonically');assert(!s.keepsakeLabels,'Input save was mutated');
});
