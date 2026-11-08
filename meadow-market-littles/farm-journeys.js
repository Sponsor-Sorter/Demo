/* Longer farm activities, real movement and visible outcomes. All timers belong to the adventure. */
(() => {
  'use strict';
  const instruction=(a,key)=>window.meadowJourneyAudio?.instruction(a,key)||Promise.resolve(0);
  const engine=window.meadowFarmAdventures,base='assets/generated/',piece=id=>base+'play-pieces/'+id+'.webp';
  const sources={nest:piece('nest'),straw:piece('hay-bale'),leaves:piece('soft-leaves'),wool:piece('soft-wool'),duck:piece('duck'),basket:piece('harvest-basket'),water:base+'animal-care/water.webp',cloth:base+'animal-care/cloth.webp',ball:base+'animal-care/ball.webp',apple:base+'minigames/produce/apple.webp',carrot:base+'minigames/produce/carrot.webp'};
  const src=id=>id.startsWith('cloud-')?base+'farm-journeys/'+id+'.webp':sources[id]||(['hen','cow','sheep','goat'].includes(id)?base+id+'.webp':piece(id));
  const image=(id,cls='',alt='')=>'<img draggable="false" src="'+src(id)+'" class="'+cls+'" alt="'+alt+'">';
  const animal=(id,cls='')=>'<div class="fj-friend '+cls+'">'+image(id,'',id)+'</div>';
  const action=(id,label)=>'<button class="fa-action" data-journey="'+id+'">'+label+'</button>';
  const tray=(a,items)=>items.map(([id,label])=>a.piece(id,label,src(id))).join('');
  function arrive(a,node,animation='fj-arrive'){if(!node)return;node.classList.add(animation);a.later(()=>node.classList.remove(animation),1100);}
  function stage(a,title,scene,tools,done,total,help){if(['nest','seed','weather','kindness'].includes(a.g.kind))a.g.image=base+'play-scenes/music-meadow.webp';a.shell(title,scene,tools,done,total,help);a.root.classList.add('fj-screen');}
  function laterPhase(a,fn,ms=1200){if(a.busy||a.finished)return;a.busy=true;a.root.querySelectorAll('[data-fa-target],[data-journey]').forEach(n=>n.disabled=true);a.later(()=>{a.busy=false;fn();},ms);}
  function travel(before,after,rect){return [before,after].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=rect.left&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom)?Math.min(50,Math.hypot(after.x-before.x,after.y-before.y)):0;}
  function rub(a,node,required,done,label){
    let finger=null,total=0,finished=false;
    const progress=document.createElement('div');progress.className='fj-work-meter';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label',label);progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');progress.setAttribute('aria-valuenow','0');progress.innerHTML='<span></span>';node.append(progress);
    const finish=()=>{if(finished||a.busy||a.finished)return;finished=true;finger=null;a.sound('care');done();};
    node.addEventListener('pointerdown',e=>{if(e.button>0||finger||finished||a.busy||a.finished)return;e.preventDefault();e.stopPropagation();finger={id:e.pointerId,x:e.clientX,y:e.clientY};node.setPointerCapture?.(e.pointerId);});
    node.addEventListener('pointermove',e=>{if(!finger||finger.id!==e.pointerId||finished)return;const next={x:e.clientX,y:e.clientY};total+=travel(finger,next,node.getBoundingClientRect());finger={id:e.pointerId,...next};const percent=Math.min(100,Math.round(total/required*100));progress.style.setProperty('--work',percent+'%');progress.setAttribute('aria-valuenow',percent);node.style.setProperty('--work',percent+'%');node.style.setProperty('--work-ratio',percent/100);if(total>=required)finish();});
    const end=e=>{if(finger?.id===e.pointerId)finger=null;};node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);node.addEventListener('lostpointercapture',end);
    node.addEventListener('click',e=>{if(e.detail===0)finish();});
  }
  function addRub(a,selector,required,done,label){const n=a.root.querySelector(selector);if(n)rub(a,n,required,done,label);}
  const nest={
    assets:[base+'play-scenes/music-meadow.webp',src('duck')],
    render(a){a.journeyPhase ||= 'line';const phase=a.journeyPhase;let body='<div class="fj-nest">'+image('nest')+'<div class="fj-nest-lining">'+a.parts.map((id,i)=>image(id,'fj-lining fj-line-'+i)).join('')+'</div></div>';
      if(phase==='line')body+=a.target('nest','Add soft lining','','left:50%;top:53%;width:70%;height:60%',a.selected||'straw');
      if(phase==='smooth')body+='<button class="fj-rub fj-nest-smooth" data-smooth aria-label="Smooth the soft nest lining"><span class="fj-finger" aria-hidden="true"></span></button>';
      if(phase==='hatch')body+='<div class="fj-eggs">'+[0,1,2].map(i=>'<button class="fj-egg '+(a.hatched?.includes(i)?'hatched':'')+'" data-egg="'+i+'" aria-label="'+(a.hatched?.includes(i)?'Duckling '+(i+1):'Gently warm egg '+(i+1))+'" '+(a.hatched?.includes(i)?'disabled':'')+'>'+(a.hatched?.includes(i)?image('duck'):'<span class="fj-shell"><i></i></span>')+'</button>').join('')+'</div>';
      stage(a,phase==='line'?'Make a soft, cosy nest':phase==='smooth'?'Smooth the nest lining':'Warm the eggs for the ducklings',body,phase==='line'?tray(a,[['straw','Soft straw'],['leaves','Soft leaves'],['wool','Cloud’s wool']]):'<p class="fj-small-prompt">'+(phase==='smooth'?'Rub the nest gently':'Gently rub each egg')+'</p>',phase==='hatch'?4+(a.hatched?.length||0):phase==='smooth'?3:a.parts.length,7,phase==='line'?'Bring one of each soft material to the nest.':phase==='smooth'?'Move your finger around the nest to make it smooth.':'Gently warm each egg. Watch your ducklings hatch!');
      instruction(a,'nest-'+phase);a.root.querySelectorAll('[data-fa-piece]').forEach(n=>n.disabled=a.parts.includes(n.dataset.faPiece));
      if(phase==='smooth')addRub(a,'[data-smooth]',220,()=>laterPhase(a,()=>{a.journeyPhase='hatch';a.hatched=[];a.render();}), 'Nest lining smoothed');
      if(phase==='hatch')a.root.querySelectorAll('[data-egg]:not(:disabled)').forEach(n=>rub(a,n,95,()=>{const id=+n.dataset.egg;if(a.hatched.includes(id))return;a.hatched.push(id);n.classList.add('hatching');n.innerHTML=image('duck');n.disabled=true;a.root.querySelector('.fa-progress').outerHTML=a.meter(4+a.hatched.length,7);if(a.hatched.length===3)laterPhase(a,()=>a.win('You made a cosy nest and helped three ducklings hatch!'),1800);},'Egg warmed'));
    },
    select(a){a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.dataset.accept=a.selected);},
    accept(a,target,id){if(a.busy||a.parts.includes(id))return;a.parts.push(id);a.render();if(a.parts.length===3)laterPhase(a,()=>{a.journeyPhase='smooth';a.render();});}
  };
  engine.register('nest',nest);
  const garden={
    assets:[base+'play-scenes/music-meadow.webp',...(['carrot','water','sheep','goat'].map(src))],
    render(a){a.journeyPhase ||= 'plant';const phase=a.journeyPhase;let body='<div class="fa-garden-bed"></div>';
      if(phase==='plant'||phase==='water')for(let i=0;i<3;i++){body+='<div class="fa-garden-plant" style="left:'+(23+i*27)+'%">'+(a.parts.includes(i)?phase==='water'?image('leaves','fj-grown'): '<span class="fa-tiny-shoot"><i></i><i></i></span>':'')+'</div>'+a.target('soil-'+i,(phase==='plant'?'Plant seed ':'Water plant ')+(i+1),'','left:'+(23+i*27)+'%;top:61%;width:23%;height:38%',phase==='plant'?'carrot':'water');}
      if(phase==='pick')body+=[0,1,2].map(i=>a.parts.includes(i)?'':'<button class="fj-pick-carrot" data-fa-piece="carrot-'+i+'" aria-label="Pick carrot '+(i+1)+'" style="left:'+(20+i*24)+'%">'+image('carrot')+'</button>').join('')+'<div class="fj-harvest-basket">'+image('basket')+a.parts.map(()=>image('carrot','fj-packed')).join('')+'</div>'+a.target('basket','Put carrots in the basket','','left:83%;top:77%;width:30%;height:40%','carrot-0');
      if(phase==='wash')body='<div class="fj-wash-tray">'+[0,1,2].map(i=>'<button class="fj-wash-carrot '+(a.parts.includes(i)?'washed':'')+'" data-wash="'+i+'" aria-label="Wash carrot '+(i+1)+'" '+(a.parts.includes(i)?'disabled':'')+'>'+image('carrot')+'<span class="fj-dirt"></span></button>').join('')+'</div><div class="fj-water-ribbons" aria-hidden="true"></div>';
      if(phase==='share')body=animal('sheep')+animal('goat','fj-second')+'<div class="fj-harvest-basket">'+image('basket')+'</div>'+[0,1].map(i=>a.target('friend-'+i,'Share with '+(i?'Clover':'Cloud'),a.parts.includes(i)?image('carrot'):'','left:'+(27+i*46)+'%;top:72%;width:30%;height:25%','carrot')).join('');
      const phases=['plant','water','pick','wash','share'],count=phase==='share'?12+a.parts.length:phases.indexOf(phase)*3+a.parts.length;
      stage(a,{plant:'Plant your carrot garden',water:'Water and watch it grow',pick:'Pull your carrots from the soil',wash:'Wash your crunchy carrots',share:'Share the harvest with your friends'}[phase],body,['plant','water','share'].includes(phase)?tray(a,[[phase==='water'?'water':'carrot',phase==='plant'?'Carrot seeds':phase==='water'?'Fresh water':'Carrot to share']]):'<p class="fj-small-prompt">'+(phase==='wash'?'Rub the muddy carrots clean':'Move the carrots into your basket')+'</p>',count,14,{plant:'Bring the carrot seeds to each patch of soil.',water:'Give each little plant a drink. Watch the leaves grow!',pick:'Pull each carrot from the soil and carry it to the basket.',wash:'Rub each carrot to wash the mud away.',share:'A crunchy carrot for each friend. You grew these yourself!'}[phase]);
      instruction(a,'garden-'+phase);a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.disabled=a.parts.includes(+n.dataset.faTarget.split('-')[1]));
      if(phase==='plant')a.root.querySelector('[data-fa-piece]').innerHTML='<span class="fa-seed-packet">'+image('carrot')+'<i></i></span><span>Carrot seeds</span>';
      if(phase==='wash')a.root.querySelectorAll('[data-wash]:not(:disabled)').forEach(n=>rub(a,n,150,()=>{const i=+n.dataset.wash;if(a.parts.includes(i))return;a.parts.push(i);n.classList.add('washed');n.disabled=true;a.root.querySelector('.fa-progress').outerHTML=a.meter(9+a.parts.length,14);garden.advance(a,3,'share');},'Carrot washed'));
    },
    select(a){if(['pick','share'].includes(a.journeyPhase))a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.dataset.accept=a.selected);},
    advance(a,goal,next){if(a.parts.length!==goal)return;laterPhase(a,()=>{if(!next)return a.win('You planted, watered, picked, washed and shared your carrots!');a.journeyPhase=next;a.parts=[];a.render();},1400);},
    accept(a,target,id){const phase=a.journeyPhase,i=+(phase==='pick'?id:target).split('-')[1];if(a.parts.includes(i))return;a.parts.push(i);a.render();a.sound(phase==='water'?'water':phase==='pick'?'harvest':'plant');garden.advance(a,phase==='share'?2:3,{plant:'water',water:'pick',pick:'wash'}[phase]);}
  };
  engine.register('seed',garden);
  const outfits=[{name:'Rainy',key:'rainy',items:['raincoat','rain-boots'],action:'Splash through the puddles'},{name:'Sunny',key:'sunny',items:['sun-hat'],action:'Gather sunny meadow flowers'},{name:'Windy',key:'windy',items:['scarf','raincoat'],action:'Catch the breezy fallen leaves'}];
  const labels={raincoat:'Raincoat','rain-boots':'Rain boots','sun-hat':'Sun hat',scarf:'Cosy scarf'};
  const weather={
    assets:[base+'play-scenes/music-meadow.webp',...['rainy','sunny','windy'].map(key=>base+'farm-journeys/cloud-'+key+'.webp')],
    render(a){a.journeyPhase ||= 'dress';a.outfitParts ||= [];const look=outfits[a.round],outside=a.journeyPhase==='outside',ready=look.items.every(id=>a.outfitParts.includes(id));
      let body='<div class="fa-weather-badge '+look.key+'"><span></span><b>'+look.name+'</b></div><div class="fj-dressed-friend">'+image(ready?'cloud-'+look.key:'sheep','fj-sheep','Cloud')+'</div>'+(!ready?'<div class="fj-outfit-rack">'+a.outfitParts.map(id=>image(id)).join('')+'</div>':'')+'<div class="fa-weather-particles '+look.key+'" aria-hidden="true">'+Array.from({length:12},(_,i)=>'<i style="--i:'+i+'"></i>').join('')+'</div>';
      if(!outside)body+=look.items.filter(id=>!a.outfitParts.includes(id)).map(id=>a.target('wear-'+id,'Help Cloud with the '+labels[id].toLowerCase(),image(id),'left:'+(id==='sun-hat'?50:look.items.indexOf(id)===1?68:32)+'%;top:'+(id==='sun-hat'?18:71)+'%;width:30%;height:28%',id)).join('');
      else body+='<div class="fj-outing-items">'+[0,1,2].map(i=>'<button data-outing="'+i+'" class="fj-outing '+look.key+' '+(a.parts.includes(i)?'done':'')+'" aria-label="'+(look.key==='rainy'?'Splash in puddle ':look.key==='sunny'?'Pick flower ':'Catch leaves ')+(i+1)+'" '+(a.parts.includes(i)?'disabled':'')+'>'+(look.key==='sunny'?'<img draggable="false" src="'+base+'flower-patch.webp" alt="">':look.key==='windy'?image('leaves'):'<span></span>')+'</button>').join('')+'</div>';
      stage(a,outside?look.action:'Help Cloud dress for '+look.name.toLowerCase()+' weather',body,outside?'<p class="fj-small-prompt">'+look.action+'</p>':tray(a,Object.entries(labels)),a.round*4+(outside?1+a.parts.length:0),12,outside?(look.key==='rainy'?'Rub each puddle to make a lovely splash!':look.key==='sunny'?'Pick a little flower from each meadow patch.':'Rub over each fluttering leaf pile to gather it.'):'Move the matching clothes to Cloud. Then head outside together.');
      instruction(a,outside?'weather-'+look.key:'weather-dress');if(outside)a.root.querySelectorAll('[data-outing]:not(:disabled)').forEach(n=>{const done=()=>{const i=+n.dataset.outing;if(a.parts.includes(i))return;a.parts.push(i);n.classList.add('done');n.disabled=true;arrive(a,a.root.querySelector('.fj-dressed-friend'),'fj-splash');a.sound(look.key==='rainy'?'water':'harvest');a.root.querySelector('.fa-progress').outerHTML=a.meter(a.round*4+1+a.parts.length,12);if(a.parts.length===3)laterPhase(a,()=>{a.round++;a.parts=[];a.outfitParts=[];a.journeyPhase='dress';if(a.round===3)a.win('You helped Cloud dress and play in three kinds of weather!');else a.render();},1500);};if(look.key==='sunny')n.onclick=done;else rub(a,n,100,done,look.key==='rainy'?'Puddle splashed':'Leaves gathered');});
    },
    accept(a,target,id){if(a.outfitParts.includes(id))return;a.outfitParts.push(id);a.render();if(outfits[a.round].items.every(item=>a.outfitParts.includes(item)))laterPhase(a,()=>{a.journeyPhase='outside';a.parts=[];a.render();});}
  };
  engine.register('weather',weather);
  const laundry={
    assets:[src('basket')],
    render(a){a.journeyPhase ||= 'hang';a.pegs ||= [];a.collected ||= [];const look=outfits[a.round],phase=a.journeyPhase;
      if(phase==='hang'){a.renderBase();a.root.classList.add('fj-screen');instruction(a,look.items.every(id=>a.parts.includes(id))?'laundry-peg':'laundry-hang');return;}
      let body='<div class="fa-clothes-rope"></div>'+look.items.map((id,i)=>a.collected.includes(id)?'':'<div class="fa-hung-clothes '+(phase==='collect'?'fj-dry':'fj-damp')+'" style="left:'+(look.items.length===1?50:29+i*42)+'%">'+(phase==='collect'?'<button class="fj-hanging-piece" data-fa-piece="'+id+'" aria-label="Collect '+labels[id]+'">'+image(id)+'</button>':image(id))+'<i></i></div>').join('');
      if(phase==='dry')body+='<button class="fj-dry-air fj-rub" data-dry aria-label="Send a breeze to dry the washing"><span class="fj-finger" aria-hidden="true"></span></button>';
      if(phase==='collect')body+='<div class="fj-laundry-basket">'+image('basket')+a.collected.map(id=>image(id,'fj-folded')).join('')+'</div>'+a.target('basket','Put dry washing in the basket','','left:50%;top:82%;width:45%;height:30%',look.items.find(id=>!a.collected.includes(id)));
      stage(a,phase==='dry'?'Send a breeze to dry the washing':'Collect your dry washing',body,'<p class="fj-small-prompt">'+(phase==='dry'?'Swipe back and forth through the washing':'Move each dry item into your basket')+'</p>',a.round*3+(phase==='dry'?1:2),9,phase==='dry'?'Move your finger back and forth. Watch the washing flutter and dry.':'Take each piece off the line and carry it into the basket.');
      instruction(a,'laundry-'+phase);if(phase==='dry')addRub(a,'[data-dry]',260,()=>{a.root.querySelectorAll('.fa-hung-clothes').forEach(n=>n.classList.add('fj-dried'));laterPhase(a,()=>{a.journeyPhase='collect';a.render();});},'Washing dried');
    },
    select(a){if(a.journeyPhase==='collect')a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.dataset.accept=a.selected);},
    accept(a,target,id){if(a.journeyPhase==='collect'){if(a.collected.includes(id))return;a.collected.push(id);a.render();if(a.collected.length===outfits[a.round].items.length){a.root.querySelector('.fa-progress').outerHTML=a.meter(a.round*3+3,9);laterPhase(a,()=>{a.round++;a.parts=[];a.pegs=[];a.collected=[];a.journeyPhase='hang';if(a.round===3)a.win('You hung, pegged, dried and collected all the farm washing!');else a.render();});}return;}
      if(id==='peg')a.pegs.push(target.slice(4));else a.parts.push(id);a.render();const look=outfits[a.round];if(look.items.every(id=>a.parts.includes(id)&&a.pegs.includes(id)))laterPhase(a,()=>{a.journeyPhase='dry';a.render();});
    }
  };
  engine.register('clothesline',laundry);
  const kindness={
    assets:[base+'play-scenes/music-meadow.webp',...['sheep','goat','hen','cow','apple','carrot','water','ball'].map(src)],
    select(a){a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.dataset.accept=a.needs[+n.dataset.faTarget.split('-')[1]]);},
    render(a){const friends=[['sheep','goat'],['hen','cow'],['cow','sheep']][a.round],needs=[['apple','carrot'],['water','water'],['ball','ball']][a.round];a.needs=needs;
      let body=friends.map((id,i)=>'<div class="fj-kind-friend '+(i?'fj-second':'')+' '+(a.parts.includes(i)?'fj-thank-you':'')+'">'+image(id,'',id)+'<div class="fj-need-picture">'+image(needs[i])+'</div></div>'+a.target('friend-'+i,'Help the '+id,a.parts.includes(i)?image(needs[i]):'','left:'+(27+i*46)+'%;top:75%;width:32%;height:27%',needs[i])).join('');
      stage(a,['Share a little farm snack','Bring fresh water to your friends','Bring everyone into the game'][a.round],body,tray(a,a.round===0?[['apple','Crunchy apple'],['carrot','Crunchy carrot']]:a.round===1?[['water','Fresh water'],['apple','Apple']]:[['ball','Play ball'],['carrot','Carrot']]),a.round*2+a.parts.length,6,a.round===0?'Look at the little picture. Bring each friend their snack.':a.round===1?'Both friends need a drink. Bring water to each bowl.':'Invite each friend to play. No one gets left out.');
      instruction(a,'kindness-'+['snack','water','play'][a.round]);a.root.dataset.caring=a.round;a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.disabled=a.parts.includes(+n.dataset.faTarget.split('-')[1]));
    },
    accept(a,target,id){const i=+target.split('-')[1];if(a.parts.includes(i))return;a.parts.push(i);a.render();const friend=a.root.querySelectorAll('.fj-kind-friend')[i];arrive(a,friend,a.round===2?'fj-play-ball':'fj-arrive');a.sound(a.round===1?'water':'care');if(a.parts.length===2)laterPhase(a,()=>{a.round++;a.parts=[];if(a.round===3)a.win('You shared snacks, brought fresh water and included everyone in the game!');else a.render();},1800);}
  };
  engine.register('kindness',kindness);
  const seasons={
    render(a){a.renderBase();a.root.classList.add('fj-screen');if(a.round===0){a.root.querySelector('.fa-orchard-tree').classList.add('fj-seedling');}if(a.round===2)a.root.querySelectorAll('.fa-tree-apple').forEach((n,i)=>n.style.setProperty('--fruit-delay',i*.16+'s'));if(a.round===3)a.root.querySelector('.fa-stage').insertAdjacentHTML('beforeend','<div class="fj-falling-leaves" aria-hidden="true">'+[0,1,2,3].map(i=>'<span style="--i:'+i+'">'+image('leaves')+'</span>').join('')+'</div>');},
    accept(a,target,id){if(a.round===3){a.parts.push('leaves');a.render();if(a.parts.length===2)laterPhase(a,()=>{a.root.querySelector('.fa-orchard-tree').classList.add('fj-spring-return');a.say('Your tree is snug. Watch a new spring begin!');Promise.resolve(instruction(a,'spring-return')).then(seconds=>a.later(()=>a.win('You cared for the orchard through the whole year. Spring comes again!'),Math.max(2200,seconds*1000+300)));},400);return;}a.acceptBase(target,id);}
  };
  engine.register('seasons',seasons);
  const bridge={
    assets:[src('goat'),base+'flower-patch.webp'],
    render(a){if(!a.crossingPhase){a.renderBase();a.root.classList.add('fj-screen');instruction(a,'bridge-fit');return;}a.renderBase();a.root.classList.add('fj-screen','fj-bridge-ready');const target=a.root.querySelector('[data-fa-target]');target.classList.add('fa-fitted');target.disabled=true;a.root.querySelector('.fa-tray').innerHTML='<p class="fj-small-prompt">Guide Clover across the bridge</p>';a.say('Slide your finger across the bridge to guide Clover safely home.');instruction(a,'bridge-guide');const area=a.root.querySelector('.fa-stage'),goat=a.root.querySelector('.fa-crossing-goat');
      const guide=document.createElement('button');guide.className='fj-cross-guide';guide.setAttribute('aria-label','Guide Clover over the bridge');guide.innerHTML='<span class="fj-finger" aria-hidden="true"></span>';area.append(guide);rub(a,guide,220,()=>{goat.classList.add('crossing');laterPhase(a,()=>{a.crossingPhase=false;a.nextRound(3,'You built three bridges and guided Clover safely across!');},2200);},'Bridge crossed');},
    accept(a){if(a.crossingPhase)return;a.crossingPhase=true;a.render();}
  };
  engine.register('bridge',bridge);
  const post={
    assets:[...['hen','cow','sheep','apple','carrot'].map(src),base+'flower-patch.webp'],
    render(a){a.renderBase();a.root.classList.add('fj-screen');instruction(a,a.parts.length?'post-deliver':'post-stamp');if(a.parts.length){a.root.querySelector('.fa-letterbox').remove();const ids=['hen','cow','sheep'];a.root.querySelector('.fa-stage').insertAdjacentHTML('beforeend','<div class="fj-mailboxes">'+ids.map(id=>'<div class="fj-mailbox">'+image('letterbox')+'<span>'+image(id)+'</span>'+a.target('mail-'+id,'Deliver to '+({hen:'Pip',cow:'Daisy',sheep:'Cloud'}[id]),'','','postcard-'+id)+'</div>').join('')+'</div>');a.say('Match the friend on your postcard to the same friend’s letterbox.');a.root.querySelector('[data-fa-piece]').dataset.faPiece='postcard-'+a.friend[0];}},
    select(a){if(!a.parts.length)a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.dataset.accept=a.selected);},
    accept(a,target,id){if(!a.parts.length){a.acceptBase(target,id);return;}if(a.busy)return;const n=a.root.querySelector('[data-fa-target="'+target+'"]');n.closest('.fj-mailbox').classList.add('fj-mail-arrives');a.root.querySelector('.fa-postcard').classList.add('posting');a.say('A picture postcard for '+a.friend[1]+'!');a.sound('harvest');laterPhase(a,()=>a.nextRound(3,'You made three postcards and delivered each to the right friend!'),2000);}
  };
  engine.register('postoffice',post);
  for(const kind of ['haystack','balance','market','parade'])engine.register(kind,{
    assets:kind==='market'?['apple','carrot','tomato','corn','pumpkin','strawberry'].map(id=>base+'minigames/produce/'+id+'.webp'):kind==='parade'?['hen','cow','sheep','goat'].map(src):[],
    render(a){a.renderBase();a.root.classList.add('fj-screen');if(kind==='haystack'){const stack=a.root.querySelectorAll('.fa-hay-stack')[a.round],top=stack?.querySelector('.fa-stacked-bale:last-child');if(a.parts.length&&top){top.classList.add('fj-bale-land');top.style.setProperty('--bale-delay','0s');}}if(kind==='balance'&&a.parts.length)a.root.querySelector('.fa-settled-duck[data-pad="'+a.parts.at(-1)+'"]')?.classList.add('fj-duck-swim');if(kind==='market')a.root.querySelector('.fa-customer').classList.add('fj-neighbour-wave');if(kind==='parade')a.root.querySelector('.fa-parade-friend').insertAdjacentHTML('beforeend','<span class="fj-parade-dust" aria-hidden="true"></span>');},
    accept(a,target,id){a.acceptBase(target,id);}
  });
  window.meadowFarmJourneys={rules:{travel}};
})();
