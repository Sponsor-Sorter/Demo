(() => {
  'use strict';
  const mud = [[380,342],[445,310],[508,350],[410,403],[485,412],[552,396]];
  const distance = (p,a,b) => { const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))); return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy); };
  // Count movement across wool, never elapsed time or repeated stationary taps.
  function brushPatch(values,a,b) { if(Math.hypot(b.x-a.x,b.y-a.y)<2)return values; return values.map((v,i)=>Math.min(100,v+(distance({x:mud[i][0],y:mud[i][1]},a,b)<53?Math.min(25,Math.hypot(b.x-a.x,b.y-a.y)*.45):0))); }
  const svg = `<svg class="pip-world" viewBox="160 40 680 720" aria-label="Play with Pip the lamb">
    <defs><linearGradient id="pip-wool" x2=".7" y2="1"><stop stop-color="#fffdf2"/><stop offset="1" stop-color="#ead6b5"/></linearGradient><linearGradient id="pip-face" x2="1" y2="1"><stop stop-color="#ffedcf"/><stop offset="1" stop-color="#eac099"/></linearGradient>
    <g id="pip-carrot-art"><path d="M-18-23Q-5-39 18-20L3 45Q-2 57-8 43Z" fill="#f59c30" stroke="#9a5025" stroke-width="4"/><path d="M-9-27Q-45-65-20-65L0-35Q0-80 17-70L9-29Q40-61 43-42L15-19" fill="#65a548" stroke="#3c6b35" stroke-width="4"/><path d="m-12-3 17 3m-14 17 11 2" stroke="#d77a27" stroke-width="4"/></g>
    <g id="pip-brush-art"><rect x="-42" y="-18" width="84" height="42" rx="15" fill="#d88b48" stroke="#6e422c" stroke-width="5"/><path d="M-29 22v21m14-21v25M0 22v26m15-26v25m14-25v21" stroke="#eee1b9" stroke-width="9"/><rect x="-17" y="-44" width="34" height="32" rx="10" fill="#e3a45c" stroke="#6e422c" stroke-width="5"/></g>
    <g id="pip-ball-art"><circle r="43" fill="#f2c450" stroke="#7c5732" stroke-width="5"/><path d="M0-41Q-30 0 0 42Q33 0 0-41" fill="#e97870"/><path d="M-40-12Q0 10 40-12M-38 20Q0-2 38 20" fill="none" stroke="#fff4d6" stroke-width="8"/></g>
    <g id="pip-hay-art"><path d="m-52 6 95-24m-94 44 104-23m-90 32 79-23m-74-29 92 29m-100-9 102 25" fill="none" stroke="#a97931" stroke-width="13" stroke-linecap="round"/><path d="m-52 2 95-24m-94 44 104-23m-90 32 79-23m-74-29 92 29m-100-9 102 25" stroke="#f2cb62" stroke-width="7" stroke-linecap="round"/></g></defs>
    <ellipse class="pip-shadow" cx="486" cy="488" rx="186" ry="25" fill="#29452944"/>
    <g class="pip-bed" opacity="0"><ellipse cx="480" cy="486" rx="207" ry="68" fill="#d7b66c" stroke="#9d783e" stroke-width="8"/><ellipse cx="480" cy="476" rx="172" ry="44" fill="#f5d680"/><g class="pip-bed-straw"></g></g>
    <g class="pip-pet" tabindex="0" role="button" aria-label="Pat Pip"><g class="pip-body-motion">
      <g class="pip-tail"><path d="M335 339Q280 293 276 329Q275 354 326 362" fill="url(#pip-wool)" stroke="#78533c" stroke-width="7"/></g>
      <g class="pip-leg leg-back"><path d="M376 410v65q16 18 33 0v-65" fill="#e7bf94" stroke="#78533c" stroke-width="7"/><path d="M376 460h33v19q-17 16-33 0" fill="#75503d"/></g>
      <g class="pip-leg leg-front"><path d="M530 412v65q17 16 34-1v-67" fill="#e7bf94" stroke="#78533c" stroke-width="7"/><path d="M530 461h34v19q-17 15-34-1" fill="#75503d"/></g>
      <path d="M333 390Q294 366 318 338Q306 304 344 299Q350 262 391 276Q419 246 452 272Q495 252 518 278Q564 272 570 307Q608 320 586 352Q602 388 571 407Q568 445 529 438Q497 460 468 443Q432 462 406 439Q366 452 354 423Q326 422 333 390Z" fill="url(#pip-wool)" stroke="#78533c" stroke-width="7"/>
      <path d="M355 350q17 22 35 0m30-40q20 23 41 0m-60 82q20 20 40 0m39-41q19 23 39 0m-21 59q18 18 35 0" fill="none" stroke="#ddc7a6" stroke-width="7" stroke-linecap="round"/>
      <g class="pip-head">
        <g class="pip-ear left"><path d="M554 267Q496 225 490 262Q500 301 555 295" fill="url(#pip-face)" stroke="#78533c" stroke-width="7"/><path d="M541 277q-35-26-36-10q12 20 36 18" fill="#eea9a0"/></g>
        <g class="pip-ear right"><path d="M650 264Q711 225 715 261Q705 300 651 295" fill="url(#pip-face)" stroke="#78533c" stroke-width="7"/><path d="M666 277q34-26 35-10q-12 20-35 18" fill="#eea9a0"/></g>
        <ellipse cx="602" cy="314" rx="79" ry="77" fill="url(#pip-face)" stroke="#78533c" stroke-width="7"/>
        <path d="M535 265q-17-32 13-41q8-30 34-20q22-23 42 0q31-11 39 18q33 12 13 42q-18 16-35-2q-20 20-39 1q-24 20-39-1q-19 15-28 3" fill="url(#pip-wool)" stroke="#78533c" stroke-width="7"/>
        <g class="pip-eyes"><ellipse cx="574" cy="307" rx="10" ry="14" fill="#49362e"/><ellipse cx="633" cy="307" rx="10" ry="14" fill="#49362e"/><circle cx="571" cy="302" r="4" fill="white"/><circle cx="630" cy="302" r="4" fill="white"/></g>
        <path class="pip-sleep-eyes" d="M562 308q12 14 24 0m35 0q12 14 24 0" fill="none" stroke="#49362e" stroke-width="6" stroke-linecap="round"/>
        <ellipse cx="551" cy="337" rx="16" ry="10" fill="#f1a59a"/><ellipse cx="650" cy="337" rx="16" ry="10" fill="#f1a59a"/>
        <path d="M591 328q12-8 24 0l-12 11Z" fill="#a86b5b"/><path class="pip-mouth" d="M586 349q17 24 35 0" fill="#a85f59" stroke="#694332" stroke-width="5" stroke-linecap="round"/>
      </g>
    </g></g>
    <g class="pip-mud" aria-hidden="true">${mud.map(([x,y],i)=>`<g data-mud="${i}" transform="translate(${x} ${y})"><path d="M-22-14q18-19 35 0q28-2 23 19q-9 18-31 8q-30 9-31-10Z" fill="#9f774c"/><path d="m-8-6 12 4m4 8 10-3" stroke="#be9663" stroke-width="4"/></g>`).join('')}</g>
    <g class="pip-blanket" opacity="0"><path d="M320 355Q425 323 553 365L581 457Q438 509 315 456Z" fill="#77afbb" stroke="#3e7180" stroke-width="6"/><path d="m350 360 8 111m54-121 8 126m52-118 8 119m-158-60 236 8" fill="none" stroke="#bdd7b8" stroke-width="10"/></g>
    <g class="pip-sleep-z" aria-hidden="true"><text x="659" y="220">z</text><text x="695" y="165">z</text><text x="731" y="110">z</text></g>
    <g class="pip-target" aria-hidden="true"><circle cx="603" cy="347" r="58"/></g>
    <g class="pip-demo" aria-hidden="true"><path d="M500 570Q500 430 603 347" fill="none" stroke="#fff5c7" stroke-width="9" stroke-dasharray="14 13"/><text x="500" y="570">☝</text></g><g class="pip-props"></g><g class="pip-effects" aria-hidden="true"></g>
  </svg>`;
  let active;
  function dispose() { if(!active)return; active.root.classList.add("pip-paused"); active.controller.abort(); active.resize.disconnect(); active=null; }
  function mount(r,h) {
    if(r.game.id!=='lambcare')return false;
    dispose(); const controller=new AbortController(),signal=controller.signal;
    h.actors.innerHTML='<div class="pip-day"><div class="pip-guide"><img src="assets/generated/guides/jay.webp" alt="Farmer Jay"><div><strong id="pip-instruction"></strong><span id="pip-detail"></span></div><button class="pip-hear" aria-label="Hear encouragement">🔊</button></div><div class="pip-playground">'+svg+'</div><div class="pip-bottom"><div class="pip-progress" role="status" aria-live="polite"></div><button class="pip-next" hidden></button></div></div>';
    const root=h.$('.pip-day'),world=h.$('.pip-world'),props=h.$('.pip-props'),pet=h.$('.pip-pet'),fx=h.$('.pip-effects');
    const s={phase:0,done:false,busy:false,drag:null,selected:null,count:0,brush:Array(6).fill(0),time:0,move:null,sleep:0,tasks:[]};
    const canPlay=()=>active?.state===s&&!r.paused&&!document.hidden;
    function after(fn,seconds){s.tasks.push({at:s.time+seconds,fn});}
    function effect(x,y,text='♥') { const node=document.createElementNS('http://www.w3.org/2000/svg','text');node.setAttribute('x',x);node.setAttribute('y',y);node.classList.add('pip-heart');node.textContent=text;fx.append(node);h.later(()=>node.remove(),1400); }
    function animate(kind,duration=1000){root.classList.remove(kind);void root.offsetWidth;root.classList.add(kind);h.later(()=>root.classList.remove(kind),duration);}
    function status(){const goal=s.phase===1?6:3;h.$('.pip-progress').innerHTML=['Snack','Brush','Play','Bed'].map((name,i)=>'<span class="'+(i<s.phase||s.done&&i===s.phase?'complete':i===s.phase?'current':'')+'">'+(i<s.phase||s.done&&i===s.phase?'★':'☆')+' '+name+'</span>').join('');h.$('#pip-detail').textContent=s.done?'Lovely helping!':s.phase===1?s.brush.filter(v=>v>=100).length+' of 6 patches clean':s.phase===3&&s.count===3?'Pull the blue blanket over Pip.':s.count+' of '+goal+(s.phase===0?' carrots eaten':s.phase===2?' ball returns':' hay bundles in bed');}
    function done(){if(s.done)return;s.done=true;s.busy=true;r.score++;h.update();window.meadowAudio?.play('care');window.meadowAudio?.speak('letter-jay-success');effect(500,230,'★');status();h.$('.pip-target').style.opacity=0;const next=h.$('.pip-next');next.hidden=false;next.textContent=['Let’s brush Pip →','Let’s play ball →','Let’s make a bed →',''][s.phase];if(s.phase===3){next.hidden=true;after(()=>h.finish(true),2.8);}}
    function prop(id,kind,x,y,label){return `<g class="pip-prop" data-prop="${id}" data-kind="${kind}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${label}"><circle r="65" fill="#fff8e3d9" stroke="#c3a166" stroke-width="3"/><use href="#pip-${kind}-art"/></g>`;}
    function phase(){s.done=false;s.busy=false;s.count=0;s.selected=null;s.drag=null;s.brush=Array(6).fill(0);s.move=null;root.dataset.phase=String(s.phase);root.classList.remove('pip-running','pip-chewing','pip-snuggled','pip-sleeping');pet.setAttribute('transform','translate(0 0)');h.$('.pip-blanket').setAttribute('opacity','0');h.$('.pip-bed').setAttribute('opacity',s.phase===3?'1':'0');h.$('.pip-mud').style.opacity=s.phase===1?'1':'0';h.$('.pip-mud').querySelectorAll('[data-mud]').forEach(e=>e.style.opacity=1);h.$('.pip-next').hidden=true;
      h.$('#pip-instruction').textContent=['Bring a carrot to Pip’s mouth','Brush the muddy patches away','Roll the ball to Pip','Make Pip a cosy bed'][s.phase];
      props.innerHTML=s.phase===0?[290,500,710].map((x,i)=>prop(i,'carrot',x,610,'Carrot '+(i+1)+'. Drag to Pip’s mouth, or select then tap Pip.')).join(''):s.phase===1?prop('brush','brush',500,610,'Brush. Drag across the muddy wool, or select then tap each patch.'):s.phase===2?prop('ball','ball',500,610,'Ball. Roll towards Pip, or select then tap Pip.'): [290,500,710].map((x,i)=>prop(i,'hay',x,610,'Hay bundle '+(i+1)+'. Drag into the bed, or select then tap the bed.')).join('');
      const target=h.$('.pip-target circle');target.setAttribute('cx',s.phase===0?603:s.phase===1?456:480);target.setAttribute('cy',s.phase===0?347:s.phase===1?366:470);target.setAttribute('r',s.phase===1?115:s.phase===3?115:58);h.$('.pip-target').style.opacity=1;status();
    }
    function point(event){const matrix=world.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};}
    function brush(a,b){s.brush=brushPatch(s.brush,a,b);h.$('.pip-mud').querySelectorAll('[data-mud]').forEach((e,i)=>{const old=Number(e.style.opacity);e.style.opacity=String(1-s.brush[i]/100);if(old>0&&s.brush[i]>=100){effect(mud[i][0],mud[i][1],'✦');window.meadowAudio?.play('tap');}});status();if(s.brush.every(v=>v>=100)){props.innerHTML='';animate('pip-delighted');done();}}
    function destination(p){return s.phase===0?Math.hypot(p.x-603,p.y-347)<115:s.phase===2?p.y<505&&p.y>200&&p.x>230&&p.x<770:s.phase===3?Math.hypot((p.x-480)*.65,p.y-470)<105:false;}
    function accept(node,p){if(!canPlay()||s.busy||s.done)return; if(!destination(p)){node.setAttribute('transform',node.dataset.home);return;}s.selected=null;node.classList.remove('selected');
      if(s.phase===0){s.busy=true;node.setAttribute('transform','translate(603 347) scale(.35)');node.classList.add('pip-eaten');animate('pip-chewing',1200);window.meadowAudio?.play('harvest');effect(620,280);after(()=>{node.remove();s.count++;s.busy=false;status();if(s.count===3)done();},1.1);}
      else if(s.phase===2){s.busy=true;s.move={start:s.time,aim:p.x,ball:node};root.classList.add('pip-running');window.meadowAudio?.play('tap');}
      else if(s.phase===3&&s.count<3){node.remove();s.count++;h.$('.pip-bed-straw').insertAdjacentHTML('beforeend',`<use href="#pip-hay-art" transform="translate(${390+s.count*45} 474)"/>`);window.meadowAudio?.play('harvest');effect(480,430,'✦');status();if(s.count===3){props.innerHTML='<g class="pip-prop" data-prop="blanket" data-kind="blanket" transform="translate(500 610)" tabindex="0" role="button" aria-label="Blanket. Drag over Pip or select then tap Pip."><rect x="-75" y="-45" width="150" height="90" rx="18" fill="#77afbb" stroke="#3e7180" stroke-width="6"/><path d="M-70-15H70M-70 15H70M-25-40V40M25-40V40" stroke="#bdd7b8" stroke-width="9"/></g>';h.$('#pip-instruction').textContent='Tuck Pip in with the blanket';}}
      else if(s.phase===3){props.innerHTML='';root.classList.add('pip-snuggled','pip-sleeping');h.$('.pip-blanket').setAttribute('opacity','1');h.$('#pip-instruction').textContent='Sleep tight, little Pip';window.meadowAudio?.play('sheep');done();}
    }
    function select(node){if(!canPlay()||s.busy||s.done)return;s.selected=node;props.querySelectorAll('.pip-prop').forEach(e=>e.classList.toggle('selected',e===node));}
    world.addEventListener('pointerdown',event=>{if(!canPlay()||s.busy||s.done||s.drag||event.button>0)return;const node=event.target.closest('[data-prop]'),p=point(event);if(!p)return;
      if(!node&&s.selected){if(s.phase===1){const i=mud.findIndex(([x,y])=>Math.hypot(x-p.x,y-p.y)<65);if(i>=0){s.brush[i]=100;h.$('.pip-mud').querySelector('[data-mud="'+i+'"]').style.opacity=0;effect(p.x,p.y,'✦');status();if(s.brush.every(v=>v>=100)){props.innerHTML='';done();}}}else accept(s.selected,p);return;}
      if(!node){if(event.target.closest('.pip-pet')){animate('pip-delighted');effect(p.x,p.y);window.meadowAudio?.play('sheep');}return;}
      event.preventDefault();select(node);node.dataset.home ||= node.getAttribute('transform');s.drag={node,id:event.pointerId,last:p,start:p,moved:false};world.setPointerCapture(event.pointerId);
    },{signal});
    world.addEventListener('pointermove',event=>{const drag=s.drag;if(!drag||event.pointerId!==drag.id||!canPlay())return;const p=point(event);if(!p)return;drag.moved ||= Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>12;drag.node.setAttribute('transform',`translate(${p.x} ${p.y})`);if(s.phase===1&&drag.moved)brush(drag.last,p);drag.last=p;},{signal});
    function release(event,cancel=false){const drag=s.drag;if(!drag||event.pointerId!==drag.id)return;s.drag=null;if(world.hasPointerCapture(event.pointerId))world.releasePointerCapture(event.pointerId);if(cancel||!canPlay()||s.done){if(drag.node.isConnected)drag.node.setAttribute('transform',drag.node.dataset.home);return;}if(s.phase===1||!drag.moved){drag.node.setAttribute('transform',drag.node.dataset.home);return;}accept(drag.node,point(event)||drag.last);}
    world.addEventListener('pointerup',event=>release(event),{signal});world.addEventListener('pointercancel',event=>release(event,true),{signal});world.addEventListener('lostpointercapture',event=>release(event,true),{signal});
    world.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key)||!canPlay()||s.busy||s.done)return;event.preventDefault();const node=event.target.closest('[data-prop]');if(!node&&event.target.closest('.pip-pet')){animate('pip-delighted');effect(600,260);window.meadowAudio?.play('sheep');return;}if(node){select(node);if(s.phase===1){const i=s.brush.findIndex(v=>v<100);if(i>=0)brush({x:mud[i][0]-80,y:mud[i][1]},{x:mud[i][0]+80,y:mud[i][1]});}else accept(node,{x:s.phase===0?603:480,y:s.phase===0?347:470});}},{signal});
    h.$('.pip-next').onclick=()=>{if(!canPlay()||!s.done)return;s.phase++;phase();};h.$('.pip-hear').onclick=()=>window.meadowAudio?.speak('letter-jay-success');
    function resize(){world.setAttribute('viewBox',root.clientWidth/root.clientHeight>1.25?'0 55 1000 625':'160 40 680 720');if(s.drag){s.drag.node.setAttribute('transform',s.drag.node.dataset.home);s.drag=null;}}
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(root);active={controller,resize:resizeObserver,state:s,root};
    r.pipFrame=paused=>root.classList.toggle('pip-paused',paused);
    r.pipTick=dt=>{s.time+=dt;const due=s.tasks.filter(t=>t.at<=s.time);s.tasks=s.tasks.filter(t=>t.at>s.time);due.forEach(t=>t.fn());if(active?.state!==s)return;if(s.move){const m=s.move,t=Math.min(1,(s.time-m.start)/2.6),out=Math.min(1,t*2),x=500+(m.aim-500)*Math.sin(t*Math.PI);m.ball.setAttribute('transform',`translate(${x} ${610-185*Math.sin(t*Math.PI)}) rotate(${t*540})`);pet.setAttribute('transform',`translate(${(m.aim-500)*.42*Math.sin(t*Math.PI)} ${-Math.sin(out*Math.PI)*18})`);if(t===1){root.classList.remove('pip-running');pet.setAttribute('transform','translate(0 0)');m.ball.setAttribute('transform',m.ball.dataset.home);s.move=null;s.busy=false;s.count++;effect(600,270);window.meadowAudio?.play('sheep');status();if(s.count===3){props.innerHTML='';done();}}} };
    phase();resize();return true;
  }
  window.meadowPipDay={mount,dispose,brushPatch,distance};
})();
