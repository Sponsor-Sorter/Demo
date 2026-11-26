/* One owned, touch-first game loop; actual taps/rubs and shared completed-round accounting. */
(() => {
  'use strict';
  const core=globalThis.meadowBugPicnicCore,paint=globalThis.meadowBugPicnicPaint,base='assets/generated/bug-picnic/';
  const bossNames={acorn:'Captain Acorn',bubble:'Bubble Boss',tickle:'Tickle Tank'};
  const icon={sound:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12h6l7-6v20l-7-6H5Z"/><path d="M23 10q7 6 0 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',pause:'<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="8" y="6" width="6" height="20" rx="2"/><rect x="19" y="6" width="6" height="20" rx="2"/></svg>',close:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m9 9 14 14M23 9 9 23" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>'};
  let dialog,session=null,completed=()=>true,getLevel=()=>1,returnFocus;
  const qualityReady=()=>{try{const n=globalThis.meadowWeeklyFair?.getQualityBuild?.();return Number.isSafeInteger(n)&&n>=99;}catch{return false;}};
  // Accessibility activation can have detail=1 without a pointer sequence.
  // Suppress only a matching pointer gesture that already performed the action.
  function activationOrigin(s,e,control=null,allowActive=false){
    if(e.detail===0)return null;
    if(Number.isInteger(e.pointerId)&&e.pointerId>=0){const origin=s.pointerOrigins.get(e.pointerId);return origin&&(allowActive||origin.ended)?origin:null;}
    const matches=[...s.pointerOrigins.values()].filter(origin=>origin.ended&&origin.control===control);
    return matches.length===1?matches[0]:null;
  }
  const sound=id=>globalThis.meadowAudio?.play(id),stopVoice=()=>globalThis.meadowAudio?.stopVoice();
  function speak(s,id){if(session===s&&!document.hidden)globalThis.meadowAudio?.speak((['intro','wave','done'].includes(id)?'bug99-rhys-':'bug-rhys-')+id);}
  function image(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Bug artwork unavailable'));img.src=url;});}
  function close(){
    const s=session;if(s){s.abort.abort();cancelAnimationFrame(s.frame);s.resize.disconnect();s.fingers.clear();s.pointerOrigins.clear();session=null;}
    stopVoice();dialog?.close();const target=returnFocus?.isConnected?returnFocus:document.querySelector('[data-play="bug_smash"]');target?.focus?.({preventScroll:true});
  }
  async function open(){
    if(!qualityReady())return;
    close();returnFocus=document.activeElement;
    if(!dialog){dialog=document.createElement('dialog');dialog.className='bsm-dialog bsm-picnic';dialog.setAttribute('aria-label','Rainbow Bug Smash');document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});}
    dialog.innerHTML='<main class="bsm-scene"><header class="bsm-header"><img class="bsm-farmer" src="assets/generated/guides/rhys.webp" alt="Farmer Rhys"><h2>Rainbow <br>Bug Smash</h2><button data-bsm-listen aria-label="Hear the farmer">'+icon.sound+'</button><button data-bsm-pause aria-label="Pause game" disabled>'+icon.pause+'</button><button data-bsm-close aria-label="Back to games">'+icon.close+'</button></header><div class="bsm-field"><canvas aria-hidden="true"></canvas><div class="bsm-bug-controls" role="group" aria-label="Colourful ants and boss targets"></div><div class="bsm-announcement" aria-live="polite"></div></div><footer class="bsm-footer"><div class="bsm-waves" aria-label="Three picnic waves"><i></i><i></i><i></i></div><div class="bsm-task"><strong data-bsm-task>Make a rainbow!</strong><span data-bsm-detail>Tap colourful ants. Big shells need a few taps.</span><div class="bsm-progress" role="progressbar" aria-label="Bug parade progress" aria-valuemin="0" aria-valuemax="9" aria-valuenow="0"><i></i></div></div><b class="bsm-counter" aria-live="polite">0 / 9</b></footer><section class="bsm-overlay bsm-start"><div class="bsm-intro-content"><small>FARMER RHYS’S PICNIC PATROL</small><h2>Protect our picnic!</h2><img class="bsm-intro-art" src="'+base+'preview.webp" alt="Top-down picnic food with colourful ants, an armoured ant and a bubble boss"><p>Tap the ants before they reach our food.<br>Three busy waves, then a big boss!</p><div class="bsm-level-picker"><button data-bsm-easier aria-label="Previous level">−</button><span><b data-bsm-level>Trail 1</b><small data-bsm-boss>Captain Acorn</small></span><button data-bsm-harder aria-label="Next level">+</button></div><button class="bsm-primary" data-bsm-start disabled>Packing the picnic…</button><button class="bsm-secondary" data-bsm-no>No thanks</button></div></section></main>';
    dialog.showModal();const field=dialog.querySelector('.bsm-field'),canvas=field.querySelector('canvas'),s={field,canvas,c:canvas.getContext('2d'),abort:new AbortController(),phase:'loading',level:core.settings(getLevel()).level,game:null,frame:0,last:0,finishIn:0,armourHeard:false,buttons:new Map(),fingers:new Map(),pointerOrigins:new Map(),voice:'intro',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,resize:null};session=s;
    const on=(node,event,fn,options={})=>node.addEventListener(event,fn,{...options,signal:s.abort.signal});
    on(dialog,'pointerdown',e=>{s.pointerOrigins.set(e.pointerId,{target:e.target,control:e.target.closest?.('.bsm-ant-key')||null,consumed:false,ended:false,cancelled:false});},{capture:true});
    const finishOrigin=e=>{
      if(e.type==='lostpointercapture'&&field.hasPointerCapture?.(e.pointerId))return;
      const origin=s.pointerOrigins.get(e.pointerId);if(!origin)return;
      if(e.type==='pointerup')origin.ended=true;else if(!origin.ended){origin.ended=true;origin.cancelled=true;}
      // Keep the matching origin through its compatibility click, then retire it.
      setTimeout(()=>{if(s.pointerOrigins.get(e.pointerId)===origin)s.pointerOrigins.delete(e.pointerId);},0);
    };
    for(const type of ['pointerup','pointercancel','lostpointercapture'])on(dialog,type,finishOrigin,{capture:true});
    s.resize=new ResizeObserver(()=>resize(s));s.resize.observe(field);resize(s);
    globalThis.addEventListener?.('meadow-quality-change',()=>{if(!qualityReady())close();},{signal:s.abort.signal});
    const levelChange=delta=>{if(session!==s||s.phase!=='intro')return;s.level=core.settings(s.level+delta).level;levelLabel(s);sound('tap');};
    on(dialog.querySelector('[data-bsm-easier]'),'click',()=>levelChange(-1));on(dialog.querySelector('[data-bsm-harder]'),'click',()=>levelChange(1));
    on(dialog.querySelector('[data-bsm-close]'),'click',close);on(dialog.querySelector('[data-bsm-no]'),'click',close);on(dialog.querySelector('[data-bsm-listen]'),'click',()=>speak(s,s.voice));on(dialog.querySelector('[data-bsm-pause]'),'click',()=>pause(s));
    on(document,'visibilitychange',()=>{if(document.hidden){s.pointerOrigins.clear();pause(s);}});
    on(field,'pointerdown',e=>{
      if(session!==s||s.phase!=='playing'||e.button>0)return;e.preventDefault();const p=point(s,e);s.fingers.set(e.pointerId,p);try{field.setPointerCapture(e.pointerId);}catch{}const used=s.game.tap(p),origin=s.pointerOrigins.get(e.pointerId);if(used&&origin)origin.consumed=true;events(s);
    });
    on(field,'pointermove',e=>{
      let previous=s.fingers.get(e.pointerId);if(!previous||s.phase!=='playing')return;e.preventDefault();const samples=e.getCoalescedEvents?.()||[e];for(const sample of samples.length?samples:[e]){const p=point(s,sample);const used=s.game.stroke(previous,p),origin=s.pointerOrigins.get(e.pointerId);if(used&&origin)origin.consumed=true;previous=p;}s.fingers.set(e.pointerId,previous);events(s);
    });
    const end=e=>{if(e.type==='lostpointercapture'&&field.hasPointerCapture?.(e.pointerId))return;s.fingers.delete(e.pointerId);};for(const type of ['pointerup','pointercancel','lostpointercapture'])on(field,type,end);
    try{
      await Promise.all([image(base+'ground.webp'),image(base+'preview.webp'),image(base+'food.webp').then(img=>s.food=img)]);if(session!==s)return;s.phase='intro';levelLabel(s);const start=dialog.querySelector('[data-bsm-start]');start.disabled=false;start.textContent='Protect the picnic!';on(start,'click',()=>startRound(s));speak(s,'intro');start.focus({preventScroll:true});
    }catch{
      if(session!==s)return;s.phase='error';const overlay=dialog.querySelector('.bsm-overlay');overlay.innerHTML='<div class="bsm-intro-content"><h2>The picnic is still loading</h2><p>Your progress is safe. Let’s try again.</p><button class="bsm-primary" data-bsm-retry>Try again</button><button class="bsm-secondary" data-bsm-back>Back to games</button></div>';on(overlay.querySelector('[data-bsm-retry]'),'click',open);on(overlay.querySelector('[data-bsm-back]'),'click',close);
    }
  }
  function levelLabel(s){const config=core.settings(s.level);dialog.querySelector('[data-bsm-level]').textContent='Picnic '+s.level;dialog.querySelector('[data-bsm-boss]').textContent=bossNames[config.boss];dialog.querySelector('[data-bsm-easier]').disabled=s.level===1;dialog.querySelector('[data-bsm-harder]').disabled=s.level===12;}
  function point(s,e){const r=s.field.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  function resize(s){
    if(session!==s)return;const r=s.field.getBoundingClientRect();if(r.width<160||r.height<130)return;s.width=r.width;s.height=r.height;const dpr=Math.min(2,devicePixelRatio||1);s.canvas.width=Math.round(r.width*dpr);s.canvas.height=Math.round(r.height*dpr);s.c.setTransform(dpr,0,0,dpr,0,0);s.game?.resize(r.width,r.height);s.fingers.clear();if(s.game){paint.draw(s.c,s.game,{food:s.food});targets(s);}
  }
  function startRound(s){
    if(session!==s||!['intro','won'].includes(s.phase))return;
    if(!qualityReady()){close();return;}
    if(globalThis.meadowLittlesAccess?.begin('bug_smash',close)===false)return;
    resize(s);s.game=new core.Game(s.width,s.height,{level:s.level});s.phase='playing';s.last=0;s.armourHeard=false;s.voice='intro';s.fingers.clear();s.pointerOrigins.clear();s.buttons.forEach(n=>n.remove());s.buttons.clear();const announcement=dialog.querySelector('.bsm-announcement');announcement.textContent='';announcement.classList.remove('bsm-bounce');s.announceUntil=0;dialog.querySelector('.bsm-overlay')?.remove();dialog.querySelector('[data-bsm-pause]').disabled=false;speak(s,'intro');update(s);cancelAnimationFrame(s.frame);s.frame=requestAnimationFrame(t=>tick(s,t));
  }
  function update(s){
    const g=s.game,b=g.boss,goal=g.config.goal+1,progress=g.hits+(g.done?1:0),task=dialog.querySelector('[data-bsm-task]'),detail=dialog.querySelector('[data-bsm-detail]');
    dialog.querySelector('.bsm-counter').textContent=b?'Big bug!':(g.wave+1)+' / 3';dialog.querySelectorAll('.bsm-waves i').forEach((n,i)=>{n.className=i<g.wave||b?'bsm-wave-done':i===g.wave?'bsm-wave-active':'';});const meter=dialog.querySelector('.bsm-progress');meter.setAttribute('aria-valuemax',goal);meter.setAttribute('aria-valuenow',progress);meter.firstElementChild.style.width=progress/goal*100+'%';
    if(!b){task.textContent=g.phase==='wave-break'?'Wonderful picnic patrol!':'Protect our picnic!';detail.textContent=g.phase==='wave-break'?'Here comes wave '+(g.wave+2)+'…':'Wave '+(g.wave+1)+' of 3 · Tap the ants coming for our food.';return;}
    task.textContent=bossNames[b.type];
    detail.textContent=g.phase==='boss-enter'?'A big bug wants our picnic!' :b.stage==='body'?'Now tap that big tummy! '+b.hp+' to go.':b.stage==='splash'?'Our picnic is safe!' :b.type==='acorn'?'Tap the three shiny acorn clasps.':b.type==='bubble'?'Pop the bubbles. Taps and swipes both work.':'Rub the glowing tummy back and forth.';
  }
  function events(s){
    if(session!==s||!s.game)return;let changed=false;
    for(const e of s.game.drain()){
      changed=true;
      if(e.type==='squish')sound('harvest');
      else if(['clasp-pop','armour-hit','boss-hit'].includes(e.type))sound('tap');
      else if(e.type==='bubble-pop')sound('care');
      if(e.type==='armour-hit'&&!s.armourHeard){s.armourHeard=true;speak(s,'armour');}
      if(e.type==='wave-clear'){s.fingers.clear();s.voice='wave';speak(s,'wave');sound('care');announce(s,'Wave '+e.wave+' complete!');}
      if(e.type==='wave-start'){s.voice='intro';announce(s,'Wave '+e.wave+' · Picnic patrol!');}
      if(e.type==='food-saved'){sound('care');announce(s,'Snack saved!');}
      if(e.type==='combo'&&!s.announceUntil)announce(s,'Rainbow splashes!');
      if(e.type==='boss-enter'){s.fingers.clear();announce(s,bossNames[e.boss]+'!');s.voice=e.boss;speak(s,s.voice);}
      if(e.type==='shell-open'){s.fingers.clear();s.voice='tummy';speak(s,'tummy');sound('care');announce(s,'Shell open!');}
      if(e.type==='won'){s.voice='done';s.phase='finishing';s.finishIn=s.reduced?.35:1.1;s.fingers.clear();sound('reward');}
    }
    if(changed){update(s);targets(s);}
  }
  function announce(s,text){s.announceUntil=s.game.elapsed+2;const node=dialog.querySelector('.bsm-announcement');node.textContent=text;node.classList.remove('bsm-bounce');void node.offsetWidth;node.classList.add('bsm-bounce');}
  function targets(s){
    const g=s.game;if(!g)return;const live=[];
    if(g.phase==='ants')for(const a of g.ants){const {x,y,w,h}=core.antBounds(a);if(x<0||y<0||x+w>s.width||y+h>s.height)continue;live.push({id:String(a.id),x,y,w,h,label:(a.armoured?'Armoured ':'')+core.colours[a.colour][0]+' ant'+(a.armoured?' · '+a.hp+' taps left':'')});}
    else if(g.phase==='boss'){
      const b=g.boss;if(b.stage==='shield'&&b.type==='tickle')live.push({id:'tickle-belly',x:b.x-b.r*1.1,y:b.y-b.r*.9,w:b.r*1.8,h:b.r*1.8,label:'Rub Tickle Tank’s tummy · '+Math.floor(b.tickle/b.tickleGoal*100)+'% tickled'});
      else if(b.stage==='shield')for(const p of g.parts())live.push({id:p.id,x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2,label:(b.type==='acorn'?'Shiny acorn clasp ':'Bubble shield ')+(p.index+1)+' · '+p.hp+' taps left'});
      else if(b.stage==='body')live.push({id:'boss-body',x:b.x-b.r*1.65,y:b.y-b.r*1.1,w:b.r*3.3,h:b.r*2.2,label:'Tap '+bossNames[b.type]+'’s tummy · '+b.hp+' taps left'});
    }
    const ids=new Set(live.map(t=>t.id));for(const[id,n]of s.buttons)if(!ids.has(id)){n.remove();s.buttons.delete(id);}
    for(const t of live){let n=s.buttons.get(t.id);if(!n){n=document.createElement('button');n.className='bsm-ant-key';n.type='button';n.onclick=e=>{
        if(session!==s||s.phase!=='playing'||!n.isConnected||s.buttons.get(t.id)!==n)return;
        const origin=activationOrigin(s,e,n);
        if(origin&&(origin.cancelled||origin.control!==n))return;
        if(origin?.consumed){origin.consumed=false;return;}
        s.game.accessible(t.id);events(s);
      };dialog.querySelector('.bsm-bug-controls').append(n);s.buttons.set(t.id,n);}if(n.getAttribute('aria-label')!==t.label)n.setAttribute('aria-label',t.label);n.style.transform='translate3d('+t.x+'px,'+t.y+'px,0)';n.style.width=t.w+'px';n.style.height=t.h+'px';n.disabled=s.phase!=='playing';}
  }
  function tick(s,time){
    if(session!==s||!['playing','finishing'].includes(s.phase))return;const dt=s.last?Math.min(.05,(time-s.last)/1000):0;s.last=time;s.game.step(dt);events(s);if(s.announceUntil&&s.game.elapsed>=s.announceUntil){s.announceUntil=0;const node=dialog.querySelector('.bsm-announcement');node.textContent='';node.classList.remove('bsm-bounce');}paint.draw(s.c,s.game,{food:s.food});targets(s);
    if(s.phase==='finishing'){s.finishIn-=dt;if(s.finishIn<=0){win(s);return;}}s.frame=requestAnimationFrame(t=>tick(s,t));
  }
  function pause(s){
    if(session!==s||!['playing','finishing'].includes(s.phase))return;s.resumePhase=s.phase;s.phase='paused';s.game.paused=true;s.fingers.clear();s.pointerOrigins.clear();cancelAnimationFrame(s.frame);s.frame=0;stopVoice();s.buttons.forEach(n=>n.disabled=true);
    const overlay=document.createElement('section');overlay.className='bsm-overlay';overlay.innerHTML='<div class="bsm-intro-content bsm-pause"><h2>A little pause</h2><p>Your picnic patrol will wait.</p><button class="bsm-primary" data-bsm-resume>Keep protecting</button><button class="bsm-secondary" data-bsm-done>Back to games</button></div>';dialog.querySelector('.bsm-scene').append(overlay);overlay.querySelector('[data-bsm-done]').onclick=close;overlay.querySelector('[data-bsm-resume]').onclick=()=>{if(document.hidden||session!==s)return;overlay.remove();s.phase=s.resumePhase;s.game.paused=false;s.last=0;if(s.phase==='playing')speak(s,s.voice);s.frame=requestAnimationFrame(t=>tick(s,t));};overlay.querySelector('[data-bsm-resume]').focus({preventScroll:true});
  }
  function win(s){
    if(session!==s||s.phase!=='finishing')return;s.phase='won';s.game.paused=true;s.frame=0;s.buttons.forEach(n=>n.disabled=true);dialog.querySelector('[data-bsm-pause]').disabled=true;const accepted=completed(s.level)!==false;s.voice='done';speak(s,'done');
    const overlay=document.createElement('section');overlay.className='bsm-overlay bsm-win';overlay.innerHTML='<div class="bsm-intro-content bsm-win-card"><img class="bsm-win-farmer" src="assets/generated/guides/rhys.webp" alt="Farmer Rhys"><h2>Picnic protected!</h2><div class="bsm-win-stars" aria-label="Three meadow stars">★ ★ ★</div><p>Three waves · '+s.game.hits+' ants · '+Math.floor(s.game.elapsed/60)+'m '+Math.floor(s.game.elapsed%60)+'s<br>You stopped '+bossNames[s.game.boss.type]+'!</p>'+(accepted?'<button class="bsm-primary" data-bsm-next>'+(s.level<12?'Next picnic · '+(s.level+1):'Another picnic patrol')+'</button><button class="bsm-secondary" data-bsm-again>Play this picnic again</button>':'')+'<button class="bsm-secondary" data-bsm-done>No thanks</button></div>';
    // A finishing finger cannot activate a newly appeared play button underneath it.
    overlay.addEventListener('click',e=>{const origin=activationOrigin(s,e,null,true);if(origin&&(origin.cancelled||!overlay.contains(origin.target))){e.preventDefault();e.stopImmediatePropagation();}},true);dialog.querySelector('.bsm-scene').append(overlay);
    overlay.querySelector('[data-bsm-next]')?.addEventListener('click',()=>{s.level=s.level<12?s.level+1:10;startRound(s);});overlay.querySelector('[data-bsm-again]')?.addEventListener('click',()=>startRound(s));overlay.querySelector('[data-bsm-done]').onclick=close;globalThis.meadowCelebration?.decorate(overlay.firstElementChild);overlay.querySelector('[data-bsm-next], [data-bsm-done]').focus({preventScroll:true});
  }
  globalThis.meadowBugPicnic={open,close,attach:({completed:fn,level}={})=>{completed=fn||(()=>true);getLevel=level||(()=>1);}};
})();
