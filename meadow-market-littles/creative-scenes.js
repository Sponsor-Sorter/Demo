/* Illustrated, hands-on creative play. Uses the same scoped input/timer lifecycle as farm adventures. */
(() => {
  'use strict';
  const engine=window.meadowFarmAdventures,base='assets/generated/',animals=['hen','cow','sheep','goat'],food=['apple','carrot','tomato','corn','pumpkin','strawberry'];
  const words=[['apple','A'],['banana','B'],['carrot','C'],['pumpkin','P'],['strawberry','S'],['watermelon','W']];
  const label=id=>({hen:'Hen',cow:'Cow',sheep:'Lamb',goat:'Goat',tractor:'Tractor',flower:'Flowers',tower:'Windmill',hay:'Hay bale',nest:'Nest',spoon:'Wooden spoon'}[id]||id[0].toUpperCase()+id.slice(1));
  const art=id=>base+(animals.includes(id)?id+'.webp':id==='flower'?'flower-patch.webp':id==='tractor'?'tractor/tractor.webp':({tower:'play-pieces/windmill-tower.webp',hay:'play-pieces/hay-bale.webp',nest:'play-pieces/nest.webp',spoon:'play-scenes/wooden-spoon.webp'}[id]||'minigames/produce/'+id+'.webp'));
  const image=(id,cls='')=>'<img draggable="false" class="'+cls+'" src="'+art(id)+'" alt="">';
  const shuffle=items=>{const out=items.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const sound=id=>window.meadowAudio?.play(id==='hen'?'chicken':id),speak=id=>window.meadowAudio?.speak(id);
  const action=(id,text)=>'<button class="fa-small-action" data-create-action="'+id+'">'+text+'</button>';
  function animate(a,node,kind='happy'){if(!node?.isConnected)return;node.classList.remove('cs-'+kind);void node.offsetWidth;node.classList.add('cs-'+kind);a.later(()=>node.classList.remove('cs-'+kind),1800);}
  function normalizeObjects(list){if(!Array.isArray(list))return [];const allowed=new Set([...animals,...food,'tractor','flower','tower','hay','nest']);return list.map((value,i)=>typeof value==='string'?{id:value,x:22+(i%3)*28,y:30+Math.floor(i/3)*23}:value).filter(value=>value&&typeof value.id==='string'&&Number.isFinite(value.x)&&Number.isFinite(value.y)).map(value=>({id:value.id==='flower-patch'?'flower':value.id,x:clamp(value.x,10,90),y:clamp(value.y,25,86)})).filter(value=>allowed.has(value.id)).slice(0,12);}
  function saved(a,key){return normalizeObjects((a.hooks.world||{})[key]);}
  function save(a,key){if(a.hooks.world){a.hooks.world[key]=a.objects.map(x=>({...x}));a.hooks.save?.();}}
  const creator={
    assets:[art('tower'),art('hay'),art('nest')],
    select(a){const target=a.root.querySelector('[data-fa-target="canvas"]');if(target)target.dataset.accept=a.selected;},
    accept(a){if(a.objects.length>=12){a.say('A lovely full scene! Move a friend, or use Remove to make room.');return;}const rect=a.root.querySelector('.cs-canvas').getBoundingClientRect(),p=a.dropPoint||{x:rect.left+rect.width/2,y:rect.top+rect.height*.65};a.objects.push({id:a.selected,x:clamp((p.x-rect.left)/rect.width*100,10,90),y:clamp((p.y-rect.top)/rect.height*100,25,86)});a.dropPoint=null;save(a,a.creatorKey);creator.render(a);},
    render(a){
      const kind=a.g.kind,key=kind==='story'?'story':kind==='builder'?'farmPieces':'keepsake';a.creatorKey=key;a.objects ||= saved(a,key);a.page ||= 0;a.removeMode ||= false;
      const palette=kind==='builder'?['tower','hay','nest','tractor',...animals,...food]:kind==='keepsake'?[...animals,'flower',...food]:[...animals,...food,'tractor','flower'];
      const shown=palette.slice(a.page*4,a.page*4+4),objects=a.objects.map((p,i)=>'<button class="cs-object" data-object="'+i+'" aria-label="'+label(p.id)+' '+(i+1)+'; drag to move, tap to play" style="left:'+p.x+'%;top:'+p.y+'%;--depth:'+(0.7+p.y/140)+';z-index:'+Math.round(p.y)+'">'+image(p.id)+'</button>').join('');
      const stage='<div class="cs-canvas '+(kind==='keepsake'?'cs-paper':'')+'">'+a.target('canvas','Place your chosen picture here','','inset:0;width:100%;height:100%;transform:none;left:0;top:0','none')+objects+'</div>';
      const tray=shown.map(id=>a.piece(id,label(id),art(id))).join('');
      a.shell(kind==='builder'?'Build your own little farm':kind==='story'?'Make your farm story':'My Meadow Day picture',stage,tray,0,0,'Move a picture into your scene. Drag it again to rearrange it.');
      a.root.querySelector('.fa-progress').outerHTML='<div class="cs-creator-tools">'+action('palette','More pictures')+action('play',kind==='keepsake'?'Make it sparkle':'Play my scene')+action('remove',a.removeMode?'Done removing':'Remove')+action('finish','Save & finish')+'</div>';
      a.root.classList.toggle('cs-removing',a.removeMode);
      const canvas=a.root.querySelector('.cs-canvas');
      canvas.addEventListener('click',e=>{if(e.target.closest('[data-fa-target]'))a.dropPoint={x:e.clientX,y:e.clientY};},true);
      let drag=null;
      canvas.addEventListener('pointerdown',e=>{const node=e.target.closest('[data-object]');if(!node||a.busy)return;e.preventDefault();e.stopPropagation();const i=Number(node.dataset.object);if(a.removeMode){a.objects.splice(i,1);save(a,key);creator.render(a);return;}drag={id:e.pointerId,i,node,x:e.clientX,y:e.clientY,moved:false};node.setPointerCapture(e.pointerId);});
      canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.moved=true;if(!drag.moved)return;const r=canvas.getBoundingClientRect(),p=a.objects[drag.i];p.x=clamp((e.clientX-r.left)/r.width*100,10,90);p.y=clamp((e.clientY-r.top)/r.height*100,25,86);drag.node.style.left=p.x+'%';drag.node.style.top=p.y+'%';drag.node.style.zIndex=Math.round(p.y);});
      const end=e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;if(d.moved){save(a,key);return;}const id=a.objects[d.i].id;animate(a,d.node,id==='tractor'?'drive':'happy');if(animals.includes(id))sound(id);else if(food.includes(id))speak('produce-'+id);else sound('care');};
      canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',()=>{drag=null;save(a,key);});
      canvas.querySelectorAll('[data-object]').forEach(node=>node.addEventListener('click',e=>{e.stopPropagation();if(e.detail===0){if(a.removeMode){a.objects.splice(Number(node.dataset.object),1);save(a,key);creator.render(a);}else animate(a,node);}}));
      a.root.querySelectorAll('[data-create-action]').forEach(b=>b.onclick=()=>{const cmd=b.dataset.createAction;if(cmd==='palette'){a.page=(a.page+1)%Math.ceil(palette.length/4);creator.render(a);}else if(cmd==='remove'){a.removeMode=!a.removeMode;creator.render(a);}else if(cmd==='finish'){if(!a.objects.length){a.say('Add a picture to your page first.');return;}save(a,key);a.win('Your own lovely farm creation is saved.');}else{if(!a.objects.length){a.say('Add some friends first, then bring your scene to life.');return;}a.root.querySelectorAll('[data-object]').forEach((node,i)=>a.later(()=>{if(!node.isConnected)return;const id=a.objects[i]?.id;if(!id)return;animate(a,node,kind==='keepsake'?'sparkle':id==='tractor'?'drive':'happy');if(animals.includes(id))sound(id);},i*500));}});
    }
  };
  for(const kind of ['story','builder','keepsake'])engine.register(kind,creator);
  engine.register('hide',{
    assets:[art('hay'),...animals.map(art)],
    render(a){a.hiders ||= shuffle(animals);a.revealed ||= [];const wanted=animals[a.round%4];
      const stage='<div class="cs-find-request">Find '+image(wanted)+'<span>'+label(wanted)+'</span></div><div class="cs-hide-field">'+a.hiders.map((id,i)=>'<div class="cs-hide-place" style="left:'+(22+i%2*55)+'%;top:'+(40+Math.floor(i/2)*38)+'%"><button data-hidden-friend="'+i+'" aria-label="'+(a.revealed.includes(i)?'Found '+label(id):'Hidden farm friend')+'" '+(!a.revealed.includes(i)?'disabled':'')+'>'+image(id)+'</button>'+(!a.revealed.includes(i)?'<button class="cs-cover" data-reveal="'+i+'" aria-label="Move hay pile '+(i+1)+'">'+image('hay')+'</button>':'')+'</div>').join('')+'</div>';
      a.shell('Who is behind the hay?',stage,'<button class="fa-action" data-listen-animal>Hear my friend</button>',a.round,4,'Slide a hay bale aside. Tap the friend you are looking for.');
      a.root.querySelector('[data-listen-animal]').onclick=()=>sound(wanted);
      a.root.querySelectorAll('[data-reveal]').forEach(b=>{let start=null;const reveal=()=>{if(a.busy)return;a.revealed.push(Number(b.dataset.reveal));sound('place');a.render();};b.onclick=reveal;b.onpointerdown=e=>{start={x:e.clientX,y:e.clientY};b.setPointerCapture(e.pointerId);};b.onpointerup=e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>35)reveal();start=null;};});
      a.root.querySelectorAll('[data-hidden-friend]').forEach(b=>b.onclick=()=>{if(a.busy)return;const id=a.hiders[Number(b.dataset.hiddenFriend)];sound(id);animate(a,b);if(id!==wanted){a.say('You found '+label(id)+'. Where is '+label(wanted)+'?');return;}a.busy=true;a.say('There you are! Lovely finding.');a.later(()=>{a.round++;a.busy=false;a.revealed=[];a.hiders=shuffle(animals);if(a.round===4)a.win('You found all four farm friends!');else a.render();},1200);});
    }
  });
  const shapeSvg=(shape,shadow=false)=>'<svg viewBox="0 0 100 100" aria-hidden="true">'+(shape==='circle'?'<circle cx="50" cy="50" r="38"/>':shape==='square'?'<rect x="12" y="12" width="76" height="76" rx="6"/>':'<path d="M50 9 94 88H6Z"/>')+'</svg>';
  engine.register('shapes',{
    render(a){const names=['circle','square','triangle'],wanted=names[a.round%3];a.shape=wanted;a.shell('Fit the farm window','<div class="cs-window-frame"><div class="cs-window-shadow '+wanted+'">'+shapeSvg(wanted,true)+'</div>'+a.target('window','Fit the '+wanted+' window','','left:50%;top:50%;width:70%;height:80%',wanted)+'</div>',shuffle(names).map(id=>'<button class="fa-piece cs-shape-piece" data-fa-piece="'+id+'" aria-label="'+id+' window" aria-pressed="false">'+shapeSvg(id)+'<span>'+label(id)+'</span></button>').join(''),a.round,6,'Move the matching wooden shape into the window.');},
    accept(a){a.busy=true;const hole=a.root.querySelector('.cs-window-shadow');hole.classList.add('cs-shape-fitted');a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.disabled=true);sound('place');a.say('It fits! The sunshine is coming in.');a.later(()=>{a.round++;a.busy=false;if(a.round===6)a.win('Six lovely farm windows fitted!');else a.render();},1400);}
  });
  const music={
    assets:[base+'play-scenes/music-meadow.webp'],
    render(a){a.notes ||= [];a.g.image=base+'play-scenes/music-meadow.webp';const stage='<div class="cs-band-friends">'+animals.map((id,i)=>'<button class="cs-musician" data-musician="'+id+'" aria-label="Play '+label(id)+'" style="--i:'+i+'">'+image(id)+'<span>'+label(id)+'</span></button>').join('')+'</div><div class="cs-score" aria-label="Your sound pattern">'+a.notes.map((id,i)=>'<button data-note="'+i+'" aria-label="Remove '+label(id)+' sound '+(i+1)+'">'+image(id)+'</button>').join('')+'</div>';
      a.shell(a.g.kind==='band'?'Meadow Farm Band':'Make a sound garden',stage,'<button class="fa-action" data-play-music>Play my tune</button><button class="fa-small-action" data-stop-music>Stop</button><button class="fa-small-action" data-clear-music>Clear</button>',0,0,'Tap your friends to make a tune. Watch each friend perform it back.');
      a.root.querySelector('.fa-progress').outerHTML='<div class="cs-beat-count" role="status">'+a.notes.length+' / 8 sounds</div>';
      a.root.querySelectorAll('[data-musician]').forEach(b=>b.onclick=()=>{if(a.playing){a.say('Your tune is playing. Tap Stop to change it.');return;}if(a.notes.length===8){a.say('Your tune is full. Tap a little picture to remove that sound.');return;}const id=b.dataset.musician;a.notes.push(id);sound(id);a.render();animate(a,a.root.querySelector('[data-musician="'+id+'"]'));});
      a.root.querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>{if(a.playing)return;a.notes.splice(Number(b.dataset.note),1);a.render();});
      const stop=()=>{a.musicRun=(a.musicRun||0)+1;a.playing=false;a.render();};a.root.querySelector('[data-stop-music]').onclick=stop;a.root.querySelector('[data-clear-music]').onclick=()=>{a.notes=[];stop();};
      a.root.querySelector('[data-play-music]').onclick=()=>{if(a.playing)return;if(!a.notes.length){a.say('Tap a friend first to make your tune.');return;}a.playing=true;const run=a.musicRun=(a.musicRun||0)+1;a.say('Here comes your own farm tune!');a.notes.forEach((id,i)=>a.later(()=>{if(run!==a.musicRun)return;const friend=a.root.querySelector('[data-musician="'+id+'"]');animate(a,friend,'perform');a.root.querySelectorAll('[data-note]').forEach((n,j)=>n.classList.toggle('cs-current-note',i===j));sound(id);},i*1100));a.later(()=>{if(run!==a.musicRun)return;a.playing=false;a.root.querySelectorAll('.cs-current-note').forEach(n=>n.classList.remove('cs-current-note'));a.say('That was your tune! Change it, or play it again.');},a.notes.length*1100);};
    }
  };
  engine.register('sounds',music);engine.register('band',music);
  engine.register('firstsounds',{
    render(a){a.wordDeck ||= shuffle(words);const [word,letter]=a.wordDeck[a.round];a.answer=letter;a.g.voice='produce-'+word;const choices=shuffle([letter,...shuffle(words.map(x=>x[1]).filter(x=>x!==letter)).slice(0,2)]);
      a.shell('Listen for the first sound','<div class="cs-first-word">'+image(word)+'<button class="fa-small-action" data-hear-word>Hear the word</button></div>',choices.map(x=>'<button class="fa-action cs-letter" data-letter="'+x+'" aria-label="Letter '+x+'">'+x+'</button>').join(''),a.round,6,'Listen to the word. Which letter starts it?');
      const hear=()=>speak('produce-'+word);a.root.querySelector('[data-hear-word]').onclick=hear;
      a.root.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>{if(a.busy)return;if(b.dataset.letter!==letter){a.say('Let’s listen once more.');hear();animate(a,b);return;}a.busy=true;b.classList.add('cs-right-letter');a.root.querySelectorAll('[data-letter]').forEach(n=>n.disabled=true);sound('care');a.say(letter+' starts '+word+'. Lovely listening!');a.later(()=>{a.round++;a.busy=false;if(a.round===6)a.win('You found all six first sounds!');else a.render();},1000);});hear();
    }
  });
  engine.register('kitchen',{
    assets:[base+'play-scenes/mixing-bowl.webp',art('spoon')],
    render(a){a.ingredients ||= [];a.cookPhase ||= 'choose';a.g.image=base+'play-scenes/kitchen-room.webp';const phase=a.cookPhase;
      const contents=a.ingredients.map((id,i)=>'<span class="cs-ingredient" style="--i:'+i+'">'+image(id)+'</span>').join('');
      let stage='<div class="cs-bowl '+(phase==='mix'?'cs-ready-mix':'')+'"><img class="cs-bowl-back" src="'+base+'play-scenes/mixing-bowl.webp" alt="Mixing bowl">'+contents+'<img class="cs-bowl-front" src="'+base+'play-scenes/mixing-bowl.webp" alt="">'+(phase==='mix'?'<div class="cs-spoon">'+image('spoon')+'</div><div class="cs-stir-guide" aria-hidden="true"></div>':'')+'</div>',tray='',help='Move some harvest treats into the bowl.';
      if(phase==='choose'){stage+=a.target('bowl','Put an ingredient in the bowl','','left:50%;top:57%;width:74%;height:58%','apple');tray=food.slice((a.page||0)*3,(a.page||0)*3+3).map(id=>a.piece(id,label(id),art(id))).join('');}
      if(phase==='mix'){help='Rub around the bowl to stir. Watch your ingredients tumble!';tray='<button class="fa-action" data-stir>Give it a stir</button>';}
      if(phase==='share'){stage+='<div class="cs-tasting-friends">'+animals.slice(0,3).map((id,i)=>'<button data-taste="'+id+'" aria-label="Share with '+label(id)+'">'+image(id)+'</button>').join('')+'</div>';help='Your treat is ready. Choose a farm friend to share it with.';tray='<button class="fa-action" data-new-recipe>New recipe</button>';}
      a.shell(phase==='choose'?'Your little farm kitchen':phase==='mix'?'Stir your own farm treat':'A lovely treat to share',stage,tray,a.stirs||0,phase==='mix'?5:0,help);
      if(phase==='choose'){a.root.querySelector('.fa-progress').outerHTML='<div class="cs-creator-tools">'+action('foods','More food')+action('mix','Ready to stir')+action('empty','Empty bowl')+'</div>';a.root.querySelectorAll('[data-create-action]').forEach(b=>b.onclick=()=>{const cmd=b.dataset.createAction;if(cmd==='foods')a.page=1-(a.page||0);else if(cmd==='empty')a.ingredients=[];else{if(!a.ingredients.length){a.say('Choose an ingredient first. Any mix is lovely!');return;}a.cookPhase='mix';a.stirs=0;}a.render();});}
      if(phase==='mix'){
        const bowl=a.root.querySelector('.cs-bowl');let drag=null,travel=0;const stir=()=>{if(a.busy||a.finished)return;a.stirs++;animate(a,bowl,'stir');a.root.querySelector('.fa-progress').outerHTML=a.meter(a.stirs,5);sound('cook');if(a.stirs===5){a.busy=true;a.say('You made it! Let’s share your farm treat.');a.later(()=>{a.busy=false;a.cookPhase='share';a.render();},1600);}};
        a.root.querySelector('[data-stir]').onclick=()=>{if(performance.now()<(a.nextStir||0))return;a.nextStir=performance.now()+600;stir();};
        bowl.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};travel=0;bowl.setPointerCapture(e.pointerId);};bowl.onpointermove=e=>{if(!drag||drag.id!==e.pointerId||a.busy)return;travel+=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;const r=bowl.getBoundingClientRect(),spoon=bowl.querySelector('.cs-spoon');spoon.style.left=clamp((e.clientX-r.left)/r.width*100,20,80)+'%';spoon.style.top=clamp((e.clientY-r.top)/r.height*100,10,60)+'%';if(travel>140){travel=0;stir();}};bowl.onpointerup=bowl.onpointercancel=()=>drag=null;
      }
      if(phase==='share'){a.root.querySelectorAll('[data-taste]').forEach(b=>b.onclick=()=>{if(a.busy)return;a.busy=true;animate(a,b);sound(b.dataset.taste);a.say('A lovely homemade treat! Thank you for sharing.');a.later(()=>a.win('You mixed and shared your very own farm treat!'),1600);});a.root.querySelector('[data-new-recipe]').onclick=()=>{a.ingredients=[];a.cookPhase='choose';a.stirs=0;a.render();};}
    },
    select(a){const target=a.root.querySelector('[data-fa-target="bowl"]');if(target)target.dataset.accept=a.selected;},
    accept(a){if(a.ingredients.length===4){a.say('Your bowl is full. Ready to stir?');return;}a.ingredients.push(a.selected);speak('produce-'+a.selected);a.render();}
  });
  window.meadowCreativeScenes={art,label,shuffle,normalizeObjects};
})();
