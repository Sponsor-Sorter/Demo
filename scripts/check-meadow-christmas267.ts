import {applyFarmCommands,FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createGameRules} from '../supabase/functions/_shared/meadow-game-rules204.ts';
import {createFarmBaseline} from '../supabase/functions/_shared/meadow-farm-origin212.ts';
const start=Date.parse('2026-12-01T00:00:00Z'),end=Date.parse('2027-01-01T00:00:00Z');
const check=(v:unknown,m:string)=>{if(!v)throw Error(m);};
const initial=()=>{const s:any=createFarmBaseline(start,{friend_code:'LOCAL-XMAS',display_name:'Local Christmas fixture'}).save;s.coins=1000;s.xp=0;return s;};
const run=(s:any,type:string,target:string,now=start,data:any={},owned:string[]=[])=>applyFarmCommands(s,[{type,target,map:s.active,data}],now,{ownedCollections:owned});
function deny(fn:()=>any){try{fn();}catch(e){if(e instanceof FarmActionError)return;throw e;}throw Error('Rejected Christmas action was accepted');}
Deno.test('December event uses exact server boundaries and rejects client reward data',()=>{
 const s=initial(),before=JSON.stringify(s);deny(()=>run(s,'christmas.gift','2026-12-01',start-1));deny(()=>run(s,'christmas.gift','2027-01-01',end));deny(()=>run(s,'christmas.gift','2026-12-01',start,{gold:9999}));check(JSON.stringify(s)===before,'Rejected command mutated the farm');
 check(run(s,'christmas.gift','2026-12-31',end-1).save.christmas2026.gifts.length===1,'Last December moment is valid');
});
Deno.test('Each daily present is exact, durable, independent of missed days and never repeatable',()=>{
 let s=initial(),R:any=createGameRules(start),gift=R.window.meadowChristmas.gift(start),gold=s.coins,before=s.farms.willow.inventory.carrot||0;
 s=run(s,'christmas.gift','2026-12-01').save;check(s.coins===gold+gift.gold,'Exact gold gift');check(s.christmas2026.seals===5,'Exact seal gift');check(s.farms.willow.inventory.carrot===before+4,'Farm supply delivered');
 deny(()=>run(s,'christmas.gift','2026-12-01'));s=JSON.parse(JSON.stringify(s));deny(()=>run(s,'christmas.gift','2026-12-01'));
 const later=Date.parse('2026-12-25T00:00:00Z');s=run(s,'christmas.gift','2026-12-25',later).save;check(s.christmas2026.gifts.length===2&&s.christmas2026.seals===20,'Missed days do not reset; Christmas Day is larger');
});
Deno.test('Three changing daily orders consume exact shared goods and reject stale/missing/repeated deliveries',()=>{
 let s=initial(),R:any=createGameRules(start),C=R.window.meadowChristmas,orders=C.orders(start);check(orders.length===3,'Three baskets');
 for(const o of orders){deny(()=>run(s,'christmas.deliver',o.id));for(const [k,n]of Object.entries(o.items))s.farms.willow.inventory[k]=(s.farms.willow.inventory[k]||0)+Number(n);const before={...s.farms.willow.inventory};s=run(s,'christmas.deliver',o.id).save;for(const [k,n]of Object.entries(o.items))check(s.farms.willow.inventory[k]===before[k]-Number(n),'Exact basket deduction');deny(()=>run(s,'christmas.deliver',o.id));}
 check(s.christmas2026.deliveries.length===3&&s.christmas2026.seals===9,'Three rewards only');deny(()=>run(s,'christmas.deliver',orders[0].id,start+86400000));
 check(JSON.stringify(orders.map((o:any)=>o.items))!==JSON.stringify(C.orders(start+86400000).map((o:any)=>o.items)),'Baskets change daily');
});
Deno.test('Chapters enforce sequence, unlock permanent earned decorations and never grant premium ownership',()=>{
 let s=initial();s.christmas2026={seals:0,gifts:[],deliveries:Array.from({length:24},(_,i)=>'2026-12-'+String(1+Math.floor(i/3)).padStart(2,'0')+':'+i%3),chapters:[],owned:[]};
 deny(()=>run(s,'christmas.chapter','gifts'));for(const id of ['welcome','gifts','neighbours','celebration']){s=run(s,'christmas.chapter',id).save;deny(()=>run(s,'christmas.chapter',id));}
 check(s.christmas2026.owned.join(',')==='collection_xmas_tree,collection_xmas_presents','Only earned chapter decorations');check(s.christmas2026.seals===55,'Exact milestone seals');
 deny(()=>run(s,'christmas.redeem','collection_xmas_globe'));deny(()=>run(s,'christmas.redeem','collection_xmas_pavilion'));
});
Deno.test('Seal shop spends once and permanent ownership survives expiry and canonical replacements',()=>{
 let s=initial();s.christmas2026={seals:55,gifts:[],deliveries:[],chapters:[],owned:[]};s=run(s,'christmas.redeem','collection_xmas_lantern').save;s=run(s,'christmas.redeem','collection_xmas_wreath').save;check(s.christmas2026.seals===0,'Exact seal deduction');deny(()=>run(s,'christmas.redeem','collection_xmas_lantern'));deny(()=>run(s,'christmas.redeem','__proto__'));
 const place=(state:any,item:string,owned:string[]=[])=>{for(let y=-8;y<7;y++)for(let x=-12;x<20;x++)try{return run(state,'build.place','',end+1,{id:'xmas-owned',item,x,y,rotation:3},owned).save;}catch(e){if(!(e instanceof FarmActionError))throw e;}throw Error('No valid placement');};
 const saved=place(JSON.parse(JSON.stringify(s)),'collection_xmas_lantern');check(saved.farms.willow.objects.some((o:any)=>o.id==='xmas-owned'),'Earned item remains placeable in January');
 let denied=true;try{place(initial(),'collection_xmas_globe');denied=false;}catch{}check(denied,'Client cannot place unowned premium item');check(place(initial(),'collection_xmas_globe',['collection_xmas_globe']).farms.willow.objects.some((o:any)=>o.type==='collection_xmas_globe'),'Verified premium ownership accepted');
});
Deno.test('Changing farms retains event progress and invalid batches cannot half-claim a reward',()=>{
 let s=initial();s.farms.coast=JSON.parse(JSON.stringify(s.farms.willow));s.active='coast';s=run(s,'christmas.gift','2026-12-01').save;check(s.active==='coast'&&s.christmas2026.gifts.length===1,'Account-wide event, active farm unchanged');check(s.farms.coast.inventory.carrot===s.farms.willow.inventory.carrot,'Shared pantry consistent');
 const before=initial();deny(()=>applyFarmCommands(before,[{type:'christmas.gift',target:'2026-12-01'},{type:'christmas.gift',target:'2026-12-01'}],start));check(!before.christmas2026,'Rejected batch left input unchanged');
});
