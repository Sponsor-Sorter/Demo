(() => {
  'use strict';
  const animalTypes=new Set(['chicken','cow','sheep','goat','alpaca']);
  const homeTypes=new Set(['coop','barn','paddock']);
  const need=(kind,icon,label,count=1)=>({kind,icon,label,count});
  // Presentation only: never settle timers, spend goods or change worker tasks here.
  function inspect(farm,rules={},now=Date.now()){
    const objects=farm?.objects||[],result=new Map(),residents=new Map();
    const homes=new Map(objects.filter(o=>homeTypes.has(o.type)).map(o=>[o.id,o]));
    for(const o of objects){if(!animalTypes.has(o.type))continue;const home=homes.get(o.coopId||o.barnId||o.paddockId);if(home){if(!residents.has(home.id))residents.set(home.id,[]);residents.get(home.id).push(o);}}
    function animalNeed(animals){
      const hungry=animals.filter(a=>a.hunger<=45),dirty=animals.filter(a=>a.clean<=35),lonely=animals.filter(a=>a.happy<=50),ready=animals.filter(a=>rules.animalReady?.(a,now));
      if(hungry.length)return need('feed','🥕','Feed '+hungry.length+(hungry.length===1?' animal':' animals'),hungry.length);
      if(dirty.length)return need('clean','🧹','Brush or clean '+dirty.length+(dirty.length===1?' animal':' animals'),dirty.length);
      if(lonely.length)return need('play','❤️','Give attention to '+lonely.length+(lonely.length===1?' animal':' animals'),lonely.length);
      if(ready.length)return need('collect','🧺','Collect produce from '+ready.length+(ready.length===1?' animal':' animals'),ready.length);
      return null;
    }
    for(const o of objects){let status=null;
      if(homeTypes.has(o.type))status=animalNeed(residents.get(o.id)||[]);
      else if(animalTypes.has(o.type)){if(!(o.coopId||o.barnId||o.paddockId)||!homes.has(o.coopId||o.barnId||o.paddockId))status=animalNeed([o]);}
      else if(['tree','orchard'].includes(o.type)&&rules.fruitReady?.(o,now))status=need('fruit','🍎','Apples ready to collect');
      else if(o.type==='hive'){
        if(o.honey>0)status=need('honey','🍯',o.honey+' honey '+(o.honey===1?'jar':'jars')+' ready to collect',o.honey);
        else if(!objects.some(f=>f.type==='flowers'&&Math.abs(f.x-o.x)+Math.abs(f.y-o.y)<=4&&f.plantedAt>0))status=need('flowers','🌼','Place flowers within four tiles to supply this hive');
      }else if(o.type==='flowers'&&o.plantedAt>0&&o.plantedAt+240000<=now){
        // A blooming patch is doing useful work beside a hive; do not ask players
        // to remove its nectar and interrupt that pollination loop.
        if(!objects.some(h=>h.type==='hive'&&Math.abs(h.x-o.x)+Math.abs(h.y-o.y)<=4))status=need('nectar','🌸','Flower nectar ready to collect');
      }else if(['kitchen','workshop'].includes(o.type)){
        const s=rules.station?.(o,now);if(s?.ready)status=need('batches','🧺',s.ready+' finished '+(s.ready===1?'batch':'batches')+' to collect',s.ready);
        else if(s?.idle)status=need('recipe',o.type==='kitchen'?'🥣':'🧶','Choose a '+(o.type==='kitchen'?'kitchen':'craft')+' recipe');
      }else if(o.type==='stall'&&!Object.values(farm.shop?.stock||{}).some(n=>n>0)&&Object.values(farm.inventory||{}).some(n=>n>0))status=need('stock','🧺','Shop shelves are empty — stock goods from your basket');
      if(status)result.set(o.id,status);
    }
    return result;
  }
  window.meadowAttention={inspect};
})();
