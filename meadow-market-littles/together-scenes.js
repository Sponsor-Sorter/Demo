/* Illustrated cooperative stages. Rules, turn ownership and peer validation stay in together-core. */
(() => {
  'use strict';
  const base='assets/generated/',pieces='play-pieces/',scenes='play-scenes/';
  const paths={hen:'hen.webp',cow:'cow.webp',sheep:'sheep.webp',goat:'goat.webp',duck:pieces+'duck.webp',plank:pieces+'wood-plank.webp',stones:pieces+'lily-pad.webp',gate:pieces+'wood-plank.webp',pack:pieces+'harvest-basket.webp',water:'animal-care/water.webp',blanket:pieces+'scarf.webp',straw:pieces+'hay-bale.webp',place:pieces+'nest.webp',play:'hen.webp',meadow:scenes+'music-meadow.webp',orchard:'minigames/tractor-scene.webp',pond:pieces+'pond.webp',coop:'minigames/coop.webp',picnic:pieces+'harvest-basket.webp',puddles:pieces+'pond.webp',dance:'goat.webp'};
  const src=id=>base+(paths[id]||'minigames/produce/'+id+'.webp');
  const img=(id,cls='',alt='')=>'<img draggable="false" class="'+cls+'" src="'+src(id)+'" alt="'+alt+'">';
  const task=s=>({animalrescue:[['sheep','meadow','stream','plank'],['duck','pond','mud','stones'],['hen','coop','gate','gate']][s.shared],picnicpartners:['apple','strawberry','carrot'][s.shared],gardenhelpers:['corn','carrot','tomato'][s.shared],cozyhome:[['sheep','blanket'],['hen','straw'],['goat','apple']][s.shared],storywagon:s.items.slice(s.shared*3,s.shared*3+3)})[s.game];
  function scene(s){
    if(!['animalrescue','picnicpartners','gardenhelpers','cozyhome','animalband','storywagon'].includes(s.game)||s.winner)return '';
    const t=task(s),phase=s.phase;let body='',background=scenes+'music-meadow.webp';
    if(s.game==='animalrescue'){body='<div class="ts-stream">'+img('pond')+'</div><div class="ts-friend '+(phase==='bridge'?'ts-ready-cross':'')+'">'+img(t[0],'' ,t[0])+'</div><div class="ts-home">'+img(t[1],'' ,'Farm home')+'</div>';if(phase==='bridge')body+='<div class="ts-path-outline" aria-hidden="true"></div>';}
    if(s.game==='picnicpartners'){body='<div class="ts-basket">'+img('pack')+'</div>'+['apple','strawberry','carrot'].slice(0,s.shared).map((id,i)=>'<div class="ts-packed" style="--i:'+i+'">'+img(id)+'</div>').join('')+'<div class="ts-wanted">'+img(t,'',t)+'</div>';}
    if(s.game==='gardenhelpers'){body='<div class="ts-soil"></div>'+['corn','carrot','tomato'].map((id,i)=>'<div class="ts-crop '+(i<s.shared?'grown':i===s.shared&&phase==='water'?'planted':'empty')+'" style="--i:'+i+'">'+img(id)+'</div>').join('');if(phase==='water')body+='<div class="ts-water-drops"><i></i><i></i><i></i></div>';}
    if(s.game==='cozyhome'){background='minigames/coop.webp';body='<div class="ts-cosy-nest">'+img('place')+'</div><div class="ts-cosy-friend">'+img(t[0],'',t[0])+'</div>'+(phase==='place'?'<div class="ts-comfort">'+img(s.selected||t[1])+'</div>':'');}
    if(s.game==='animalband'){body='<div class="ts-band">'+['hen','cow','sheep','goat'].map(id=>'<div class="'+(id===s.selected?'ts-performing':'')+'">'+img(id,'',id)+'</div>').join('')+'</div><div class="ts-notes">'+s.items.map(id=>img(id)).join('')+'</div>';}
    if(s.game==='storywagon'){const [friend,place,fun]=t;if(place)background=paths[place]||background;body=friend?'<div class="ts-story-friend '+(fun==='dance'?'ts-dancing':fun==='puddles'?'ts-splashing':'')+'">'+img(friend,'',friend)+'</div>':'';if(fun==='picnic')body+='<div class="ts-story-prop">'+img('pack')+img('apple')+'</div>';if(fun==='puddles')body+='<div class="ts-story-puddle">'+img('pond')+'</div>';}
    return '<div class="ts-scene" data-coop-stage aria-label="Interactive '+s.game+' farm scene" style="--ts-scene:url('+base+background+')">'+body+'<span class="ts-drop-cue" aria-hidden="true"></span></div>';
  }
  function bind(root,state,act){
    const stage=root.querySelector('[data-coop-stage]');if(!stage)return;
    let drag=null,ghost=null,suppressUntil=0;
    root.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
    root.querySelectorAll('[data-coop-choice]').forEach(button=>{
      button.addEventListener('pointerdown',e=>{if(e.button>0||button.disabled)return;drag={id:e.pointerId,button,x:e.clientX,y:e.clientY,moved:false};button.setPointerCapture(e.pointerId);});
      button.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<10&&!drag.moved)return;drag.moved=true;if(!ghost){ghost=document.createElement('img');ghost.className='ts-drag-ghost';ghost.src=src(button.dataset.coopChoice);ghost.alt='';root.append(ghost);}ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';stage.classList.add('ts-ready');});
      const cancel=()=>{ghost?.remove();ghost=null;drag=null;stage.classList.remove('ts-ready');};
      button.addEventListener('pointercancel',cancel);
      button.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;cancel();if(!moved)return;suppressUntil=performance.now()+500;const r=stage.getBoundingClientRect();if(e.clientX>=r.left-20&&e.clientX<=r.right+20&&e.clientY>=r.top-20&&e.clientY<=r.bottom+20)act(button.dataset.coopChoice);});
    });
  }
  let outcomeTimer=0;
  function cancel(){clearTimeout(outcomeTimer);outcomeTimer=0;}
  function outcome(root,before,after,done){
    if(!before||before.game!==after.game||after.shared<=before.shared||before.winner)return false;
    let stage=root.querySelector('[data-coop-stage]');if(!stage)return false;cancel();
    if(before.game==='storywagon'){
      const holder=document.createElement('div');holder.innerHTML=scene({...before,items:after.items});const next=holder.firstElementChild;if(next){stage.replaceWith(next);stage=next;}
    }
    root.querySelectorAll('[data-coop-choice]').forEach(button=>button.disabled=true);
    stage.classList.add('ts-outcome');
    if(before.game==='animalrescue'){const bridge=document.createElement('div');bridge.className='ts-built-bridge';bridge.innerHTML=img(task(before)[3]);stage.append(bridge);}
    if(before.game==='animalband'){const chosen=before.selected;stage.querySelectorAll('.ts-band>div').forEach(n=>n.classList.toggle('ts-performing',n.querySelector('img')?.getAttribute('src')===src(chosen)));}
    const feedback=root.querySelector('.coop-feedback');if(feedback)feedback.textContent=({animalrescue:'You made a way across! Watch your friend go home.',picnicpartners:'Into the basket! Your picnic is growing.',gardenhelpers:'Fresh water! Look at your plant grow.',cozyhome:'A cosy home, made by both of you.',animalband:'Listen to the sound you made together!',storywagon:'Your story is coming to life!'})[before.game];
    outcomeTimer=setTimeout(()=>{outcomeTimer=0;done();},before.game==='storywagon'?2300:1800);return true;
  }
  function measure(root,s){if(s?.game!=='meadowrace')return [];return s.positions.map((position,i)=>{const nodes=root.querySelectorAll('.race-step'),node=nodes[position]?.querySelector('img[src*="'+(i===0?'apple':'sunflower')+'"]');const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top}:null;});}
  function animateBoard(root,before,after,positions){
    if(!before||before.game!==after.game||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    if(after.game==='meadowrace')after.positions.forEach((position,i)=>{if(position===before.positions[i]||!positions[i])return;const node=root.querySelectorAll('.race-step')[position]?.querySelector('img[src*="'+(i===0?'apple':'sunflower')+'"]');if(!node)return;const r=node.getBoundingClientRect();node.animate([{translate:(positions[i].left-r.left)+'px '+(positions[i].top-r.top)+'px',rotate:'-8deg'},{translate:'0 0',rotate:'0deg'}],{duration:800,easing:'cubic-bezier(.25,.7,.3,1)'});});
    if(after.game==='connectfour'){const cell=after.board.findIndex((value,i)=>value&&!before.board[i]);const node=root.querySelectorAll('.four-board .board-hole')[cell]?.querySelector('img');if(node){const r=node.getBoundingClientRect(),board=root.querySelector('.four-board').getBoundingClientRect();node.animate([{translate:'0 '+(board.top-r.top-r.height)+'px'},{translate:'0 0'}],{duration:500,easing:'cubic-bezier(.3,.7,.4,1)'});}}
  }
  window.meadowTogetherScenes={scene,src,bind,outcome,cancel,measure,animateBoard};
})();
