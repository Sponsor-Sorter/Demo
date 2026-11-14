/* Stable scene nodes, primary-pointer gestures and one shared animation loop. */
(() => {
 'use strict';
 const C=window.meadowClassicCore;
 let active=null;
 const root='assets/generated/',basket=root+'play-pieces/harvest-basket.webp';
 const text={
  eggs:{catch:'Move your basket under the falling eggs.',carry:'Carry your basket to the cosy nest.',tuck:'Brush the soft straw over the eggs.',done:'Safe and cosy!'},
  milk:{wash:'Rub the muddy patches to wash Daisy.',pump:'Pull down on the soft milking handle.',deliverMilk:'Carry the full milk pail to the cart.',done:'Thank you for caring for Daisy!'},
  flowers:{nectar:'Guide your bee to each big flower.',pick:'Pick three flowers for the basket.',giveFlowers:'Bring your bouquet to Farmer Jade.',done:'A lovely gift for Jade!'},
  memory:{match:'Find the matching seed pictures.',water:'Rub your watering can over each seedling.',harvest:'Pull your crops into the basket.',done:'Look at your garden grow!'},
  sorting:{sort:'Drag the food to its matching picture basket.',load:'Load the full baskets onto the cart.',push:'Push your cart along the farm lane.',done:'The market delivery is here!'}
 };
 const cues={eggs:{catch:'catch',carry:'carry',tuck:'tuck'},milk:{wash:'wash',pump:'pump',deliverMilk:'carry'},flowers:{nectar:'bee',pick:'pick',giveFlowers:'give'},memory:{match:'match',water:'water',harvest:'harvest'},sorting:{sort:'sort',load:'load',push:'push'}};
 const voice=id=>id==='eggs'||id==='sorting'?'jay':'jade';
 const cue=(id,phase)=>'classic63-'+voice(id)+'-'+id+'-'+(phase==='done'?'done':cues[id][phase]);
 function enabled(id){return C.ids.includes(id)&&(window.meadowWeeklyFair?.getQualityBuild?.()||62)>=63;}
 function prepare(g){if(!enabled(g.id))return g;const s=C.create(g.id,g.level);return {...g,goal:s.goal,time:0,relaxed:true,text:text[g.id][s.phase]+' '+({eggs:'Then carry them home and tuck them in.',milk:'Then fill the pail and deliver the milk.',flowers:'Then pick and deliver a bouquet.',memory:'Then water and harvest your little garden.',sorting:'Then load your cart and push it to market.'})[g.id]};}
 const img=(src,alt='',cls='')=>'<img draggable="false" class="'+cls+'" src="'+src+'" alt="'+alt+'">';
 function object(cls,label,x,y,contents,target=''){return '<div class="cc-object '+cls+'" role="img" aria-label="'+label+'" '+(target?'data-drag="'+target+'"':'')+' style="left:'+x*100+'%;top:'+y*100+'%">'+contents+'</div>';}
 function destination(label,x,y,contents){return object('cc-destination',label,x,y,contents+'<span class="cc-label">'+label+'</span>');}
 function pail(){return '<span class="cc-pail"><i></i><b></b></span>';}
 function cart(){return '<span class="cc-cart"><i></i><b></b><em></em></span>';}
 function can(){return '<svg viewBox="0 0 160 120" aria-hidden="true"><path d="M35 40C1 0 3 101 35 80" fill="none" stroke="#366f67" stroke-width="13"/><path d="M36 35H100L145 8L157 22L114 62V101Q75 115 36 99Z" fill="#73b9a6" stroke="#2e6b61" stroke-width="6"/><path d="M45 46H93V94H45" fill="#a7d7b9"/><path d="M125 30L145 48" stroke="#2e6b61" stroke-width="8"/></svg>';}
 function scene(a){
  const s=a.s,p=s.phase,field=a.field;field.dataset.phase=p;field.dataset.activity=s.id;
  let html='';
  if(s.id==='eggs'){
   if(p==='catch')html='<div class="cc-eggs"></div>'+object('cc-basket','Egg catching basket',s.basket.x,.84,img(basket)+'<span class="cc-basket-eggs"></span>','basket');
   if(p==='carry')html=destination('Cosy straw nest',.5,.28,img(root+'play-pieces/nest.webp'))+object('cc-basket cc-full','Carry the egg basket',.5,.82,img(basket)+'<span class="cc-basket-eggs">● ● ●</span>','basket');
   if(p==='tuck'||p==='done')html=object('cc-nest cc-large','Eggs in their straw nest',.5,.4,img(root+'play-pieces/nest.webp')+'<span class="cc-nest-eggs">● ● ●</span><i class="cc-straw"></i>')+object('cc-tool','Soft straw brush',.8,.8,img(root+'play-pieces/soft-leaves.webp'),'straw');
  }
  if(s.id==='milk'){
   html=object('cc-daisy','Daisy the cow',.48,.4,img(root+'cow.webp'));
   if(p==='wash')html+=C.mudSpots.map((q,i)=>object('cc-mud','Muddy patch '+(i+1),q.x,q.y,'<i></i><b></b>')).join('')+object('cc-tool','Daisy’s washing cloth',.84,.82,img(root+'animal-care/cloth.webp'),'cloth');
   if(p==='pump')html+=object('cc-handle','Pull down to milk Daisy',.56,.46,'<i></i><span>↓</span>','handle')+object('cc-pail-object','Milk pail',.5,.85,pail())+'<div class="cc-milk-stream"></div>';
   if(p==='deliverMilk'||p==='done')html+=destination('Milk delivery cart',.82,.45,cart())+object('cc-pail-object cc-full','Carry the full milk pail',p==='done'?.82:.4,p==='done'?.45:.84,pail(),'pail');
  }
  if(s.id==='flowers'){
   html=C.flowerSpots.map((q,i)=>object('cc-flower','Flower '+(i+1),q.x,q.y,img(root+'learning56/flower.webp'),'flower'+i)).join('');
   if(p==='nectar')html+=object('cc-bee','Your helpful bee',s.bee.x,s.bee.y,img(root+'learning56/bee.webp'),'bee');
   if(p==='pick')html+=destination('Bouquet basket',.5,.82,img(basket));
   if(p==='giveFlowers'||p==='done')html+=destination('Farmer Jade',.82,.3,img(root+'guides/jade.webp'))+object('cc-bouquet','Your flower bouquet',p==='done'?.72:.3,p==='done'?.45:.78,img(basket)+img(root+'learning56/flower.webp','','cc-bloom one')+img(root+'learning56/flower.webp','','cc-bloom two')+img(root+'learning56/flower.webp','','cc-bloom three'),'bouquet');
  }
  if(s.id==='memory'){
   if(p==='match')html='<div class="cc-cards" style="--cols:'+ (s.deck.length<=6?3:4)+'">'+s.deck.map((id,i)=>'<button class="cc-card" data-card="'+i+'" aria-label="Seed card '+(i+1)+': hidden"><span class="cc-card-inner"><span class="cc-card-back">'+img(root+'together/card-back.svg')+'</span><span class="cc-card-front">'+img(root+'minigames/produce/'+id+'.webp')+'<b>'+id+'</b></span></span></button>').join('')+'</div>';
   else{
    html=C.plots.map((q,i)=>object('cc-plot','Garden plant '+(i+1),q.x,q.y,'<span class="cc-pot"></span>'+img(root+'learning56/seedling.webp','','cc-seedling')+img(root+'minigames/produce/'+s.deck[i*2]+'.webp','','cc-grown'),'crop'+i)).join('');
    html+=p==='water'?object('cc-tool cc-can','Your watering can',.8,.84,can(),'can'):destination('Harvest basket',.5,.85,img(basket));
   }
  }
  if(s.id==='sorting'){
   if(p==='sort'||p==='load')html=s.types.map((id,i)=>{const q=C.basketSpot(s,i);return object('cc-sort-basket','Basket for '+id,q.x,q.y,img(basket)+img(root+'minigames/produce/'+id+'.webp','','cc-basket-picture'),'load'+i);}).join('');
   if(p==='sort')html+=object('cc-produce','Food to sort',.5,.25,img(root+'minigames/produce/'+s.queue[s.sorted]+'.webp'),'produce');
   if(p==='load')html+=destination('Farm market cart',.78,.3,cart());
   if(p==='push'||p==='done')html='<div class="cc-lane"></div>'+destination('Farm market',.88,.34,img(root+'harvest58/barn.webp'))+object('cc-cart-object','Push your loaded farm cart',s.pushX,.65,cart()+img(basket,'','cc-cart-load'),'cart');
  }
  field.innerHTML=html+'<div class="cc-sparkles" aria-hidden="true"></div><div class="cc-hand" aria-hidden="true">☝</div><button class="cc-listen" aria-label="Farmer '+(voice(s.id)==='jay'?'Jay':'Jade')+': listen again">'+img(root+'guides/'+voice(s.id)+'.webp')+'<span aria-hidden="true">🔊</span></button>';
  field.querySelector('.cc-listen').onclick=()=>{if(!a.run.paused)window.meadowAudio?.speak(cue(s.id,p));};
  a.version=s.phaseVersion;a.signature='';a.dragNode=null;
  if(p==='match')field.querySelectorAll('[data-card]').forEach(b=>{b.onclick=()=>{if(!a.run.paused&&!document.hidden&&C.card(s,+b.dataset.card)){events(a);render(a);}};});
  if(p!=='done'){a.caption.textContent=text[s.id][p];window.meadowAudio?.speak(cue(s.id,p));}
  else{a.caption.textContent=text[s.id].done;a.field.classList.add('cc-completed');}
 }
 function events(a){for(const e of a.s.events.splice(0)){
  if(e.type==='success'){window.meadowAudio?.play('care');const spark=document.createElement('i');spark.textContent='✦';spark.style.left=(20+Math.random()*60)+'%';a.field.querySelector('.cc-sparkles')?.append(spark);a.hooks.later(()=>spark.remove(),800);}
  if(e.type==='word')window.meadowAudio?.speak((a.s.id==='sorting'?'harvest58-jay-word-':'produce-')+e.id);
  if(e.type==='retry'){window.meadowAudio?.play('tap');a.caption.textContent='Look for the matching picture. Try again!';}
 }}
 function render(a){
  if(active!==a)return;const s=a.s;if(a.version!==s.phaseVersion)scene(a);
  a.run.score=s.score;
  const signature=[s.score,s.phase,s.sorted,s.open.join(','),s.matched.join(','),s.visited.join(','),s.picked.join(','),s.loaded.join(','),s.harvested.join(',')].join('|');
  if(signature!==a.signature){
   a.signature=signature;a.hooks.$('#mini-count').textContent=s.score+' / '+s.goal+' helping steps';a.hooks.$('#mini-timer').textContent='Take your time';a.hooks.$('#mini-status').textContent=({catch:'Catch · Carry · Tuck',wash:'Wash · Milk · Deliver',nectar:'Guide · Pick · Give',match:'Match · Water · Harvest',sort:'Sort · Load · Deliver'})[s.phase]||'Lovely helping!';
   a.field.querySelectorAll('[data-card]').forEach(b=>{const i=+b.dataset.card,visible=s.open.includes(i)||s.matched.includes(i);b.classList.toggle('is-open',visible);b.classList.toggle('is-matched',s.matched.includes(i));b.disabled=s.matched.includes(i);b.setAttribute('aria-label','Seed card '+(i+1)+': '+(visible?s.deck[i]:'hidden'));});
   a.field.querySelectorAll('.cc-flower').forEach((n,i)=>{n.classList.toggle('cc-visited',s.visited.includes(i));n.hidden=s.picked.includes(i)||(s.phase==='giveFlowers'||s.phase==='done');});
   a.field.querySelectorAll('.cc-sort-basket').forEach((n,i)=>n.hidden=s.loaded.includes(i));
   if(s.phase==='sort'){const n=a.field.querySelector('.cc-produce img');n.src=root+'minigames/produce/'+s.queue[s.sorted]+'.webp';n.alt=s.queue[s.sorted];n.parentNode.setAttribute('aria-label',s.queue[s.sorted]+' to sort');}
   if(s.phase==='catch')a.field.querySelector('.cc-basket-eggs').textContent='● '.repeat(Math.min(6,s.caught));
   a.field.querySelectorAll('.cc-plot').forEach((n,i)=>{n.hidden=s.harvested.includes(i);n.classList.toggle('cc-grown-plant',s.phase!=='water');});
  }
  if(s.phase==='catch'){
   a.field.querySelector('.cc-basket').style.left=s.basket.x*100+'%';const eggLayer=a.field.querySelector('.cc-eggs');
   for(const n of eggLayer.children)if(!s.eggs.some(e=>String(e.id)===n.dataset.egg))n.remove();
   for(const e of s.eggs){let n=eggLayer.querySelector('[data-egg="'+e.id+'"]');if(!n){n=document.createElement('span');n.className='cc-egg';n.dataset.egg=e.id;n.setAttribute('role','img');n.setAttribute('aria-label','Falling egg');eggLayer.append(n);}n.style.left=e.x*100+'%';n.style.top=e.y*100+'%';}
  }
  if(s.phase==='wash')a.field.querySelectorAll('.cc-mud').forEach((n,i)=>{n.style.opacity=String(1-s.mud[i]);n.hidden=s.mud[i]>=1;});
  if(s.phase==='pump'){a.field.querySelector('.cc-pail').style.setProperty('--fill',s.pumps/s.pumpGoal);a.field.querySelector('.cc-milk-stream').classList.toggle('cc-flowing',s.stream>0);a.field.querySelector('.cc-handle').style.translate='0 '+(s.gesture?Math.max(0,Math.min(.2,s.gesture.last.y-s.gesture.start.y))*a.field.clientHeight:0)+'px';}
  if(s.phase==='nectar'){const bee=a.field.querySelector('.cc-bee');bee.style.left=s.bee.x*100+'%';bee.style.top=s.bee.y*100+'%';}
  if(s.phase==='water')a.field.querySelectorAll('.cc-plot').forEach((n,i)=>{n.style.setProperty('--growth',s.water[i]);n.classList.toggle('cc-watered',s.water[i]>=1);});
  if(s.phase==='tuck')a.field.querySelector('.cc-straw').style.opacity=String(Math.min(1,(s.tucked||0)/.65));
  if(s.phase==='push'||s.phase==='done'&&s.id==='sorting'){a.field.querySelector('.cc-cart-object').style.left=s.pushX*100+'%';a.field.querySelectorAll('.cc-cart b,.cc-cart em').forEach(n=>n.style.rotate=(s.push*900)+'deg');}
  if(s.done&&!a.ending){a.ending=true;a.hooks.later(()=>{if(active===a)a.hooks.finish(true);},1300);}
 }
 function point(a,e){const r=a.field.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
 function reset(a,released=false){if(!released)C.cancel(a.s);a.pointer=null;if(a.dragNode){a.dragNode.style.translate='';a.dragNode.style.zIndex='';a.dragNode=null;}a.field.classList.remove('cc-touching');}
 function mount(run,hooks){
  if(!enabled(run.game.id))return false;dispose();
  const s=C.create(run.game.id,run.game.level),dialog=hooks.actors.closest('dialog');run.game.goal=s.goal;
  const field=document.createElement('div');field.className='cc-field';hooks.actors.replaceChildren(field);dialog.classList.add('cc-dialog');
  if(s.id==='milk'){hooks.$('.mini-stage').style.backgroundImage='url('+root+'classic63/dairy-scene.webp)';hooks.$('.mini-stage').style.backgroundPosition='center bottom';}
  const a=active={s,field,dialog,run,hooks,caption:hooks.$('.mini-caption'),version:-1,pointer:null,disposed:false};run.classic=true;
  run.classicLayout=()=>{const b=field.getBoundingClientRect();field.style.setProperty('--unit',Math.min(b.width,b.height)+'px');if(s.id==='eggs'){const stage=hooks.$('.mini-stage').getBoundingClientRect(),w=Math.max(stage.width,stage.height*1.5),h=w/1.5,ox=(stage.width-w)/2;s.eggSources=[.14,.28,.42,.57,.71,.85].map(x=>({x:(stage.left+ox+x*w-b.left)/b.width,y:Math.max(.04,Math.min(.5,(stage.top+.32*h-b.top)/b.height))})).filter(q=>q.x>.12&&q.x<.88);if(!s.eggSources.length)s.eggSources=[{x:.5,y:.1}];}reset(a);};
  run.classicFrame=paused=>{if(paused)reset(a);};
  run.classicTick=dt=>{C.tick(s,dt);events(a);render(a);};
  field.addEventListener('pointerdown',e=>{
   if(run.paused||document.hidden||e.isPrimary===false||e.button!==0||a.pointer!==null||e.target.closest('[data-card],.cc-listen'))return;
   e.preventDefault();const node=e.target.closest('[data-drag]'),p=point(a,e);if(!C.start(s,p,node?.dataset.drag||''))return;
   a.pointer=e.pointerId;field.setPointerCapture(e.pointerId);field.classList.add('cc-touching');
   const tool=['wash','water','tuck'].includes(s.phase)?field.querySelector('.cc-tool'):node;
   if(tool&&s.phase!=='catch'&&s.phase!=='nectar'&&s.phase!=='pump'&&s.phase!=='push'){a.dragNode=tool;const box=tool.getBoundingClientRect(),f=field.getBoundingClientRect();a.dragStart={x:(box.x+box.width/2-f.x)/f.width,y:(box.y+box.height/2-f.y)/f.height};tool.style.zIndex='12';if(['wash','water','tuck'].includes(s.phase))tool.style.translate=(p.x-a.dragStart.x)*f.width+'px '+(p.y-a.dragStart.y)*f.height+'px';}
   render(a);
  });
  field.addEventListener('pointermove',e=>{
   if(e.pointerId!==a.pointer||run.paused)return;e.preventDefault();const p=point(a,e);C.move(s,p);
   if(a.dragNode){const b=field.getBoundingClientRect();a.dragNode.style.translate=(p.x-a.dragStart.x)*b.width+'px '+(p.y-a.dragStart.y)*b.height+'px';}
   const hand=field.querySelector('.cc-hand');if(hand){hand.style.left=p.x*100+'%';hand.style.top=p.y*100+'%';}events(a);render(a);
  });
  field.addEventListener('pointerup',e=>{if(e.pointerId!==a.pointer)return;e.preventDefault();if(!run.paused)C.end(s,point(a,e));reset(a,true);events(a);render(a);});
  field.addEventListener('pointercancel',e=>{if(e.pointerId===a.pointer)reset(a);});field.addEventListener('lostpointercapture',e=>{if(e.pointerId===a.pointer)reset(a);});
  scene(a);run.classicLayout();const cards=field.querySelector('.cc-cards');if(cards){const fit=()=>{const b=cards.getBoundingClientRect(),cols=s.deck.length<=6?3:4,rows=Math.ceil(s.deck.length/cols),gap=parseFloat(getComputedStyle(cards).columnGap)||8;cards.style.setProperty('--card-size',Math.floor(Math.min((b.width-gap*(cols-1))/cols,(b.height-gap*(rows-1))/rows))+'px');cards.style.setProperty('--rows',rows);};const layout=run.classicLayout;run.classicLayout=()=>{layout();fit();};fit();}render(a);return true;
 }
 function dispose(){if(!active)return;reset(active);active.disposed=true;active.dialog.classList.remove('cc-dialog');active=null;}
 window.meadowClassic={enabled,prepare,mount,dispose,intro:g=>{if(!enabled(g.id))return false;const s=C.create(g.id,g.level);window.meadowAudio?.speak(cue(g.id,s.phase));return true;},cue,text};
})();
