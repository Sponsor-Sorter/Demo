(() => {
  'use strict';
 function verified(s,type,target,data){if(!window.meadowCommandUI?.stateIs(s))return false;window.meadowCommandUI.route(type,target,data,s.active,{after:()=>{show(selectedChapter);}});return true;}

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
  chapters.push({name:'A shop that grows with you',person:'jay',goals:[
    {id:'shop-shelf-plan',title:'A little plan for the shelves',text:'Build a market stall and enable a shelf plan with at least one good. Set a basket reserve for your recipes.',target:1,reward:120,xp:25,measure:s=>Object.values(s.farms).filter(f=>{const p=window.meadowShopPlan.plan(f);return f.objects.some(o=>o.type==='stall')&&p.enabled&&p.rules.length}).length},
    {id:'shop-helper-supply',title:'Neighbours are always welcome',text:'Let Farmer Jay restock forty goods across your farm shops. He follows your plan while you play in each area.',target:40,reward:300,xp:50,measure:s=>Object.values(s.farms).reduce((n,f)=>n+(f.shop?.helperStocked||0),0)}
  ]});
  chapters.push({name:'The artisan’s signature',person:'jay',goals:[
    {id:'artisan-skill-first',title:'Made with practice',text:'Reach artisan rank 2 by collecting five batches of one recipe. Helper collections count.',target:1,reward:80,xp:20,measure:s=>window.meadowProduction.recipes.filter(r=>window.meadowArtisan.status(s,r.id).rank>=2).length},
    {id:'artisan-skill-signature',title:'Our signature creations',text:'At farm level 8, select both a kitchen and craft signature. Each recipe needs artisan rank 3.',target:2,reward:180,xp:35,measure:s=>Object.values(window.meadowArtisan.book(s).signature).filter(id=>window.meadowArtisan.signature(s,id)).length},
    {id:'artisan-skill-variety',title:'A truly handmade village',text:'Reach artisan rank 3 in eight recipes. Your permanent skills improve every matching workspace.',target:8,reward:350,xp:60,measure:s=>window.meadowProduction.recipes.filter(r=>window.meadowArtisan.status(s,r.id).rank>=3).length},
    {id:'artisan-skill-master',title:'A master of the craft',text:'Collect 120 batches of one recipe for artisan rank 5. Progress and unclaimed rewards never expire.',target:1,reward:450,xp:75,measure:s=>window.meadowProduction.recipes.filter(r=>window.meadowArtisan.status(s,r.id).rank>=5).length}
  ]});
  const objects=s=>Object.values(s.farms).flatMap(f=>f.objects||[]),stats=s=>s.homestead?.stats||{};
  function journal(s){s.homestead ||= {stats:{},claimed:[]};s.homestead.stats ||= {};s.homestead.claimed ||= [];return s.homestead}
  function event(id,count=1){if(!api)return;const j=journal(api.state());j.stats[id]=(j.stats[id]||0)+Math.max(0,Number(count)||0)}
  function progress(s,g){return Math.max(0,Math.min(g.target,Number(g.measure(s))||0))}
  function claim(s,id){if(verified(s,'story.claim',id,{}))return null;const goal=chapters.flatMap(c=>c.goals).find(g=>g.id===id),j=journal(s);if(!goal||j.claimed.includes(id)||progress(s,goal)<goal.target)return null;j.claimed.push(id);return goal}
  const openings=[
    'A few beds and a happy flock can become a home. Farmer Jade helps you build a steady harvest before the village needs more.',
    'The family has more than fresh crops to share. Farmer Jay turns your harvest into food, honey and a welcoming farm shop.',
    'Your neighbours are ready to welcome you. Farmer Rhys helps you cross the bridge, meet friends and make room for bigger plans.',
    'The country fair is coming. Give your alpacas a comfortable home, gather soft fleece and weave something worth sharing.',
    'A good farm grows friendships too. Spend time with your animals and build homes where everyone belongs.',
    'Each animal brings something different to the meadow. Help your whole farm family feel comfortable and cared for.',
    'The village table needs more than raw ingredients. Use your kitchen and craft shed to turn familiar harvests into thoughtful creations.',
    'Take your handmade favourites into the village. Farmer Jay has customers waiting for your kitchen and craft goods.',
    'Every harvest teaches you something. Farmer Jade helps you master favourite crops and discover new ones.',
    'A busy shop needs a little planning. Keep recipe ingredients in reserve while Farmer Jay stocks goods for your customers.',
    'Your farm has a style of its own. Practise recipes, choose your signatures and become an artisan the village remembers.'
  ];
  // Each replay explains the chapter's actual activity, using the original cast.
  // Reuse an existing specific lesson rather than an unrelated generic tutorial.
  const chapterGuides=[
    ['jade-crops','Farmer Jade: crop care'],
    ['jay-production120','Farmer Jay: kitchen & craft batches'],
    ['rhys-travel189','Farmer Rhys: travelling between farms'],
    ['jay-fleece','Farmer Jay: alpacas & fleece'],
    ['jay-care','Farmer Jay: everyday animal care'],
    ['jay-care-round123','Farmer Jay: care across your farms'],
    ['jay-artisan126','Farmer Jay: artisan recipes'],
    ['jay-market-stalls127','Farmer Jay: market deliveries'],
    ['jade-crop-mastery128','Farmer Jade: crop mastery'],
    ['jay-shop-plan130','Farmer Jay: shelf plans'],
    ['jay-artisan-mastery146','Farmer Jay: artisan mastery']
  ];
  let selectedChapter=null;
  function nextChapter(s){const claimed=journal(s).claimed;return Math.max(0,chapters.findIndex(c=>c.goals.some(g=>!claimed.includes(g.id))))}
  function goalRoute(id){if(['beds','kitchen','flock','grand-field','grove','alpaca-friends','grand-barn-family'].includes(id))return ['build','Open Build'];if(id==='visit')return ['friends','Find farm friends'];if(id==='parcels')return ['places','Choose a place'];if(['market-pantry','market-handmade'].includes(id))return ['market','Go to Farmers Market'];if(['customers','country-shop','shop-shelf-plan','shop-helper-supply'].includes(id))return ['shop','Open my farm shop'];if(id==='vendors')return ['requests','See market requests'];if(id.startsWith('animal-')||id.startsWith('family-'))return ['animals','Care for my animals'];return ['farm','Back to my farm']}
  function show(index){
    const s=api.state(),j=journal(s),total=chapters.reduce((n,c)=>n+c.goals.length,0);
    selectedChapter=Number.isInteger(index)?Math.max(0,Math.min(chapters.length-1,index)):selectedChapter??nextChapter(s);
    const c=chapters[selectedChapter],completed=c.goals.filter(g=>j.claimed.includes(g.id)).length,next=c.goals.find(g=>!j.claimed.includes(g.id)),route=next?(progress(s,next)>=next.target?['claim','Collect reward']:goalRoute(next.id)):null;
    const card=g=>{const n=progress(s,g),done=j.claimed.includes(g.id);return '<article class="story-goal '+(done?'story-complete':'')+'"><div><h3>'+g.title+'</h3><p>'+g.text+'</p><small>'+n+' / '+g.target+' · '+g.reward+' gold · '+g.xp+' XP</small><progress value="'+n+'" max="'+g.target+'" aria-label="'+g.title+' progress"></progress></div><button class="small-button story-claim" data-goal="'+g.id+'" '+(done||n<g.target?'disabled':'')+'>'+(done?'Collected':'Collect')+'</button></article>'};
    api.modal('<section class="story-reader"><header class="story-toolbar"><div><small class="eyebrow">YOUR HOMESTEAD STORY · '+j.claimed.length+'/'+total+'</small><h2>Growing together</h2></div><button class="small-button" id="story-daily">Daily jobs</button><button class="close-button" data-close="modal-dialog" aria-label="Return to farm">×</button><label class="story-selector">Chapter<select id="story-chapter-select">'+chapters.map((ch,i)=>'<option value="'+i+'" '+(i===selectedChapter?'selected':'')+'>'+ (i+1)+'. '+ch.name+' · '+ch.goals.filter(g=>j.claimed.includes(g.id)).length+'/'+ch.goals.length+'</option>').join('')+'</select></label></header><main class="story-pages"><div class="story-narrative"><img src="assets/generated/guides/'+c.person+'.webp" alt="Farmer '+c.person[0].toUpperCase()+c.person.slice(1)+'"><div><small>CHAPTER '+(selectedChapter+1)+' · '+completed+'/'+c.goals.length+' COLLECTED</small><h3>'+c.name+'</h3><p>'+openings[selectedChapter]+'</p><button class="small-button" id="story-listen">🔊 '+(c.person==='jade'?'Jade: growing tips':c.person==='rhys'?'Rhys: building tips':'Jay: market tips')+'</button></div></div>'+(next?'<div class="story-next"><div><small>YOUR NEXT STEP</small><strong>'+next.title+'</strong></div><button class="primary-button" id="story-go">'+route[1]+'</button></div>':'<div class="story-next"><strong>Chapter complete. Your meadow is growing!</strong>'+(selectedChapter<chapters.length-1?'<button class="primary-button" id="story-next-chapter">Next chapter →</button>':'')+'</div>')+c.goals.filter(g=>!j.claimed.includes(g.id)).map(card).join('')+(completed?'<details class="story-collected"><summary>'+completed+' collected '+(completed===1?'goal':'goals')+'</summary>'+c.goals.filter(g=>j.claimed.includes(g.id)).map(card).join('')+'</details>':'')+'</main></section>');
    document.querySelector('#story-daily').onclick=()=>{document.querySelector('#modal-dialog').close();api.daily()};
    document.querySelector('#story-chapter-select').onchange=e=>{window.meadowAudio?.stopVoice();show(Number(e.target.value))};
    const guide=chapterGuides[selectedChapter],listen=document.querySelector('#story-listen');
    listen.textContent='🔊 '+guide[1];listen.onclick=()=>window.meadowAudio?.speak(guide[0]);
    document.querySelector('#story-go')?.addEventListener('click',()=>{if(route[0]==='claim'){document.querySelector('[data-goal="'+next.id+'"]').click();return}document.querySelector('#modal-dialog').close();api.go?.(route[0])});
    document.querySelector('#story-next-chapter')?.addEventListener('click',()=>show(selectedChapter+1));
    document.querySelectorAll('.story-claim').forEach(b=>b.onclick=()=>{const g=claim(api.state(),b.dataset.goal);if(!g)return;api.earn(g.reward);api.xp(g.xp);api.save();window.meadowAudio?.play('reward');show(selectedChapter)});
  }
  window.meadowStory={chapters,chapterGuides,progress,claim,event,show,attach(adapter){api=adapter;journal(api.state())}};
})();
