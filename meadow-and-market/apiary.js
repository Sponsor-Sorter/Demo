(() => {
  'use strict';
  const capacities=[3,5,8],intervals=[120000,90000,60000];
  let api;
  const $=s=>document.querySelector(s),tier=o=>Math.max(0,Math.min(2,Math.floor(Number(o.tier)||0)));
  function blooms(f,h){return f.objects.filter(o=>o.type==='flowers'&&Math.abs(o.x-h.x)+Math.abs(o.y-h.y)<=4)}
  function settle(f,h,now=Date.now()){
    const t=tier(h),cap=capacities[t];h.honey=Math.max(0,Math.min(cap,Number(h.honey)||0));
    if(!Number.isFinite(h.lastHoneyAt)){h.lastHoneyAt=now;return 0}
    const flowering=blooms(f,h).filter(o=>Number(o.plantedAt)>0&&o.plantedAt+240000<=now);
    if(!flowering.length||h.honey>=cap){h.lastHoneyAt=now;return 0}
    const start=Math.max(h.lastHoneyAt,Math.min(...flowering.map(o=>o.plantedAt+240000)));
    const count=Math.min(cap-h.honey,Math.floor(Math.max(0,now-start)/intervals[t]));
    if(count){h.honey+=count;h.lastHoneyAt=h.honey>=cap?now:start+count*intervals[t]}
    return count;
  }
  function collect(f,h){settle(f,h);const n=h.honey||0;if(!n)return 0;f.inventory.honey=(f.inventory.honey||0)+n;h.honey=0;return n}
  function harvest(f,h){const n=collect(f,h);if(!n)return 0;api.xp(n*4);api.event?.('honey',n);api.save();api.render();window.meadowAudio?.play('honey');api.notify('Collected '+n+' jars of meadow honey');return n}
  function settleAll(){let n=0;for(const f of Object.values(api.farms()))for(const h of f.objects.filter(o=>o.type==='hive'))n+=settle(f,h);if(n)api.save();return n}
  function status(f,h){const nearby=blooms(f,h),active=nearby.some(o=>Number(o.plantedAt)>0&&o.plantedAt+240000<=Date.now());return {nearby,active,full:h.honey>=capacities[tier(h)],remaining:Math.max(0,Math.ceil((intervals[tier(h)]-(Date.now()-(h.lastHoneyAt||Date.now())))/1000))}}
  function statusText(f,h){const s=status(f,h);return !s.nearby.length?'Plant a flower patch within four tiles.':!s.active?'Waiting for nearby flowers to bloom.':s.full?'Honey jars are full — collect your harvest.':'Bees are foraging · next honey in '+s.remaining+' seconds.'}
  function show(h){
    window.meadowAudio?.play('bees');
    const f=api.current();if(settle(f,h))api.save();const t=tier(h),cost=[180,420][t],names=['Garden beehive','Meadow beehive','Grand artisan hive'];
    api.modal('<div class="sheet-head"><div><small class="eyebrow">BEEKEEPING · LEVEL '+(t+1)+' / 3</small><h2>'+names[t]+'</h2></div><button class="close-button" data-close="modal-dialog">×</button></div><img class="hive-preview" src="assets/generated/apiary/hive-'+t+'.webp" alt="'+names[t]+'"><p>Bees forage from fully blooming flower patches within four tiles. Flowers keep helping your hive until you collect their nectar and start their next growing cycle.</p><div class="stats-row"><div class="stat-card"><span>Honey stored</span><b id="hive-amount">'+(h.honey||0)+' / '+capacities[t]+'</b></div><div class="stat-card"><span>Production time</span><b>'+intervals[t]/1000+' seconds</b></div></div><p id="hive-status" class="sheet-copy">'+statusText(f,h)+'</p><button class="primary-button full-button" id="hive-collect" '+(h.honey?'':'disabled')+'>Collect honey</button><p class="sheet-copy">Sell honey for 30 gold, stock your shop, or bake honey cakes in the farm kitchen. Your hive works while you are away and pauses when its jars are full.</p>'+(t<2?'<button class="small-button full-button" id="hive-upgrade" '+(api.coins()>=cost?'':'disabled')+'>Upgrade hive · '+cost+' gold · '+capacities[t+1]+' jars</button><p class="sheet-copy">Each upgrade adds a new hive box and faster honey production. The ground footprint stays one tile. A new production cycle starts after upgrading.</p>':'<p>Your artisan hive is fully upgraded.</p>'));
    $('#hive-collect').onclick=()=>{if(harvest(f,h))show(h)};
    $('#hive-upgrade')?.addEventListener('click',()=>{if(t>=2||!api.spend(cost))return;settle(f,h);h.tier=t+1;h.lastHoneyAt=Date.now();api.save();api.render();window.meadowAudio?.play('upgrade');show(h)});
    $('#hive-status').dataset.hive=h.id;
  api.moveControls?.(h);}
  function tick(){if(document.hidden)return;settleAll();const id=$('#hive-status')?.dataset.hive;if(!id)return;const h=api.current().objects.find(o=>o.id===id);if(!h)return;$('#hive-amount').textContent=(h.honey||0)+' / '+capacities[tier(h)];$('#hive-status').textContent=statusText(api.current(),h);$('#hive-collect').disabled=!h.honey}
  window.meadowApiary={settle,collect,harvest,settleAll,show,capacities,intervals,attach(adapter){api=adapter;settleAll();setInterval(tick,1000)}};
})();

