// Disposable anonymous acceptance farm only. Never apply to a player account.
import {createFarmBaseline} from '../supabase/functions/_shared/meadow-farm-origin212.ts';
import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {earnedTutorial} from '../scripts/check-meadow-fixtures209.ts';
const now=Date.now();
let s:any=createFarmBaseline(now,{friend_code:'MEADOW-ISL21',display_name:'Command acceptance fixture'}).save;
s.level=14;s.coins=10000;s.tutorial={...earnedTutorial(),paused:true,introduced:true};
s.farms.willow.expansionLevel=3;
Object.assign(s.farms.willow.inventory,{carrot:30,wheat:60,strawberry:30,apple:30,egg:30,milk:30,wool:30,lavender:30,nectar:30,honey:30,flour:30,bread:20});
for(const o of s.farms.willow.objects)if(o.type==='well')Object.assign(o,{tier:3,helpers:{jade:true,rhys:true,jay:true}});
function command(type:string,data:any={},target?:string,map='willow'){
 const out=applyFarmCommands(s,[{type,map,data,...(target?{target}:{})}],now);s=out.save;return out;
}
for(const type of ['kitchen','workshop','stall','hive']){
 let found=false;
 for(let y=1;y<10&&!found;y++)for(let x=0;x<14&&!found;x++){
  try{command('build.place',{id:'qa-'+type,item:type,x,y,rotation:0});found=true;}catch(e){if(!(e instanceof FarmActionError))throw e;}
 }
 if(!found)throw Error('No clear footprint for '+type);
}
command('map.open',{destination:'coast'});
console.log(JSON.stringify(s));
