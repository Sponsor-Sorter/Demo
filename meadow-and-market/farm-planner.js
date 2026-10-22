(() => {
  'use strict';
  let api,dialog,cache,tab='projects';
  const crops=['carrot','wheat','strawberry','corn','tomato','lavender','pumpkin','mushroom'];
  const animalGoods={chicken:'egg',cow:'milk',sheep:'wool',goat:'goatmilk',alpaca:'fleece'};
  const integer=(n,max=1e9)=>Number.isFinite(Number(n))?Math.max(0,Math.min(max,Math.floor(Number(n)))):0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const recipes=()=>window.meadowProduction?.recipes||[];
  const recipe=id=>recipes().find(r=>r.id===id);
  const state=()=>api.state(),bag=s=>s.farms?.willow?.inventory||s.inventory||{};
  const objects=s=>Object.values(s.farms||{}).flatMap(f=>f.objects||[]);
  function invalidate(){cache=null;}
  function descriptorKey(d){return d?JSON.stringify([d.kind,d.id||'',d.map||'',d.stage??'',d.week||'',d.amount||0]):'';}
  function resolve(s,d=s.farmPlan?.goal,now=Date.now()){
    if(!d)return null;
    if(d.kind==='recipe'){
      const r=recipe(d.id);if(!r||!Number.isInteger(d.amount)||d.amount<1||d.amount>999)return null;
      return {key:descriptorKey(d),descriptor:d,name:api.items[d.id]?.name||d.id,ask:{[d.id]:d.amount},gold:0,art:api.items[d.id]?.icon,reason:s.level<(r.unlock||((r.station||'kitchen')==='workshop'?4:2))?'Reach the recipe’s unlock level':'',kind:'recipe'};
    }
    if(d.kind==='project'){
      const q=window.meadowJourneyCore?.projectStatus(s,d.id);if(!q||!Number.isInteger(d.stage)||d.stage<0||d.stage>2)return null;
      const step=q.p.stages[d.stage];return {key:descriptorKey(d),descriptor:d,name:q.p.name+' · '+step.name,ask:step.ask,gold:step.gold,art:'assets/generated/journey/'+(d.id==='jetty'?'wharf':q.p.art)+'-'+Math.min(2,d.stage)+'.webp',done:q.n>d.stage,stale:q.n<d.stage,reason:q.reason,kind:'project'};
    }
    if(d.kind==='festival'){const f=window.meadowLife?.festival(s,now);if(!f||d.id!==f.runId)return {key:descriptorKey(d),descriptor:d,name:'Village celebration',ask:{},gold:0,stale:true,kind:'festival'};return {key:descriptorKey(d),descriptor:d,name:f.theme.name+' · Festival hamper',ask:f.ask,gold:0,art:f.theme.art,done:f.stage>1,stale:f.stage<1,kind:'festival',reason:''};}
    if(d.kind==='weekly'){
      const q=window.meadowVillageOrders?.contract(s,now);if(!q)return null;
      return {key:descriptorKey(d),descriptor:d,name:q.name,ask:q.ask,gold:0,art:'assets/generated/club/mission.webp',done:d.week===q.key&&q.stage>d.stage,stale:d.week!==q.key||q.stage<d.stage,reason:'',kind:'weekly'};
    }
    if(d.kind==='order'){
      const f=s.farms?.[d.map];if(!f)return null;const o=f.orders?.find(o=>o.id===d.id);
      return {key:descriptorKey(d),descriptor:d,name:o?.name||'Market request',ask:o?.ask||{},gold:0,art:'assets/generated/hud/requests.webp',stale:!o,kind:'order',reason:''};
    }
    return null;
  }
  function pin(s,d){const q=resolve(s,d);if(!q||q.done||q.stale)return false;s.farmPlan={goal:{...d},helpers:true,keepGold:true,seenReady:false};invalidate();return true;}
  function clear(s){delete s.farmPlan;invalidate();}
  function reserves(s){
    const result={};for(const f of Object.values(s.farms||{})){
      if(!(f.objects||[]).some(o=>o.type==='stall'))continue;
      const p=window.meadowShopPlan?.plan(f);if(!p?.enabled)continue;
      for(const r of p.rules)result[r.id]=Math.max(result[r.id]||0,integer(r.keep));
    }return result;
  }
  function forecast(s){
    const pending={};const add=(id,n)=>{if(api.items[id]&&integer(n)>0)pending[id]=(pending[id]||0)+integer(n);};
    for(const o of objects(s)){
      if(o.type==='plot'&&o.plantedAt&&crops.includes(o.crop))add(o.crop,api.plotYield(o));
      for(const job of o.jobs||[])if(recipe(job.id))add(job.id,window.meadowProduction.jobOutput(job));
      if(o.type==='hive')add('honey',o.honey);
      if(['tree','orchard'].includes(o.type))add('apple',api.fruitYield(o));
    }return pending;
  }
  function analyse(s,now=Date.now()){
    const goal=resolve(s,undefined,now);
    if(!goal||goal.done||goal.stale)return {goal,rows:[],required:{},keep:{},pending:{},ready:false,active:false};
    const keep=reserves(s),inventory=bag(s),pending=forecast(s);
    const required={};for(const [id,n] of Object.entries(goal.ask))if(api.items[id])required[id]=integer(n);
    const depths={};function depth(id,path=new Set()){
      if(depths[id]!==undefined)return depths[id];if(path.has(id)||path.size>24)throw Error('Recipe dependency cycle');
      const r=recipe(id);if(!r)return depths[id]=0;const next=new Set(path);next.add(id);
      return depths[id]=1+Math.max(0,...Object.keys(r.input).map(k=>depth(k,next)));
    }
    const all=[...new Set([...Object.keys(required),...recipes().map(r=>r.id),...recipes().flatMap(r=>Object.keys(r.input))])].sort((a,b)=>depth(b)-depth(a));
    for(const id of all){
      const need=required[id]||0,available=Math.max(0,integer(inventory[id])-(keep[id]||0)),gap=Math.max(0,need-available-(pending[id]||0)),r=recipe(id);
      if(!gap||!r)continue;
      const output=window.meadowArtisan?.output(s,id)||r.count,batches=Math.ceil(gap/output);
      for(const [input,n]of Object.entries(r.input))required[input]=Math.min(1e9,(required[input]||0)+batches*n);
    }
    const rows=Object.entries(required).filter(([,n])=>n>0).map(([id,target])=>{
      const owned=integer(inventory[id]),reserve=keep[id]||0,usable=Math.max(0,owned-reserve),onFarm=pending[id]||0;
      return {id,target,owned,reserve,usable,onFarm,missing:Math.max(0,target-usable-onFarm),toCollect:Math.max(0,target-usable),direct:Object.hasOwn(goal.ask,id),depth:depth(id)};
    }).sort((a,b)=>Number(b.direct)-Number(a.direct)||b.depth-a.depth||a.id.localeCompare(b.id));
    const ready=!goal.reason&&Object.entries(goal.ask).every(([id,n])=>Math.max(0,integer(inventory[id])-(keep[id]||0))>=n)&&integer(s.coins)>=goal.gold;
    return {goal,rows,required,keep,pending,ready,active:true};
  }
  function current(){const s=state(),minute=Math.floor(Date.now()/60000);if(!cache||cache.state!==s||cache.minute!==minute)cache={state:s,minute,value:analyse(s)};return cache.value;}
  function helping(){return !!api&&state().farmPlan?.helpers===true&&current().active;}
  function hold(id){if(!helping())return 0;const q=current();return (q.required[id]||0)+(q.keep[id]||0);}
  function seedAllowed(cost){return !helping()||state().farmPlan.keepGold===false||state().coins-cost>=current().goal.gold;}
  function allowedInputs(r,forPlan=false){
    if(!helping())return true;const q=current(),inventory=bag(state());
    if(!forPlan&&(q.required[r.id]||0)>0)return false;
    return Object.entries(r.input).every(([id,n])=>{
      const protectedCount=(q.keep[id]||0)+(forPlan?integer(q.goal.ask[id]):(q.required[id]||0));
      return integer(inventory[id])-n>=protectedCount;
    });
  }
  function recipeFor(o){
    if(!helping()||o.autoWork===false)return null;
    const q=current(),production=window.meadowProduction;
    for(const row of q.rows.filter(r=>r.missing>0).sort((a,b)=>a.depth-b.depth)){
      const r=recipe(row.id);if(!r||(r.station||'kitchen')!==o.type||!production.canMake(o,r)||!production.belowCap(o,r)||!allowedInputs(r,true))continue;
      return r;
    }return null;
  }
  function cropFor(fallback,well,plot){
    if(!helping())return fallback;
    const unlocked=new Set(api.maps.filter(m=>state().level>=m.unlock).flatMap(m=>m.crops)),needed=current().rows.filter(r=>r.missing>0&&crops.includes(r.id)&&unlocked.has(r.id)&&api.canPlanCrop?.(well,r.id,plot)!==false).sort((a,b)=>b.missing-a.missing);
    return needed[0]?.id||fallback;
  }
  function plantAllowed(id){if(!helping())return true;const row=current().rows.find(r=>r.id===id);return !row||row.missing>0;}
  function priority(o){
    if(!helping())return 0;const wanted=current().required,ids=o.type==='plot'?[o.crop]:['tree','orchard'].includes(o.type)?['apple']:o.type==='hive'?['honey']:animalGoods[o.type]?[animalGoods[o.type]]:(o.jobs||[]).map(j=>j.id);
    return ids.some(id=>wanted[id]>0)?1:0;
  }
  function readyCount(s=state()){const q=s===state()?current():analyse(s);return q.ready&&!s.farmPlan?.seenReady?1:0;}
  function art(id){
    const p=api.items[id];if(p?.icon)return '<img src="'+p.icon+'" alt="">';
    if(crops.includes(id))return '<span class="planner-crop"><img src="assets/generated/crop-growth/'+id+'.webp" alt=""></span>';
    if(id==='apple')return '<img src="assets/generated/orchard/apple-fruit.webp" alt="">';
    return '<span aria-hidden="true">'+esc(p?.emoji||'🧺')+'</span>';
  }
  function choices(){
    const s=state();if(tab==='projects')return (window.meadowJourneyData?.projects||[]).flatMap(p=>{const q=window.meadowJourneyCore.projectStatus(s,p.id);return q.step?[{d:{kind:'project',id:p.id,stage:q.n},name:p.name,sub:q.step.name,art:'assets/generated/journey/'+(p.id==='jetty'?'wharf':p.art)+'-'+Math.min(2,q.n)+'.webp'}]:[];});
    if(tab==='orders'){
      const result=[];const festival=window.meadowLife?.festival(s);if(festival?.joined&&festival.stage===1)result.push({d:{kind:'festival',id:festival.runId,stage:1},name:festival.theme.name,sub:'Festival hamper',art:festival.theme.art});const w=window.meadowVillageOrders?.contract(s);if(w&&w.stage<3)result.push({d:{kind:'weekly',week:w.key,stage:w.stage},name:w.name,sub:'Weekly delivery '+(w.stage+1)+' / 3',art:'assets/generated/club/mission.webp'});
      for(const [id,f]of Object.entries(s.farms||{}))for(const o of f.orders||[])result.push({d:{kind:'order',map:id,id:o.id},name:o.name,sub:api.mapName(id)+' · '+o.reward+' gold',art:'assets/generated/hud/requests.webp'});
      return result;
    }
    return recipes().map(r=>({d:{kind:'recipe',id:r.id,amount:10},name:api.items[r.id].name,sub:(r.station==='workshop'?'Craft shed':'Kitchen')+' · '+(r.unlock?'Level '+r.unlock:'Stock target'),art:api.items[r.id].icon}));
  }
  function supplyRows(rows){return rows.map(r=>'<button class="planner-supply" data-plan-good="'+r.id+'">'+art(r.id)+'<span><strong>'+esc(api.items[r.id]?.name||r.id)+'</strong><small>'+Math.min(r.target,r.usable)+' / '+r.target+' in basket'+(r.reserve?' · '+r.reserve+' kept aside':'')+'</small><small>'+(r.missing?'Need '+r.missing+(r.onFarm?' · '+r.onFarm+' growing / queued':''):r.toCollect?'Collect '+r.toCollect+' from growing crops or queued goods':'✓ In your basket')+'</small></span><b aria-hidden="true">›</b></button>').join('');}
  function activePanel(q){
    if(!q.goal)return '<section class="planner-paper planner-empty"><img src="assets/generated/club/mission.webp" alt=""><h3>What are we working towards?</h3><p>Choose an upgrade, order or recipe. We’ll work out its supplies together.</p></section>';
    if(q.goal.done||q.goal.stale)return '<section class="planner-paper"><h3>'+(q.goal.done?'✓ This plan is finished':'This order has changed')+'</h3><p>'+esc(q.goal.name)+'</p><button id="planner-clear">Choose a new plan</button></section>';
    const p=state().farmPlan,g=q.goal;
    return '<section class="planner-paper"><button id="planner-back" class="planner-back">↓ Choose another goal</button><div class="planner-goal-heading"><img src="'+g.art+'" alt=""><div><small>YOUR PINNED PLAN</small><h3>'+esc(g.name)+'</h3><strong class="planner-status">'+(q.ready?'✓ Ready to use':g.reason||'Gathering supplies')+'</strong></div></div><div class="planner-actions"><button id="planner-open">'+(g.kind==='recipe'?'Go to workspace':g.kind==='project'?'Open upgrade':'Open order')+'</button><button id="planner-clear">Unpin</button></div>'+(g.kind==='recipe'?'<label class="planner-quantity">Stock target <input id="planner-amount" type="number" min="1" max="999" inputmode="numeric" value="'+g.descriptor.amount+'"><button id="planner-amount-save">Set</button></label>':'')+'<label class="planner-helper"><input id="planner-helpers" type="checkbox" '+(p.helpers?'checked':'')+'> Helpers prioritise this plan</label>'+(g.gold?'<label class="planner-helper"><input id="planner-gold" type="checkbox" '+(p.keepGold!==false?'checked':'')+'> Keep '+g.gold.toLocaleString()+' gold for the upgrade</label><small class="planner-gold-status">'+Math.min(g.gold,integer(state().coins)).toLocaleString()+' / '+g.gold.toLocaleString()+' gold saved</small>':'')+'<h4>For your goal</h4>'+supplyRows(q.rows.filter(r=>r.direct))+(q.rows.some(r=>!r.direct)?'<h4>Ingredients to gather</h4>'+supplyRows(q.rows.filter(r=>!r.direct)):'')+'<details class="planner-details"><summary>Helper rules & reserves</summary><p>Helpers work in the farm you are visiting. Existing well pauses, stock caps and shelf reserves stay in place. Planned goods are protected from automatic shop stocking and unrelated helper recipes. Raw crops and real queued outputs count once; future goods still need collecting.</p><p>Flowers stay blooming for bees. Collect their nectar yourself. A single whole field or recipe batch may exceed your target. You choose when to deliver, upgrade or spend anything by hand.</p></details></section>';
  }
  function draw(){
    const q=current(),list=choices();dialog.innerHTML='<header class="artisan-head planner-head"><div><small>MEADOW MARKETS</small><h2>Your farm plan</h2></div><span class="artisan-summary">'+(q.ready?'Ready to use':q.goal?.done?'Finished':q.active?'One goal at a time':'Choose your next goal')+'</span><button id="planner-refresh" aria-label="Refresh supply counts">Refresh</button><button id="planner-listen" aria-label="Farmer Rhys: farm planning"><img src="assets/generated/guides/rhys.webp" alt="">Listen</button><button id="planner-close" aria-label="Return to previous screen">×</button></header><nav class="artisan-nav" aria-label="Farm plan choices">'+[['projects','Upgrades'],['orders','Orders'],['recipes','Recipes']].map(([id,name])=>'<button data-plan-tab="'+id+'" aria-pressed="'+(tab===id)+'">'+name+'</button>').join('')+'</nav><main class="planner-body"><section class="planner-choices" aria-label="Choose a goal">'+(list.map((p,i)=>'<button class="planner-choice" data-plan-index="'+i+'" aria-pressed="'+(descriptorKey(p.d)===q.goal?.key)+'"><img src="'+p.art+'" alt=""><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.sub)+'</small></span></button>').join('')||'<div class="planner-paper">No unfinished goals here yet.</div>')+'</section><aside class="planner-active" aria-label="Pinned plan supplies">'+activePanel(q)+'</aside></main>';
    dialog.querySelector('#planner-close').onclick=()=>dialog.close();dialog.querySelector('#planner-listen').onclick=()=>window.meadowAudio?.speak('rhys-farm-planner147');dialog.querySelector('#planner-refresh').onclick=()=>{invalidate();draw();};
    dialog.querySelectorAll('[data-plan-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.planTab;draw();if(matchMedia('(max-width:680px) and (orientation:portrait)').matches)dialog.querySelector('.planner-choices').scrollIntoView({block:'start'});});
    dialog.querySelectorAll('[data-plan-index]').forEach(b=>b.onclick=()=>{if(!api.canPlay())return;const selected=list[Number(b.dataset.planIndex)];if(!selected||!pin(state(),selected.d))return;api.save();draw();if(matchMedia('(max-width:680px) and (orientation:portrait)').matches)dialog.querySelector('.planner-active').scrollIntoView({block:'start'});});
    dialog.querySelector('#planner-back')?.addEventListener('click',()=>dialog.querySelector('.planner-choices').scrollIntoView({block:'start'}));
    dialog.querySelector('#planner-clear')?.addEventListener('click',()=>{clear(state());api.save();draw();});
    dialog.querySelector('#planner-open')?.addEventListener('click',()=>{dialog.close();api.openGoal(q.goal);});
    dialog.querySelectorAll('[data-plan-good]').forEach(b=>b.onclick=()=>{dialog.close();api.find(b.dataset.planGood);});
    dialog.querySelector('#planner-helpers')?.addEventListener('change',e=>{state().farmPlan.helpers=e.target.checked;invalidate();api.save();});
    dialog.querySelector('#planner-gold')?.addEventListener('change',e=>{state().farmPlan.keepGold=e.target.checked;invalidate();api.save();});
    dialog.querySelector('#planner-amount-save')?.addEventListener('click',()=>{const amount=Number(dialog.querySelector('#planner-amount').value);if(!Number.isInteger(amount)||amount<1||amount>999)return api.notify('Choose a whole target from 1 to 999.');state().farmPlan.goal.amount=amount;state().farmPlan.seenReady=false;invalidate();api.save();draw();});
    if(q.ready&&!state().farmPlan.seenReady){state().farmPlan.seenReady=true;api.save();}
  }
  function show(){if(!api.canPlay())return api.notify('Return to your own farm first.');invalidate();draw();if(!dialog.open)dialog.showModal();if(!state().farmPlannerHeard147){state().farmPlannerHeard147=true;api.save();window.meadowAudio?.speak('rhys-farm-planner147');}}
  function pinAndShow(d){if(!api.canPlay()||!pin(state(),d))return false;api.save();show();return true;}
  function attach(a){api=a;dialog=document.createElement('dialog');dialog.className='artisan-dialog planner-dialog';dialog.id='farm-planner';dialog.setAttribute('aria-label','Farm planning and helper priorities');dialog.addEventListener('close',()=>window.meadowAudio?.stopVoice());document.body.append(dialog);}
  window.meadowPlanner={attach,resolve,pin,clear,analyse,current,invalidate,descriptorKey,reserves,forecast,hold,seedAllowed,allowedInputs,recipeFor,cropFor,plantAllowed,priority,readyCount,helping,show,pinAndShow};
})();
