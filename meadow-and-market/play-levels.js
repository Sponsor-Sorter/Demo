(() => {
  'use strict';
  const names={apple:'Apple',carrot:'Carrot',tomato:'Tomato',corn:'Corn',pumpkin:'Pumpkin',strawberry:'Strawberry',pear:'Pear',banana:'Banana',orange:'Orange',grapes:'Grapes',watermelon:'Watermelon',lemon:'Lemon',cucumber:'Cucumber',potato:'Potato',onion:'Onion',broccoli:'Broccoli',peas:'Peas',pepper:'Pepper'};
  const shuffle=(list,random=Math.random)=>{const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  function levelGame(g,level=1){const n=Math.max(1,Math.floor(Number(level)||1)),d=Math.min(30,n-1),r={...g,level:n};
    if(g.id==='eggs')Object.assign(r,{goal:12+Math.min(30,d*2),time:Math.max(28,45-d*.5),spawnGap:Math.max(.32,1.25/(1+d*.12)),fallSpeed:1+d*.07,burst:d>=4?2:1});
    if(g.id==='milk')Object.assign(r,{goal:8+Math.min(10,Math.floor(d/2)),time:Math.max(24,40-d*.6),zone:Math.max(.10,.36/(1+d*.15)),markerSpeed:2.6+d*.18});
    if(g.id==='memory'){const pairs=Math.min(18,8+Math.floor(d/2)*2);Object.assign(r,{pairs,goal:pairs,time:Math.max(65,100-d*1.5)})}
    if(g.id==='sorting')Object.assign(r,{goal:15+Math.min(25,d*2),time:Math.max(32,50-d*.5),basketCount:Math.min(6,3+Math.floor(d/3))});
    if(['sheep','goat','cow'].includes(g.id))Object.assign(r,{goal:Math.min(10,6+Math.floor(d/3)),time:Math.max(25,45-d*.6)});
    if(g.id==='flowers')Object.assign(r,{goal:12+Math.min(18,d),time:Math.max(21,35-d*.35)});
    if(g.id==='coopmath')Object.assign(r,{goal:6+Math.min(6,Math.floor(d/3)),time:Math.max(65,110-d*1.5)});
    if(g.id==='differences')Object.assign(r,{goal:Math.min(10,5+Math.floor(d/3)),time:Math.max(45,100-d*2)});
    r.time=Math.ceil(r.time);
    const copy={eggs:()=>`Catch ${r.goal} falling eggs before three break. Later levels drop faster eggs and small bursts.`,milk:()=>`Tap the playfield or Milk when the marker is inside the golden zone. Fill ${r.goal} buckets before the timer ends.`,sorting:()=>`Sort ${r.goal} items into ${r.basketCount} labelled baskets. Listen to each produce name. A wrong basket costs two seconds.`,flowers:()=>`Follow the glowing flower and pick ${r.goal} before time runs out. Only the glowing flower counts.`,coopmath:()=>`Solve ${r.goal} number problems to build the coop. Tap a wooden answer sign: a tick builds another piece; a cross means try another answer.`,differences:()=>`Find ${r.goal} changes between the farm pictures. Tap a changed item on either side. Ten farm scenes bring a fresh mix each play.`};
    if(copy[g.id])r.text=copy[g.id]();
    if(['sheep','goat','cow'].includes(g.id))r.text=`Find all ${r.goal} hiding farm friends before time runs out. Their places and appearances change each play.`;
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
    {id:'coopmath',name:'Rhys’s coop builders',person:'rhys',label:'Farmer Rhys',scene:'coop-build',text:'Solve each number problem. Tap the wooden answer sign. A tick adds a piece to the coop; a cross means try another answer. Build the whole coop before time runs out!',goal:6,time:110,item:'egg',amount:3},
    {id:'differences',name:'Farm spot the difference',person:'rhys',label:'Farmer Rhys',scene:'differences',text:'Compare both farm pictures. Tap each changed fruit, vegetable or farm detail on either picture. Find them all before time runs out. Explore ten scenes with fresh changes each play!',goal:5,time:100,item:'apple',amount:3}
  ];
  const art=id=>id==='flower'?'assets/generated/flower-patch.webp':['hammer','planks','nails'].includes(id)?'assets/generated/minigames/build/'+id+'.webp':'assets/generated/minigames/produce/'+id+'.webp';
  function mount(r,h){if(r.game.id==='coopmath'){
      h.actors.innerHTML='<img class="mini-coop-guide" src="assets/generated/guides/rhys.webp" alt="Farmer Rhys"><div class="mini-coop-construction"><img class="mini-coop-foundation" src="assets/generated/minigames/build/foundation.webp" alt="Coop foundation"><img class="mini-built-coop" src="assets/generated/chicken-coop.webp" alt="Chicken coop being assembled"><img class="mini-build-hammer" src="assets/generated/minigames/build/hammer.webp" alt=""><img class="mini-build-material" src="assets/generated/minigames/build/planks.webp" alt=""></div><div class="mini-math-controls"><div class="mini-math-question" aria-live="polite"></div><div class="mini-math-answers"></div></div>';
      r.newQuestion=()=>{h.$('.mini-coop-foundation').style.opacity=r.score?1:0;r.math=question(r.game.level);r.mathLocked=false;h.$('.mini-math-question').textContent=r.math.text+' = ?';h.$('.mini-math-answers').innerHTML=r.math.choices.map(n=>'<button class="mini-wood-answer" data-answer="'+n+'" aria-label="Answer '+n+'"><span>'+n+'</span><b aria-hidden="true"></b></button>').join('');h.$('.mini-built-coop').style.clipPath='inset('+(100-r.score/r.game.goal*100)+'% 0 0 0)';h.actors.querySelectorAll('[data-answer]').forEach(b=>h.bindTap(b,()=>{if(r.paused||r.mathLocked||b.disabled)return;const correct=Number(b.dataset.answer)===r.math.answer;b.classList.add(correct?'answer-correct':'answer-wrong');b.querySelector('b').textContent=correct?'✓':'✕';if(!correct){b.disabled=true;r.elapsed+=2;window.meadowAudio?.play('tap');h.update();return}r.mathLocked=true;r.score++;h.$('.mini-coop-foundation').style.opacity=1;h.$('.mini-built-coop').style.clipPath='inset('+(100-r.score/r.game.goal*100)+'% 0 0 0)';h.$('.mini-coop-construction').classList.remove('building-hit');void h.$('.mini-coop-construction').offsetWidth;h.$('.mini-coop-construction').classList.add('building-hit');window.meadowAudio?.play('build');h.update();r.questionAt=r.elapsed+.85;if(r.score>=r.game.goal){r.questionAt=0;r.finishAt=r.elapsed+1.05}}))};r.newQuestion();return true;
    }
    if(r.game.id==='differences'){
      const version=differences[r.game.variant||0],pool=shuffle([...Object.keys(names),'hammer','planks','nails','flower']),slots=shuffle(Array.from({length:12},(_,i)=>({x:20+(i%4)*20+(Math.random()-.5)*5,y:30+Math.floor(i/4)*18})));r.changed=new Set(shuffle(Array.from({length:12},(_,i)=>i)).slice(0,r.game.goal));r.foundDiff=new Set();r.diffObjects=slots.map((p,i)=>({...p,a:pool[i],b:pool[(i+3)%pool.length]}));
      h.actors.innerHTML='<div class="mini-diff-board">'+[0,1].map(side=>'<section class="mini-diff-picture" aria-label="'+(side?'Changed':'Original')+' picture" style="background-image:url(assets/generated/'+version.scene+'.webp)"><span class="mini-diff-label">'+(side?'Find the changes':'Look carefully')+'</span><img class="mini-diff-farmer" src="assets/generated/guides/'+version.person+'.webp" alt="Farmer '+version.person+'"><img class="mini-diff-table" src="assets/generated/minigames/difference-table.webp" alt="Farm worktable">'+r.diffObjects.map((p,i)=>'<button class="mini-diff-object" data-diff="'+i+'" aria-label="Inspect farm detail '+(i+1)+'" style="left:'+p.x+'%;top:'+p.y+'%"><img src="'+art(side&&r.changed.has(i)?p.b:p.a)+'" alt=""><b aria-hidden="true"></b></button>').join('')+'</section>').join('')+'</div>';
      h.actors.querySelectorAll('[data-diff]').forEach(b=>h.bindTap(b,()=>{if(r.paused)return;const i=Number(b.dataset.diff);if(r.foundDiff.has(i))return;if(!r.changed.has(i)){r.elapsed+=1.5;window.meadowAudio?.play('tap');h.update();return}r.foundDiff.add(i);r.score++;h.actors.querySelectorAll('[data-diff="'+i+'"]').forEach(t=>{t.classList.add('difference-found');t.querySelector('b').textContent='✓';t.disabled=true});window.meadowAudio?.play('care');h.update();if(r.score>=r.game.goal)h.finish(true)}));return true;
    }return false;
  }
  function tick(r,h){if(r.questionAt&&r.elapsed>=r.questionAt){r.questionAt=0;r.newQuestion()}if(r.finishAt&&r.elapsed>=r.finishAt){r.finishAt=0;h.finish(true);return true}return false}
  window.meadowPlayLevels={names,shuffle,levelGame,deck,question,differences,extraGames,mount,tick};
})();
