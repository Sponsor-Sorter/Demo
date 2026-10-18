(() => {
  'use strict';
  let api;
  const chapters=[
    {name:'A growing homestead',person:'jade',goals:[
      {id:'beds',title:'Room to grow',text:'Till at least three tiles of crop soil. Upgraded fields count every tile.',target:3,reward:60,xp:15,measure:s=>objects(s).filter(o=>o.type==='plot'&&(o.stage||o.plantedAt)).reduce((n,o)=>n+(1+(o.tier||0))**2,0)},
      {id:'baskets',title:'Harvest days',text:'Gather five crop or orchard harvests. Jade’s harvests count too.',target:5,reward:90,xp:20,measure:s=>stats(s).harvest||0},
      {id:'flock',title:'A happy little flock',text:'House three chickens in your coops. Upgrade a coop to make room.',target:3,reward:120,xp:25,measure:s=>objects(s).filter(o=>o.type==='chicken'&&o.coopId).length}
    ]},
    {name:'Made in the meadow',person:'jay',goals:[
      {id:'kitchen',title:'Something delicious',text:'Build your first farm kitchen from the Build catalogue or Shop.',target:1,reward:100,xp:20,measure:s=>objects(s).filter(o=>o.type==='kitchen').length},
      {id:'batches',title:'The artisan’s basket',text:'Collect four completed kitchen batches. Flour, bread, jam, cheese and cake all count.',target:4,reward:160,xp:30,measure:s=>stats(s).craft||0},
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
  const objects=s=>Object.values(s.farms).flatMap(f=>f.objects||[]),stats=s=>s.homestead?.stats||{};
  function journal(s){s.homestead ||= {stats:{},claimed:[]};s.homestead.stats ||= {};s.homestead.claimed ||= [];return s.homestead}
  function event(id,count=1){if(!api)return;const j=journal(api.state());j.stats[id]=(j.stats[id]||0)+Math.max(0,Number(count)||0)}
  function progress(s,g){return Math.max(0,Math.min(g.target,Number(g.measure(s))||0))}
  function claim(s,id){const goal=chapters.flatMap(c=>c.goals).find(g=>g.id===id),j=journal(s);if(!goal||j.claimed.includes(id)||progress(s,goal)<goal.target)return null;j.claimed.push(id);return goal}
  function show(){const s=api.state(),j=journal(s),total=chapters.reduce((n,c)=>n+c.goals.length,0);api.modal('<div class="sheet-head"><div><small class="eyebrow">YOUR HOMESTEAD STORY</small><h2>Little steps, a bigger farm</h2></div><button class="close-button" data-close="modal-dialog">×</button></div><p>'+j.claimed.length+' / '+total+' goals celebrated. Explore at your own pace; every reward can be collected once and stays saved with your farm.</p><button class="small-button full-button" id="story-daily">Today’s daily jobs</button>'+chapters.map(c=>'<section class="story-chapter"><div class="story-heading"><img src="assets/generated/guides/'+c.person+'.webp" alt="Farm helper"><h3>'+c.name+'</h3></div>'+c.goals.map(g=>{const n=progress(s,g),done=j.claimed.includes(g.id);return '<div class="task-card"><div class="task-row"><div class="task-main"><strong>'+g.title+'</strong><small>'+g.text+'</small><small>'+n+' / '+g.target+' · '+g.reward+' gold + '+g.xp+' XP</small></div><button class="small-button story-claim" data-goal="'+g.id+'" '+(done||n<g.target?'disabled':'')+'>'+(done?'Celebrated':'Claim')+'</button></div><div class="progress-track"><i style="width:'+n/g.target*100+'%"></i></div></div>'}).join('')+'</section>').join(''));document.querySelector('#story-daily').onclick=api.daily;document.querySelectorAll('.story-claim').forEach(b=>b.onclick=()=>{const g=claim(api.state(),b.dataset.goal);if(!g)return;api.earn(g.reward);api.xp(g.xp);api.save();window.meadowAudio?.play('reward');show()})}
  window.meadowStory={chapters,progress,claim,event,show,attach(adapter){api=adapter;journal(api.state())}};
})();
