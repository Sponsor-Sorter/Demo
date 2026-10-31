// Read-only pre-conversion review. Input is a private operator export, never a
// player upload. This tool does not enroll, rewrite or downgrade any farm.
import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createGameRules,RULES_HASH} from '../supabase/functions/_shared/meadow-game-rules204.ts';
const file=Deno.args[0];if(!file)throw Error('Pass the private farm review export path.');
const backup=JSON.parse(await Deno.readTextFile(file)),saved=backup.farm_backup,s=saved?.save_data,R:any=createGameRules(Date.now());
if(!backup.ready||!saved?.user_id||!Number.isSafeInteger(saved.revision)||!/^[a-f0-9]{64}$/.test(backup.source_hash)||!s?.farms?.willow)throw Error('A ready named farm with exact revision/hash is required.');
const faults:string[]=[],footprints:string[]=[],catalog=new Set(R.catalog.map((i:any)=>i.id)),items=new Set(Object.keys(R.crops)),maps=new Set(R.maps.map((m:any)=>m.id));
for(const key of ['coins','xp','rep','level'])if(!Number.isSafeInteger(s[key])||s[key]<(key==='level'?1:0))faults.push('Invalid '+key);
for(const [map,farm]of Object.entries(s.farms) as [string,any][]){
 if(!maps.has(map)||!Array.isArray(farm.objects)){faults.push('Unknown map structure');continue;}
 const ids=new Set();for(const o of farm.objects){if(typeof o.id!=='string'||ids.has(o.id)||!catalog.has(o.type)||!Number.isSafeInteger(o.x)||!Number.isSafeInteger(o.y))faults.push(map+': invalid object identity/type/coordinates');ids.add(o.id);}
 for(const stock of [farm.inventory,farm.shop?.stock].filter(Boolean))for(const [id,n]of Object.entries(stock))if(!items.has(id)||!Number.isSafeInteger(n)||Number(n)<0)faults.push(map+': invalid basket/shelf good');
}
if(faults.length)throw Error(JSON.stringify({faults:[...new Set(faults)]}));
const context={ownedCollections:backup.owned_collections||[]},now=Date.now();
applyFarmCommands(s,[{type:'shop.check'}],now,context);
let working=structuredClone(s);const commands:any[]=[],repairs:any[]=[];
for(const [map,farm]of Object.entries(s.farms) as [string,any][]){
 for(const o of farm.objects){if(['chicken','cow','sheep','goat','alpaca'].includes(o.type))continue;
  try{applyFarmCommands(s,[{type:'build.move',map,target:o.id,data:{x:o.x,y:o.y,rotation:o.rotation||0}}],now,context);}
  catch(e){if(!(e instanceof FarmActionError))throw e;footprints.push(map+':'+o.type+':'+o.id+':'+e.code);
   if(Deno.args[1]){
    const candidates=[];for(let x=-10;x<27;x++)for(let y=-10;y<23;y++)candidates.push({x,y,distance:(x-o.x-y+o.y)**2+.49*(x-o.x+y-o.y)**2});candidates.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
    let found=false;for(const cell of candidates){const command={type:'build.move',map,target:o.id,data:{x:cell.x,y:cell.y,rotation:o.rotation||0}};
     try{const out=applyFarmCommands(working,[command],now,context);working=out.save;commands.push(command);repairs.push({map,id:o.id,type:o.type,from:{x:o.x,y:o.y},to:{x:cell.x,y:cell.y}});found=true;break;}catch(error){if(!(error instanceof FarmActionError))throw error;}
    }if(!found)throw Error('No free matching footprint. Review this farm manually.');
   }
  }
 }
}
console.log(JSON.stringify({review:'read-only',revision:saved.revision,protocol:saved.save_protocol,maps:Object.keys(s.farms).length,objects:Object.values(s.farms).reduce((n:number,f:any)=>n+f.objects.length,0),normalization:'passed',footprintIssues:footprints},null,2));
if(Deno.args[1]){
 if(!commands.length||commands.length>32)throw Error('A repair proposal needs one to 32 reviewed moves.');
 const result=applyFarmCommands(s,commands,now,context);
 for(const [map,farm]of Object.entries(result.save.farms) as [string,any][])
  for(const o of farm.objects)if(!['chicken','cow','sheep','goat','alpaca'].includes(o.type))
   applyFarmCommands(result.save,[{type:'build.move',map,target:o.id,data:{x:o.x,y:o.y,rotation:o.rotation||0}}],now,context);
 for(const key of ['coins','xp','rep','level'])if(result.save[key]!==s[key])throw Error('Repair changed '+key);
 for(const [map,farm]of Object.entries(s.farms) as [string,any][]){
  const after=result.save.farms[map];
  if(after.objects.length!==farm.objects.length||JSON.stringify(after.inventory)!==JSON.stringify(farm.inventory))throw Error('Repair changed farm contents');
  for(const o of farm.objects){const next=after.objects.find((v:any)=>v.id===o.id);if(!next||next.type!==o.type||next.level!==o.level)throw Error('Repair changed an owned asset');}
 }
 const proposal={source_revision:saved.revision,source_hash:backup.source_hash,rules:RULES_HASH,repairs,commands,save_data:result.save};
 await Deno.writeTextFile(Deno.args[1],JSON.stringify(proposal));console.log(JSON.stringify({proposal:'saved privately; no database change',moves:repairs.length,goldDelta:result.save.coins-s.coins,levelDelta:result.save.level-s.level}));
}else if(footprints.length)Deno.exitCode=2;
