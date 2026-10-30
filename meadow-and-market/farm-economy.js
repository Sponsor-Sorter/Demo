(() => {
  'use strict';
  // Receipt effects are also applied by the database. This is a display rebase,
  // never permission to award something: only an accepted save returns a patch.
  const clone=v=>JSON.parse(JSON.stringify(v));
  const cursor=s=>Number.isSafeInteger(s?._farmEconomy?.cursor)?s._farmEconomy.cursor:0;
  function apply(state,patch){
    if(!patch||patch.version!==1)return false;
    const at=cursor(state);
    if(at===patch.to&&state._farmEconomy?.version===1)return false;
    if(at!==patch.from)throw Error('Farm rewards changed on another save. Review the online farm.');
    state.club ||= {};state.club.applied ||= [];
    for(const r of patch.receipts||[]){
      const d=r.delivery||{};
      state.coins+=(Number(d.gold)||0);
      if(d.xp){state.xp+=d.xp;const threshold=90+(state.level-1)*50;if(state.xp>=threshold){state.xp-=threshold;state.level++;state.coins+=35;}}
      if(d.game&&r.kind!=='reward_turn'){
        state.minigames ||= {records:{},rewards:{}};state.minigames.rewards ||= {};
        const key=r.created_at.slice(0,10)+':'+d.game;
        state.minigames.rewards[key]=(state.minigames.rewards[key]||0)+1;
      }
      const home=state.farms?.[d.map]||state.farms?.[state.active]||state.farms?.willow;
      const bag=state.sharedPantryVersion?state.farms?.willow?.inventory:home?.inventory;
      for(const [id,n]of Object.entries(d.items||{}))bag[id]=(bag[id]||0)+n;
      for(const key of ['well_watering','well_upgrade','queue_slot','speed']){
        const q=d[key];if(!q)continue;
        const f=state.farms?.[q.map];
        const o=f?.objects.find(o=>o.id===q.target)||(!q.map?Object.values(state.farms||{}).flatMap(f=>f.objects||[]).find(o=>o.id===q.target):null);
        if(!o)continue;
        if(key==='well_watering'&&o.type==='well')o.autoWater=true;
        if(key==='well_upgrade'&&o.type==='well')o.wellGemTier=Math.max(Number(o.wellGemTier)||0,Math.min(4,q.level));
        if(key==='queue_slot'&&['kitchen','workshop'].includes(o.type))o.queueSlots=Math.max(Number(o.queueSlots)||0,Math.min(8,q.level));
        if(key==='speed'){
          const ms=q.minutes*60000;
          const basis=q.basis?.[q.map||Object.keys(state.farms).find(id=>state.farms[id].objects.includes(o))];
          if(o.type==='plot'&&o.plantedAt&&(!q.basis||o.plantedAt===basis?.plantedAt))o.plantedAt-=ms;
          for(const j of o.jobs||[])if(!q.basis||basis?.jobs?.some(b=>b.id===j.id&&b.startAt===j.startAt&&b.finishAt===j.finishAt)){j.startAt-=ms;j.finishAt-=ms;}
        }
      }
      if(!state.club.applied.includes(r.id))state.club.applied.push(r.id);
    }
    if(state.sharedPantryVersion){const bag=state.farms.willow.inventory;state.inventory=bag;for(const f of Object.values(state.farms))f.inventory=bag;}
    state._farmEconomy={version:1,cursor:patch.to};
    return true;
  }
  function rebase(snapshot,patches){const next=clone(snapshot);for(const p of patches)if(cursor(next)===p.from&&!(next._farmEconomy?.version===1&&p.from===p.to))apply(next,p);return next;}
  let api;
  async function reconcile(){
    const owner=api.user()?.id,basis=cursor(api.state());
    if(!owner)throw Error('Sign in before reviewing farm rewards.');
    const r=await api.client().rpc('meadow_market_rebase_farm_rewards',{p_from_cursor:basis});
    if(owner!==api.user()?.id||api.canReconcile?.()===false)throw Error('Farm account changed during review.');
    if(r.error)throw Error(r.error.message);
    const next=rebase(api.state(),r.data.patches);
    if(cursor(next)!==r.data.cursor)throw Error('Load the online farm to recover its newer rewards.');
    for(const patch of r.data.patches)apply(api.state(),patch);
    api.state()._farmEconomy={version:1,cursor:r.data.cursor};
    return r.data.revision;
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function show(){
    if(!api?.ready())return api?.notify('Connect online to see your saved farm activity.');
    const owner=api.user()?.id;
    try{
      await api.flush();
      const r=await api.client().rpc('meadow_market_farm_ledger');
      if(owner!==api.user()?.id||!api.ready())return;
      if(r.error)throw Error(r.error.message);
      const data=r.data,amount=n=>(n>0?'+':'')+Number(n).toLocaleString();
      const label=k=>k==='gold'?'gold':k==='xp'?'XP':k==='level'?'level':(k.startsWith('shelves:')?'On shelves · ':'')+(api.items[k.split(':').at(-1)]?.name||k.split(':').at(-1));
      api.modal('<div class="sheet-head"><div><small class="eyebrow">YOUR SAVED FARM</small><h2>Gold & basket history</h2></div><button class="small-button" id="farm-history-listen" aria-label="Farmer Rhys: saved farm activity">🔊</button><button class="close-button" data-close="modal-dialog" aria-label="Return to farm">×</button></div><p class="sheet-copy">'+Number(data.balances?.gold||0).toLocaleString()+' gold · latest 25 changes</p>'+data.entries.map(e=>{
        const entries=Object.entries(e.changes),gold=e.changes.gold;
        return '<details class="settings-section"><summary>'+({'legacy_baseline':'Opening balance','legacy_snapshot':'Farm activity','server_receipt':'Account reward','verified_action':'Farm activity','server_refund':'Purchase refund'})[e.lane]+' · '+(gold===undefined?entries.length+(entries.length===1?' change':' changes'):amount(gold)+' gold')+'</summary><small>'+esc(new Date(e.created_at).toLocaleString())+'</small>'+entries.map(([k,n])=>'<div class="task-row"><span>'+esc(label(k))+'</span><strong>'+esc(amount(n))+'</strong></div>').join('')+'</details>';
      }).join('')+(data.entries.length?'':'<p>Your next saved farm action will appear here.</p>'));
      document.querySelector('#farm-history-listen').onclick=()=>window.meadowAudio?.speak('rhys-history189');
    }catch(e){if(owner===api.user()?.id)api.notify('Farm history is unavailable: '+e.message);}
  }
  window.meadowEconomy={apply,rebase,cursor,show,reconcile,attach:a=>{api=a}};
})();
