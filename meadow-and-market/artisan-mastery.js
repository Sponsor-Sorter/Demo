(() => {
  'use strict';
  let api,dialog,station='kitchen',selected=null;
  const ranks=[
    {batches:0,name:'Apprentice',speed:0,bonus:0,gold:0,xp:0},
    {batches:5,name:'Practised hands',speed:5,bonus:0,gold:25,xp:10},
    {batches:20,name:'Village artisan',speed:10,bonus:0,gold:60,xp:15},
    {batches:50,name:'Meadow specialist',speed:10,bonus:1,gold:120,xp:25},
    {batches:120,name:'Master artisan',speed:15,bonus:1,gold:240,xp:40}
  ];
  const num=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(1e9,Math.floor(Number(v)))):0;
  const recipes=()=>window.meadowProduction?.recipes||[];
  const recipe=id=>recipes().find(r=>r.id===id);
  const kind=r=>r.station||'kitchen';
  const unlock=r=>r.unlock||(kind(r)==='workshop'?4:2);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Existing made_* counters contain output, not batches. Seed once before any
  // new collection event; new progress only comes from actually collected jobs.
  function book(s){
    if(!s.artisanMastery||s.artisanMastery.version!==1){
      const batches={};for(const r of recipes())batches[r.id]=Math.floor(num(s.homestead?.stats?.['made_'+r.id])/r.count);
      s.artisanMastery={version:1,batches,claimed:{},signature:{}};
    }
    const b=s.artisanMastery;b.batches||={};b.claimed||={};b.signature||={};return b;
  }
  function status(s,id){const r=recipe(id);if(!r)return null;const count=num(book(s).batches[id]);let rank=0;for(let i=1;i<ranks.length;i++)if(count>=ranks[i].batches)rank=i;const next=ranks[rank+1];return {...ranks[rank],rank:rank+1,count,next,progress:next?(count-ranks[rank].batches)/(next.batches-ranks[rank].batches):1};}
  function record(s,id,count=1){if(!recipe(id)||!Number.isInteger(count)||count<1||count>1000)return null;const before=status(s,id);book(s).batches[id]=Math.min(1e9,before.count+count);return {before,after:status(s,id)};}
  function signature(s,id){const r=recipe(id);return !!r&&num(s.level)>=8&&status(s,id).rank>=3&&book(s).signature[kind(r)]===id;}
  function benefits(s,id){const r=status(s,id);return r?{speed:r.speed,bonus:r.bonus+(signature(s,id)?1:0)}:{speed:0,bonus:0};}
  function output(s,id){const r=recipe(id);return r?r.count+benefits(s,id).bonus:0;}
  function factor(s,id){return 1-benefits(s,id).speed/100;}
  function choose(s,id){const r=recipe(id);if(!r||num(s.level)<Math.max(8,unlock(r))||status(s,id).rank<3)return false;book(s).signature[kind(r)]=id;return true;}
  function clear(s,type){if(!['kitchen','workshop'].includes(type))return false;delete book(s).signature[type];return true;}
  function ready(s){const b=book(s);return recipes().reduce((n,r)=>n+ranks.filter((step,i)=>i>0&&status(s,r.id).rank>i&&!(b.claimed[r.id]||[]).includes(i+1)).length,0);}
  function claim(s,id,rank){const r=status(s,id),step=ranks[rank-1],b=book(s);if(!r||!Number.isInteger(rank)||rank<2||!step||r.rank<rank||(b.claimed[id]||[]).includes(rank))return null;b.claimed[id]||=[];b.claimed[id].push(rank);return {gold:step.gold,xp:step.xp};}
  function perkText(s,id){const p=benefits(s,id);return [p.speed?p.speed+'% faster':'',p.bonus?'+'+p.bonus+' per batch':''].filter(Boolean).join(' · ')||'Collect 5 batches for your first perk';}
  function card(s,r){const q=status(s,r.id),p=api.items[r.id],locked=num(s.level)<unlock(r);return '<button class="artisan-card" data-artisan-recipe="'+r.id+'" aria-pressed="'+(selected===r.id)+'" aria-label="'+esc(p.name)+', rank '+q.rank+'"><img src="'+p.icon+'" alt=""><span><strong>'+esc(p.name)+'</strong><small>'+(locked?'Level '+unlock(r):signature(s,r.id)?'★ Your signature':'Rank '+q.rank+' · '+q.name)+'</small><progress value="'+q.progress+'" max="1" aria-label="'+esc(p.name)+' mastery"></progress><small>'+q.count+' '+(q.count===1?'batch':'batches')+(q.next?' · '+(q.next.batches-q.count)+' to next rank':' · mastered')+'</small></span></button>';}
  function detail(s,id){const r=recipe(id),q=status(s,id),p=api.items[id],b=book(s),isSignature=signature(s,id),canChoose=num(s.level)>=Math.max(8,unlock(r))&&q.rank>=3;return '<section class="artisan-detail"><button class="artisan-back" id="artisan-all-recipes">↑ All recipes</button><div class="artisan-focus"><img src="'+p.icon+'" alt="'+esc(p.name)+'"><div><h3>'+esc(p.name)+'</h3><strong>Rank '+q.rank+' · '+q.name+'</strong><p>'+perkText(s,id)+'</p><small>'+q.count+' '+(q.count===1?'batch':'batches')+' collected across your farms</small></div></div><div class="artisan-actions"><button data-artisan-find="'+id+'">Ingredients & where to make it</button><button data-artisan-signature="'+id+'" '+(canChoose?'':'disabled')+'>'+(isSignature?'Remove signature':canChoose?'Make my '+(kind(r)==='kitchen'?'kitchen':'craft')+' signature':'Signature · level 8 + rank 3')+'</button></div><small class="artisan-note">One signature per workspace type. +1 item per new batch. Switching is free; queued batches keep their promised output.</small><div class="artisan-steps">'+ranks.map((step,i)=>{const claimed=(b.claimed[id]||[]).includes(i+1),earned=q.rank>i;return '<article class="artisan-step '+(earned?'artisan-earned':'')+'"><div><strong>Rank '+(i+1)+' · '+step.name+'</strong><small>'+step.batches+' batches · '+([step.speed?step.speed+'% faster':'',step.bonus?'+'+step.bonus+' item':''].filter(Boolean).join(' · ')||'Start collecting batches')+'</small></div>'+(i?'<button data-artisan-claim="'+id+'" data-rank="'+(i+1)+'" '+(!earned||claimed?'disabled':'')+'>'+(claimed?'Claimed':step.gold+' gold + '+step.xp+' XP')+'</button>':'')+'</article>';}).join('')+'</div></section>';}
  function draw(){const s=api.state(),list=recipes().filter(r=>kind(r)===station),total=list.reduce((n,r)=>n+(status(s,r.id).rank>=3?1:0),0);dialog.innerHTML='<header class="artisan-head"><div><small>MEADOW MARKETS</small><h2>Artisan mastery</h2></div><span class="artisan-summary">'+total+' / '+list.length+' skilled recipes</span><button id="artisan-listen" aria-label="Farmer Jay: artisan mastery"><img src="assets/generated/guides/jay.webp" alt="">Listen</button><button id="artisan-close" aria-label="Return to previous screen">×</button></header><nav class="artisan-nav" aria-label="Artisan workspaces"><button data-artisan-station="kitchen" aria-pressed="'+(station==='kitchen')+'">Kitchen</button><button data-artisan-station="workshop" aria-pressed="'+(station==='workshop')+'">Craft shed</button><button id="artisan-help" aria-expanded="false">How it works</button></nav><div id="artisan-explanation" class="artisan-explanation" hidden>Collect batches to grow each recipe’s skill. Helpers count; purchases and game prizes do not. At rank 3 and farm level 8 choose one signature per workspace. Perks apply to new batches. Progress and unclaimed rewards never expire.</div><main class="artisan-body"><section class="artisan-grid" aria-label="Recipes">'+list.map(r=>card(s,r)).join('')+'</section><aside class="artisan-inspector">'+detail(s,selected)+'</aside></main>';
    dialog.querySelector('#artisan-close').onclick=()=>dialog.close();dialog.querySelector('#artisan-listen').onclick=()=>window.meadowAudio?.speak('jay-artisan-mastery146');dialog.querySelector('#artisan-help').onclick=e=>{const p=dialog.querySelector('#artisan-explanation');p.hidden=!p.hidden;e.currentTarget.setAttribute('aria-expanded',String(!p.hidden));};
    dialog.querySelectorAll('[data-artisan-station]').forEach(b=>b.onclick=()=>{station=b.dataset.artisanStation;selected=recipes().find(r=>kind(r)===station).id;draw();});
    dialog.querySelectorAll('[data-artisan-recipe]').forEach(b=>b.onclick=()=>{selected=b.dataset.artisanRecipe;draw();if(matchMedia('(max-width: 680px)').matches)dialog.querySelector('.artisan-inspector').scrollIntoView({block:'start'});});
    dialog.querySelector('#artisan-all-recipes').onclick=()=>dialog.querySelector('.artisan-grid').scrollIntoView({block:'start'});
    dialog.querySelector('[data-artisan-find]').onclick=()=>{dialog.close();api.find(selected);};
    dialog.querySelector('[data-artisan-signature]').onclick=()=>{if(signature(s,selected))clear(s,station);else if(!choose(s,selected))return;api.save();api.changed?.();window.meadowAudio?.play('upgrade');draw();};
    dialog.querySelectorAll('[data-artisan-claim]').forEach(b=>b.onclick=()=>{const reward=claim(api.state(),b.dataset.artisanClaim,Number(b.dataset.rank));if(!reward)return;api.earn(reward.gold);api.xp(reward.xp);api.save();api.changed?.();window.meadowAudio?.play('reward');draw();});
  }
  function show(id){if(!api.canPlay())return api.notify('Return to your own farm first.');selected=recipe(id)?.id||recipes().find(r=>kind(r)===station).id;station=kind(recipe(selected));draw();dialog.showModal();if(!book(api.state()).heard){book(api.state()).heard=true;api.save();window.meadowAudio?.speak('jay-artisan-mastery146');}}
  function attach(a){api=a;book(api.state());dialog=document.createElement('dialog');dialog.className='artisan-dialog';dialog.id='artisan-mastery';dialog.setAttribute('aria-label','Artisan mastery');dialog.addEventListener('close',()=>window.meadowAudio?.stopVoice());document.body.append(dialog);}
  window.meadowArtisan={ranks,book,status,record,signature,benefits,output,factor,choose,clear,ready,claim,perkText,show,attach};
})();
