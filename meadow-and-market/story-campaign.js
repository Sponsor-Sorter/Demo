(() => {
 'use strict';
 const objects=s=>Object.values(s.farms||{}).flatMap(f=>f.objects||[]),stats=s=>s.homestead?.stats||{};
 const housed=o=>!!(o.coopId||o.barnId||o.paddockId),animals=s=>objects(s).filter(o=>['chicken','cow','sheep','goat','alpaca'].includes(o.type));
 const goal=(id,title,text,target,reward,xp,measure,route,lesson)=>({id:'campaign238-'+id,title,text,target,reward,xp,measure,route,lesson});
 const chapters=[
  {name:'Welcome to Willowbrook',person:'jade',campaign:true,pack:'welcome_garden',voice:'jade-willowbrook238',endingVoice:'rhys-homestead238',
   opening:'The old Harvest Fair once brought the whole village together. Farmer Jade has found its faded invitation. Before we can welcome everyone back, this little corner of Willowbrook needs a steady harvest and a place for the family to rest.',
   ending:'There is life in the meadow again. Farmer Rhys puts the old invitation safely beside the well. Next, Farmer Jay has a plan for the empty animal homes. The fair begins with a farm that feels like home.',
   goals:[
    goal('soil','A little room to grow','Till one crop tile. Farmer Jade will show you where to start.',1,30,10,s=>objects(s).some(o=>o.type==='plot'&&(o.stage||o.plantedAt))?1:0,'farm','till'),
    goal('seed','Our first seeds','Plant a crop. Crops already growing and earlier planting count.',1,35,10,s=>Math.max(stats(s).plant||0,objects(s).some(o=>o.type==='plot'&&o.plantedAt)?1:0),'farm','plant'),
    goal('water','A drink for the garden','Water a planted field. Previous watering and helper watering count.',1,35,10,s=>Math.max(stats(s).water||0,objects(s).some(o=>o.type==='plot'&&o.wateredUntil>0)?1:0),'farm','water'),
    goal('harvest','The first harvest basket','Gather five crop or orchard harvests. Your farmers can help.',5,60,15,s=>stats(s).harvest||0,'farm','harvest'),
    goal('well','A place to gather','Keep a family well on one of your farms. Open Build to place one if needed.',1,45,10,s=>objects(s).filter(o=>o.type==='well').length,'build','well'),
    goal('roots','Putting down roots','Upgrade one field to at least 2×2. Harvest it first and leave room for all four tiles.',1,80,20,s=>objects(s).filter(o=>o.type==='plot'&&o.tier>=1).length,'farm','upgrade')
   ]},
  {name:'A Home for Every Animal',person:'jay',campaign:true,pack:'coop_charm',voice:'jay-animal-home238',endingVoice:'jay-animal-parade238',
   opening:'Farmer Jay has heard the village children asking whether the fair will have animals again. Let’s start with comfortable homes, a small flock and daily care. Happy animals will give us the eggs and milk the village needs.',
   ending:'The animal homes are busy again, and the first produce is ready for the village. Farmer Jay adds an animal parade to the old fair invitation. Keep caring for your new friends as your homestead story continues.',
   goals:[
    goal('coop','Somewhere safe to settle','Build a chicken coop. A coop you already own counts.',1,50,15,s=>objects(s).filter(o=>o.type==='coop').length,'build','home'),
    goal('flock','Three feathered neighbours','House three chickens in coops across your farms.',3,65,15,s=>animals(s).filter(o=>o.type==='chicken'&&o.coopId).length,'animals','home'),
    goal('care','Make everyone welcome','Feed, brush or play with your animals three times. Earlier care counts.',3,60,15,s=>stats(s).care||0,'animals','care'),
    goal('room','Room for a growing flock','Upgrade a chicken coop once. The next stage needs two clear tiles.',1,85,20,s=>objects(s).filter(o=>o.type==='coop'&&o.tier>=1).length,'farm','upgrade'),
    goal('pasture','A home beyond the coop','Build a barn or livestock paddock for larger animals.',1,85,20,s=>objects(s).filter(o=>['barn','paddock'].includes(o.type)).length,'build','home'),
    goal('family','A farm family of our own','House at least two kinds of animal. A chicken and a cow, sheep, goat or alpaca will do.',2,100,25,s=>new Set(animals(s).filter(housed).map(o=>o.type)).size,'animals','home')
   ]}
 ];
 window.meadowCampaign={chapters};
})();
