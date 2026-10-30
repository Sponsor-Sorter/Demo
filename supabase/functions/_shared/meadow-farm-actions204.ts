import {createGameRules,RULES_HASH} from './meadow-game-rules204.ts';
import {progressionCommand} from './meadow-progression205.ts';
import {createWorkerController} from './meadow-workers205.ts';
import {tripCommand} from './meadow-trips208.ts';
type Data=Record<string,any>;
export type FarmCommand={type:string;map?:string;target?:string;data?:Data};
export type FarmContext={ownedCollections?:string[];pendingHelp?:Data[];marketRounds?:Data[];visitedFriend?:boolean};
export class FarmActionError extends Error{constructor(public code:string,message:string){super(message);}}
function fail(message:string,code='INVALID_FARM_ACTION'):never{throw new FarmActionError(code,message);}
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const integer=(n:unknown,min=0,max=1e9)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
const validID=(id:unknown)=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
function fields(value:Data,allowed:string[]){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(k=>!allowed.includes(k)))fail('This action contains unsupported fields.');}
export function applyFarmCommands(input:Data,commands:FarmCommand[],now:number,context:FarmContext={}){
 if(!integer(now,1,1e15)||!Array.isArray(commands)||!commands.length||commands.length>32)fail('Choose between one and 32 farm actions.');
 const s=copy(input),R:Data=createGameRules(now),W=R.window as Data,items=R.crops as Data,catalog=R.catalog as Data[],vendors=R.vendorDefs as Data[];
 if(!s.farms?.willow||!integer(s.coins,0,1e12)||!integer(s.level,1,1e6))fail('The saved farm needs review.');
 W.meadowPantry.connect(s);
 s.collectionState||={};s.collectionState.owned=[...(context.ownedCollections||[])];
 const events:Data[]=[],messages:string[]=[],results:Data[]=[],marketSales:Data[]=[];
 let map=s.active;
 const farms=()=>s.farms,current=()=>farms()[map];
 const animal=(o:Data)=>['chicken','cow','sheep','goat','alpaca'].includes(o.type);
 const tier=(o:Data,max=3)=>Math.max(0,Math.min(max,Math.floor(Number(o?.tier)||0)));
 const side=(o:Data)=>tier(o)+1,area=(o:Data)=>side(o)**2;
 const ownedMap=(o:Data)=>Object.keys(farms()).find(k=>farms()[k].objects.includes(o));
 const home=(a:Data,f=farms()[ownedMap(a)!])=>f.objects.find((h:Data)=>a.type==='chicken'?h.type==='coop'&&h.id===a.coopId:(h.type==='barn'&&h.id===a.barnId)||(h.type==='paddock'&&h.id===a.paddockId));
 const xp=(n:number)=>{if(!integer(n,0,100000))fail('Invalid experience.');s.xp=(s.xp||0)+n;const threshold=90+(s.level-1)*50;if(s.xp>=threshold){s.xp-=threshold;s.level++;s.coins+=35;}};
 const spend=(n:number)=>{if(!integer(n)||s.coins<n)return false;s.coins-=n;return true;};
 const pay=(n:number)=>{if(!spend(n))fail('Save the required gold first.','NOT_ENOUGH_GOLD');};
 const record=(id:string,n:number)=>W.meadowAlmanac.record(id,n);
 function journal(){
  // Preserve the established home-day boundary until per-account time zones ship.
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now),part=(key:string)=>parts.find(p=>p.type===key)!.value;
  const key=part('year')+'-'+Number(part('month'))+'-'+Number(part('day'));
  if(s.journal?.day!==key)s.journal={day:key,progress:{},claimed:[],bonus:false};return s.journal;
 }
 function event(id:string,n=1,where=map){
  W.meadowProgress.event(s,id,n,where);W.meadowStory.event(id,n);
  if(id.startsWith('made_'))record(id.slice(5),n);
  if(['plant','harvest','care'].includes(id)){
   const j=journal();j.progress[id]=(j.progress[id]||0)+1;
  }
  events.push({event:id,amount:n,map:where});
 }
 function lesson(id:string,result:Data){
  const def=R.lessons.find((l:Data)=>l.id===id);if(!def)return false;
  s.tutorial||={version:1,completed:[],rewarded:[],seenContexts:[],started:false,paused:false};
  const t=s.tutorial;t.completed||=[];t.rewarded||=[];if(t.rewarded.includes(id))return false;
  if(!t.completed.includes(id))t.completed.push(id);t.rewarded.push(id);s.coins+=10;
  (result.lesson_rewards||=[]).push(id);messages.push('Lesson complete · '+def.title+' · 10 gold');return true;
 }
 const api:Data={state:()=>s,current,farms,items,recipes:W.meadowProduction.recipes,level:()=>s.level,coins:()=>s.coins,spend,earn:(n:number)=>{if(!integer(n,0,1e12))fail('Invalid sale.');s.coins+=n;},xp,event,
  produce:(id:string,n:number)=>{record(id,n);W.meadowStory.event(id,n);},home,yield:(a:Data)=>1+tier(home(a))+W.meadowJourneyCore.animalBonus(s)+W.meadowProgress.animalBonus(s,ownedMap(a)),
  name:(a:Data)=>a.type,mapName:(id:string)=>id,save:()=>{},render:()=>{},notify:(text:string)=>messages.push(text),settle:(f:Data)=>W.meadowProduction.settleShop(f)};
 for(const name of ['meadowProduction','meadowApiary','meadowAnimals','meadowShopPlan','meadowAlmanac','meadowLife','meadowVillageOrders'])W[name].bind(api);
 W.meadowStory.attach(api);
 function fp(o:Data):{w:number;h:number}{
  let p={w:1,h:1};const t=tier(o);
  const sizes:Data={coop:[[1,1],[2,1],[3,2],[4,3]],paddock:[[3,2],[4,3],[5,4],[6,5]],orchard:[[2,2],[3,2],[4,3],[5,3]]};
  if(o.type==='plot')p={w:side(o),h:side(o)};
  else if(o.type==='barn')p=W.meadowBarns.footprint(t);
  else if(sizes[o.type])p={w:sizes[o.type][t][0],h:sizes[o.type][t][1]};
  else if(['kitchen','workshop'].includes(o.type))p={w:2,h:2};
  else if(['packingbench','marketcart'].includes(o.type))p={w:2,h:1};
  else if(o.type.startsWith('collection_')){const c=catalog.find(c=>c.id===o.type);if(!c)fail('Unknown decoration.');p={w:c.w,h:c.h};}
  return ((o.rotation||0)%2)?{w:p.h,h:p.w}:p;
 }
 function grass(x:number,y:number,where=map){
  if(!integer(x,-32,48)||!integer(y,-32,48))return false;
  const outline=(R.areaOutlines as Data)[where]||R.meadowOutline,projection=where==='willow'?{x:7,y:26.5,w:.87,h:.70}:{x:7,y:15,w:.87,h:.76};
  const step=100/12,cx=50-step+(x-y)*step/2,cy=50-11*step/2+(x+y)*step/2;
  const diamond=[[cx,cy-step/2],[cx+step/2,cy],[cx,cy+step/2],[cx-step/2,cy]];
  const inside=(px:number,py:number)=>{let yes=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const [ax,ay]=outline[i],[bx,by]=outline[j];if(((ay>py)!==(by>py))&&px<(bx-ax)*(py-ay)/(by-ay)+ax)yes=!yes;}return yes;};
  const test=(px:number,py:number)=>inside(projection.x+px*projection.w,projection.y+py*projection.h);
  if(!test(cx,cy))return false;
  for(let i=0;i<4;i++)for(let k=0;k<8;k++){const a=diamond[i],b=diamond[(i+1)%4];if(!test(a[0]+(b[0]-a[0])*k/8,a[1]+(b[1]-a[1])*k/8))return false;}
  return true;
 }
 function fits(o:Data,x:number,y:number,where=map,ignore=o.id){
  const f=farms()[where],p=fp(o),expansion=Math.min(3,Number(f.expansionLevel)||0);
  if(!integer(x,-32,48)||!integer(y,-32,48))return false;
  for(let xx=x;xx<x+p.w;xx++)for(let yy=y;yy<y+p.h;yy++)if((expansion<3&&yy>=7+expansion)||!grass(xx,yy,where))return false;
  return !f.objects.some((other:Data)=>{if(other.id===ignore||(animal(other)&&home(other,f)))return false;const q=fp(other);return x<other.x+q.w&&x+p.w>other.x&&y<other.y+q.h&&y+p.h>other.y;});
 }
 const plotYield=(o:Data)=>area(o)*(3+tier(o)+(Number(o.wateredUntil)>0?1:0)+W.meadowMastery.bonus(s,o.crop)+W.meadowJourneyCore.cropBonus(s)+W.meadowProgress.cropBonus(s,ownedMap(o)));
 const seedCost=(o:Data,id:string,where=ownedMap(o)||map)=>Math.ceil(W.meadowMastery.seedCost(s,id,items[id].seed*area(o))*W.meadowJourneyCore.seedFactor(s)*W.meadowProgress.seedFactor(s,where));
 const settle=()=>{for(const f of Object.values(farms()) as Data[]){W.meadowProduction.settleShop(f);for(const o of f.objects){if(animal(o))W.meadowAnimals.settle(o);if(o.type==='hive')W.meadowApiary.settle(f,o);}}};
 const requireObject=(id:unknown,type?:string)=>{if(!validID(id))fail('Choose a farm item.');const matches=current().objects.filter((o:Data)=>o.id===id),o=matches[0];if(matches.length!==1||type&&o.type!==type)fail('This item is no longer uniquely identified on that farm.');return o;};
 const unlockedCrop=(id:unknown)=>typeof id==='string'&&R.maps.some((m:Data)=>s.level>=m.unlock&&m.crops.includes(id));
 const runOnMap=(where:string,fn:()=>any)=>{const old=map;map=where;try{return fn();}finally{map=old;}};
 const worker=createWorkerController({s,W,R,now,api,fp,grass,home,animal,area,plotYield,seedCost,unlockedCrop,event,fields,fail,integer,runOnMap});
 function requireRecipe(o:Data,id:unknown){const r=W.meadowProduction.recipes.find((r:Data)=>r.id===id);if(!r||(r.station||'kitchen')!==o.type||s.level<(r.unlock||(o.type==='workshop'?4:2)))fail('This recipe is not unlocked at this workspace.');return r;}
 function add(id:string,n:number){if(!Object.hasOwn(items,id)||!integer(n,0,1e9))fail('Unknown farm good.');current().inventory[id]=(current().inventory[id]||0)+n;}
 // These rows come only from the service-owned database read, never the
 // request body. Reuse the original care/crop-cycle rules before player work.
 if(!Array.isArray(context.pendingHelp||[])||(context.pendingHelp||[]).length>100)fail('Visitor help needs review.');
 const help=(context.pendingHelp||[]).map(row=>{
  const result=W.meadowSocial.applyHelp(s,row,{crops:items,settleAnimal:(o:Data)=>W.meadowAnimals.settle(o)},now);
  return{id:row.id,outcome:result.outcome};
 });
 for(const command of commands){
  fields(command,['type','map','target','data']);if(typeof command.type!=='string')fail('Choose a farm action.');map=command.map||s.active;
  if(!validID(map)||!farms()[map])fail('Open that farm first.');
  const f=current(),d=command.data||{};let o:Data,result:Data={type:command.type};
  settle();
  const eventStart=events.length,fleeceBefore=Number(farms().willow.inventory.fleece)||0;
  switch(command.type){
   case 'plot.till':
    fields(d,[]);o=requireObject(command.target,'plot');if(o.plantedAt||o.stage)fail('This plot is already tilled.');o.stage=1;event('till');break;
   case 'plot.plant':
    fields(d,['crop']);o=requireObject(command.target,'plot');if(o.plantedAt||!o.stage||!unlockedCrop(d.crop)||!items[d.crop]?.time)fail('Choose an unlocked crop and an empty tilled plot.');pay(seedCost(o,d.crop));W.meadowCropGrowth.start(o,d.crop);event('plant');break;
   case 'plot.water':
    fields(d,[]);o=requireObject(command.target,'plot');if(!o.plantedAt||Number(o.wateredUntil)>0)fail('This field does not need water.');pay(area(o));o.wateredUntil=now+items[o.crop].time*3;event('water');break;
   case 'plot.harvest':{
    fields(d,[]);o=requireObject(command.target,'plot');if(!o.plantedAt||W.meadowCropGrowth.calculate(o,items[o.crop],f.objects).stage<3)fail('This field is still growing.','NOT_READY');const n=plotYield(o);add(o.crop,n);record(o.crop,n);W.meadowMastery.record(s,o.crop,area(o));s.coins+=2;xp(8+tier(o)*4);o.plantedAt=0;o.stage=1;o.wateredUntil=0;event('harvest');result.count=n;break;}
   case 'fruit.harvest':{
    fields(d,[]);o=requireObject(command.target);if(!['tree','orchard'].includes(o.type))fail('Choose an apple tree or orchard.');const duration=120000*W.meadowProgress.pollinationFactor(s,map);if(o.lastFruitAt&&now-o.lastFruitAt<duration)fail('The apples are still growing.','NOT_READY');const n=[2,4,7,11][tier(o)];add('apple',n);record('apple',n);o.lastFruitAt=now;xp(5+tier(o));event('harvest');W.meadowProgress.event(s,'fruit',1,map);result.count=n;break;}
   case 'flowers.harvest':
    fields(d,[]);o=requireObject(command.target,'flowers');if(!o.plantedAt||now-o.plantedAt<240000)fail('These flowers are still growing.','NOT_READY');W.meadowCropGrowth.settle(f,items);add('nectar',1);record('nectar',1);s.coins+=8;o.plantedAt=now;xp(5);break;
   case 'animal.care':
    fields(d,['action']);o=requireObject(command.target);if(!animal(o)||!['feed','brush','play','all','collect','treat'].includes(d.action))fail('Choose an animal care action.');result.changed=W.meadowAnimals.care(o.id,d.action,map);break;
   case 'animal.collect_all':fields(d,[]);result.collected=W.meadowAnimals.collectAll();break;
   case 'animal.care_all':fields(d,[]);if(s.level<5)fail('Care all unlocks at level 5.');{const plan=W.meadowAnimals.careAllPlan();if(s.coins<plan.cost)fail('Save '+plan.cost+' gold for Care all.','NOT_ENOUGH_GOLD');result.count=W.meadowAnimals.careAll();}break;
   case 'animal.rename':fields(d,['name']);o=requireObject(command.target);if(!animal(o)||typeof d.name!=='string'||!d.name.trim()||Array.from(d.name).length>20)fail('Choose an animal name up to 20 characters.');o.name=d.name.trim();break;
   case 'craft.queue':
    fields(d,['recipe']);o=requireObject(command.target);if(!['kitchen','workshop'].includes(o.type))fail('Choose a kitchen or craft shed.');if(!W.meadowProduction.queue(o,requireRecipe(o,d.recipe)))fail('Check the ingredients and free queue spaces.');break;
   case 'craft.collect':
    fields(d,[]);o=requireObject(command.target);if(!['kitchen','workshop'].includes(o.type))fail('Choose a kitchen or craft shed.');result.count=W.meadowProduction.collect(o,true);if(!result.count)fail('No batches are ready yet.','NOT_READY');break;
   case 'hive.collect':fields(d,[]);o=requireObject(command.target,'hive');result.count=W.meadowApiary.harvest(f,o);if(!result.count)fail('No honey is ready yet.','NOT_READY');break;
   case 'shop.stock':case 'shop.take':{
    fields(d,['item','count']);if(!Object.hasOwn(items,d.item)||!integer(d.count,1,10000))fail('Choose a valid good and amount.');const shop=f.shop;if(!shop?.unlocked||!f.objects.some((o:Data)=>o.type==='stall'))fail('Build a farm stall first.');
    if(command.type==='shop.stock'){if((f.inventory[d.item]||0)<d.count||W.meadowShopPlan.amount(f)+d.count>W.meadowShopPlan.capacity(f))fail('Check your basket and shelf space.');if(!W.meadowShopPlan.amount(f))shop.lastSaleAt=now;f.inventory[d.item]-=d.count;shop.stock[d.item]=(shop.stock[d.item]||0)+d.count;event('stock',d.count);}
    else{if((shop.stock[d.item]||0)<d.count)fail('There are fewer goods on that shelf.');shop.stock[d.item]-=d.count;add(d.item,d.count);}break;}
   case 'shop.check':fields(d,[]);break;
   case 'shop.upgrade':fields(d,['expected']);if(!f.shop?.unlocked||!integer(d.expected,0,2)||tier(f.shop)!==d.expected)fail('Reopen the current shop upgrade.');pay([240,520,980][d.expected]);f.shop.tier=d.expected+1;f.shop.lastSaleAt=now;break;
   case 'shop.name':fields(d,['name']);if(!f.shop?.unlocked||typeof d.name!=='string'||!d.name.trim()||Array.from(d.name).length>28)fail('Choose a shop name up to 28 characters.');f.shop.name=d.name.trim();break;
   case 'shop.plan':fields(d,['rules','enabled']);if(typeof d.enabled!=='boolean'||!W.meadowShopPlan.setPlan(f,d.rules,d.enabled))fail('Check the shelf targets and basket reserves.');break;
   case 'market.sell_direct':{
    fields(d,['item','count']);if(!Object.hasOwn(items,d.item)||!integer(d.count,1,10000)||(f.inventory[d.item]||0)<d.count)fail('Choose goods and a quantity from your basket.');const gold=d.count*items[d.item].sell;
    if(!integer(gold,1,1e9))fail('This good cannot be sold directly.');f.inventory[d.item]-=d.count;s.coins+=gold;xp(2);event('sell');result.gold=gold;result.count=d.count;break;}
   case 'market.sell':{
    fields(d,['round','item']);const round=(context.marketRounds||[]).find(r=>r.id===d.round&&r.map===map),market=W.meadowFarmersMarket;
    if(!round||!round.verified||!round.won||!['market_pack','market_weigh'].includes(round.game)||!integer(round.goal,1,6)||!integer(round.expires_at,1,1e15)||round.expires_at<now||marketSales.some(r=>r.id===round.id))fail('Finish and verify a new market delivery before selling.','VERIFIED_ROUND_REQUIRED');
    if(!market.stalls.some((g:Data)=>g.goods.includes(d.item))||!market.unlocked(d.item,s))fail('Choose an unlocked market good.');const quote=market.quote(s,items[d.item],round.goal);
    if(quote.amount!==round.goal||(f.inventory[d.item]||0)<round.goal)fail('Check this batch’s basket stock and market-cart capacity.');
    f.inventory[d.item]-=round.goal;s.coins+=quote.total;xp(8);event('premiumSale',round.goal);event('market_'+market.stalls.find((g:Data)=>g.goods.includes(d.item)).id,round.goal);event('sell');marketSales.push({id:round.id,map});result={...result,item:d.item,amount:round.goal,gold:quote.total};break;}
   case 'vendor.deliver':{
    fields(d,[]);if(!validID(command.target))fail('Choose an order.');const at=f.orders?.findIndex((x:Data)=>x.id===command.target),order=f.orders?.[at],vendor=vendors.find(v=>v.id===order?.vendor||v.name===order?.name&&Object.keys(v.ask).length===Object.keys(order.ask||{}).length&&Object.entries(v.ask).every(([id,n])=>order.ask[id]===n));
    if(!vendor||s.level<(vendor.unlock||1))fail('This order is no longer available.');for(const [id,n]of Object.entries(vendor.ask) as [string,number][]){if((f.inventory[id]||0)<n)fail('Gather the requested produce first.');}
    for(const [id,n]of Object.entries(vendor.ask) as [string,number][])f.inventory[id]-=n;
    s.coins+=vendor.reward;s.rep=(s.rep||0)+vendor.rep;f.done=(f.done||0)+1;f.orders.splice(at,1);const eligible=vendors.filter(v=>s.level>=(v.unlock||1)),next=eligible[(s.orderIndex||0)%eligible.length];s.orderIndex=(s.orderIndex||0)+1;f.orders.push({...next,id:'order-'+String(command.target).slice(-40)+'-'+s.orderIndex,vendor:next.id});xp(18);event('sell');break;}
   case 'map.expand':fields(d,['expected']);if(!integer(d.expected,0,2)||(f.expansionLevel||0)!==d.expected)fail('Reopen this meadow expansion.');pay([320,540,820][d.expected]);f.expansionLevel=d.expected+1;f.expanded=true;event('expand');break;
   case 'map.visit':{
    fields(d,['destination']);const destination=R.maps.find((m:Data)=>m.id===d.destination);if(!destination||s.level<destination.unlock)fail('Reach this farm’s unlock level first.');
    if(!farms()[destination.id]){
     pay(destination.cost||0);const opened:Data={objects:[],inventory:farms().willow.inventory,orders:[],done:0,visits:0,shop:{unlocked:false,stock:{},earned:0},expansionLevel:0,expanded:false,layoutVersion:2,gridScaleVersion:2,cropClusterVersion:1,tileSizeVersion:1,fixedGridVersion:1};farms()[destination.id]=opened;
     if(!['back','east'].includes(destination.id)){
      const defs=[{type:'plot',x:8,y:6,crop:destination.crops[0],stage:0,plantedAt:0},{type:'plot',x:9,y:6,crop:destination.crops[1],stage:0,plantedAt:0},{type:'tree',x:2,y:4,lastFruitAt:now},{type:'flowers',x:12,y:4,plantedAt:now},{type:'well',x:4,y:3,tier:0},{type:'orchard',x:9,y:2,tier:0,lastFruitAt:now}];
      for(const [index,def]of defs.entries()){
       const object:Data={...def,id:'server-'+destination.id+'-'+index};let spot:Data|undefined;
       // Select only complete, clear grass footprints on the painted map.
       const candidates:Data[]=[];for(let x=-12;x<=24;x++)for(let y=-12;y<7;y++)if(fits(object,x,y,destination.id,null))candidates.push({x,y});
       spot=candidates.sort((a,b)=>Math.hypot(a.x-def.x,a.y-def.y)-Math.hypot(b.x-def.x,b.y-def.y))[0];if(!spot)fail('This farm’s starter layout needs review.');opened.objects.push({...object,...spot});
      }
     }
     const eligible=vendors.filter(v=>s.level>=(v.unlock||1)),next=eligible[(s.orderIndex||0)%eligible.length];s.orderIndex=(s.orderIndex||0)+1;opened.orders.push({...next,id:'order-'+destination.id+'-'+s.orderIndex,vendor:next.id});
    }
    s.active=destination.id;result.destination=s.active;break;}
   case 'build.place':{
    fields(d,['id','item','x','y','rotation','home']);const def=catalog.find(c=>c.id===d.item);if(!def||!validID(d.id)||Object.values(farms()).some((f:any)=>f.objects.some((o:Data)=>o.id===d.id))||!integer(d.rotation??0,0,3))fail('Choose a new valid farm item.');if(s.level<(def.unlock||1))fail('This item is not unlocked yet.');
    if(def.kind==='collection'&&(!(context.ownedCollections||[]).includes(def.id)||Object.values(farms()).some((f:any)=>f.objects.some((o:Data)=>o.type===def.id))))fail('Own this decoration and put away its placed copy first.');
    const created:Data={id:d.id,type:def.id,x:d.x,y:d.y,rotation:d.rotation||0};
    const automaticHome=animal(created)&&!d.home?f.objects.find((h:Data)=>W.meadowHousing.canHouse(f,created.type,h)):null;
    if(animal(created)&&(d.home||automaticHome)){const h=d.home?requireObject(d.home):automaticHome;if(!W.meadowHousing.canHouse(f,created.type,h))fail('Choose a matching home with a free space.');W.meadowHousing.assign(f,created,h);}
    else if(!fits(created,d.x,d.y))fail('Place every occupied tile on clear unlocked grass.');
    if(['cow','sheep','goat','alpaca'].includes(def.id)&&!home(created,f)){const h=f.objects.find((h:Data)=>W.meadowHousing.canHouse(f,def.id,h));if(!h)fail('Build a matching livestock home first.');W.meadowHousing.assign(f,created,h);}
    pay(def.price);if(['coop','barn','paddock','hive'].includes(def.id))created.tier=0;
    if(def.id==='hive'){created.lastHoneyAt=now;created.honey=0;}if(def.id==='flowers')created.plantedAt=now;if(['tree','orchard'].includes(def.id))created.lastFruitAt=now;
    if(def.id==='plot')Object.assign(created,{crop:R.maps.find((m:Data)=>m.id===map)?.crops[0]||'carrot',plantedAt:0,stage:0});
    if(animal(created))Object.assign(created,{name:def.animal||def.name,hunger:82,clean:88,happy:82,lastCare:now,lastProductAt:now,needsAt:now});
    f.objects.push(created);event('place');result.id=created.id;break;}
   case 'build.move':case 'build.rotate':{
    fields(d,['x','y','rotation','destination','home']);o=requireObject(command.target);const destination=d.destination||map;if(!farms()[destination]||!integer(d.rotation??o.rotation??0,0,3))fail('Choose an open destination and rotation.');
    const target=farms()[destination],moved={...o,rotation:d.rotation??o.rotation??0},x=d.x??o.x,y=d.y??o.y;
    if(animal(o)&&d.home){if(destination!==map)fail('Move to the farm before choosing its animal home.');const h=requireObject(d.home);if(!W.meadowHousing.assign(f,o,h))fail('That home is full or does not match this animal.');}
    else{if(!fits(moved,x,y,destination,destination===map?o.id:null))fail('The whole footprint must fit clear unlocked grass.');W.meadowCropGrowth.settle(f,items);if(target!==f)W.meadowCropGrowth.settle(target,items);const residents=f.objects.filter((a:Data)=>animal(a)&&home(a,f)===o);if(animal(o)){delete o.coopId;delete o.barnId;delete o.paddockId;}Object.assign(o,{x,y,rotation:moved.rotation});for(const a of residents)Object.assign(a,{x,y});if(destination!==map){const carry=new Set([o,...residents]);f.objects=f.objects.filter((a:Data)=>!carry.has(a));target.objects.push(...carry);}for(const farm of [f,target])for(const h of farm.objects.filter((a:Data)=>a.type==='hive'))if(['flowers','hive'].includes(o.type))h.lastHoneyAt=now;}
    event('move');break;}
   case 'build.upgrade':{
    fields(d,['expected']);o=requireObject(command.target);const costs:Data={...R.upgradeCosts,kitchen:[250,600],workshop:[250,600],hive:[180,420],well:Array.from({length:7},(_,tier)=>W.meadowWells.nextGold({tier},1e6).cost)};
    const prices=costs[o.type],at=tier(o,7);if(!prices||!integer(d.expected,0,7)||at!==d.expected||at>=prices.length)fail('Reopen this item’s current upgrade.');if(o.type==='plot'&&o.plantedAt)fail('Harvest this field before enlarging it.');if(o.type==='well'&&s.level<W.meadowWells.nextGold(o).level)fail('Reach the required farm level first.');if(!fits({...o,tier:at+1},o.x,o.y))fail('Make room for the upgraded footprint first.');pay(prices[at]);o.tier=at+1;if(o.type==='hive')o.lastHoneyAt=now;event('upgrade');break;}
   case 'build.sell':{
    fields(d,[]);o=requireObject(command.target);const def=catalog.find(d=>d.id===o.type);if(!def||def.kind==='collection')fail('This item cannot be sold for gold.');if(f.objects.some((a:Data)=>animal(a)&&home(a,f)===o)||(o.jobs||[]).length)fail('Move residents and collect all batches before selling.');const gold=Math.floor(def.price*.5);f.objects=f.objects.filter((a:Data)=>a!==o);s.coins+=gold;result.gold=gold;break;}
   case 'build.put_away':fields(d,[]);o=requireObject(command.target);if(!o.type.startsWith('collection_')||!(context.ownedCollections||[]).includes(o.type))fail('Choose an owned decoration.');f.objects=f.objects.filter((a:Data)=>a!==o);break;
   case 'well.settings':{
    fields(d,['helpers','crop','mode','cap']);o=requireObject(command.target,'well');fields(d.helpers,['jade','rhys','jay']);if(Object.keys(d.helpers).length!==3||Object.values(d.helpers).some(x=>typeof x!=='boolean')||!unlockedCrop(d.crop)||!['previous','selected'].includes(d.mode)||!integer(d.cap,0,9999))fail('Check the well’s helper settings.');o.helpers={...d.helpers};o.helperCrop=d.crop;o.helperPlantMode=d.mode;o.helperCropCap=d.cap;break;}
   case 'craft.settings':fields(d,['enabled','recipe','cap']);o=requireObject(command.target);if(!['kitchen','workshop'].includes(o.type)||typeof d.enabled!=='boolean'||!integer(d.cap,0,9999))fail('Choose valid production settings.');requireRecipe(o,d.recipe);Object.assign(o,{autoWork:d.enabled,autoRecipe:d.recipe,autoCap:d.cap});break;
   case 'lesson.claim':fields(d,[]);if(command.target!=='friends'||!context.visitedFriend||!lesson('friends',result))fail('Complete this lesson before collecting its reward.');break;
   default:{
    const r=worker.command(command.type,command.target,d,map)||tripCommand(command.type,d,{s,W,now,fields,fail,xp})||progressionCommand(command.type,command.target,d,{s,W,R,now,map,fields,fail,xp,event,journal});
    if(!r)fail('This farm action has not moved to the verified server yet.','UNSUPPORTED_FARM_ACTION');result={...r,type:command.type};
   }
  }
  if(!command.type.startsWith('workers.')&&command.type!=='lesson.claim'){
   for(const e of events.slice(eventStart))lesson(e.event,result);
   if(command.type==='fruit.harvest')lesson('fruit',result);
   if(['animal.care','animal.collect_all'].includes(command.type)&&(Number(farms().willow.inventory.fleece)||0)>fleeceBefore)lesson('fleece',result);
   if(command.type==='build.place'&&result.id){const placed=f.objects.find((o:Data)=>o.id===result.id);if(placed&&animal(placed)&&home(placed,f))lesson('home',result);}
   if(command.type==='build.move'&&d.home)lesson('home',result);
  }
  results.push(result);
  worker.invalidate();
 }
 settle();s.seen=now;
 return {save:s,results,events,help,marketSales,messages:messages.slice(-8),rules: RULES_HASH};
}
