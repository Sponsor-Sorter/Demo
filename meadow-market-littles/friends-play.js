/* Farm friends: tangible pieces and audio-paced lessons, using the shared mini-game lifecycle. */
(() => {
 'use strict';
 const C=window.meadowFriendsCore,root='assets/generated/',basket=root+'play-pieces/harvest-basket.webp';if(!C)return;let active=null;
 const people={meadowpairs:'jade',paddockchange:'rhys',farmerpattern:'jade',barnyardlisten:'jade',gentleharvest:'jade',farmpicture:'rhys'};
 const words={
  meadowpairs:{match:'Find the matching farm friends.',home:'Bring each friend to its picture home.',done:'Everyone is home!'},
  paddockchange:{look:'Look carefully at our three friends.',restore:'Who is missing? Bring your friend back.',restored:'There you are! Lovely remembering.',done:'You remembered our farm friends!'},
  farmerpattern:{watch:'Watch and listen to our little train.',pack:'Load the foods in the same order.',train:'Here goes your little harvest train!',done:'Lovely listening and loading!'},
  barnyardlisten:{listen:'Who made that sound? Pull open their door.',pet:'Give your farm friend a gentle stroke.',happy:'What a happy farm friend!',done:'Lovely listening and gentle caring!'},
  gentleharvest:{pick:'Bring the food Jade asks for into your basket.',deliver:'Carry your full basket to the cart.',done:'Your lovely harvest is home!'},
  farmpicture:{build:'Fit the big pieces into the farm picture.',done:'You made a beautiful farm picture!'}
 };
 const pictures=['sheep','goat','cow','tractorrepair','lambcare','flowers','nest_builder','seed_to_snack','orchard_seasons','windmill_workshop','pond_balance','farm_weather'].map(id=>root+'friends66/pictures/'+id+'.webp');
 const cue=(id,phase)=>'friends66-'+people[id]+'-'+id+'-'+phase;
 const enabled=id=>C.ids.includes(id)&&(window.meadowWeeklyFair?.getQualityBuild?.()||62)>=66;
 const img=(src,alt='',cls='')=>'<img draggable="false" src="'+src+'" alt="'+alt+'" class="'+cls+'">';
 const animal=id=>root+id+'.webp',food=id=>root+'minigames/produce/'+id+'.webp';
 function object(cls,label,x,y,html,target=''){return '<div class="cc-object '+cls+'" role="img" aria-label="'+label+'" style="left:'+x*100+'%;top:'+y*100+'%" '+(target!==''?'data-friend-drag="'+target+'"':'')+'>'+html+'</div>';}
 function home(id,i,n){const q=C.pos(i,n,.76),place=id==='hen'?'coop':id==='cow'?'barn':'paddock';return object('fr-home','Home for '+id,q.x,q.y,img(root+'harvest58/'+place+'.webp')+img(animal(id),'','fr-home-sign'));}
 function nextPicture(){let stored={remaining:[],last:-1};try{stored=JSON.parse(localStorage.getItem('meadow-littles-jigsaw-v1'))||stored;}catch{}const rotate=window.meadowSlidingPicture?.rules.rotation;if(!rotate)return Math.floor(Math.random()*pictures.length);const v=rotate(Array.isArray(stored.remaining)?stored.remaining:[],stored.last);try{localStorage.setItem('meadow-littles-jigsaw-v1',JSON.stringify({remaining:v.remaining,last:v.choice}));}catch{}return v.choice;}
 function speak(a,id,done){const token=++a.voiceToken,serial=a.s.phaseSerial;Promise.resolve(window.meadowAudio?.speak(id)||0).then(duration=>{if(active!==a||token!==a.voiceToken)return;a.voiceUntil=a.s.time+(Number(duration)||0);if(a.s.phase==='happy')a.s.waitAt=Math.max(a.s.waitAt,a.voiceUntil+.15);if(done&&a.s.phaseSerial===serial)done(Number(duration)||0);});}
 function narrate(a,p,resume=false){const s=a.s;
  if(s.id==='farmerpattern'&&p==='watch')speak(a,cue(s.id,p),duration=>C.continueWatch(s,Math.max(.9,duration+.2)));
  else if(s.id==='barnyardlisten'&&p==='listen')speak(a,cue(s.id,p),duration=>{a.pendingSound={serial:s.phaseSerial,at:s.time+duration+.15,id:s.target==='hen'?'chicken':s.target};});
  else if(s.id==='barnyardlisten'&&p==='pet')speak(a,['friends66-jade-animal-'+s.target,cue(s.id,p)]);
  else if(s.id==='gentleharvest'&&p==='pick'){if(resume)speak(a,'harvest58-jade-pick-'+s.target);}
  else if(!['restored','train','happy','done'].includes(p))speak(a,cue(s.id,p));
 }
 function scene(a){const s=a.s,p=s.phase,f=a.field;a.version=s.phaseSerial;f.dataset.phase=p;f.dataset.activity=s.id;
  if(p==='done'){f.classList.add('fr-complete');a.caption.textContent=words[s.id].done;return;}
  let h='';
  if(p==='watch')a.lit=-1;
  if(s.id==='meadowpairs'){
   if(p==='match')h='<div class="cc-cards fr-cards" style="--cols:'+(s.deck.length===6?3:4)+'">'+s.deck.map((id,i)=>'<button class="cc-card" data-friend-card="'+i+'" aria-label="Friend card '+(i+1)+': hidden"><span class="cc-card-inner"><span class="cc-card-back">'+img(root+'together/card-back.svg')+'</span><span class="cc-card-front">'+img(animal(id))+'<b>'+id+'</b></span></span></button>').join('')+'</div>';
   else{const ids=[...new Set(s.deck)];h=ids.map((id,i)=>home(id,i,ids.length)+object('fr-friend','Bring home '+id,C.pos(i,ids.length,.3).x,.3,img(animal(id)),id)).join('');}
  }
  if(s.id==='paddockchange'){
   h=s.friends.map((id,i)=>{const q=C.pos(i,3,.42),missing=p==='restore'&&i===s.missing;return object('fr-friend '+(missing?'fr-missing':'')+(p==='restored'&&i===s.missing?' fr-returned':''),missing?'Missing farm friend '+(i+1):'Paddock friend '+(i+1)+': '+id,q.x,q.y,img(animal(id)));}).join('');
   if(p==='look')h+='<button class="fr-action fr-ready" data-friend-ready>Ready!</button>';
   if(p==='restore')h+='<div class="fr-choice-tray">'+C.animals.map((id,i)=>object('fr-choice','Bring back '+id,(i+.5)/4,.83,img(animal(id)),id)).join('')+'</div><button class="fr-look-again" data-friend-look>Look again</button>';
  }
  if(s.id==='farmerpattern'){
   h='<div class="fr-rails"></div><div data-wagons="'+s.pattern.length+'" class="fr-train '+(p==='train'?'fr-departing':'')+'">'+object('fr-engine','Little farm engine',.1,.4,img(root+'learning56/engine.webp'))+s.pattern.map((id,i)=>{const q=C.pos(i,s.pattern.length,.4);return object('fr-wagon','Pattern wagon '+(i+1),q.x,q.y,img(root+'learning56/carriage.webp')+'<span class="fr-wagon-food">'+img(food(id))+'</span><b>'+(i+1)+'</b>');}).join('')+'</div>';
   if(p==='pack')h+='<div class="fr-choice-tray">'+s.options.map((id,i)=>object('fr-choice','Load '+id,(i+.5)/s.options.length,.83,img(food(id)),id)).join('')+'</div>';
  }
  if(s.id==='barnyardlisten'){
   h='<div class="fr-stalls">'+C.animals.slice(0,3).map((id,i)=>{const q=C.pos(i,3,.35);return object('fr-stall '+(p!=='listen'&&id===s.target?'fr-open':''),'Open '+id+' door',q.x,q.y,'<span class="fr-stall-inside">'+img(animal(id))+'</span><span class="fr-door">'+img(animal(id),'','fr-door-picture')+'<b></b></span>',id);}).join('')+'</div>';
   // Four farm species rotate through the three picture-marked stalls.
   const ids=C.animals.slice(0,3);if(!ids.includes(s.target)){ids[2]=s.target;h='<div class="fr-stalls">'+ids.map((id,i)=>{const q=C.pos(i,3,.35);return object('fr-stall '+(p!=='listen'&&id===s.target?'fr-open':''),'Open '+id+' door',q.x,q.y,'<span class="fr-stall-inside">'+img(animal(id))+'</span><span class="fr-door">'+img(animal(id),'','fr-door-picture')+'<b></b></span>',id);}).join('')+'</div>';}
   if(p==='pet'||p==='happy')h+=object('fr-pet-friend '+(p==='happy'?'fr-loved':''),'Stroke your '+s.target,.5,.46,img(animal(s.target))+'<span class="fr-hearts" aria-hidden="true">♥ ♥ ♥</span>','pet');
   if(p==='listen'){if(a.clueRound!==s.round){a.clueRound=s.round;a.showClue=s.level<4;a.soundMisses=0;}h+='<button class="fr-action fr-ready" data-sound-clue>Picture clue</button><div class="fr-clue-place"></div>';}
  }
  if(s.id==='gentleharvest'){
   if(p==='pick')h='<div class="fr-conveyor"></div>'+s.produce.map(v=>object('fr-rolling-food',v.id+' on the moving bench',v.x,v.y,img(food(v.id)),String(v.key))).join('')+object('fr-harvest-basket','Collection basket for '+s.target,.5,.87,img(basket)+img(food(s.target),'Jade asks for '+s.target,'fr-basket-target')+'<b>'+s.caught+' / 6</b>');
   if(p==='deliver')h=object('fr-cart','Farm delivery cart',.8,.38,img(root+'learning56/trolley.webp'))+object('fr-full-basket','Carry your harvest basket',.35,.8,img(basket)+img(food(s.target),'','fr-basket-food'),'basket');
  }
  if(s.id==='farmpicture'){
   const src=pictures[s.variant];h='<div class="fr-picture-board" style="--picture:url('+src+');--cols:'+s.pieceGrid+'"><div class="fr-picture-reference"></div>'+Array.from({length:s.pieceGrid*2},(_,i)=>'<div class="fr-picture-slot" data-friend-slot="'+i+'" role="img" aria-label="Picture spot '+(i+1)+'" style="--px:'+(i%s.pieceGrid)*100/(s.pieceGrid-1)+'%;--py:'+Math.floor(i/s.pieceGrid)*100+'%"></div>').join('')+'</div><div class="fr-picture-tray" style="--cols:'+(s.pieces.length===4?2:3)+'">'+s.pieces.map(i=>'<div class="fr-picture-piece" role="img" aria-label="Farm picture piece '+(i+1)+'" data-friend-drag="'+i+'" style="--picture:url('+src+');--image-cols:'+s.pieceGrid+';--px:'+(i%s.pieceGrid)*100/(s.pieceGrid-1)+'%;--py:'+Math.floor(i/s.pieceGrid)*100+'%"></div>').join('')+'</div>';
  }
  f.innerHTML=h+'<div class="cc-sparkles" aria-hidden="true"></div><button class="cc-listen" aria-label="Farmer '+(people[s.id]==='rhys'?'Rhys':'Jade')+': listen again">'+img(root+'guides/'+people[s.id]+'.webp')+'<span aria-hidden="true">🔊</span></button>';
  a.signature='';a.dragNode=null;a.caption.textContent=words[s.id][p];
  f.querySelector('[data-friend-ready]')?.addEventListener('click',()=>{if(!a.run.paused){C.ready(s);render(a);}});
  f.querySelector('[data-friend-look]')?.addEventListener('click',()=>{if(!a.run.paused){C.lookAgain(s);render(a);}});
  f.querySelector('[data-sound-clue]')?.addEventListener('click',()=>{if(!a.run.paused){a.showClue=true;showClue(a);}});
  f.querySelectorAll('[data-friend-card]').forEach(b=>b.onclick=()=>{if(!a.run.paused&&C.card(s,+b.dataset.friendCard)){events(a);render(a);}});
  f.querySelector('.cc-listen').onclick=()=>{if(a.run.paused)return;if(s.id==='farmerpattern'){if(s.phase==='watch'){s.watchIndex=0;s.watchClock=Infinity;s.phaseSerial++;}else C.replay(s);render(a);}else if(s.id==='barnyardlisten'&&s.phase==='listen')window.meadowAudio?.play(s.target==='hen'?'chicken':s.target);else speak(a,cue(s.id,p));};
  narrate(a,p);
  if(p==='happy')s.waitAt=Math.max(s.waitAt,a.voiceUntil+.15||0);
  if(s.id==='barnyardlisten'&&p==='listen')showClue(a);
  layout(a);
 }
 function events(a){for(const e of a.s.events.splice(0)){
  if(e.type==='success'){window.meadowAudio?.play('care');const star=document.createElement('i');star.textContent='✦';star.style.left=(25+Math.random()*50)+'%';a.field.querySelector('.cc-sparkles')?.append(star);a.hooks.later(()=>star.remove(),800);}
  if(e.type==='retry'){window.meadowAudio?.play('tap');a.caption.textContent='Look at the pictures. You can try again!';if(a.s.id==='barnyardlisten'&&a.s.phase==='listen'&&++a.soundMisses>=2){a.showClue=true;showClue(a);}}
  if(e.type==='animalName')speak(a,'friends66-jade-animal-'+e.id);
  if(e.type==='findFood')speak(a,'harvest58-jade-pick-'+e.id);
  if(e.type==='patternWord'){a.lit=e.index;speak(a,'produce-'+e.id,duration=>C.continueWatch(a.s,Math.max(.9,duration+.2)));}
 }}
 function render(a){if(active!==a)return;const s=a.s;if(a.version!==s.phaseSerial)scene(a);a.run.score=s.score;
  const signature=[s.phase,s.score,s.open.join(','),s.matched.join(','),s.homes.join(','),s.loaded.join(','),s.placed.join(','),a.lit].join('|');
  if(signature!==a.signature){a.signature=signature;a.hooks.$('#mini-count').textContent=s.score+' / '+s.goal+' helping steps';a.hooks.$('#mini-timer').textContent='Take your time';a.hooks.$('#mini-status').textContent='Listen · Remember · Help';
   a.field.querySelectorAll('[data-friend-card]').forEach(b=>{const i=+b.dataset.friendCard,show=s.open.includes(i)||s.matched.includes(i);b.classList.toggle('is-open',show);b.classList.toggle('is-matched',s.matched.includes(i));b.disabled=s.matched.includes(i);b.setAttribute('aria-label','Friend card '+(i+1)+': '+(show?s.deck[i]:'hidden'));});
   if(s.id==='meadowpairs'&&s.phase!=='match'){const ids=[...new Set(s.deck)];a.field.querySelectorAll('.fr-friend').forEach((n,i)=>{n.style.top=(s.homes.includes(ids[i])?76:30)+'%';n.classList.toggle('fr-home-safe',s.homes.includes(ids[i]));});}
   a.field.querySelectorAll('.fr-wagon').forEach((n,i)=>{const lit=s.phase==='watch'&&a.lit===i,loaded=i<s.loaded.length||s.phase==='train';n.style.setProperty('--portrait-left',((s.pattern.length===2?[.4,.75]:[.33,.59,.85])[i]*100)+'%');n.classList.toggle('fr-wagon-lit',lit);n.classList.toggle('fr-wagon-loaded',loaded);n.setAttribute('aria-label','Pattern wagon '+(i+1)+': '+(lit||loaded?s.pattern[i]:'empty'));});
   a.field.querySelectorAll('[data-friend-slot]').forEach(n=>n.classList.toggle('fr-fitted',s.placed.includes(+n.dataset.friendSlot)));
   a.field.querySelectorAll('.fr-picture-piece').forEach(n=>n.hidden=s.placed.includes(+n.dataset.friendDrag));
  }
  if(s.phase==='pick')a.field.querySelectorAll('.fr-rolling-food').forEach(n=>{const v=s.produce.find(v=>String(v.key)===n.dataset.friendDrag);n.style.left=v.x*100+'%';n.style.rotate=(s.time*v.dir*15)+'deg';});
  if(s.done&&s.id==='gentleharvest'){const basket=a.field.querySelector('.fr-full-basket');if(basket){basket.style.left='80%';basket.style.top='38%';}}
  if(s.done&&!a.ending){a.ending=true;a.hooks.later(()=>{if(active===a)a.hooks.finish(true);},1600);}
 }
 function showClue(a){const place=a.field.querySelector('.fr-clue-place');if(!place||!a.showClue)return;place.innerHTML=object('fr-sound-clue','Picture clue: '+a.s.target,.5,.82,img(animal(a.s.target)));const button=a.field.querySelector('[data-sound-clue]');if(button)button.hidden=true;}
 function layout(a){const r=a.field.getBoundingClientRect();a.field.style.setProperty('--unit',Math.min(r.width,r.height)+'px');const board=a.field.querySelector('.cc-cards');if(board){const b=board.getBoundingClientRect(),cols=a.s.deck.length===6?3:4,rows=Math.ceil(a.s.deck.length/cols),gap=parseFloat(getComputedStyle(board).columnGap)||8;board.style.setProperty('--card-size',Math.floor(Math.min((b.width-gap*(cols-1))/cols,(b.height-gap*(rows-1))/rows))+'px');board.style.setProperty('--rows',rows);}
  const slots=[...a.field.querySelectorAll('[data-friend-slot]')];if(slots.length)a.s.slots=slots.map(n=>{const b=n.getBoundingClientRect();return {x:(b.x+b.width/2-r.x)/r.width,y:(b.y+b.height/2-r.y)/r.height};});reset(a);
 }
 function point(a,e){const r=a.field.getBoundingClientRect();return {x:(e.clientX-r.x)/r.width,y:(e.clientY-r.y)/r.height};}
 function reset(a){C.cancel(a.s);a.pointer=null;if(a.dragNode){a.dragNode.style.translate='';a.dragNode.style.zIndex='';a.dragNode=null;}a.field.querySelectorAll('.fr-stall:not(.fr-open) .fr-door').forEach(n=>n.style.rotate='');a.field.classList.remove('fr-touching');}
 function mount(run,hooks){if(!enabled(run.game.id))return false;dispose();const s=C.create(run.game.id,run.game.level,Math.random,run.game.id==='farmpicture'?nextPicture():0),dialog=hooks.actors.closest('dialog'),field=document.createElement('div');field.className='cc-field fr-field';hooks.actors.replaceChildren(field);dialog.classList.add('cc-dialog');
  if(s.id==='barnyardlisten'){hooks.$('.mini-stage').style.backgroundImage='url('+root+'classic63/dairy-scene.webp)';hooks.$('.mini-stage').style.backgroundPosition='center bottom';}
  if(s.id==='paddockchange')hooks.$('.mini-stage').style.backgroundImage='url('+root+'bee-shelter/meadow.webp)';
  const a=active={s,run,hooks,dialog,field,caption:hooks.$('.mini-caption'),version:-1,pointer:null,voiceToken:0,voiceUntil:0,lit:-1};hooks.$('.mini-header h2').textContent=({meadowpairs:'Farm Friend Pairs',paddockchange:'Who’s Missing?',farmerpattern:'Copy the Pattern',barnyardlisten:'Who Made That Sound?',gentleharvest:'Moving Harvest',farmpicture:'Farm Picture Puzzle'})[s.id];run.classic=true;run.game.goal=s.goal;run.resultVoice=cue(s.id,'done');run.classicLayout=()=>layout(a);
  run.classicFrame=paused=>{field.classList.toggle('fr-paused',paused);if(paused){reset(a);if(!a.wasPaused){a.voiceToken++;a.pendingSound=null;window.meadowAudio?.stopVoice();}}else if(a.wasPaused){if(s.id==='farmerpattern'&&s.phase==='watch'){s.watchIndex=0;s.watchClock=Infinity;a.lit=-1;a.signature='';}narrate(a,s.phase,true);}a.wasPaused=paused;};
  run.classicTick=dt=>{C.tick(s,dt);if(a.pendingSound&&(s.phaseSerial!==a.pendingSound.serial||s.phase!=='listen'))a.pendingSound=null;if(a.pendingSound&&s.time>=a.pendingSound.at){const id=a.pendingSound.id;a.pendingSound=null;window.meadowAudio?.play(id);}events(a);render(a);};
  field.addEventListener('pointerdown',e=>{if(run.paused||document.hidden||e.isPrimary===false||e.button!==0||a.pointer!==null||e.target.closest('button'))return;const node=e.target.closest('[data-friend-drag]');if(!node&&s.phase!=='pet')return;e.preventDefault();const p=point(a,e);if(!C.start(s,p,node?.dataset.friendDrag||'pet'))return;a.pointer=e.pointerId;field.setPointerCapture(e.pointerId);a.down=p;if(node&&s.phase!=='listen'&&s.phase!=='pet'){a.dragNode=node;node.style.zIndex='20';}field.classList.add('fr-touching');});
  field.addEventListener('pointermove',e=>{if(e.pointerId!==a.pointer||run.paused)return;e.preventDefault();const p=point(a,e);C.move(s,p);if(a.dragNode){const r=field.getBoundingClientRect();a.dragNode.style.translate=(p.x-a.down.x)*r.width+'px '+(p.y-a.down.y)*r.height+'px';}if(s.phase==='listen'){const door=field.querySelector('[data-friend-drag="'+s.gesture?.target+'"] .fr-door');if(door)door.style.rotate='y '+Math.min(75,Math.abs(p.x-a.down.x)*250)+'deg';}events(a);render(a);});
  field.addEventListener('pointerup',e=>{if(e.pointerId!==a.pointer)return;e.preventDefault();if(!run.paused)C.end(s,point(a,e));reset(a);events(a);render(a);});
  const cancel=e=>{if(e.pointerId===a.pointer)reset(a);};field.addEventListener('pointercancel',cancel);field.addEventListener('lostpointercapture',cancel);scene(a);render(a);return true;
 }
 function dispose(){if(!active)return;reset(active);active.voiceToken++;active.dialog.classList.remove('cc-dialog');active=null;}
 function prepare(g){if(!enabled(g.id))return g;const s=C.create(g.id,g.level);return {...g,goal:s.goal,time:0,relaxed:true,text:words[g.id][s.phase]};}
 window.meadowFriends={enabled,prepare,mount,dispose,cue,words,pictures,intro:g=>{if(!enabled(g.id))return false;const s=C.create(g.id,g.level);window.meadowAudio?.speak(cue(g.id,s.phase));return true;}};
})();
