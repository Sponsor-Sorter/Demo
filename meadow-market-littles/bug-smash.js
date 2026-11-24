/* One owned, touch-first game loop; actual taps/rubs and shared completed-round accounting. */
(() => {
  'use strict';
  const core=globalThis.meadowBugSmashCore,paint=globalThis.meadowBugSmashPaint,base='assets/generated/bug-smash/';
  const bossNames={acorn:'Captain Acorn',bubble:'Bubble Boss',tickle:'Tickle Tank'};
  const icon={sound:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12h6l7-6v20l-7-6H5Z"/><path d="M23 10q7 6 0 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',pause:'<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="8" y="6" width="6" height="20" rx="2"/><rect x="19" y="6" width="6" height="20" rx="2"/></svg>',close:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m9 9 14 14M23 9 9 23" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>'};
  let dialog,session=null,completed=()=>true,getLevel=()=>1,returnFocus;
  const qualityReady=()=>{try{const n=globalThis.meadowWeeklyFair?.getQualityBuild?.();return Number.isSafeInteger(n)&&n>=96;}catch{return false;}};
  const sound=id=>globalThis.meadowAudio?.play(id),stopVoice=()=>globalThis.meadowAudio?.stopVoice();
  function speak(s,id){if(session===s&&!document.hidden)globalThis.meadowAudio?.speak('bug-rhys-'+id);}
  function image(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Bug artwork unavailable'));img.src=url;});}
  function close(){
    const s=session;if(s){s.abort.abort();cancelAnimationFrame(s.frame);s.resize.disconnect();s.fingers.clear();session=null;}
    stopVoice();dialog?.close();const target=returnFocus?.isConnected?returnFocus:document.querySelector('[data-play="bug_smash"]');target?.focus?.({preventScroll:true});
  }
  async function open(){
    if(!qualityReady())return;
    close();returnFocus=document.activeElement;
    if(!dialog){dialog=document.createElement('dialog');dialog.className='bs-dialog';dialog.setAttribute('aria-label','Rainbow Bug Smash');document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});}
    dialog.innerHTML='<main class="bs-scene"><header class="bs-header"><img class="bs-farmer" src="assets/generated/guides/rhys.webp" alt="Farmer Rhys"><h2>Rainbow <br>Bug Smash</h2><button data-bs-listen aria-label="Hear the farmer">'+icon.sound+'</button><button data-bs-pause aria-label="Pause game" disabled>'+icon.pause+'</button><button data-bs-close aria-label="Back to games">'+icon.close+'</button></header><div class="bs-field"><canvas aria-hidden="true"></canvas><div class="bs-bug-controls" role="group" aria-label="Colourful ants and boss targets"></div><div class="bs-announcement" aria-live="polite"></div></div><footer class="bs-footer"><div class="bs-flower" aria-hidden="true">✿</div><div class="bs-task"><strong data-bs-task>Make a rainbow!</strong><span data-bs-detail>Tap colourful ants. Big shells need a few taps.</span><div class="bs-progress" role="progressbar" aria-label="Bug parade progress" aria-valuemin="0" aria-valuemax="9" aria-valuenow="0"><i></i></div></div><b class="bs-counter" aria-live="polite">0 / 9</b></footer><section class="bs-overlay bs-start"><div class="bs-intro-content"><small>FARMER RHYS’S PAINT PARADE</small><h2>Ready, steady… splash!</h2><img class="bs-intro-art" src="'+base+'preview.webp" alt="Colourful ants, a big acorn-armoured ant and a bubble boss in the farm garden"><p>Tap the ants. Crack the big shells.<br>Meet a boss with a fun surprise!</p><div class="bs-level-picker"><button data-bs-easier aria-label="Previous level">−</button><span><b data-bs-level>Trail 1</b><small data-bs-boss>Captain Acorn</small></span><button data-bs-harder aria-label="Next level">+</button></div><button class="bs-primary" data-bs-start disabled>Getting the garden ready…</button><button class="bs-secondary" data-bs-no>No thanks</button></div></section></main>';
    dialog.showModal();const field=dialog.querySelector('.bs-field'),canvas=field.querySelector('canvas'),s={field,canvas,c:canvas.getContext('2d'),abort:new AbortController(),phase:'loading',level:core.settings(getLevel()).level,game:null,frame:0,last:0,finishIn:0,armourHeard:false,buttons:new Map(),fingers:new Map(),voice:'intro',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,resize:null};session=s;
    const on=(node,event,fn)=>node.addEventListener(event,fn,{signal:s.abort.signal});
    s.resize=new ResizeObserver(()=>resize(s));s.resize.observe(field);resize(s);
    globalThis.addEventListener?.('meadow-quality-change',()=>{if(!qualityReady())close();},{signal:s.abort.signal});
    const levelChange=delta=>{if(session!==s||s.phase!=='intro')return;s.level=core.settings(s.level+delta).level;levelLabel(s);sound('tap');};
    on(dialog.querySelector('[data-bs-easier]'),'click',()=>levelChange(-1));on(dialog.querySelector('[data-bs-harder]'),'click',()=>levelChange(1));
    on(dialog.querySelector('[data-bs-close]'),'click',close);on(dialog.querySelector('[data-bs-no]'),'click',close);on(dialog.querySelector('[data-bs-listen]'),'click',()=>speak(s,s.voice));on(dialog.querySelector('[data-bs-pause]'),'click',()=>pause(s));
    on(document,'visibilitychange',()=>{if(document.hidden)pause(s);});
    on(field,'pointerdown',e=>{
      if(session!==s||s.phase!=='playing'||e.button>0)return;e.preventDefault();const p=point(s,e);s.fingers.set(e.pointerId,p);try{field.setPointerCapture(e.pointerId);}catch{}s.game.tap(p);events(s);
    });
    on(field,'pointermove',e=>{
      let previous=s.fingers.get(e.pointerId);if(!previous||s.phase!=='playing')return;e.preventDefault();const samples=e.getCoalescedEvents?.()||[e];for(const sample of samples.length?samples:[e]){const p=point(s,sample);s.game.stroke(previous,p);previous=p;}s.fingers.set(e.pointerId,previous);events(s);
    });
    const end=e=>{s.fingers.delete(e.pointerId);};for(const type of ['pointerup','pointercancel','lostpointercapture'])on(field,type,end);
    try{
      await Promise.all([image(base+(matchMedia('(max-aspect-ratio: 1/1)').matches?'garden-portrait.webp':'garden.webp')),image(base+'preview.webp')]);if(session!==s)return;s.phase='intro';levelLabel(s);const start=dialog.querySelector('[data-bs-start]');start.disabled=false;start.textContent='Let’s splash!';on(start,'click',()=>startRound(s));speak(s,'intro');start.focus({preventScroll:true});
    }catch{
      if(session!==s)return;s.phase='error';const overlay=dialog.querySelector('.bs-overlay');overlay.innerHTML='<div class="bs-intro-content"><h2>The garden is still loading</h2><p>Your progress is safe. Let’s try again.</p><button class="bs-primary" data-bs-retry>Try again</button><button class="bs-secondary" data-bs-back>Back to games</button></div>';on(overlay.querySelector('[data-bs-retry]'),'click',open);on(overlay.querySelector('[data-bs-back]'),'click',close);
    }
  }
  function levelLabel(s){const config=core.settings(s.level);dialog.querySelector('[data-bs-level]').textContent='Trail '+s.level;dialog.querySelector('[data-bs-boss]').textContent=bossNames[config.boss];dialog.querySelector('[data-bs-easier]').disabled=s.level===1;dialog.querySelector('[data-bs-harder]').disabled=s.level===12;}
  function point(s,e){const r=s.field.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  function resize(s){
    if(session!==s)return;const r=s.field.getBoundingClientRect();if(r.width<160||r.height<130)return;s.width=r.width;s.height=r.height;const dpr=Math.min(2,devicePixelRatio||1);s.canvas.width=Math.round(r.width*dpr);s.canvas.height=Math.round(r.height*dpr);s.c.setTransform(dpr,0,0,dpr,0,0);s.game?.resize(r.width,r.height);s.fingers.clear();if(s.game){paint.draw(s.c,s.game);targets(s);}
  }
  function startRound(s){
    if(session!==s||!['intro','won'].includes(s.phase))return;
    if(!qualityReady()){close();return;}
    if(globalThis.meadowLittlesAccess?.begin('bug_smash',close)===false)return;
    resize(s);s.game=new core.Game(s.width,s.height,{level:s.level});s.phase='playing';s.last=0;s.armourHeard=false;s.voice='intro';s.fingers.clear();s.buttons.forEach(n=>n.remove());s.buttons.clear();const announcement=dialog.querySelector('.bs-announcement');announcement.textContent='';announcement.classList.remove('bs-bounce');s.announceUntil=0;dialog.querySelector('.bs-overlay')?.remove();dialog.querySelector('[data-bs-pause]').disabled=false;speak(s,'intro');update(s);cancelAnimationFrame(s.frame);s.frame=requestAnimationFrame(t=>tick(s,t));
  }
  function update(s){
    const g=s.game,b=g.boss,goal=g.config.goal+1,progress=g.hits+(g.done?1:0),task=dialog.querySelector('[data-bs-task]'),detail=dialog.querySelector('[data-bs-detail]');
    dialog.querySelector('.bs-counter').textContent=progress+' / '+goal;const meter=dialog.querySelector('.bs-progress');meter.setAttribute('aria-valuemax',goal);meter.setAttribute('aria-valuenow',progress);meter.firstElementChild.style.width=progress/goal*100+'%';
    if(!b){task.textContent='Trail '+s.level+' · Colour splash';detail.textContent='Tap an ant. Big shells need more taps.';return;}
    task.textContent=bossNames[b.type];
    detail.textContent=g.phase==='boss-enter'?'Here comes a big paint bug!':b.stage==='body'?'Now tap that big tummy! '+b.hp+' to go.':b.stage==='splash'?'A brilliant rainbow splash!':b.type==='acorn'?'Tap the three shiny acorn clasps.':b.type==='bubble'?'Pop the bubbles. Taps and swipes both work.':'Rub the glowing tummy back and forth.';
  }
  function events(s){
    if(session!==s||!s.game)return;let changed=false;
    for(const e of s.game.drain()){
      changed=true;
      if(e.type==='squish')sound('harvest');
      else if(['clasp-pop','armour-hit','boss-hit'].includes(e.type))sound('tap');
      else if(e.type==='bubble-pop')sound('care');
      if(e.type==='armour-hit'&&!s.armourHeard){s.armourHeard=true;speak(s,'armour');}
      if(e.type==='boss-enter'){s.fingers.clear();announce(s,bossNames[e.boss]+'!');s.voice=e.boss;speak(s,s.voice);}
      if(e.type==='shell-open'){s.fingers.clear();s.voice='tummy';speak(s,'tummy');sound('care');announce(s,'Shell open!');}
      if(e.type==='won'){s.phase='finishing';s.finishIn=s.reduced?.35:1.1;s.fingers.clear();sound('reward');}
    }
    if(changed){update(s);targets(s);}
  }
  function announce(s,text){s.announceUntil=s.game.elapsed+2;const node=dialog.querySelector('.bs-announcement');node.textContent=text;node.classList.remove('bs-bounce');void node.offsetWidth;node.classList.add('bs-bounce');}
  function targets(s){
    const g=s.game;if(!g)return;const live=[];
    if(g.phase==='ants')for(const a of g.ants){const x=a.x-a.r*1.75,y=a.y-a.r*1.25,w=a.r*3.5,h=a.r*2.5;if(x<0||y<0||x+w>s.width||y+h>s.height)continue;live.push({id:String(a.id),x,y,w,h,label:(a.armoured?'Armoured ':'')+core.colours[a.colour][0]+' ant'+(a.armoured?' · '+a.hp+' taps left':'')});}
    else if(g.phase==='boss'){
      const b=g.boss;if(b.stage==='shield'&&b.type==='tickle')live.push({id:'tickle-belly',x:b.x-b.r*1.1,y:b.y-b.r*.9,w:b.r*1.8,h:b.r*1.8,label:'Rub Tickle Tank’s tummy · '+Math.floor(b.tickle/b.tickleGoal*100)+'% tickled'});
      else if(b.stage==='shield')for(const p of g.parts())live.push({id:p.id,x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2,label:(b.type==='acorn'?'Shiny acorn clasp ':'Bubble shield ')+(p.index+1)+' · '+p.hp+' taps left'});
      else if(b.stage==='body')live.push({id:'boss-body',x:b.x-b.r*1.65,y:b.y-b.r*1.1,w:b.r*3.3,h:b.r*2.2,label:'Tap '+bossNames[b.type]+'’s tummy · '+b.hp+' taps left'});
    }
    const ids=new Set(live.map(t=>t.id));for(const[id,n]of s.buttons)if(!ids.has(id)){n.remove();s.buttons.delete(id);}
    for(const t of live){let n=s.buttons.get(t.id);if(!n){n=document.createElement('button');n.className='bs-ant-key';n.type='button';n.onclick=e=>{if(e.detail!==0||s.phase!=='playing')return;s.game.accessible(t.id);events(s);};dialog.querySelector('.bs-bug-controls').append(n);s.buttons.set(t.id,n);}if(n.getAttribute('aria-label')!==t.label)n.setAttribute('aria-label',t.label);n.style.transform='translate3d('+t.x+'px,'+t.y+'px,0)';n.style.width=t.w+'px';n.style.height=t.h+'px';n.disabled=s.phase!=='playing';}
  }
  function tick(s,time){
    if(session!==s||!['playing','finishing'].includes(s.phase))return;const dt=s.last?Math.min(.05,(time-s.last)/1000):0;s.last=time;s.game.step(dt);events(s);if(s.announceUntil&&s.game.elapsed>=s.announceUntil){s.announceUntil=0;const node=dialog.querySelector('.bs-announcement');node.textContent='';node.classList.remove('bs-bounce');}paint.draw(s.c,s.game);targets(s);
    if(s.phase==='finishing'){s.finishIn-=dt;if(s.finishIn<=0){win(s);return;}}s.frame=requestAnimationFrame(t=>tick(s,t));
  }
  function pause(s){
    if(session!==s||!['playing','finishing'].includes(s.phase))return;s.resumePhase=s.phase;s.phase='paused';s.game.paused=true;s.fingers.clear();cancelAnimationFrame(s.frame);s.frame=0;stopVoice();s.buttons.forEach(n=>n.disabled=true);
    const overlay=document.createElement('section');overlay.className='bs-overlay';overlay.innerHTML='<div class="bs-intro-content bs-pause"><h2>A little pause</h2><p>Your paint parade will wait.</p><button class="bs-primary" data-bs-resume>Keep splashing</button><button class="bs-secondary" data-bs-done>Back to games</button></div>';dialog.querySelector('.bs-scene').append(overlay);overlay.querySelector('[data-bs-done]').onclick=close;overlay.querySelector('[data-bs-resume]').onclick=()=>{if(document.hidden||session!==s)return;overlay.remove();s.phase=s.resumePhase;s.game.paused=false;s.last=0;speak(s,s.voice);s.frame=requestAnimationFrame(t=>tick(s,t));};overlay.querySelector('[data-bs-resume]').focus({preventScroll:true});
  }
  function win(s){
    if(session!==s||s.phase!=='finishing')return;s.phase='won';s.game.paused=true;s.frame=0;s.buttons.forEach(n=>n.disabled=true);dialog.querySelector('[data-bs-pause]').disabled=true;const accepted=completed(s.level)!==false;s.voice='done';speak(s,'done');
    const overlay=document.createElement('section');overlay.className='bs-overlay bs-win';overlay.innerHTML='<div class="bs-intro-content bs-win-card"><img class="bs-win-farmer" src="assets/generated/guides/rhys.webp" alt="Farmer Rhys"><h2>Brilliant splashing!</h2><div class="bs-win-stars" aria-label="Three meadow stars">★ ★ ★</div><p>You splashed '+s.game.hits+' ants and '+bossNames[s.game.boss.type]+'.<br>What a colourful garden!</p>'+(accepted?'<button class="bs-primary" data-bs-next>'+(s.level<12?'Next trail · '+(s.level+1):'Another rainbow parade')+'</button><button class="bs-secondary" data-bs-again>Play this trail again</button>':'')+'<button class="bs-secondary" data-bs-done>No thanks</button></div>';
    // A finishing finger cannot activate a newly appeared play button underneath it.
    let fresh=false;overlay.addEventListener('pointerdown',()=>fresh=true,true);overlay.addEventListener('click',e=>{if(e.detail>0&&!fresh){e.preventDefault();e.stopImmediatePropagation();}},true);dialog.querySelector('.bs-scene').append(overlay);
    overlay.querySelector('[data-bs-next]')?.addEventListener('click',()=>{s.level=Math.min(12,s.level+1);startRound(s);});overlay.querySelector('[data-bs-again]')?.addEventListener('click',()=>startRound(s));overlay.querySelector('[data-bs-done]').onclick=close;globalThis.meadowCelebration?.decorate(overlay.firstElementChild);overlay.querySelector('[data-bs-next], [data-bs-done]').focus({preventScroll:true});
  }
  globalThis.meadowBugSmash={open,close,attach:({completed:fn,level}={})=>{completed=fn||(()=>true);getLevel=level||(()=>1);}};
})();
