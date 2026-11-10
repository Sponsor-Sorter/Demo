(() => {
  'use strict';
  const C=window.meadowBeeChallengeCore,P=window.meadowBeeChallengeProgress;
  const art='assets/generated/bee-challenge/',portrait='assets/generated/guides/rhys.webp';
  const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
  let api,owner='',dialog,canvas,ctx,sim,level=0,spent=0,draft=[],finger=null,raf=0,last=0,accumulator=0,epoch=0;
  let images={},ready=false,loadingImages=null,hint=false,usedHint=false,completed=false,paused=false,uiSecond=-1;
  let pencil={x:300,y:180},keyboardMode=false,welcomed=false;
  const $=selector=>dialog.querySelector(selector);
  const sound=id=>window.meadowAudio?.play(id);
  const say=id=>window.meadowAudio?.speak(id==='intro'?'bee51-rhys-intro':id==='hint'?'bee51-rhys-map-'+C.levels[level].cue:'bee-rhys-'+id);
  const sameOwner=()=>owner===String(api.owner()||'device');
  function cleanup(){epoch++;cancelAnimationFrame(raf);raf=0;sim?.dispose();sim=null;finger=null;draft=[];last=0;accumulator=0;window.meadowAudio?.stopVoice();}
  function close(toMenu=false){cleanup();dialog?.close();if(toMenu)api.menu();}
  function header(subtitle){return '<header class="bs-header"><button class="bs-guide" data-bs-hear aria-label="Farmer Rhys: hear the directions"><img src="'+portrait+'" alt="Farmer Rhys"></button><div class="bs-title"><h1>Bee Shelter Challenge</h1><p data-bs-title>'+subtitle+'</p></div><button class="bs-close" data-bs-home aria-label="Back to games">×</button></header>';}
  function bindHeader(){ $('[data-bs-home]').onclick=()=>close(true);$('[data-bs-hear]').onclick=()=>say(sim?.state==='swarm'?'watch':'intro'); }
  function open(){
    if(api.canPlay&&!api.canPlay())return api.notify('Return to your own farm to play.');
    owner=String(api.owner()||'device');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='bee-challenge-dialog';dialog.className='bs-dialog';dialog.setAttribute('aria-label','Bee Shelter Challenge');document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close(true);});dialog.addEventListener('close',()=>{if(!dialog.open)cleanup();});}
    if(!dialog.open)dialog.showModal();
    level=P.load(storage,owner).last;showMaps();
  }
  async function loadImages(){
    if(ready)return;
    if(!loadingImages)loadingImages=Promise.all(Object.entries({bee:'bee',hive:'hive',friend:'cloud',post:'post',rock:'rock',ground:'ground'}).map(([id,file])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=async()=>{try{await image.decode();images[id]=image;resolve();}catch(e){reject(e);}};image.onerror=reject;image.src=art+file+'.webp';}))).then(()=>{ready=true;}).finally(()=>{loadingImages=null;});
    await loadingImages;
  }
  async function showMaps(){
    cleanup();const token=epoch,records=P.load(storage,owner),wins=Object.keys(records.maps).length;
    delete dialog.dataset.beeState;
    dialog.innerHTML='<main class="bs-scene">'+header(wins+' / 20 shelters completed · personal practice')+'<section class="bs-map-page"><div class="bs-map-intro"><h2>Less ink. Bigger swarms. Stronger shelters.</h2><p>Draw a shelter for Cloud. Fixed rocks support your ink; loose drawings can be pushed away. Choose any puzzle. Earn a star for surviving, efficient ink and solving without a hint.</p><button class="bs-primary" data-bs-continue>Continue · '+C.levels[level].name+'</button><small>Best runs stay on this device for this farm. No farm goods or reward turns are used.</small></div><div class="bs-maps">'+C.levels.map((l,i)=>{const record=records.maps[i];return '<button data-bs-level="'+i+'" class="bs-map-card" aria-label="Puzzle '+(i+1)+': '+l.name+', '+l.tier+(record?', '+record.stars+' stars':'')+'"><canvas width="300" height="250" aria-hidden="true"></canvas><strong>'+(i+1)+'. '+l.name+'</strong><span>'+l.tier+' · '+l.ink+' ink · '+l.seconds+'s</span><span class="bs-map-stars">'+(record?'★'.repeat(record.stars)+' · Best '+record.score.toLocaleString():'Not completed')+'</span></button>';}).join('')+'</div></section></main>';
    bindHeader();$('[data-bs-continue]').onclick=()=>start(level);
    dialog.querySelectorAll('[data-bs-level]').forEach(button=>button.onclick=()=>start(Number(button.dataset.bsLevel)));
    try{await loadImages();if(token!==epoch||!dialog.open)return;for(const button of dialog.querySelectorAll('[data-bs-level]')){const preview=button.querySelector('canvas'),paint=preview.getContext('2d');paint.scale(.5,.5);paint.translate(0,-35);paintMap(paint,C.levels[Number(button.dataset.bsLevel)],0);}}
    catch{if(token===epoch)$('.bs-map-intro small').textContent='Pictures could not load. Choose a puzzle to retry.';}
    if(token===epoch&&!welcomed){welcomed=true;say('intro');}
  }
  async function start(index=level){
    cleanup();if(!sameOwner())return close();
    level=Number.isInteger(index)&&index>=0&&index<C.levels.length?index:0;
    const token=epoch;spent=0;hint=false;usedHint=false;completed=false;paused=false;uiSecond=-1;pencil={x:300,y:180};keyboardMode=false;
    const progress=P.load(storage,owner);progress.last=level;P.write(storage,owner,progress);
    dialog.innerHTML='<main class="bs-scene">'+header((level+1)+' / 20 · '+C.levels[level].tier+' · '+C.levels[level].name)+'<section class="bs-play"><div class="bs-board-slot"><div class="bs-field"><canvas width="1200" height="1200" tabindex="0" aria-label="Draw a shelter. Arrows move the pencil; Space starts or ends a line."></canvas><button class="bs-paused" hidden data-bs-resume>Paused · tap to resume</button></div></div><aside class="bs-dock"><p data-bs-note role="status">Use fixed rocks to hold your drawing. Launch when ready.</p><div class="bs-ink"><label for="bs-ink">Ink <b data-bs-ink></b></label><progress id="bs-ink" value="0" max="1" aria-label="Drawing ink left"></progress></div><div class="bs-count" data-bs-count aria-live="polite">'+C.levels[level].bees+' bees · survive '+C.levels[level].seconds+' seconds</div><button class="bs-go" data-bs-go disabled>Release the swarm</button><div class="bs-tools"><button data-bs-undo disabled>Undo</button><button data-bs-clear disabled>Clear</button><button data-bs-hint disabled>Hint</button><button data-bs-map>Puzzles</button><button data-bs-listen>Hear</button><button data-bs-pause disabled>Pause</button></div></aside></section></main>';
    bindHeader();$('[data-bs-listen]').onclick=()=>say(sim?.state==='swarm'?'watch':hint?'hint':'intro');$('[data-bs-map]').onclick=showMaps;
    $('[data-bs-clear]').onclick=()=>{if(sim?.state!=='draw')return;while(sim.undo()){}spent=0;draft=[];finger=null;note('Drawing cleared. Try a different support.');update();};
    $('[data-bs-undo]').onclick=()=>{if(sim?.state!=='draw'||finger!==null)return;const stroke=sim.undo();if(stroke)spent=Math.max(0,spent-stroke.length);update();};
    $('[data-bs-hint]').onclick=()=>{if(sim?.state!=='draw')return;hint=!hint;usedHint=true;note(hint?sim.level.help:'Hint hidden. This run still counts as assisted.');if(hint)say('hint');update();};
    $('[data-bs-go]').onclick=launch;$('[data-bs-pause]').onclick=togglePause;$('[data-bs-resume]').onclick=togglePause;
    canvas=$('.bs-field canvas');ctx=canvas.getContext('2d');ctx.setTransform(2,0,0,2,0,0);
    canvas.onpointerdown=down;canvas.onpointermove=move;canvas.onpointerup=up;canvas.onpointercancel=cancel;canvas.onlostpointercapture=cancel;canvas.onkeydown=keyDraw;syncPencil();
    try{await loadImages();if(token!==epoch||!dialog.open||!sameOwner())return;sim=C.create(level);update();raf=requestAnimationFrame(frame);}
    catch{if(token!==epoch)return;note('Pictures could not load. Try again.');$('[data-bs-clear]').textContent='Retry pictures';$('[data-bs-clear]').disabled=false;$('[data-bs-clear]').onclick=()=>start();}
  }
  function note(text){const node=$('[data-bs-note]');if(node)node.textContent=text;}
  function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*600/r.width,y:(e.clientY-r.top)*600/r.height};}
  function down(e){if(e.button>0||finger!==null||sim?.state!=='draw'||spent>=sim.level.ink)return;const p=point(e);if(!C.rules.legalPoint(p,sim.level)){note('Keep ink outside Cloud and the fixed rocks.');return;}e.preventDefault();keyboardMode=false;finger=e.pointerId;draft=[p];canvas.setPointerCapture(e.pointerId);update();}
  function addPoint(p){const result=C.rules.append(draft,p,sim.level.ink-spent,sim.level);spent+=result.used;if(result.blocked){finishStroke();note('The fixed terrain cannot be drawn through.');}else if(result.exhausted){finishStroke();note('Ink used. Undo a line or test your shelter.');}update();}
  function move(e){if(e.pointerId!==finger||sim?.state!=='draw')return;e.preventDefault();for(const sample of e.getCoalescedEvents?.().length?e.getCoalescedEvents():[e]){if(e.pointerId!==finger)break;addPoint(point(sample));}}
  function finishStroke(){if(!sim)return;const length=draft.reduce((n,p,i)=>n+(i?C.rules.distance(draft[i-1],p):0),0),stroke=sim.addStroke(draft);if(!stroke)spent=Math.max(0,spent-length);draft=[];const id=finger;finger=null;if(typeof id==='number'&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);update();}
  function up(e){if(e.pointerId===finger)finishStroke();}
  function cancel(e){if(finger!==null&&e.pointerId===finger)finishStroke();}
  function syncPencil(){canvas.dataset.pencilX=String(pencil.x);canvas.dataset.pencilY=String(pencil.y);}
  function keyDraw(e){
    if(sim?.state!=='draw'||typeof finger==='number')return;
    const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(d){e.preventDefault();keyboardMode=true;const step=e.shiftKey?25:5;pencil={x:Math.max(10,Math.min(590,pencil.x+d[0]*step)),y:Math.max(45,Math.min(495,pencil.y+d[1]*step))};if(finger==='keyboard')addPoint(pencil);syncPencil();}
    else if(e.key===' '&&!e.repeat){e.preventDefault();keyboardMode=true;if(finger==='keyboard')finishStroke();else if(finger===null&&spent<sim.level.ink&&C.rules.legalPoint(pencil,sim.level)){finger='keyboard';draft=[{...pencil}];update();}}
  }
  function launch(){if(!sim||sim.state!=='draw'||finger!==null||!sim.launch())return;hint=false;say('watch');note('Hold for '+sim.level.seconds+' seconds. Your ink is physical now.');update();}
  function togglePause(){if(sim?.state!=='swarm')return;paused=!paused;last=0;accumulator=0;$('[data-bs-resume]').hidden=!paused;$('[data-bs-pause]').textContent=paused?'Resume':'Pause';if(paused)window.meadowAudio?.stopVoice();}
  function update(){
    if(!sim)return;const draw=sim.state==='draw';dialog.dataset.beeState=sim.state;dialog.dataset.beeLevel=String(level);dialog.dataset.beeLines=String(sim.strokes.length);dialog.dataset.beeInk=String(Math.round(spent));
    const meter=$('progress');meter.max=sim.level.ink;meter.value=Math.max(0,sim.level.ink-spent);$('[data-bs-ink]').textContent=Math.max(0,Math.floor(sim.level.ink-spent))+' / '+sim.level.ink;
    $('[data-bs-go]').disabled=!draw||!sim.strokes.length||finger!==null;
    for(const name of ['undo','clear'])$('[data-bs-'+name+']').disabled=!draw||!sim.strokes.length||finger!==null;
    $('[data-bs-hint]').disabled=!draw;$('[data-bs-hint]').setAttribute('aria-pressed',String(hint));$('[data-bs-pause]').disabled=sim.state!=='swarm';$('[data-bs-map]').disabled=sim.state==='swarm';
  }
  function frame(time){
    if(!sim||!dialog.open)return;if(!sameOwner()){close();return;}
    if(document.hidden||paused){last=0;accumulator=0;}
    else{if(!last)last=time;accumulator+=Math.min(50,time-last);last=time;while(accumulator>=1000/120){sim.step();accumulator-=1000/120;}const second=Math.max(0,Math.ceil(sim.level.seconds-sim.elapsed/1000));if(sim.state==='swarm'&&second!==uiSecond){uiSecond=second;$('[data-bs-count]').textContent=sim.bees.length+(sim.bees.length===1?' bee · ':' bees · ')+second+'s to safety';dialog.dataset.beeRemaining=String(second);}draw(time);if(!completed&&['win','retry'].includes(sim.state))result(sim.state==='win');}
    if(!completed)raf=requestAnimationFrame(frame);else raf=0;
  }
  function line(points){if(!points.length)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();}
  function paintMap(paint,map,time){
    for(const t of map.terrain)paint.drawImage(images[t.kind==='wood'?'post':t.kind==='rock'?'rock':'ground'],t.x-t.w/2,t.y-t.h/2,t.w,t.h);
    for(const h of map.hives){paint.save();paint.translate(h.x,h.y);paint.rotate(Math.sin(time/700)*.018);paint.drawImage(images.hive,-52,-74,104,120);paint.restore();}
    const f=map.friend;paint.save();paint.translate(f.x,f.y);paint.scale(1+Math.sin(time/700)*.012,1+Math.sin(time/700)*.012);paint.drawImage(images.friend,-47,-48,94,94);paint.restore();
  }
  function draw(time){
    ctx.clearRect(0,0,600,600);paintMap(ctx,sim.level,time);
    if(hint&&sim.state==='draw'){ctx.save();ctx.setLineDash([10,9]);ctx.strokeStyle='#fff8cf';ctx.lineWidth=15;line(sim.level.hint);ctx.strokeStyle='#c49b42';ctx.lineWidth=4;line(sim.level.hint);ctx.restore();}
    ctx.strokeStyle='#181a18';ctx.lineWidth=C.INK;ctx.lineCap='round';ctx.lineJoin='round';
    for(const s of sim.strokes){ctx.save();ctx.translate(s.body.position.x,s.body.position.y);ctx.rotate(s.body.angle);line(s.points);ctx.restore();}line(draft);
    if(keyboardMode&&sim.state==='draw'){ctx.save();ctx.strokeStyle='#fff6bc';ctx.lineWidth=3;ctx.beginPath();ctx.arc(pencil.x,pencil.y,10,0,Math.PI*2);ctx.stroke();ctx.restore();}
    for(const b of sim.bees){ctx.save();ctx.translate(b.position.x,b.position.y);if(b.velocity.x>0)ctx.scale(-1,1);ctx.rotate(Math.sin(time/65+b.beePhase)*.07);ctx.fillStyle='#effcfa88';ctx.beginPath();ctx.ellipse(0,-8,10,3+Math.abs(Math.sin(time/23+b.beePhase))*6,-.3,0,Math.PI*2);ctx.fill();ctx.drawImage(images.bee,-17,-14,34,28);ctx.restore();}
  }
  function result(won){
    if(completed||!sameOwner())return;completed=true;update();$('[data-bs-count]').textContent=won?'Cloud is safe!':'A bee found a gap';sound(won?'reward':'tap');say(won?'success':'retry');
    const points=won?P.score(sim.level,spent,usedHint):null,record=won?P.record(storage,owner,level,points):null;
    for(const child of $('.bs-scene').children)child.inert=true;
    const panel=document.createElement('section');panel.className='bs-result';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',won?'Shelter complete':'Try another shelter');
    panel.innerHTML='<div><img src="'+portrait+'" alt="Farmer Rhys"><h2>'+(won?'Shelter held!':'A gap in the shelter')+'</h2>'+(won?'<div class="bs-stars" aria-label="'+points.stars+' out of three stars">'+'★'.repeat(points.stars)+'<span>'+'☆'.repeat(3-points.stars)+'</span></div><strong class="bs-score">'+points.score.toLocaleString()+' points</strong><p>'+points.ink+' / '+sim.level.ink+' ink · '+(usedHint?'Assisted':'No hint')+' · Best '+record.data.maps[level].score.toLocaleString()+'</p><small>'+(record.saved?'Personal best saved on this device.':'Storage is full; this result could not be saved.')+'</small>':'<p>Rest your line on a ledge, hook a corner or wedge it in a gap. Retry freely.</p>')+'<div class="bs-result-actions"><button class="bs-primary" data-bs-next>'+(won&&level<19?'Next puzzle':won?'Choose a puzzle':'Retry')+'</button><button data-bs-retry>'+(won?'Improve this score':'Choose a puzzle')+'</button><button data-bs-done>Back to farm</button></div></div>';
    $('.bs-scene').append(panel);panel.querySelector('[data-bs-next]').onclick=()=>won?(level<19?start(level+1):showMaps()):start();panel.querySelector('[data-bs-retry]').onclick=()=>won?start():showMaps();panel.querySelector('[data-bs-done]').onclick=()=>close();panel.querySelector('[data-bs-next]').focus();
  }
  document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});
  window.meadowBeeChallenge={open,attach:callbacks=>{api=callbacks;}};
})();
