(() => {
  'use strict';
  function connect(state){
    const farms=state.farms||{},home=farms.willow;if(!home)return;
    const basket=home.inventory||state.inventory||{};
    if(!state.sharedPantryVersion){
      // Eastbank and Back Pasture already shared Willow's basket. JSON restores
      // contain copies of that basket, which must never be counted again.
      const seen=new Set([basket]);
      for(const [id,f] of Object.entries(farms)){
        if(['willow','east','back'].includes(id)||!f.inventory||seen.has(f.inventory))continue;
        seen.add(f.inventory);
        for(const [k,n] of Object.entries(f.inventory))if(Number.isFinite(n)&&n>0&&k!=='__proto__')basket[k]=(Number(basket[k])||0)+Math.floor(n);
      }
      state.sharedPantryVersion=1;
    }
    state.inventory=basket;for(const f of Object.values(farms))f.inventory=basket;
    return basket;
  }
  function canDeliver(order,basket){return Object.entries(order.ask||{}).every(([k,n])=>(basket[k]||0)>=n)}
  function deliver(farm,id){const i=farm.orders.findIndex(o=>o.id===id);if(i<0)return null;const o=farm.orders[i];if(!canDeliver(o,farm.inventory))return null;for(const[k,n]of Object.entries(o.ask))farm.inventory[k]-=n;farm.orders.splice(i,1);return o}
  window.meadowPantry={connect,canDeliver,deliver};
})();
