(() => {
  'use strict';
  let api;
  const chapters=[
    {name:'A growing homestead',person:'jade',goals:[
      {id:'beds',title:'Room to grow',text:'Till at least three tiles of crop soil. Upgraded fields count every tile.',target:3,reward:60,xp:15,measure:s=>objects(s).filter(o=>o.type==='plot'&&(o.stage||o.plantedAt)).reduce((n,o)=>n+(1+(o.tier||0))**2,0)},
      {id:'baskets',title:'Harvest days',text:'Gather five crop or orchard harvests. Farmer Jade’s harvests count too.',target:5,reward:90,xp:20,measure:s=>stats(s).harvest||0},
      {id:'flock',title:'A happy little flock',text:'House three chickens in your coops. Upgrade a coop to make room.',target:3,reward:120,xp:25,measure:s=>objects(s).filter(o=>o.type==='chicken'&&o.coopId).length}
    ]},
    {name:'Made in the meadow',person:'jay',goals:[
      {id:'kitchen',title:'Something delicious',text:'Build your first farm kitchen from the Build catalogue or Shop.',target:1,reward:100,xp:20,measure:s=>objects(s).filter(o=>o.type==='kitchen').length},
      {id:'batches',title:'The artisan’s basket',text:'Collect four finished batches from a kitchen or craft shed. Food and handmade goods both count.',target:4,reward:160,xp:30,measure:s=>stats(s).craft||0},
      {id:'customers',title:'Open for business',text:'Stock a market stall and sell ten items to visiting customers.',target:10,reward:180,xp:35,measure:s=>Object.values(s.farms).reduce((n,f)=>n+(f.shop?.sold||0),0)},
      {id:'honey',title:'A little sweetness',text:'Collect three jars of honey. Place a hive within four tiles of blooming flowers.',target:3,reward:150,xp:30,measure:s=>stats(s).honey||0},
      {id:'grove',title:'An orchard for everyone',text:'Upgrade an orchard grove to its second stage. Clear space for its larger footprint.',target:1,reward:180,xp:35,measure:s=>objects(s).some(o=>o.type==='orchard'&&o.tier>=1)?1:0}
    ]},
    {name:'Beyond the garden gate',person:'rhys',goals:[
      {id:'parcels',title:'Over the bridge and beyond',text:'Open both Eastbank Meadow and the Homestead Back Pasture.',target:2,reward:250,xp:45,measure:s=>['east','back'].filter(id=>s.farms[id]).length},
      {id:'vendors',title:'Village favourite',text:'Complete five vendor orders across your farms. Find their requests in Market.',target:5,reward:200,xp:40,measure:s=>Object.values(s.farms).reduce((n,f)=>n+(f.done||0),0)},
      {id:'visit',title:'Better with farm friends',text:'Visit an accepted friend’s farm using the Friends button in the top HUD.',target:1,reward:100,xp:20,measure:s=>stats(s).visit||0},
      {id:'grand-field',title:'A field of plenty',text:'Upgrade a crop plot to a 4×4 field. It needs sixteen clear grass tiles.',target:1,reward:300,xp:50,measure:s=>objects(s).some(o=>o.type==='plot'&&o.tier>=3)?1:0}
    ]}
  ];
  chapters.push({name:'Fleece, fibre and the country fair',person:'jay',goals:[
    {id:'alpaca-friends',title:'A soft-hearted pair',text:'House two alpacas in barns or paddocks. They join the farm at Level 6.',target:2,reward:180,xp:35,measure:s=>objects(s).filter(o=>o.type==='alpaca'&&(o.barnId||o.paddockId)).length},
    {id:'fleece-basket',title:'Soft fleece, happy friends',text:'Collect ten alpaca fleece. Healthy animals and upgraded homes give larger harvests.',target:10,reward:200,xp:40,measure:s=>stats(s).fleece||0},
    {id:'woven-gifts',title:'Handmade warmth',text:'Collect six woven alpaca scarves from your craft shed.',target:6,reward:280,xp:50,measure:s=>stats(s).made_scarf||0},
    {id:'country-shop',title:'The country fair pantry',text:'Sell fifty goods through your farm shops. Sales on every map count.',target:50,reward:350,xp:60,measure:s=>Object.values(s.farms).reduce((n,f)=>n+(f.shop?.sold||0),0)}
  ]});
  chapters.push({name:'Friends for life',person:'jay',goals:[
    {id:'animal-companion',title:'A familiar friendly face',text:'Reach friendship level 3 with an animal. Feed, brush and play; each activity earns a care star every ten minutes.',target:1,reward:150,xp:30,measure:s=>objects(s).filter(o=>window.meadowBonds.rank(o)>=3).length},
    {id:'animal-best-friend',title:'Best farm friends',text:'Reach friendship level 5 with an animal. Best friends add two goods to each happy collection.',target:1,reward:300,xp:50,measure:s=>objects(s).filter(o=>window.meadowBonds.rank(o)>=5).length},
    {id:'grand-barn-family',title:'A home for everyone',text:'House a cow, sheep, goat and alpaca together in one fully upgraded barn.',target:1,reward:350,xp:60,measure:s=>Object.values(s.farms).some(f=>f.objects.some(h=>h.type==='barn'&&h.tier>=3&&['cow','sheep','goat','alpaca'].every(type=>f.objects.some(o=>o.type===type&&o.barnId===h.id))))?1:0}
  ]});
  chapters.push({name:'A thriving animal family',person:'jay',goals:[
    {id:'family-variety',title:'Different friends, one farm family',text:'Welcome all five animal types across your farms. Coops house chickens; barns and paddocks house livestock.',target:5,reward:250,xp:45,measure:s=>new Set(objects(s).filter(o=>['chicken','cow','sheep','goat','alpaca'].includes(o.type)).map(o=>o.type)).size},
    {id:'family-comfort',title:'Comfortable homes',text:'Keep six housed animals above 75% for food, cleanliness and happiness. Open Animal Family to find anyone needing care.',target:6,reward:300,xp:50,measure:s=>objects(s).filter(o=>['chicken','cow','sheep','goat','alpaca'].includes(o.type)&&(o.coopId||o.barnId||o.paddockId)&&o.hunger>=75&&o.clean>=75&&o.happy>=75).length},
    {id:'family-bonds',title:'Everyone belongs',text:'Build friendship level 3 with five animals. Different care activities help friendships grow.',target:5,reward:400,xp:65,measure:s=>objects(s).filter(o=>['chicken','cow','sheep','goat','alpaca'].includes(o.type)&&window.meadowBonds.rank(o)>=3).length}
  ]});
  chapters.push({name:'The village artisan kitchen',person:'jay',goals:[
    {id:'artisan-pantry',title:'From milk to a village supper',text:'Collect six farm butter and six creamy mushroom soup from your kitchen.',target:12,reward:250,xp:45,measure:s=>Math.min(6,stats(s).made_butter||0)+Math.min(6,stats(s).made_mushroomsoup||0)},
    {id:'artisan-pastry',title:'Tea in the orchard',text:'Collect six strawberry tarts and six orchard apple pies. Flour, butter and jam give your crops a second purpose.',target:12,reward:350,xp:55,measure:s=>Math.min(6,stats(s).made_berrytart||0)+Math.min(6,stats(s).made_applepie||0)},
    {id:'artisan-gifts',title:'Made with care',text:'Collect three wool blankets and three homestead gift baskets from your craft shed.',target:6,reward:450,xp:65,measure:s=>Math.min(3,stats(s).made_blanket||0)+Math.min(3,stats(s).made_giftbasket||0)}
  ]});
  chapters.push({name:'A place in the village market',person:'jay',goals:[
    {id:'market-pantry',title:'From our kitchen to your table',text:'Sell six pantry goods in the Farmers Market. Choose Kitchen pantry, then finish a packing or weighing delivery.',target:6,reward:200,xp:40,measure:s=>stats(s).market_pantry||0},
    {id:'market-handmade',title:'Gifts made in the meadow',text:'Sell six handmade goods in the Farmers Market. Your craft shed turns farm produce into gifts for the village.',target:6,reward:300,xp:50,measure:s=>stats(s).market_handmade||0}
  ]});
  chapters.push({name:'A wiser way to grow',person:'jade',goals:[
    {id:'crop-skilled',title:'Know your favourite crop',text:'Reach mastery rank 3 in one crop by harvesting 80 planted tiles. Farmer Jade’s harvests count too.',target:1,reward:200,xp:40,measure:s=>window.meadowMastery.crops.filter(id=>window.meadowMastery.status(s,id).rank>=3).length},
    {id:'crop-variety',title:'A garden full of experience',text:'Reach mastery rank 3 in four different crops. Grow across your farm areas to discover more varieties.',target:4,reward:450,xp:65,measure:s=>window.meadowMastery.crops.filter(id=>window.meadowMastery.status(s,id).rank>=3).length}
  ]});
  const objects=s=>Object.values(s.farms).flatMap(f=>f.objects||[]),stats=s=>s.homestead?.stats||{};
  function journal(s){s.homestead ||= {stats:{},claimed:[]};s.homestead.stats ||= {};s.homestead.claimed ||= [];return s.homestead}
  function event(id,count=1){if(!api)return;const j=journal(api.state());j.stats[id]=(j.stats[id]||0)+Math.max(0,Number(count)||0)}
  function progress(s,g){return Math.max(0,Math.min(g.target,Number(g.measure(s))||0))}
  function claim(s,id){const goal=chapters.flatMap(c=>c.goals).find(g=>g.id===id),j=journal(s);if(!goal||j.claimed.includes(id)||progress(s,goal)<goal.target)return null;j.claimed.push(id);return goal}
  function show(){const s=api.state(),j=journal(s),total=chapters.reduce((n,c)=>n+c.goals.length,0);api.modal('<div class="sheet-head"><div><small class="eyebrow">YOUR HOMESTEAD STORY</small><h2>Little steps, a bigger farm</h2></div><button class="close-button" data-close="modal-dialog">×</button></div><p>'+j.claimed.length+' / '+total+' goals celebrated. Explore at your own pace; every reward can be collected once and stays saved with your farm.</p><button class="small-button full-button" id="story-daily">Today’s daily jobs</button>'+chapters.map(c=>'<section class="story-chapter"><div class="story-heading"><img src="assets/generated/guides/'+c.person+'.webp" alt="Farm helper"><h3>'+c.name+'</h3></div>'+c.goals.map(g=>{const n=progress(s,g),done=j.claimed.includes(g.id);return '<div class="task-card"><div class="task-row"><div class="task-main"><strong>'+g.title+'</strong><small>'+g.text+'</small><small>'+n+' / '+g.target+' · '+g.reward+' gold + '+g.xp+' XP</small></div><button class="small-button story-claim" data-goal="'+g.id+'" '+(done||n<g.target?'disabled':'')+'>'+(done?'Celebrated':'Claim')+'</button></div><div class="progress-track"><i style="width:'+n/g.target*100+'%"></i></div></div>'}).join('')+'</section>').join(''));document.querySelector('#story-daily').onclick=api.daily;document.querySelectorAll('.story-claim').forEach(b=>b.onclick=()=>{const g=claim(api.state(),b.dataset.goal);if(!g)return;api.earn(g.reward);api.xp(g.xp);api.save();window.meadowAudio?.play('reward');show()})}
  window.meadowStory={chapters,progress,claim,event,show,attach(adapter){api=adapter;journal(api.state())}};
})();
