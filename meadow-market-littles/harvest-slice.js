/* One owned animation loop; real pointer sweeps, separated cut sprites and gentle endless retries. */
(() => {
  'use strict';
  const core=window.meadowHarvestSliceCore,base='assets/generated/harvest-slice/';
  let dialog,session=null,completed=()=>{},level=()=>1;
  const roundGoal=()=>12+(Math.max(1,Math.min(3,Number(level())||1))-1)*2;
  const sound=id=>window.meadowAudio?.play(id),voice=id=>window.meadowAudio?.speak(id);
  function image(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not load harvest artwork'));img.src=url;});}
  function close(){
    if(session){session.abort.abort();cancelAnimationFrame(session.frame);session.resize.disconnect();session=null;}
    window.meadowAudio?.stopVoice();dialog?.close();
  }
  async function open(){
    close();
    if(!dialog){dialog=document.createElement('dialog');dialog.className='hs-dialog';dialog.setAttribute('aria-label','Harvest Slice');document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});}
    dialog.innerHTML='<main class="hs-scene"><header class="hs-header"><img src="assets/generated/guides/jay.webp" alt="Farmer Jay"><h2>Harvest Slice</h2><div class="hs-count" aria-live="polite"><span data-hs-count>0</span><small> / 12</small></div><button data-hs-help aria-label="Hear how to slice">🔊</button><button data-hs-pause aria-label="Pause game">Ⅱ</button><button data-hs-close aria-label="Back to games">×</button></header><div class="hs-field"><canvas aria-hidden="true"></canvas><div class="hs-fruit-controls" role="group" aria-label="Flying fruit and vegetables"></div><div class="hs-swipe-hint" aria-hidden="true">☝</div><p class="hs-combo" aria-live="polite"></p></div><footer class="hs-counter"><div class="hs-basket"><div class="hs-collected"></div><img src="assets/generated/play-pieces/harvest-basket.webp" alt="Harvest basket"></div><div class="hs-progress"><span data-hs-message>Swipe across the fruit and vegetables!</span><div role="progressbar" aria-label="Harvest bowl" aria-valuemin="0" aria-valuemax="12" aria-valuenow="0"><i></i></div></div></footer><section class="hs-overlay"><div class="hs-paper hs-intro"><small>FARMER JAY’S HARVEST</small><h2>Let’s slice the harvest!</h2><img class="hs-demo" src="'+base+'preview.webp" alt="Fruit tossed into the air and sliced with a finger swipe"><p>Swipe your finger through the flying fruit and vegetables.<br>Fill the basket. Take your time!</p><button class="hs-primary" data-hs-start disabled>Getting the harvest ready…</button><button class="hs-secondary" data-hs-intro-close>No thanks</button></div></section></main>';
    dialog.querySelector('.hs-swipe-hint').hidden=true;dialog.querySelector('.hs-count small').textContent=' / '+roundGoal();dialog.querySelector('[role=progressbar]').setAttribute('aria-valuemax',roundGoal());dialog.showModal();
    const scene=dialog.querySelector('.hs-scene'),field=dialog.querySelector('.hs-field'),canvas=field.querySelector('canvas'),context=canvas.getContext('2d'),abort=new AbortController();
    const s={abort,scene,field,canvas,context,game:null,phase:'loading',finger:null,trail:[],buttons:new Map(),frame:0,last:0,finishIn:0,comboUntil:0,comboCount:0,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,resize:new ResizeObserver(()=>resize(s))};
    session=s;s.resize.observe(field);
    const listen=(node,event,fn)=>node.addEventListener(event,fn,{signal:abort.signal});
    listen(dialog.querySelector('[data-hs-close]'),'click',close);listen(dialog.querySelector('[data-hs-intro-close]'),'click',close);
    listen(dialog.querySelector('[data-hs-help]'),'click',()=>voice('slice-jay-intro'));
    listen(dialog.querySelector('[data-hs-pause]'),'click',()=>pause(s));
    listen(document,'visibilitychange',()=>{if(document.hidden)pause(s);});
    listen(scene,'pointerdown',e=>{
      if(s.phase!=='playing'||s.finger||e.button>0||e.isPrimary===false||e.target.closest?.('.hs-header,.hs-overlay'))return;
      e.preventDefault();scene.setPointerCapture?.(e.pointerId);const p=point(s,e);s.finger={id:e.pointerId,...p};s.trail=[{...p,t:performance.now()}];s.comboCount=0;
    });
    listen(scene,'pointermove',e=>{
      if(s.phase!=='playing'||s.finger?.id!==e.pointerId)return;e.preventDefault();
      const samples=e.getCoalescedEvents?.()||[e];for(const sample of samples.length?samples:[e]){
        const p=point(s,sample),hits=s.game.slice(s.finger,p);s.finger={id:e.pointerId,...p};s.trail.push({...p,t:performance.now()});if(hits.length)cut(s,hits);
      }
    });
    const end=e=>{if(s.finger?.id===e.pointerId){if(e.type==='pointerup'&&s.phase==='playing'){const hits=s.game.slice(s.finger,point(s,e));if(hits.length)cut(s,hits);}s.finger=null;s.comboCount=0;}};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(scene,event,end);
    try{
      const [atlas,layout]=await Promise.all([image(base+'produce-atlas.webp'),fetch(base+'atlas.json').then(r=>{if(!r.ok)throw Error('Artwork layout unavailable');return r.json();})]);
      if(session!==s)return;
      if(layout.width!==atlas.naturalWidth||layout.height!==atlas.naturalHeight||!Array.isArray(layout.frames)||layout.frames.length!==6||layout.frames.some(row=>!Array.isArray(row)||row.length!==3||row.some(r=>![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>layout.width||r.y+r.h>layout.height)))throw Error('Artwork layout mismatch');
      s.atlas=atlas;s.frames=layout.frames;s.phase='intro';
      const start=dialog.querySelector('[data-hs-start]');start.disabled=false;start.textContent='Let’s play';listen(start,'click',()=>startRound(s));start.focus({preventScroll:true});
    }catch{
      if(session!==s)return;dialog.querySelector('.hs-paper').innerHTML='<h2>The harvest is still loading</h2><p>Please try again when your connection is ready. Your progress is safe.</p><button class="hs-primary" data-retry>Try again</button><button class="hs-secondary" data-close>Back to games</button>';listen(dialog.querySelector('[data-retry]'),'click',open);listen(dialog.querySelector('[data-close]'),'click',close);
    }
  }
  function point(s,e){const box=s.field.getBoundingClientRect();return {x:e.clientX-box.left,y:e.clientY-box.top};}
  function resize(s){
    if(session!==s)return;const box=s.field.getBoundingClientRect();if(!box.width||!box.height)return;
    const ratio=Math.min(2,devicePixelRatio||1);s.canvas.width=Math.round(box.width*ratio);s.canvas.height=Math.round(box.height*ratio);s.context.setTransform(ratio,0,0,ratio,0,0);s.width=box.width;s.height=box.height;
    s.game?.resize(box.width,box.height);s.finger=null;s.trail=[];
  }
  function startRound(s){
    if(session!==s)return;
    if(window.meadowLittlesAccess?.begin('harvest_slice',close)===false)return;
    resize(s);const goal=roundGoal();s.game=new core.Game(s.width,s.height,{goal});s.phase='playing';s.scene.classList.add('hs-playing');s.last=0;s.finger=null;s.trail=[];s.comboCount=0;s.buttons.forEach(n=>n.remove());s.buttons.clear();dialog.querySelector('.hs-overlay')?.remove();dialog.querySelector('.hs-collected').textContent='';const combo=dialog.querySelector('.hs-combo');combo.textContent='';combo.classList.remove('hs-pop');dialog.querySelector('.hs-count small').textContent=' / '+goal;dialog.querySelector('[role=progressbar]').setAttribute('aria-valuemax',goal);update(s);voice('slice-jay-intro');cancelAnimationFrame(s.frame);s.frame=requestAnimationFrame(now=>tick(s,now));
  }
  function pause(s){
    if(session!==s||!['playing','finishing'].includes(s.phase))return;
    s.resumePhase=s.phase;s.phase='paused';s.scene.classList.remove('hs-playing');s.game.paused=true;s.finger=null;s.trail=[];cancelAnimationFrame(s.frame);s.frame=0;s.buttons.forEach(b=>b.disabled=true);window.meadowAudio?.stopVoice();
    const overlay=document.createElement('section');overlay.className='hs-overlay';overlay.innerHTML='<div class="hs-paper"><h2>A little pause</h2><p>Your harvest will wait for you.</p><button class="hs-primary" data-resume>Keep playing</button><button class="hs-secondary" data-done>Back to games</button></div>';dialog.querySelector('.hs-scene').append(overlay);
    overlay.querySelector('[data-done]').onclick=close;overlay.querySelector('[data-resume]').onclick=()=>{if(document.hidden)return;overlay.remove();s.phase=s.resumePhase;s.scene.classList.add('hs-playing');s.game.paused=false;s.last=0;s.frame=requestAnimationFrame(t=>tick(s,t));};
  }
  function update(s){
    dialog.querySelector('[data-hs-count]').textContent=s.game.hits;
    const meter=dialog.querySelector('[role=progressbar]');meter.setAttribute('aria-valuenow',s.game.hits);meter.firstElementChild.style.width=s.game.hits/s.game.goal*100+'%';
    dialog.querySelector('[data-hs-message]').textContent=s.game.hits>=s.game.goal?'A lovely full harvest!':s.game.hits?'Lovely! Keep filling the basket.':'Swipe across the fruit and vegetables!';
  }
  function cut(s,hits){
    sound('harvest');s.comboCount+=hits.length;
    if(s.comboCount>=2){const combo=dialog.querySelector('.hs-combo');combo.textContent=s.comboCount===2?'Double slice!':'Lovely rainbow slice!';combo.classList.remove('hs-pop');void combo.offsetWidth;combo.classList.add('hs-pop');s.comboUntil=performance.now()+1100;}
    const collected=dialog.querySelector('.hs-collected');for(const f of hits){const p=document.createElement('canvas');p.width=64;p.height=64;p.style.setProperty('--fruit-turn',(f.id%5-2)*12+'deg');const r=s.frames[f.type][1],scale=58/Math.max(r.w,r.h);p.getContext('2d').drawImage(s.atlas,r.x,r.y,r.w,r.h,(64-r.w*scale)/2,(64-r.h*scale)/2,r.w*scale,r.h*scale);collected.append(p);}
    update(s);if(s.game.done){s.phase='finishing';s.finishIn=.7;s.finger=null;s.trail=[];}
  }
  function sprite(s,p,column=0){
    const c=s.context,r=s.frames[p.type][column],whole=s.frames[p.type][0],scale=p.r*2.1/Math.max(whole.w,whole.h),w=r.w*scale,h=r.h*scale;
    c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.globalAlpha=p.life===undefined?1:Math.min(1,p.life*2);c.drawImage(s.atlas,r.x,r.y,r.w,r.h,-w/2,-h/2,w,h);c.restore();
  }
  function tick(s,now){
    if(session!==s)return;const dt=s.last?Math.min(.05,(now-s.last)/1000):0;s.last=now;
    if(['playing','finishing'].includes(s.phase))s.game.step(dt);
    const c=s.context;c.clearRect(0,0,s.width,s.height);
    for(const p of s.game.pieces)sprite(s,p,p.column);
    for(const f of s.game.fruit)sprite(s,f);
    c.save();for(const p of s.game.drops){c.globalAlpha=Math.min(1,p.life*2);c.fillStyle=p.color;c.beginPath();c.ellipse(p.x,p.y,p.r,p.r*1.5,0,0,Math.PI*2);c.fill();}c.restore();
    s.trail=s.trail.filter(p=>now-p.t<190).slice(-36);
    if(s.trail.length>1){c.save();c.lineCap='round';c.lineJoin='round';c.shadowColor='#ffe978';c.shadowBlur=s.reduced?0:12;c.strokeStyle='#ffe367';c.lineWidth=10;c.beginPath();s.trail.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.shadowBlur=0;c.strokeStyle='#fffdf0';c.lineWidth=4;c.stroke();c.restore();}
    const live=new Set(s.game.fruit.filter(f=>f.y>=f.r&&f.y<=s.height-f.r&&f.x>=f.r&&f.x<=s.width-f.r).map(f=>f.id));
    for(const [id,button]of s.buttons)if(!live.has(id)){button.remove();s.buttons.delete(id);}
    for(const f of s.game.fruit){if(!live.has(f.id))continue;let button=s.buttons.get(f.id);if(!button){button=document.createElement('button');button.className='hs-fruit-key';button.setAttribute('aria-label','Slice the '+core.types[f.type][0]);button.onclick=e=>{if(e.detail!==0||s.phase!=='playing')return;const hit=s.game.accessibleCut(f.id);if(hit.length)cut(s,hit);};dialog.querySelector('.hs-fruit-controls').append(button);s.buttons.set(f.id,button);}button.style.cssText='left:'+(f.x-f.r)+'px;top:'+(f.y-f.r)+'px;width:'+(f.r*2)+'px;height:'+(f.r*2)+'px';button.disabled=s.phase!=='playing';}
    const hint=dialog.querySelector('.hs-swipe-hint'),first=s.game.fruit.find(f=>f.y<s.height*.65&&f.y>s.height*.15);hint.hidden=s.game.hits>0||!first||s.phase!=='playing';if(!hint.hidden){hint.style.left=first.x+'px';hint.style.top=(first.y+first.r*.4)+'px';}
    if(s.phase==='finishing'){s.finishIn-=dt;if(s.finishIn<=0)win(s);}
    if(s.phase==='won'){s.frame=0;return;}s.frame=requestAnimationFrame(t=>tick(s,t));
  }
  function win(s){
    if(session!==s||s.phase!=='finishing')return;s.phase='won';s.scene.classList.remove('hs-playing');s.game.paused=true;s.buttons.forEach(b=>b.disabled=true);completed();sound('reward');voice('slice-jay-done');
    const overlay=document.createElement('section');overlay.className='hs-overlay';overlay.innerHTML='<div class="hs-paper hs-result fa-win-card"><img class="hs-farmer" src="assets/generated/guides/jay.webp" alt="Farmer Jay"><h2>A lovely harvest!</h2><div class="fa-win-stars" aria-label="Three meadow stars">★ ★ ★</div><p>You sliced '+s.game.hits+' fruit and vegetables.<br>Our harvest basket is full!</p><button class="hs-primary" data-again>Another harvest</button><button class="hs-secondary" data-done>No thanks</button></div>';
    // A finishing finger must not click a button that appeared underneath it.
    let fresh=false;overlay.addEventListener('pointerdown',()=>fresh=true,true);overlay.addEventListener('click',e=>{if(e.detail>0&&!fresh){e.preventDefault();e.stopImmediatePropagation();}},true);
    dialog.querySelector('.hs-scene').append(overlay);overlay.querySelector('[data-again]').onclick=()=>startRound(s);overlay.querySelector('[data-done]').onclick=close;window.meadowCelebration?.decorate(overlay.firstElementChild);
  }
  window.meadowHarvestSlice={open,close,attach:(fn,getLevel)=>{completed=fn;level=getLevel||(()=>1);}};
})();
