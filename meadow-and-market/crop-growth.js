(() => {
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n));
  function near(plot,flower){const side=Math.max(1,Math.min(4,1+Math.floor(Number(plot.tier)||0))),dx=Math.max(plot.x-flower.x,0,flower.x-(plot.x+side-1)),dy=Math.max(plot.y-flower.y,0,flower.y-(plot.y+side-1));return dx+dy<=4}
  function calculate(p,crop,objects,now=Date.now()){
    if(!p.plantedAt)return {progress:0,stage:p.stage||0,bonusMs:0,remainingMs:0};
    const duration=Math.max(1,Number(crop.time)*3),from=Math.max(p.plantedAt,Number(p.growthSettledAt)||p.plantedAt),flowers=objects.filter(f=>f.type==='flowers'&&Number(f.plantedAt)>0&&near(p,f)),starts=flowers.map(f=>f.plantedAt+240000),active=starts.filter(t=>t<=now),start=active.length?Math.max(from,Math.min(...active)):now,bonusMs=Math.max(0,Number(p.growthBonusMs)||0)+Math.max(0,now-start)*.18,elapsed=Math.max(0,now-p.plantedAt)+bonusMs,progress=clamp(elapsed/duration),work=Math.max(0,duration-elapsed),next=starts.filter(t=>t>now).sort((a,b)=>a-b)[0];
    const packMs=window.meadowPackBoosts?.extra('crop',p,p.plantedAt,now)||0,boosted=clamp((elapsed+packMs)/duration),left=Math.max(0,work-packMs);
    const remainingMs=window.meadowPackBoosts?.remaining('crop',p,left,now,active.length?1.18:1,next?[{at:next,rate:1.18}]:[])??(active.length?left/1.18:next&&left>next-now?(next-now)+(left-(next-now))/1.18:left);
    return {progress:boosted,stage:boosted>=1?3:boosted<.2?0:boosted<.48?1:2,bonusMs,packMs,remainingMs};
  }
  function settle(farm,items,now=Date.now()){if(window.meadowCommandUI?.required())return;const flowers=farm.objects.filter(o=>o.type==='flowers');for(const p of farm.objects.filter(o=>o.type==='plot'&&o.plantedAt)){const g=calculate(p,items[p.crop]||items.carrot,flowers,now);p.growthBonusMs=g.bonusMs;p.growthSettledAt=now}}
  function start(p,id,now=Date.now()){p.crop=id;p.plantedAt=now;p.stage=1;p.wateredUntil=0;p.growthBonusMs=0;p.growthSettledAt=now}
  window.meadowCropGrowth={calculate,settle,start,near};
})();
