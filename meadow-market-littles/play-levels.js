(() => {
  'use strict';
  const names={apple:'Apple',carrot:'Carrot',tomato:'Tomato',corn:'Corn',pumpkin:'Pumpkin',strawberry:'Strawberry',pear:'Pear',banana:'Banana',orange:'Orange',grapes:'Grapes',watermelon:'Watermelon',lemon:'Lemon',cucumber:'Cucumber',potato:'Potato',onion:'Onion',broccoli:'Broccoli',peas:'Peas',pepper:'Pepper'};
  const shuffle=(list,random=Math.random)=>{const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  function levelGame(g,level=1){const n=Math.max(1,Math.floor(Number(level)||1)),d=Math.min(30,n-1),r={...g,level:n};
    if(g.id==='eggs')Object.assign(r,{goal:12+Math.min(30,d*2),time:Math.max(28,45-d*.5),spawnGap:Math.max(.32,1.25/(1+d*.12)),fallSpeed:1+d*.07,burst:d>=4?2:1});
    if(g.id==='milk')Object.assign(r,{goal:8+Math.min(10,Math.floor(d/2)),time:Math.max(24,40-d*.6),zone:Math.max(.10,.36/(1+d*.15)),markerSpeed:2.6+d*.18});
    if(g.id==='memory'){const pairs=Math.min(18,8+Math.floor(d/2)*2);Object.assign(r,{pairs,goal:pairs,time:Math.max(65,100-d*1.5)})}
    if(g.id==='sorting')Object.assign(r,{goal:15+Math.min(25,d*2),time:Math.max(32,50-d*.5),basketCount:Math.min(6,3+Math.floor(d/3))});
    if(['sheep','goat','cow'].includes(g.id))Object.assign(r,{goal:Math.min(6,3+Math.floor(d/3)),time:0,relaxed:true});
    if(g.id==='flowers')Object.assign(r,{goal:12+Math.min(18,d),time:Math.max(21,35-d*.35)});
    if(g.id==='coopmath')Object.assign(r,{goal:6,time:0,relaxed:true});
    if(g.id==='differences')Object.assign(r,{goal:Math.min(6,3+Math.floor(d/4)),time:0,relaxed:true});
    r.time=Math.ceil(r.time);
    const copy={eggs:()=>`Catch ${r.goal} falling eggs before three break. Later levels drop faster eggs and small bursts.`,milk:()=>`Tap the playfield or Milk when the marker is inside the golden zone. Fill ${r.goal} buckets before the timer ends.`,sorting:()=>`Sort ${r.goal} items into ${r.basketCount} labelled baskets. Listen to each produce name. A wrong basket costs two seconds.`,flowers:()=>`Follow the glowing flower and pick ${r.goal} before time runs out. Only the glowing flower counts.`,coopmath:()=>`Build a cosy coop with Farmer Rhys. Fit the floor boards, walls and roof, hammer the shiny nails, paint your roof and make three soft nests. Take your time.`,differences:()=>`Look at two farm pictures. Find ${r.goal} changes and tap them in either picture. Take your time. Tap Show a hint whenever you like.`};
    if(copy[g.id])r.text=copy[g.id]();
    if(['sheep','goat','cow'].includes(g.id))r.text=`Find ${r.goal} little farm friends. Move the leaves, lift hay and open gates to uncover them. Tap each friend, guide everyone home along the footprints, then scatter their snack. Ask Farmer Rhys for a sound clue whenever you like.`;
    return r;
  }
  function deck(pairs=8,random=Math.random){const chosen=shuffle(Object.keys(names),random).slice(0,Math.min(18,Math.max(2,pairs)));return shuffle(chosen.flatMap(id=>[id,id]),random)}
  function question(level,random=Math.random){const d=Math.max(0,level-1),max=Math.min(60,5+d*3),a=1+Math.floor(random()*max),b=1+Math.floor(random()*max);let text,answer;if(level>=5&&random()<.35){const m=Math.min(12,3+Math.floor(level/2)),x=1+Math.floor(random()*m),y=1+Math.floor(random()*m);text=x+' × '+y;answer=x*y}else if(level>=3&&random()<.5){text=Math.max(a,b)+' − '+Math.min(a,b);answer=Math.abs(a-b)}else{text=a+' + '+b;answer=a+b}const choices=new Set([answer]);for(let i=1;choices.size<4;i++)choices.add(Math.max(0,answer+(i%2?1:-1)*Math.ceil(i/2)));return {text,answer,choices:shuffle([...choices],random)}}
  const differences=[
    {name:'Meadow picnic',scene:'minigames/meadow',person:'jade'},
    {name:'Chicken yard',scene:'minigames/coop',person:'jay'},
    {name:'Dairy morning',scene:'minigames/dairy',person:'jade'},
    {name:'Seed table',scene:'minigames/memory',person:'rhys'},
    {name:'Harvest baskets',scene:'minigames/sorting',person:'jay'},
    {name:'Cow pasture',scene:'minigames/cow-search',person:'jade'},
    {name:'Goat garden',scene:'minigames/goat-search',person:'rhys'},
    {name:'Farmers market',scene:'market/farmers-market',person:'jay'},
    {name:'Packing morning',scene:'market/packingbench',person:'rhys'},
    {name:'Market cart',scene:'market/marketcart',person:'jade'}
  ];
  const extraGames=[
    {id:'coopmath',name:'Rhys’s coop builders',person:'rhys',label:'Farmer Rhys',scene:'coop-build',card:'assets/generated/minigames/coop-build-card.svg',text:'Fit the floor boards, walls and roof, hammer the shiny nails, paint your roof and make three soft nests for the hens. Take your time!',goal:6,time:0,relaxed:true,item:'egg',amount:3},
    {id:'differences',name:'Farm spot the difference',person:'rhys',label:'Farmer Rhys',scene:'differences',text:'Compare both farm pictures. Tap each changed fruit, vegetable or farm detail on either picture. Find them all before time runs out. Explore ten scenes with fresh changes each play!',goal:5,time:100,item:'apple',amount:3}
  ];
  const animalArt={hen:'assets/generated/hen.webp',cow:'assets/generated/cow.webp',sheep:'assets/generated/sheep.webp',goat:'assets/generated/goat.webp'};
  const art=id=>animalArt[id]|| (id==='flower'?'assets/generated/flower-patch.webp':['hammer','planks','nails'].includes(id)?'assets/generated/minigames/build/'+id+'.webp':'assets/generated/minigames/produce/'+id+'.webp');
  function mount(r,h){
    if(r.game.id==='differences'){
      const version=differences[r.game.variant||0],pool=shuffle([...Object.keys(names),'hen','cow','sheep','goat','hammer','planks','nails','flower']),slots=shuffle(Array.from({length:8},(_,i)=>({x:18+(i%4)*21+(Math.random()-.5)*4,y:36+Math.floor(i/4)*31+(Math.random()-.5)*4})));r.changed=new Set(shuffle(Array.from({length:8},(_,i)=>i)).slice(0,r.game.goal));r.foundDiff=new Set();r.diffObjects=slots.map((p,i)=>{const a=pool[i],different=pool.find((id,j)=>id!==a&&j!==i);return {...p,a,b:different||pool[(i+1)%pool.length]}});
      h.actors.innerHTML='<div class="mini-diff-board">'+[0,1].map(side=>'<section class="mini-diff-picture" aria-label="Farm picture '+(side?'B':'A')+'" style="background-image:url(assets/generated/'+version.scene+'.webp)"><span class="mini-diff-label">'+(side?'PICTURE B':'PICTURE A')+'</span>'+r.diffObjects.map((p,i)=>'<button class="mini-diff-object" data-diff="'+i+'" aria-label="Look at farm detail '+(i+1)+' in picture '+(side?'B':'A')+'" style="left:'+p.x+'%;top:'+p.y+'%"><img src="'+art(side&&r.changed.has(i)?p.b:p.a)+'" alt=""><b aria-hidden="true"></b></button>').join('')+'</section>').join('')+'<p class="mini-diff-message" id="mini-diff-message" role="status">Tap a change in either picture. You can take your time.</p></div>';
      h.actors.querySelectorAll('[data-diff]').forEach(b=>h.bindTap(b,()=>{if(r.paused)return;const i=Number(b.dataset.diff);if(r.foundDiff.has(i))return;if(!r.changed.has(i)){h.$('#mini-diff-message').textContent='These pictures match there. Keep looking!';window.meadowAudio?.play('tap');return}r.foundDiff.add(i);r.score++;h.actors.querySelectorAll('[data-diff="'+i+'"]').forEach(t=>{t.classList.remove('hinted');t.classList.add('difference-found');t.querySelector('b').textContent='✓';t.disabled=true});h.$('#mini-diff-message').textContent='You found one! '+r.score+' of '+r.game.goal+' changes.';window.meadowAudio?.play('care');h.update();if(r.score>=r.game.goal)h.finish(true)}));
      h.$('#mini-hint').onclick=()=>{if(r.paused)return;if(r.hintTimer)h.cancel(r.hintTimer);const i=[...r.changed].find(n=>!r.foundDiff.has(n));if(i===undefined)return;const buttons=h.actors.querySelectorAll('[data-diff="'+i+'"]');buttons.forEach(b=>{b.classList.remove('hinted');void b.offsetWidth;b.classList.add('hinted')});h.$('#mini-diff-message').textContent='Here is a little hint. Tap the matching spot in either picture.';window.meadowAudio?.play('tap');r.hintTimer=h.later(()=>{buttons.forEach(b=>b.classList.remove('hinted'));r.hintTimer=0},2200)};return true;
    }return false;
  }
  function tick(r,h){if(r.questionAt&&r.elapsed>=r.questionAt){r.questionAt=0;r.newQuestion()}if(r.finishAt&&r.elapsed>=r.finishAt){r.finishAt=0;h.finish(true);return true}return false}
  window.meadowPlayLevels={names,shuffle,levelGame,deck,question,differences,extraGames,mount,tick};
})();
