(() => {
 'use strict';
 let host,run,frame;
 const art='assets/generated/journey/';
 const online=()=>!!window.meadowCommandUI?.active();
 function stop(){cancelAnimationFrame(frame);frame=null;host?.remove();host=null;run=null;window.meadowAudio?.stopVoice();}
 function open(kind,runId,onEnd){
  stop();const root=document.querySelector('#journey-world');if(!root?.open)return;
  run={kind,id:runId,onEnd,started:false,ended:false,starting:false,casts:0,score:0,found:0,wrong:0,actions:[],pauseStart:0,pausedMs:0};
  host=document.createElement('section');host.className='journey-activity journey-activity-'+kind;host.setAttribute('aria-label',kind==='fishing'?'Willow fishing':'Woodland gathering');host.style.backgroundImage='url("'+art+kind+'.webp")';root.append(host);intro();
 }
 function voice(){window.meadowAudio?.speak(run.kind==='fishing'?'rhys-journey-fishing':'jade-journey-forage');}
 function intro(){
  const r=run;host.innerHTML='<header class="journey-activity-head"><div><h2>'+(r.kind==='fishing'?'Willow fishing':'Woodland basket')+'</h2><p>'+(r.kind==='fishing'?'Stop the float inside the gold catch window. Three casts.':'Find the named berries, nuts or herbs. Twelve picks, forty-five seconds.')+'</p></div><button id="trip-listen" aria-label="Listen to the game instructions">🔊</button><button id="trip-back" aria-label="Leave this trip">×</button></header><div class="trip-intro"><img src="assets/generated/guides/'+(r.kind==='fishing'?'rhys':'jade')+'.webp" alt="Your farmer guide"><h3>'+(r.kind==='fishing'?'A quiet moment by the river':'A basket of woodland finds')+'</h3><p>'+(r.kind==='fishing'?'Tap Cast, or tap the water, when the float reaches the gold window. Accurate casts discover rarer fish.':'Watch the item named in the top bar. Tap its matching basket in the clearing. Wrong picks cost three seconds.')+'</p><button id="trip-start">Let’s begin</button></div>';
  host.querySelector('#trip-listen').onclick=voice;host.querySelector('#trip-back').onclick=()=>{const cb=run.onEnd;stop();cb(null);};host.querySelector('#trip-start').onclick=start;voice();
 }
 async function start(){
  const r=run;if(!r||r.starting)return;r.starting=true;
  const button=host.querySelector('#trip-start')||host.querySelector('#trip-retry');if(button){button.disabled=true;button.textContent='Preparing…';}
  try{
   if(online()){
    await window.meadowCommandUI.flush();if(run!==r)return;
    const reply=await window.meadowCommandUI.run([{type:'trip.start',data:{run:r.id}}],{quiet:true});if(run!==r)return;
    const proof=reply.summary.results.find(x=>x.type==='trip.start');r.attempt=proof.attempt;r.targets=proof.targets;
   }
   if(run!==r)return;
   Object.assign(r,{started:true,ended:false,score:0,casts:0,found:0,wrong:0,actions:[],clockStart:performance.now(),pauseStart:0,pausedMs:0,collectPending:false});
   for(const selector of ['.trip-intro','.trip-result','.trip-playfield','.trip-bottom','.trip-connection'])host.querySelector(selector)?.remove();
   const field=document.createElement('div');field.className='trip-playfield';host.append(field);
   const bottom=document.createElement('div');bottom.className='trip-bottom';host.append(bottom);
   if(r.kind==='fishing'){
    field.innerHTML='<div class="trip-float" aria-hidden="true">🎣</div><div class="trip-cast-meter" aria-label="Cast timing"><span class="trip-catch-window"></span><i class="trip-cast-marker"></i></div>';
    bottom.innerHTML='<strong id="trip-score">Cast 1 / 3</strong><button id="trip-cast">Cast</button>';bottom.querySelector('button').onclick=cast;field.onclick=cast;
   }else{
    if(!online())r.targets=Array.from({length:12},()=>['blackberry','hazelnut','wildherbs'][Math.floor(Math.random()*3)]);
    bottom.innerHTML='<strong id="trip-score">0 / 12</strong><span id="trip-time">45s</span>';placeFinds();updateTarget();
   }
   cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);
  }catch(e){if(run===r){host.querySelector('header p').textContent=e.message||'Reconnect to start this trip.';if(button){button.disabled=false;button.textContent='Try starting again';}}}finally{r.starting=false;}
 }
 function elapsed(r,now=performance.now()){return Math.max(0,((r.pauseStart||now)-r.clockStart-r.pausedMs)/1000);}
 function phaseAt(actions,t){let phase=0,previous=0;for(let i=0;i<actions.length;i++){phase+=(actions[i].t-previous)*(2.2+i*.2);previous=actions[i].t;}return phase+(t-previous)*(2.2+actions.length*.2);}
 function cast(e){
  e?.stopPropagation();const r=run;if(!r||r.kind!=='fishing'||!r.started||r.ended||r.pauseStart)return;
  const t=elapsed(r);if(r.actions.length&&t-r.actions.at(-1).t<.45)return;
  const accuracy=Math.round(Math.max(0,100-Math.abs(Math.sin(phaseAt(r.actions,t)))*100));r.actions.push({t});r.score+=accuracy;r.casts++;
  window.meadowAudio?.play('water');host.querySelector('#trip-score').textContent='Cast '+Math.min(3,r.casts+1)+' / 3 · '+accuracy+' points';
  const splash=document.createElement('i');splash.className='trip-splash';host.querySelector('.trip-playfield').append(splash);setTimeout(()=>splash.remove(),650);
  if(r.casts>=3)finish(Math.round(r.score/3));
 }
 function placeFinds(){
  const field=host.querySelector('.trip-playfield');field.innerHTML='';const goods=['blackberry','hazelnut','wildherbs'];
  for(let i=0;i<12;i++){const id=goods[i%3],b=document.createElement('button');b.className='trip-find';b.style.left=((i%4)*24+14+(Math.random()-.5)*7)+'%';b.style.top=(Math.floor(i/4)*30+15+(Math.random()-.5)*6)+'%';b.setAttribute('aria-label',id==='blackberry'?'Woodland blackberries':id==='hazelnut'?'Wild hazelnuts':'Wild cooking herbs');b.innerHTML='<img src="'+art+id+'.webp" alt="">';b.onclick=()=>pick(id,b);field.append(b);}
 }
 function updateTarget(){if(!run||run.kind!=='woodland')return;const id=run.targets[run.found];host.querySelector('header p').textContent='Find: '+({blackberry:'Woodland blackberries',hazelnut:'Wild hazelnuts',wildherbs:'Wild cooking herbs'}[id]||'Basket complete');host.querySelector('#trip-score').textContent=run.found+' / 12';}
 function pick(id,b){
  const r=run;if(!r||r.ended||r.pauseStart)return;const t=elapsed(r);if(r.actions.length&&t-r.actions.at(-1).t<.1)return;
  if(t+r.wrong*3>45)return finish(Math.round(r.found/12*100));r.actions.push({t,item:id});
  if(id!==r.targets[r.found]){r.wrong++;b.classList.add('trip-wrong');setTimeout(()=>b.classList.remove('trip-wrong'),250);window.meadowAudio?.play('tap');return;}
  r.found++;window.meadowAudio?.play('harvest');if(r.found>=12)return finish(Math.max(0,100-r.wrong*7));placeFinds();updateTarget();
 }
 function tick(now){
  const r=run;if(!r||r.ended)return;
  if(!document.hidden&&!r.pauseStart){const t=elapsed(r,now);if(r.kind==='fishing')host.querySelector('.trip-cast-marker').style.left=((Math.sin(phaseAt(r.actions,t))+1)*50)+'%';else{const left=45-t-r.wrong*3;host.querySelector('#trip-time').textContent=Math.ceil(Math.max(0,left))+'s';if(left<=0)return finish(Math.round(r.found/12*100));}}
  frame=requestAnimationFrame(tick);
 }
 async function collect(){
  const r=run,button=host?.querySelector('#trip-collect');if(!r||r.starting||!button||button.disabled)return;button.disabled=true;button.textContent='Saving your basket…';
  try{
   let score=r.finalScore;
   if(online()){
    let response;if(r.collectPending)response=await window.meadowCommandUI.retry();else{await window.meadowCommandUI.flush();if(run!==r)return;try{response=await window.meadowCommandUI.run([{type:'trip.collect',data:{run:r.id,attempt:r.attempt,actions:r.actions}}],{quiet:true});}catch(e){r.collectPending=!!window.meadowCommandUI.status()?.pending;throw e;}}
    score=response?.summary?.results?.find(x=>x.type==='trip.collect')?.score??score;
   }
   if(run!==r)return;const cb=r.onEnd;stop();cb({score,verified:online()});
  }catch(e){if(run===r){button.disabled=false;button.textContent=r.collectPending?'Retry saved collection':'Collect & return';host.querySelector('header p').textContent=e.message||'Reconnect to collect your basket.';}}
 }
 function finish(score){
  const r=run;if(!r||r.ended)return;r.ended=true;cancelAnimationFrame(frame);r.finalScore=score;if(r.kind==='woodland')host.querySelector('#trip-score').textContent=r.found+' / 12';host.querySelector('header p').textContent='Round complete · collect your rewards or try again';
  const result=document.createElement('section');result.className='trip-result';result.innerHTML='<h3>'+(r.kind==='fishing'?'Your catch is ready':'Your woodland basket')+'</h3><strong>'+score+' / 100</strong><p>'+(r.kind==='fishing'?(score>=85?'Golden willow carp':score>=55?'Silver river trout':'Willow river perch'):'Berries, hazelnuts and wild herbs')+'</p><button id="trip-collect">Collect & return</button><button id="trip-retry">Try again</button>';host.append(result);window.meadowAudio?.speak('game-result-win');result.querySelector('#trip-collect').onclick=collect;result.querySelector('#trip-retry').onclick=()=>{window.meadowAudio?.stopVoice();start();};
 }
 async function resume(){
  const r=run;if(!r?.pauseStart||r.ended||r.resuming)return;r.resuming=true;
  try{if(online())await window.meadowCommandUI.maintenance([{type:'trip.resume',data:{run:r.id,attempt:r.attempt}}]);if(run!==r)return;if(document.hidden){if(online())await window.meadowCommandUI.maintenance([{type:'trip.pause',data:{run:r.id,attempt:r.attempt}}]);return;}r.pausedMs+=performance.now()-r.pauseStart;r.pauseStart=0;host.querySelector('.trip-connection')?.remove();}
  catch(e){if(run!==r)return;let note=host.querySelector('.trip-connection');if(!note){note=document.createElement('button');note.className='trip-connection';note.style.cssText='position:absolute;inset:45% 20% auto;z-index:10;padding:20px;background:#fff6df;color:#52351f;border-radius:14px';host.append(note);note.onclick=resume;}note.textContent='Reconnect to continue · tap to retry';}finally{r.resuming=false;}
 }
 document.addEventListener('visibilitychange',()=>{
  const r=run;if(!r?.started||r.ended)return;
  if(document.hidden){if(r.pauseStart)return;r.pauseStart=performance.now();if(online())window.meadowCommandUI.maintenance([{type:'trip.pause',data:{run:r.id,attempt:r.attempt}}]).catch(()=>{});}
  else resume();
 });
 window.meadowJourneyActivities={open,stop,phaseAt};
})();
