(() => {
 'use strict';let api;
 function task(role,skip=new Set(),map=api.state().active){
  const s=api.state(),f=s.farms[map];if(!f)return null;const well=api.well(f),tasks=[],flowers=f.objects.filter(o=>o.type==='flowers');
  for(const o of f.objects){if(skip.has(o.id))continue;let action,label,seed;
   if(o.type==='plot'){
    if(o.plantedAt){const g=window.meadowCropGrowth.calculate(o,api.crops[o.crop]||api.crops.carrot,flowers);if(g.stage>=3){action='harvest';label='Harvesting '+api.crops[o.crop].name}else if(well?.autoWater&&!o.wateredUntil&&s.coins>=api.area(o)){action='water';label='Watering '+api.crops[o.crop].name}}
    else if(!o.stage){action='till';label='Tilling a field'}else{seed=api.seed(o,well,map);const cost=api.seedCost(o,seed,map);if(api.canPlant(o,well,seed,f)&&s.coins>=cost&&window.meadowPlanner?.seedAllowed(cost)!==false){action='plant';label='Planting '+api.crops[seed].name}}
   }else if(['tree','orchard'].includes(o.type)&&api.fruitProgress(o)>=1){action='fruit';label='Picking ripe apples'}
   else if(['kitchen','workshop'].includes(o.type)){action=window.meadowProduction.helperTask(o);if(action)label=action==='make'?'Preparing a production batch':'Collecting finished batches'}
   else if(o.type==='hive'){window.meadowApiary.settle(f,o);if(o.honey>0){action='honey';label='Collecting honey'}}
   else if(api.isAnimal(o)){window.meadowAnimals.settle(o);if(Date.now()-(o.lastCare||0)>45000&&(o.hunger<95||o.clean<95||o.happy<95||window.meadowAnimals.ready(o))){action='care';label='Caring for '+(o.name||o.type)}}
   else if(o.type==='stall'&&window.meadowShopPlan?.needed(f)){action='stock';label='Restocking shop shelves'}
   if(action){const home=api.home(o,f)||o;tasks.push({...home,id:o.id,helperAction:action,label,seed,lastHelperAt:o.lastHelperAt||0})}
  }
  // Fair turns: a busy bakery cannot indefinitely starve fields or animals.
  return tasks.sort((a,b)=>a.lastHelperAt-b.lastHelperAt||((a.helperAction==='water'?-1:0)-(b.helperAction==='water'?-1:0)))[0]||null;
 }
 function perform(role,t,map=api.state().active){const s=api.state(),f=s.farms[map],o=f?.objects.find(o=>o.id===t.id);if(!o)return false;const well=api.well(f);let done=false;const action=t.helperAction;
  if(action==='water'&&o.type==='plot'&&o.plantedAt&&!o.wateredUntil&&well?.autoWater&&window.meadowCropGrowth.calculate(o,api.crops[o.crop],f.objects).stage<3&&s.coins>=api.area(o)){s.coins-=api.area(o);o.wateredUntil=Date.now()+api.crops[o.crop].time*3;done=true}
  if(action==='till'&&o.type==='plot'&&!o.plantedAt&&!o.stage){o.stage=1;done=true}
  if(action==='plant'&&o.type==='plot'&&!o.plantedAt&&o.stage){const seed=api.seed(o,well,map),cost=api.seedCost(o,seed,map);if(api.canPlant(o,well,seed,f)&&s.coins>=cost&&window.meadowPlanner?.seedAllowed(cost)!==false){s.coins-=cost;window.meadowCropGrowth.start(o,seed);done=true}}
  if(action==='harvest'&&o.type==='plot'&&o.plantedAt&&window.meadowCropGrowth.calculate(o,api.crops[o.crop],f.objects).stage>=3){const n=api.yield(o);f.inventory[o.crop]=(f.inventory[o.crop]||0)+n;window.meadowAlmanac?.record(o.crop,n);window.meadowMastery?.record(s,o.crop,api.area(o));s.coins+=2;api.xp(8+(Number(o.tier)||0)*4);o.plantedAt=0;o.stage=1;o.wateredUntil=0;done=true}
  if(action==='fruit'&&api.fruitProgress(o)>=1){const n=api.fruitYield(o);f.inventory.apple=(f.inventory.apple||0)+n;o.lastFruitAt=Date.now();window.meadowAlmanac?.record('apple',n);api.xp(5);done=true}
  if(['collect','make'].includes(action)&&['kitchen','workshop'].includes(o.type))done=window.meadowProduction.helperWork(o,action);
  if(action==='care'&&api.isAnimal(o))done=window.meadowAnimals.care(o.id,'all',map);
  if(action==='honey'&&o.type==='hive'){const n=window.meadowApiary.collect(f,o);done=n>0;if(done)api.xp(n*4)}
  if(action==='stock'&&o.type==='stall')done=window.meadowShopPlan.helperWork(f);
  if(done){o.lastHelperAt=Date.now();api.event(action,map);api.save();if(map===s.active)api.render()}return !!done;
 }
 window.meadowFarmWork={attach:a=>api=a,task,perform};
})();
