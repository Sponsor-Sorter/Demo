(() => {
  'use strict';
  const products={chicken:{item:'egg',time:30000},cow:{item:'milk',time:30000},sheep:{item:'wool',time:90000},goat:{item:'goatmilk',time:30000}};
  let api;
  const $=s=>document.querySelector(s),clamp=n=>Math.max(0,Math.min(100,n)),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function settle(a,now=Date.now()){
    const elapsed=Math.max(0,now-(a.needsAt||a.lastCare||now))/3600000;
    for(const [key,rate] of [['hunger',5],['clean',2],['happy',3]])a[key]=clamp((Number.isFinite(a[key])?a[key]:80)-elapsed*rate);
    a.needsAt=now;return a;
  }
  function ready(a,now=Date.now()){return a.hunger>45&&a.clean>35&&a.happy>50&&now-(a.lastProductAt||0)>=products[a.type].time}
  function image(a){return 'assets/generated/'+(a.type==='chicken'?'hen':a.type)+'.png'}
  function home(a){return api.home(a)?.type==='coop'?'Chicken coop':api.home(a)?.type==='paddock'?'Livestock paddock':api.home(a)?'Farm barn':'Roaming the farm'}
  function productText(a){const p=products[a.type];return a.hunger<=45?'A little food will help production.':a.clean<=35?'A clean home will help production.':a.happy<=50?'Some attention will help production.':ready(a)?api.items[p.item].name+' ready · '+(api.yield(a)+(a.treatBonus?1:0)):Math.max(1,Math.ceil((p.time-(Date.now()-(a.lastProductAt||0)))/1000))+' seconds until the next collection'}
  function care(id,action='all'){
    const a=api.current().objects.find(o=>o.id===id);if(!a||!products[a.type])return false;settle(a);
    let changed=false,collected=0;
    if(action==='treat'){
      if(a.treatBonus||(api.current().inventory.wheat||0)<1)return false;
      api.current().inventory.wheat--;a.treatBonus=true;changed=true;
      for(const key of ['hunger','happy'])a[key]=clamp(a[key]+15);
    }else for(const [key,amount,kind] of [['hunger',35,'feed'],['clean',35,'brush'],['happy',25,'play']])if(action==='all'||action===kind){const next=clamp(a[key]+amount);if(next>a[key]+.01)changed=true;a[key]=next}
    if((action==='all'||action==='collect')&&ready(a)){
      collected=api.yield(a)+(a.treatBonus?1:0);const id=products[a.type].item;api.current().inventory[id]=(api.current().inventory[id]||0)+collected;a.lastProductAt=Date.now();a.treatBonus=false;changed=true;
    }
    a.lastCare=Date.now();a.needsAt=Date.now();
    if(changed){api.xp(collected?4:2);api.event('care')}
    api.save();api.render();window.meadowAudio?.play(collected?'harvest':a.type);
    api.notify(collected?'Collected '+collected+' '+api.items[products[a.type].item].name.toLowerCase()+' from '+(a.name||api.name(a)):action==='treat'?'Wheat treat enjoyed · +1 on the next collection':changed?(a.name||api.name(a))+' enjoyed a little care':productText(a));return changed;
  }
  function show(a){
    settle(a);const p=products[a.type],name=escape(a.name||api.name(a)),wheat=api.current().inventory.wheat||0;
    api.modal('<div class="sheet-head"><div><small class="eyebrow">YOUR FARM FRIEND · '+escape(home(a))+'</small><h2>'+name+'</h2></div><button class="close-button" data-close="modal-dialog">×</button></div><img class="animal-preview" src="'+image(a)+'" alt="'+escape(api.name(a))+'"><div class="stats-row animal-needs">'+[['hunger','Fed'],['clean','Clean'],['happy','Happy']].map(([k,n])=>'<div class="stat-card"><span>'+n+'</span><b data-need="'+k+'">'+Math.round(a[k])+'%</b></div>').join('')+'</div><div class="animal-care-actions"><button class="small-button" data-animal-action="feed">Feed · free</button><button class="small-button" data-animal-action="brush">Brush</button><button class="small-button" data-animal-action="play">Play</button></div><p id="animal-product-status" data-animal="'+escape(a.id)+'">'+productText(a)+'</p><button class="primary-button full-button" id="animal-collect" '+(ready(a)?'':'disabled')+'>Collect '+api.items[p.item].name.toLowerCase()+'</button><div class="task-card"><h3>A little wheat treat</h3><p>One wheat gives a small care boost and adds one extra product to the next collection. Treats do not stack.</p><button class="small-button full-button" data-animal-action="treat" '+(a.treatBonus||!wheat?'disabled':'')+'>'+(a.treatBonus?'Treat ready · +1 next collection':'Give a treat · 1 wheat ('+wheat+' owned)')+'</button></div><label for="animal-home">Animal home</label><select class="friend-code-input full-button" id="animal-home"><option value="">Roaming the farm</option>'+api.homes(a).map(h=>'<option value="'+escape(h.id)+'" '+([a.coopId,a.barnId,a.paddockId].includes(h.id)?'selected':'')+'>'+escape(h.label)+'</option>').join('')+'</select><label for="animal-name">Your animal’s name</label><div class="task-row"><input class="friend-code-input" id="animal-name" maxlength="20" value="'+name+'"><button class="small-button" id="animal-name-save">Save name</button></div><p class="sheet-copy">Basic care is always free. Fed, clean and happy animals produce more with each home upgrade. Needs gradually change while you are away; your animals always stay safe.</p>');
    document.querySelectorAll('[data-animal-action]').forEach(b=>b.onclick=()=>{care(a.id,b.dataset.animalAction);show(a)});$('#animal-collect').onclick=()=>{care(a.id,'collect');show(a)};$('#animal-home').onchange=()=>{api.assign(a,$('#animal-home').value);show(a)};$('#animal-name-save').onclick=()=>{const name=$('#animal-name').value.trim().slice(0,20);if(!name)return;a.name=name;api.save();api.render();show(a)};
  }
  function render(){const animals=api.current().objects.filter(a=>products[a.type]);for(const a of animals)settle(a);$('#view-content').innerHTML='<div class="section-title"><div><small class="eyebrow">YOUR LITTLE FRIENDS</small><h2>Animal care</h2></div><button class="soft-link" id="add-animal">＋ Add</button></div><div class="welcome-card"><h3>Every friend has a little routine</h3><p>Feed, brush and play with your animals. Tap a friend for its needs, home, treats and produce.</p></div>'+animals.map(a=>'<div class="animal-card"><div class="animal-face"><img src="'+image(a)+'" alt="'+escape(api.name(a))+'"></div><div class="animal-info"><strong>'+escape(a.name||api.name(a))+'</strong><small>'+home(a)+' · Fed '+Math.round(a.hunger)+'% · Happy '+Math.round(a.happy)+'%</small><small>'+productText(a)+'</small></div><button class="small-button animal-detail" data-animal="'+escape(a.id)+'">Visit</button></div>').join('')+(animals.length?'':'<p class="empty-state">Build a home and meet your first animal friend.</p>')+'<button class="primary-button full-button" id="animal-shop">Meet another friend</button>';$('#add-animal').onclick=$('#animal-shop').onclick=()=>api.build();document.querySelectorAll('.animal-detail').forEach(b=>b.onclick=()=>show(animals.find(a=>a.id===b.dataset.animal)))}
  function tick(){if(document.hidden)return;const id=$('#animal-product-status')?.dataset.animal;if(!id)return;const a=api.current().objects.find(o=>o.id===id);if(!a)return;settle(a);document.querySelectorAll('[data-need]').forEach(e=>e.textContent=Math.round(a[e.dataset.need])+'%');$('#animal-product-status').textContent=productText(a);$('#animal-collect').disabled=!ready(a)}
  window.meadowAnimals={settle,ready,care,show,render,products,attach(adapter){api=adapter;for(const f of Object.values(api.farms()))for(const a of f.objects.filter(o=>products[o.type]))settle(a);setInterval(tick,1000);setInterval(()=>{if(document.hidden)return;for(const f of Object.values(api.farms()))for(const a of f.objects.filter(o=>products[o.type]))settle(a);api.save();if(api.view()==='animals'&&!document.querySelector('dialog[open]'))render()},60000)}};
})();
